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
import { SERVICE_UUID, CHAR_UUID, DEVICE_NAME } from '../constants/ble';
import {
  unpackIMU,
  deriveMetrics,
  detectStep,
  updatePace,
  resetStepDetector,
  resetPace,
  RawIMU,
  DerivedMetrics,
} from '../utils/imuMath';

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

  // Session stats
  stepCount: number;
  pace: number; // steps per minute

  // Actions
  startScan: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
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
  const [stepCount, setStepCount]               = useState(0);
  const [pace, setPace]                         = useState(0);

  const connectionStartTime = useRef<number>(0);

  // Throttle: only push a UI update every 100ms (10Hz) regardless of 50Hz BLE stream
  const lastUIUpdate = useRef<number>(0);

  const isConnected = connectedDeviceId !== null;

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
      setDevices(prev => {
        if (prev.some(d => d.id === peripheral.id)) return prev;
        console.log('Discovered device:', peripheral.id, peripheral.name);
        return [...prev, {
          id:   peripheral.id,
          name: peripheral.name || 'Unknown Device',
          rssi: peripheral.rssi,
        }];
      });
    });

    const onDisconnect = BleManager.onDisconnectPeripheral((data) => {
      if (data.peripheral === connectedDeviceId) {
        setConnectedDeviceId(null);
        setConnectionStatus('Disconnected');
        setRawIMU(null);
        setDerived(null);
      }
    });

    const onValueUpdate = BleManager.onDidUpdateValueForCharacteristic((data) => {
      const now = Date.now();

      // Parse regardless — needed for step detection
      const timestamp = now - connectionStartTime.current;
      const imu = unpackIMU(data.value, timestamp);
      console.log('Received IMU data:', imu);
      const metrics = deriveMetrics(imu);

      // Step detection runs on every sample
      const isStep = detectStep(metrics.totalAccel, timestamp);
      if (isStep) {
        setStepCount(prev => prev + 1);
        setPace(updatePace(timestamp));
      }

      // Throttle UI renders to 10Hz
      if (now - lastUIUpdate.current < 500) return;
      lastUIUpdate.current = now;

      setRawIMU(imu);
      setDerived(metrics);
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
          peripherals.map(p => ({
            id:   p.id,
            name: p.name || 'Unknown Device',
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

  const connect = useCallback(async (deviceId: string) => {
    setConnectionStatus('Connecting...');
    try {
      await BleManager.connect(deviceId);
      await BleManager.retrieveServices(deviceId);
      const negotiatedMTU = await BleManager.requestMTU(deviceId, 64);
      console.log('[BLE] Negotiated MTU:', negotiatedMTU);

      connectionStartTime.current = Date.now();
      resetStepDetector();
      resetPace();
      setStepCount(0);
      setPace(0);

      await BleManager.startNotification(deviceId, SERVICE_UUID, CHAR_UUID);

      console.log('[BLE] Connected to device:', deviceId);
      console.log('[BLE] Notifications started on', SERVICE_UUID, '/', CHAR_UUID);

      setConnectedDeviceId(deviceId);
      setConnectionStatus(`Connected to ${DEVICE_NAME}`);
    } catch (e: any) {
      console.error('Connect error:', e);
      setConnectionStatus(`Failed: ${e?.message ?? 'unknown error'}`);
      setConnectedDeviceId(null);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!connectedDeviceId) return;
    try {
      await BleManager.stopNotification(connectedDeviceId, SERVICE_UUID, CHAR_UUID);
      await BleManager.disconnect(connectedDeviceId);
    } catch (e) {
      console.error('Disconnect error:', e);
    }
    setConnectedDeviceId(null);
    setConnectionStatus('Disconnected');
    setRawIMU(null);
    setDerived(null);
  }, [connectedDeviceId]);

  // ---------------------------------------------------------------------------

  return (
    <BleContext.Provider value={{
      isScanning, devices, connectedDeviceId, connectionStatus, isConnected,
      rawIMU, derived,
      stepCount, pace,
      startScan, connect, disconnect,
    }}>
      {children}
    </BleContext.Provider>
  );
}
