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
import { FOOT_DEVICE, ANKLE_DEVICE, DeviceConfig } from '../constants/ble';
import {
  unpackIMU,
  deriveMetrics,
  detectStep,
  updatePace,
  resetStepDetector,
  resetPace,
  RawIMU,
  DerivedMetrics,
  ANGLE_WARN_THRESHOLD,
  WALK_ANGLE_WARN_THRESHOLD,
  normalizeAngleDegrees,
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
  calibratedFootAngle: number | null;
  isCalibrating: boolean;
  isCalibrated: boolean;

  // Classification (from Arduino TinyML)
  walking: boolean;

  // Session stats
  stepCount: number;
  pace: number; // steps per minute

  // Recording
  isRecording: boolean;
  elapsedSeconds: number;
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
  const [calibratedFootAngle, setCalibratedFootAngle] = useState<number | null>(null);
  const [isCalibrating, setIsCalibrating]             = useState(false);
  const [isCalibrated, setIsCalibrated]               = useState(false);
  const [walking, setWalking]                   = useState(false);
  const [stepCount, setStepCount]               = useState(0);
  const [pace, setPace]                         = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isRecordingRef = useRef(false);
  const isCalibratingRef = useRef(false);
  const isCalibratedRef = useRef(false);

  const connectionStartTime   = useRef<number>(0);
  const activeConfig          = useRef<DeviceConfig>(FOOT_DEVICE);
  const connectedDeviceIdRef  = useRef<string | null>(null);
  const stepCountRef          = useRef(0);

  // Recording counters — only accumulate while isRecording is true
  const sessionStartTime  = useRef<number>(0);
  const stepCountAtStart  = useRef<number>(0);
  const totalReadings     = useRef<number>(0);
  const correctReadings   = useRef<number>(0);
  const walkingReadings   = useRef<number>(0);
  const footAngleSum      = useRef<number>(0);
  const footAngleOffset   = useRef(0);
  const calibrationStartTimestamp = useRef<number | null>(null);
  const calibrationAngleSum       = useRef(0);
  const calibrationSampleCount    = useRef(0);
  const prevRawFootAngle          = useRef(0);

  // Throttle: only push a UI update every 100ms (10Hz) regardless of 50Hz BLE stream
  const lastUIUpdate = useRef<number>(0);
  const CALIBRATION_DURATION_MS = 2000;

  const isConnected = connectedDeviceId !== null;

  // Keep refs in sync so BLE listeners always see current values without re-registering
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isCalibratingRef.current = isCalibrating; }, [isCalibrating]);
  useEffect(() => { isCalibratedRef.current = isCalibrated; }, [isCalibrated]);
  useEffect(() => { connectedDeviceIdRef.current = connectedDeviceId; }, [connectedDeviceId]);
  useEffect(() => { stepCountRef.current = stepCount; }, [stepCount]);

  // Session timer — ticks every second while recording
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

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
      await BleManager.start({ showAlert: false, restoreIdentifier: 'muc-group07-ble' });
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
      if (data.peripheral === connectedDeviceIdRef.current) {
        setConnectedDeviceId(null);
        setConnectionStatus('Disconnected');
        setRawIMU(null);
        setDerived(null);
        setCalibratedFootAngle(null);
        setIsCalibrating(false);
        setIsCalibrated(false);
        setWalking(false);
        setDevices([]);
        isRecordingRef.current = false;
        isCalibratingRef.current = false;
        isCalibratedRef.current = false;
        footAngleOffset.current = 0;
        calibrationStartTimestamp.current = null;
        calibrationAngleSum.current = 0;
        calibrationSampleCount.current = 0;
        setIsRecording(false);
      }
    });

    const onValueUpdate = BleManager.onDidUpdateValueForCharacteristic((data) => {
      const now = Date.now();

      // Parse regardless — needed for step detection
      const timestamp = now - connectionStartTime.current;
      const serviceUUID = data.service?.toLowerCase();
      const packetSource =
        serviceUUID === FOOT_DEVICE.serviceUUID.toLowerCase() ? 'foot' :
        serviceUUID === ANKLE_DEVICE.serviceUUID.toLowerCase() ? 'ankle' :
        'unknown';

      const imu = unpackIMU(data.value, timestamp, packetSource);
      console.log('Received IMU data:', imu);
      const metrics = deriveMetrics(imu);

      // Drift compensation: when standing still AND angle is stable, slowly adapt
      // offset to track and cancel gyroscope yaw drift. The stability check
      // (rawChange < 0.5°) prevents the offset from shifting when the foot is
      // actively rotated while standing.
      if (isRecordingRef.current && isCalibratedRef.current && !isCalibratingRef.current && !imu.walking) {
        const rawChange = Math.abs(imu.footAngle - prevRawFootAngle.current);
        if (rawChange < 0.5) {
          footAngleOffset.current += (imu.footAngle - footAngleOffset.current) * 0.005;
        }
      }
      prevRawFootAngle.current = imu.footAngle;

      // Sign is flipped so that outward flare reads as positive
      const currentCalibratedFootAngle = isCalibratedRef.current
        ? normalizeAngleDegrees(-(imu.footAngle - footAngleOffset.current))
        : null;

      // Step detection only runs when the TinyML classifier says walking
      const isStep = imu.walking && detectStep(metrics.totalAccel, timestamp);
      if (isStep) {
        setStepCount(prev => prev + 1);
        setPace(updatePace(timestamp));
      }

      if (isRecordingRef.current && isCalibratingRef.current) {
        if (calibrationStartTimestamp.current === null) {
          calibrationStartTimestamp.current = timestamp;
        }

        calibrationAngleSum.current += imu.footAngle;
        calibrationSampleCount.current += 1;

        const calibrationElapsed = timestamp - calibrationStartTimestamp.current;
        if (calibrationElapsed >= CALIBRATION_DURATION_MS && calibrationSampleCount.current > 0) {
          footAngleOffset.current = calibrationAngleSum.current / calibrationSampleCount.current;
          calibrationStartTimestamp.current = null;
          calibrationAngleSum.current = 0;
          calibrationSampleCount.current = 0;

          isCalibratingRef.current = false;
          isCalibratedRef.current = true;
          setIsCalibrating(false);
          setIsCalibrated(true);
          setCalibratedFootAngle(0);

          // Start actual stats only after the neutral stance calibration finishes.
          sessionStartTime.current = Date.now();
          stepCountAtStart.current = stepCountRef.current;
          totalReadings.current = 0;
          correctReadings.current = 0;
          walkingReadings.current = 0;
          footAngleSum.current = 0;
          setElapsedSeconds(0);
        }
      }

      // Accumulate recording stats only after calibration has completed.
      if (isRecordingRef.current && currentCalibratedFootAngle !== null) {
        totalReadings.current++;
        const warnThreshold = imu.walking ? WALK_ANGLE_WARN_THRESHOLD : ANGLE_WARN_THRESHOLD;
        if (Math.abs(currentCalibratedFootAngle) <= warnThreshold) correctReadings.current++;
        if (imu.walking) walkingReadings.current++;
        footAngleSum.current += currentCalibratedFootAngle;
      }

      // Throttle UI renders to 10Hz
      if (now - lastUIUpdate.current < 500) return;
      lastUIUpdate.current = now;

      setRawIMU(imu);
      setDerived(metrics);
      setCalibratedFootAngle(currentCalibratedFootAngle);
      setWalking(imu.walking);
    });

    return () => {
      onDiscover.remove();
      onDisconnect.remove();
      onValueUpdate.remove();
    };
  }, []);

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

  const connect = useCallback(async (deviceId: string, _deviceName: string) => {
    setConnectionStatus('Connecting...');
    try {
      await Promise.race([
        BleManager.connect(deviceId),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timed out')), 10000)
        ),
      ]);
      await BleManager.retrieveServices(deviceId, [FOOT_DEVICE.serviceUUID]);

      if (Platform.OS === 'android') {
        const negotiatedMTU = await BleManager.requestMTU(deviceId, 64);
        console.log('[BLE] Negotiated MTU:', negotiatedMTU);
      }

      connectionStartTime.current = Date.now();
      lastUIUpdate.current = 0;
      resetStepDetector();
      resetPace();
      setStepCount(0);
      setPace(0);

      await BleManager.startNotification(deviceId, FOOT_DEVICE.serviceUUID, FOOT_DEVICE.charUUID);
      activeConfig.current = FOOT_DEVICE;

      console.log('[BLE] Connected to device:', deviceId);
      console.log('[BLE] Notifications started on', FOOT_DEVICE.serviceUUID, '/', FOOT_DEVICE.charUUID);

      setConnectedDeviceId(deviceId);
      setConnectionStatus(`Connected to ${FOOT_DEVICE.name}`);
    } catch (e: any) {
      console.error('Connect error:', e);
      setConnectionStatus(`Failed: ${e?.message ?? 'unknown error'}`);
      setConnectedDeviceId(null);
    }
  }, []);

  const startSession = useCallback(() => {
    sessionStartTime.current  = Date.now();
    stepCountAtStart.current  = stepCountRef.current;
    totalReadings.current     = 0;
    correctReadings.current   = 0;
    walkingReadings.current   = 0;
    footAngleSum.current      = 0;
    footAngleOffset.current   = 0;
    calibrationStartTimestamp.current = null;
    calibrationAngleSum.current = 0;
    calibrationSampleCount.current = 0;
    isCalibratingRef.current  = true;
    isCalibratedRef.current   = false;
    setIsCalibrating(true);
    setIsCalibrated(false);
    setCalibratedFootAngle(null);
    resetStepDetector();
    resetPace();
    setStepCount(0);
    setPace(0);
    setElapsedSeconds(0);
    isRecordingRef.current = true;
    setIsRecording(true);
  }, []);

  const stopSession = useCallback(async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    isCalibratingRef.current = false;
    isCalibratedRef.current = false;
    setIsRecording(false);
    setIsCalibrating(false);
    setIsCalibrated(false);
    setCalibratedFootAngle(null);

    const durationSecs   = Math.round((Date.now() - sessionStartTime.current) / 1000);
    const sessionSteps   = stepCount - stepCountAtStart.current;
    const total          = totalReadings.current;

    footAngleOffset.current = 0;
    calibrationStartTimestamp.current = null;
    calibrationAngleSum.current = 0;
    calibrationSampleCount.current = 0;

    if (total === 0 || durationSecs < 5) return; // discard accidental taps

    await saveSession({
      id:             Date.now().toString(),
      date:           new Date(sessionStartTime.current).toISOString(),
      durationSecs,
      steps:          sessionSteps,
      avgPace:        Math.round(pace),
      percentCorrect: Math.round((correctReadings.current / total) * 100),
      walkingPct:     Math.round((walkingReadings.current / total) * 100),
      avgFootAngle:   parseFloat((footAngleSum.current / total).toFixed(1)),
    });
  }, [stepCount, pace]);

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
    setCalibratedFootAngle(null);
    setIsCalibrating(false);
    setIsCalibrated(false);
    setWalking(false);
    setDevices([]);
    isCalibratingRef.current = false;
    isCalibratedRef.current = false;
    footAngleOffset.current = 0;
    calibrationStartTimestamp.current = null;
    calibrationAngleSum.current = 0;
    calibrationSampleCount.current = 0;
  }, [connectedDeviceId]);

  // ---------------------------------------------------------------------------

  return (
    <BleContext.Provider value={{
      isScanning, devices, connectedDeviceId, connectionStatus, isConnected,
      rawIMU, derived, calibratedFootAngle, isCalibrating, isCalibrated,
      walking,
      stepCount, pace,
      isRecording, elapsedSeconds, startSession, stopSession,
      startScan, connect, disconnect,
    }}>
      {children}
    </BleContext.Provider>
  );
}
