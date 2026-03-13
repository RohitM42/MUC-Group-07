// Types --------------------------------------------------------------------

export interface RawIMU {
  ax: number; ay: number; az: number; // accelerometer (g)
  gx: number; gy: number; gz: number; // gyroscope (°/s)
  mx: number; my: number; mz: number; // magnetometer (µT)
  timestamp: number;                  // ms since connection
}

export interface DerivedMetrics {
  totalAccel: number;    // magnitude of acceleration (g)
  pitch: number;         // foot up/down tilt (degrees)
  roll: number;          // foot inward/outward lean (degrees) — key metric
  angularSpeed: number;  // total rotation rate (°/s)
  heading: number;       // compass heading (degrees)
}

// Byte unpacking -------------------------------------------------------------------

// Unpacks the 36-byte BLE notification from the Arduino into 9 floats.

export function unpackIMU(data: number[], timestamp: number): RawIMU {
  console.log('[IMU] raw bytes length:', data.length, 'bytes:', JSON.stringify(data));

  if (data.length < 36) {
    console.warn('[IMU] packet too short — expected 36 bytes, got', data.length);
    return { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0, mx: 0, my: 0, mz: 0, timestamp };
  }

  const buf = new DataView(new Uint8Array(data).buffer);

  const ax = buf.getFloat32(0,  true);
  const ay = buf.getFloat32(4,  true);
  const az = buf.getFloat32(8,  true);
  const gx = buf.getFloat32(12, true);
  const gy = buf.getFloat32(16, true);
  const gz = buf.getFloat32(20, true);
  const mx = buf.getFloat32(24, true);
  const my = buf.getFloat32(28, true);
  const mz = buf.getFloat32(32, true);

  console.log('[IMU] ACC:', ax, ay, az);
  console.log('[IMU] GYR:', gx, gy, gz);
  console.log('[IMU] MAG:', mx, my, mz);

  return { ax, ay, az, gx, gy, gz, mx, my, mz, timestamp };
}

// Derived metrics --------------------------------------------------------------

const RAD_TO_DEG = 180 / Math.PI;

export function deriveMetrics(imu: RawIMU): DerivedMetrics {
  const { ax, ay, az, gx, gy, gz, mx, my } = imu;

  const totalAccel   = Math.sqrt(ax * ax + ay * ay + az * az);
  const pitch        = Math.atan2(ay, Math.sqrt(ax * ax + az * az)) * RAD_TO_DEG;
  const roll         = Math.atan2(ax, Math.sqrt(ay * ay + az * az)) * RAD_TO_DEG;
  const angularSpeed = Math.sqrt(gx * gx + gy * gy + gz * gz);
  const heading      = Math.atan2(my, mx) * RAD_TO_DEG;

  return { totalAccel, pitch, roll, angularSpeed, heading };
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

// Simple peak-detection step counter.
// Call addSample() on every BLE reading; it returns true when a step is detected.

const STEP_THRESHOLD = 1.2; // g — total accel must exceed this to count as a step
const STEP_COOLDOWN  = 300; // ms — minimum time between steps

let lastStepTime = 0;
let wasAboveThreshold = false;

export function detectStep(totalAccel: number, timestamp: number): boolean {
  const aboveThreshold = totalAccel > STEP_THRESHOLD;

  // Rising edge: crossed above threshold and cooldown has passed
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

// Rolling window of step timestamps — returns steps per minute.
const PACE_WINDOW_MS = 10_000; // 10 second rolling window

const stepTimestamps: number[] = [];

export function updatePace(stepTimestamp: number): number {
  stepTimestamps.push(stepTimestamp);
  const cutoff = stepTimestamp - PACE_WINDOW_MS;

  // Remove timestamps outside the window
  while (stepTimestamps.length > 0 && stepTimestamps[0] < cutoff) {
    stepTimestamps.shift();
  }

  // steps in window / window duration in minutes
  return (stepTimestamps.length / PACE_WINDOW_MS) * 60_000;
}

export function resetPace(): void {
  stepTimestamps.length = 0;
}
