import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  PermissionsAndroid,
  Platform,
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import { KNOWN_DEVICES, FOOT_DEVICE, DeviceConfig } from '../constants/ble';
import {
  unpackIMU,
  deriveMetrics,
  detectStep,
  updatePace,
  resetStepDetector,
  resetPace,
  RawIMU,
  DerivedMetrics,
  ROLL_WARN_THRESHOLD,
} from '../utils/imuMath';
import { saveSession } from '../utils/sessionStore';

// Types -----------------------------------------------------------------------

export interface BleDevice {
  id: string;
  name: string;
  rssi?: number;
}

interface BleContextValue {
  // Connection state
  isScanning: boolean;
  devices: BleDevice[];
  connectedDeviceId: string | null;
  connectionStatus: string;
  isConnected: boolean;

  // Live data
  rawIMU: RawIMU | null;
  derived: DerivedMetrics | null;

  // Classification (from Arduino TinyML)
  walking: boolean;

  // Session stats
  stepCount: number;
  pace: number; // steps per minute

  // Recording
  isRecording: boolean;
  startSession: () => void;
  stopSession: () => Promise<void>;

  // Actions
  startScan: () => Promise<void>;
  connect: (deviceId: string, deviceName: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

// Context setup ---------------------------------------------------------------

const BleContext = createContext<BleContextValue | null>(null);

export function useBle(): BleContextValue {
  const ctx = useContext(BleContext);
  if (!ctx) throw new Error('useBle must be used inside BleProvider');
  return ctx;
}

// Provider --------------------------------------------------------------------


export function BleProvider({ children }: { children: React.ReactNode }) {
  const [isScanning, setIsScanning]             = useState(false);
  const [devices, setDevices]                   = useState<BleDevice[]>([]);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [rawIMU, setRawIMU]                     = useState<RawIMU | null>(null);
  const [derived, setDerived]                   = useState<DerivedMetrics | null>(null);
  const [walking, setWalking]                   = useState(false);
  const [stepCount, setStepCount]               = useState(0);
  const [pace, setPace]                         = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);

  const connectionStartTime = useRef<number>(0);
  const activeConfig        = useRef<DeviceConfig>(FOOT_DEVICE);

  // Recording counters — only accumulate while isRecording is true
  const sessionStartTime  = useRef<number>(0);
  const stepCountAtStart  = useRef<number>(0);
  const totalReadings     = useRef<number>(0);
  const correctReadings   = useRef<number>(0);
  const walkingReadings   = useRef<number>(0);
  const footAngleSum      = useRef<number>(0);

  // Throttle: only push a UI update every 100ms (10Hz) regardless of 50Hz BLE stream
  const lastUIUpdate = useRef<number>(0);

  const isConnected = connectedDeviceId !== null;

  // Keep ref in sync so the BLE listener always sees the current value
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // Initialise BLE on mount ----------------------------------------------------

  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
      }
      await BleManager.start({ showAlert: false });
    };

    init();

    // BLE event listeners -------------------------------------------------------

    const onDiscover = BleManager.onDiscoverPeripheral((peripheral) => {
      const { id, name, rssi } = peripheral;
      if (!name) return;
      setDevices(prev => {
        if (prev.some(d => d.id === id)) return prev;
        console.log('Discovered device:', id, name);
        return [...prev, { id, name, rssi }];
      });
    });

    const onDisconnect = BleManager.onDisconnectPeripheral((data) => {
      if (data.peripheral === connectedDeviceId) {
        setConnectedDeviceId(null);
        setConnectionStatus('Disconnected');
        setRawIMU(null);
        setDerived(null);
        setWalking(false);
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    });

    const onValueUpdate = BleManager.onDidUpdateValueForCharacteristic((data) => {
      const now = Date.now();

      // Parse regardless — needed for step detection
      const timestamp = now - connectionStartTime.current;
      const imu = unpackIMU(data.value, timestamp);
      console.log('Received IMU data:', imu);
      const metrics = deriveMetrics(imu);

      // Step detection only runs when the TinyML classifier says walking
      const isStep = imu.walking && detectStep(metrics.totalAccel, timestamp);
      if (isStep) {
        setStepCount(prev => prev + 1);
        setPace(updatePace(timestamp));
      }

      // Accumulate recording stats on every sample while a session is active
      if (isRecordingRef.current) {
        totalReadings.current++;
        if (Math.abs(metrics.roll) <= ROLL_WARN_THRESHOLD) correctReadings.current++;
        if (imu.walking) walkingReadings.current++;
        footAngleSum.current += imu.footAngle;
      }

      // Throttle UI renders to 10Hz
      if (now - lastUIUpdate.current < 500) return;
      lastUIUpdate.current = now;

      setRawIMU(imu);
      setDerived(metrics);
      setWalking(imu.walking);
    });

    return () => {
      onDiscover.remove();
      onDisconnect.remove();
      onValueUpdate.remove();
    };
  }, [connectedDeviceId]);

  // Actions -------------------------------------------------------------------

  const startScan = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const allGranted = Object.values(granted).every(
        v => v === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        console.warn('Bluetooth permissions denied');
        setIsScanning(false);
        return;
      }
    }

    setDevices([]);
    setIsScanning(true);
    try {
      await BleManager.scan({ seconds: 5, allowDuplicates: true });
      setTimeout(async () => {
        await BleManager.stopScan();
        const peripherals = await BleManager.getDiscoveredPeripherals();
        setDevices(
          peripherals
            .filter(p => p.name)
            .map(p => ({
              id:   p.id,
              name: p.name!,
              rssi: p.rssi,
            }))
        );
        setIsScanning(false);
      }, 5500);
    } catch (e) {
      console.error('Scan error:', e);
      setIsScanning(false);
    }
  }, []);

  const connect = useCallback(async (deviceId: string, deviceName: string) => {
    setConnectionStatus('Connecting...');
    try {
      await BleManager.connect(deviceId);
      await BleManager.retrieveServices(deviceId);

      if (Platform.OS === 'android') {
        const negotiatedMTU = await BleManager.requestMTU(deviceId, 64);
        console.log('[BLE] Negotiated MTU:', negotiatedMTU);
      }

      connectionStartTime.current = Date.now();
      resetStepDetector();
      resetPace();
      setStepCount(0);
      setPace(0);

      // Try each known device config until one succeeds
      let matchedConfig = FOOT_DEVICE;
      let notificationStarted = false;
      for (const candidate of KNOWN_DEVICES) {
        try {
          await BleManager.startNotification(deviceId, candidate.serviceUUID, candidate.charUUID);
          matchedConfig = candidate;
          notificationStarted = true;
          break;
        } catch {
          // try next
        }
      }
      if (!notificationStarted) {
        throw new Error('No matching service UUID found on device');
      }
      activeConfig.current = matchedConfig;

      console.log('[BLE] Connected to device:', deviceId);
      console.log('[BLE] Notifications started on', matchedConfig.serviceUUID, '/', matchedConfig.charUUID);

      setConnectedDeviceId(deviceId);
      setConnectionStatus(`Connected to ${matchedConfig.name}`);
    } catch (e: any) {
      console.error('Connect error:', e);
      setConnectionStatus(`Failed: ${e?.message ?? 'unknown error'}`);
      setConnectedDeviceId(null);
    }
  }, []);

  const startSession = useCallback(() => {
    sessionStartTime.current  = Date.now();
    stepCountAtStart.current  = stepCount;
    totalReadings.current     = 0;
    correctReadings.current   = 0;
    walkingReadings.current   = 0;
    footAngleSum.current      = 0;
    isRecordingRef.current = true;
    setIsRecording(true);
  }, [stepCount]);

  const stopSession = useCallback(async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);

    const durationSecs   = Math.round((Date.now() - sessionStartTime.current) / 1000);
    const sessionSteps   = stepCount - stepCountAtStart.current;
    const total          = totalReadings.current;

    if (total === 0 || durationSecs < 5) return; // discard accidental taps

    await saveSession({
      id:             Date.now().toString(),
      date:           new Date(sessionStartTime.current).toISOString(),
      durationSecs,
      steps:          sessionSteps,
      avgPace:        pace,
      percentCorrect: Math.round((correctReadings.current / total) * 100),
      walkingPct:     Math.round((walkingReadings.current / total) * 100),
      avgFootAngle:   parseFloat((footAngleSum.current / total).toFixed(1)),
    });
  }, [isRecording, stepCount, pace]);

  const disconnect = useCallback(async () => {
    if (!connectedDeviceId) return;
    const { serviceUUID, charUUID } = activeConfig.current;
    try {
      await BleManager.stopNotification(connectedDeviceId, serviceUUID, charUUID);
      await BleManager.disconnect(connectedDeviceId);
    } catch (e) {
      console.error('Disconnect error:', e);
    }
    setConnectedDeviceId(null);
    setConnectionStatus('Disconnected');
    setRawIMU(null);
    setDerived(null);
    setWalking(false);
  }, [connectedDeviceId]);

  // ---------------------------------------------------------------------------

  return (
    <BleContext.Provider value={{
      isScanning, devices, connectedDeviceId, connectionStatus, isConnected,
      rawIMU, derived,
      walking,
      stepCount, pace,
      isRecording, startSession, stopSession,
      startScan, connect, disconnect,
    }}>
      {children}
    </BleContext.Provider>
  );
}
