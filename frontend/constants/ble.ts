export interface DeviceConfig {
  name:        string;
  serviceUUID: string;
  charUUID:    string;
}

export const FOOT_DEVICE: DeviceConfig = {
  name:        'IMU_Foot',
  serviceUUID: '19B10040-E8F2-537E-4F6C-D104768A1214',
  charUUID:    '19B10041-E8F2-537E-4F6C-D104768A1214',
};

export const ANKLE_DEVICE: DeviceConfig = {
  name:        'IMU_Ankle',
  serviceUUID: '19B10030-E8F2-537E-4F6C-D104768A1214',
  charUUID:    '19B10031-E8F2-537E-4F6C-D104768A1214',
};

export const KNOWN_DEVICES: DeviceConfig[] = [FOOT_DEVICE, ANKLE_DEVICE];
