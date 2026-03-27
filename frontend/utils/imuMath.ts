// Types --------------------------------------------------------------------

// Packet from ml + app enabled code/foot/foot.ino
// 20 bytes = 5 floats: [footAngle, walking, ax, ay, az]
export interface RawIMU {
  footAngle: number; // on-device linear model output (degrees)
  walking:   boolean; // TinyML classifier result from ankle
  ax: number; ay: number; az: number; // accelerometer (g)
  timestamp: number; // ms since connection
}

export interface DerivedMetrics {
  totalAccel: number; // magnitude of acceleration (g)
  pitch:      number; // foot up/down tilt (degrees)
  roll:       number; // foot inward/outward lean (degrees) — key metric
}

// Byte unpacking -------------------------------------------------------------------

// Unpacks the 20-byte BLE notification from foot.ino into 5 floats.
// Layout: [footAngle, walking, ax, ay, az] — all little-endian float32

export function unpackIMU(data: number[], timestamp: number): RawIMU {
  console.log('[IMU] raw bytes length:', data.length, 'bytes:', JSON.stringify(data));

  const buf = new DataView(new Uint8Array(data).buffer);

  // 24-byte ankle packet: [walking, ax, ay, az, roll, yaw]
  if (data.length >= 24) {
    const walkingRaw = buf.getFloat32(0,  true);
    const ax         = buf.getFloat32(4,  true);
    const ay         = buf.getFloat32(8,  true);
    const az         = buf.getFloat32(12, true);
    const walking    = walkingRaw >= 0.5;
    console.log('[IMU] ankle packet — walking:', walking);
    console.log('[IMU] ACC:', ax, ay, az);
    return { footAngle: 0, walking, ax, ay, az, timestamp };
  }

  // 20-byte foot packet: [footAngle, walking, ax, ay, az]
  if (data.length >= 20) {
    const footAngle  = buf.getFloat32(0,  true);
    const walkingRaw = buf.getFloat32(4,  true);
    const ax         = buf.getFloat32(8,  true);
    const ay         = buf.getFloat32(12, true);
    const az         = buf.getFloat32(16, true);
    const walking    = walkingRaw >= 0.5;
    console.log('[IMU] foot packet — footAngle:', footAngle, 'walking:', walking);
    console.log('[IMU] ACC:', ax, ay, az);
    return { footAngle, walking, ax, ay, az, timestamp };
  }

  console.warn('[IMU] packet too short — expected 20 or 24 bytes, got', data.length);
  return { footAngle: 0, walking: false, ax: 0, ay: 0, az: 0, timestamp };
}

// Derived metrics --------------------------------------------------------------

const RAD_TO_DEG = 180 / Math.PI;

export function deriveMetrics(imu: RawIMU): DerivedMetrics {
  const { ax, ay, az } = imu;

  const totalAccel = Math.sqrt(ax * ax + ay * ay + az * az);
  const pitch      = Math.atan2(ay, Math.sqrt(ax * ax + az * az)) * RAD_TO_DEG;
  const roll       = Math.atan2(ax, Math.sqrt(ay * ay + az * az)) * RAD_TO_DEG;

  return { totalAccel, pitch, roll };
}

// Orientation correctness --------------------------------------------------------------

// Thresholds in degrees — adjust once calibration data is available
export const ROLL_WARN_THRESHOLD  = 10; // amber: ±10°
export const ROLL_ERROR_THRESHOLD = 20; // red:   ±20°

export type CorrectnessLevel = 'correct' | 'warn' | 'incorrect';

export function getRollCorrectness(roll: number): CorrectnessLevel {
  const abs = Math.abs(roll);
  if (abs <= ROLL_WARN_THRESHOLD)  return 'correct';
  if (abs <= ROLL_ERROR_THRESHOLD) return 'warn';
  return 'incorrect';
}

export const CORRECTNESS_COLOUR: Record<CorrectnessLevel, string> = {
  correct:   '#22c55e', // green
  warn:      '#f59e0b', // amber
  incorrect: '#ef4444', // red
};

// Step detection --------------------------------------------------------------

const STEP_THRESHOLD = 1.2; // g — total accel must exceed this to count as a step
const STEP_COOLDOWN  = 300; // ms — minimum time between steps

let lastStepTime = 0;
let wasAboveThreshold = false;

export function detectStep(totalAccel: number, timestamp: number): boolean {
  const aboveThreshold = totalAccel > STEP_THRESHOLD;

  if (aboveThreshold && !wasAboveThreshold && (timestamp - lastStepTime) > STEP_COOLDOWN) {
    wasAboveThreshold = true;
    lastStepTime = timestamp;
    return true;
  }

  if (!aboveThreshold) wasAboveThreshold = false;
  return false;
}

export function resetStepDetector(): void {
  lastStepTime = 0;
  wasAboveThreshold = false;
}

// Pace calculation -----------------------------------------------------------------

const PACE_WINDOW_MS = 10_000; // 10 second rolling window

const stepTimestamps: number[] = [];

export function updatePace(stepTimestamp: number): number {
  stepTimestamps.push(stepTimestamp);
  const cutoff = stepTimestamp - PACE_WINDOW_MS;

  while (stepTimestamps.length > 0 && stepTimestamps[0] < cutoff) {
    stepTimestamps.shift();
  }

  return (stepTimestamps.length / PACE_WINDOW_MS) * 60_000;
}

export function resetPace(): void {
  stepTimestamps.length = 0;
}
