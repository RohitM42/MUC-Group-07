#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#include <MadgwickAHRS.h>
#include <math.h>
#include "../angle_model.h"
#include "../walking_model.h"

Madgwick filter;

const int ledPin = 13;

const char* ankleName = "IMU_Ankle";
const char* ankleUUID = "19B10031-E8F2-537E-4F6C-D104768A1214";

/* Python service */

BLEService footService("19B10040-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic footChar(
  "19B10041-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  20
);

float ankleData[6];
float outPacket[5];
bool wasAppSubscribed = false;
bool scanningForAnkle = false;

float walkingWindow[WALKING_MODEL_WINDOW_SIZE][WALKING_MODEL_FEATURES_PER_SAMPLE];
int walkingWindowWriteIndex = 0;
int walkingWindowSampleCount = 0;

void LongBlink(){
  digitalWrite(ledPin, HIGH);
  delay(1000);                
  digitalWrite(ledPin, LOW);  
  delay(1000);
}

void ShortBlink(){
  digitalWrite(ledPin, HIGH);
  delay(200);                
  digitalWrite(ledPin, LOW);  
  delay(200);
}

// Trained linear regression exported from classifier/models/angle_linear_regression.pkl.
float predictFootAngle(
  float footRoll,
  float footPitch,
  float footYaw,
  float gx,
  float gy,
  float gz,
  float ankleRoll,
  float ankleYaw,
  float ankleAx,
  float ankleAy,
  float ankleAz)
{
  float features[ANGLE_MODEL_FEATURE_COUNT] = {
    footRoll,
    footPitch,
    footYaw,
    gx,
    gy,
    gz,
    ankleRoll,
    ankleYaw,
    ankleAx,
    ankleAy,
    ankleAz,
  };

  float prediction = ANGLE_MODEL_INTERCEPT;
  for (int i = 0; i < ANGLE_MODEL_FEATURE_COUNT; ++i) {
    prediction += features[i] * ANGLE_MODEL_COEF[i];
  }

  return prediction;
}

void normalizeAcceleration(
  float ax,
  float ay,
  float az,
  float &axNorm,
  float &ayNorm,
  float &azNorm)
{
  float norm = sqrt(ax * ax + ay * ay + az * az);

  if (norm < 0.000001f) {
    axNorm = 0.0f;
    ayNorm = 0.0f;
    azNorm = 0.0f;
    return;
  }

  axNorm = ax / norm;
  ayNorm = ay / norm;
  azNorm = az / norm;
}

void addWalkingSample(
  float footRoll,
  float footPitch,
  float footYaw,
  float gx,
  float gy,
  float gz,
  float ankleRoll,
  float anklePitch,
  float ankleYaw,
  float ax,
  float ay,
  float az)
{
  float *sample = walkingWindow[walkingWindowWriteIndex];

  sample[0] = footRoll;
  sample[1] = footPitch;
  sample[2] = footYaw;
  sample[3] = gx;
  sample[4] = gy;
  sample[5] = gz;
  sample[6] = ankleRoll;
  sample[7] = anklePitch;
  sample[8] = ankleYaw;
  sample[9] = ax;
  sample[10] = ay;
  sample[11] = az;

  walkingWindowWriteIndex = (walkingWindowWriteIndex + 1) % WALKING_MODEL_WINDOW_SIZE;

  if (walkingWindowSampleCount < WALKING_MODEL_WINDOW_SIZE) {
    walkingWindowSampleCount++;
  }
}

bool walkingClassifierReady()
{
  return walkingWindowSampleCount >= WALKING_MODEL_WINDOW_SIZE;
}

float walkingClassifierScore()
{
  float score = WALKING_MODEL_INTERCEPT;
  int modelIndex = 0;

  for (int windowOffset = 0; windowOffset < WALKING_MODEL_WINDOW_SIZE; ++windowOffset) {
    int sampleIndex = (walkingWindowWriteIndex + windowOffset) % WALKING_MODEL_WINDOW_SIZE;

    for (int featureIndex = 0; featureIndex < WALKING_MODEL_FEATURES_PER_SAMPLE; ++featureIndex) {
      float rawValue = walkingWindow[sampleIndex][featureIndex];
      float standardizedValue =
        (rawValue - WALKING_MODEL_MEAN[modelIndex]) / WALKING_MODEL_SCALE[modelIndex];

      score += standardizedValue * WALKING_MODEL_COEF[modelIndex];
      modelIndex++;
    }
  }

  return score;
}

bool walkingClassifier()
{
  return walkingClassifierReady() && walkingClassifierScore() >= 0.0f;
}

void resetWalkingClassifier()
{
  walkingWindowWriteIndex = 0;
  walkingWindowSampleCount = 0;
}

void ensurePhoneAdvertising()
{
  bool appSubscribed = footChar.subscribed();

  if (wasAppSubscribed && !appSubscribed) {
    BLE.advertise();
  }

  if (!appSubscribed) {
    BLE.advertise();
  }

  wasAppSubscribed = appSubscribed;
}

void startAnkleScan()
{
  if (!scanningForAnkle) {
    BLE.scan();
    scanningForAnkle = true;
  }
}

void stopAnkleScan()
{
  if (scanningForAnkle) {
    BLE.stopScan();
    scanningForAnkle = false;
  }
}

void setup() {
  pinMode(ledPin,OUTPUT);

  if (!BLE.begin()) {
    while (1){
      LongBlink();
      LongBlink();
      ShortBlink();
      ShortBlink();
      delay(1000);                
    }
  }

  if (!IMU.begin()) {
    while (1){
      LongBlink();
      LongBlink();
      LongBlink();
      ShortBlink();
      delay(1000);                
    }
  }

  // Match the training-time collector configuration for the walking classifier.
  filter.begin(200);

  BLE.setLocalName("IMU_Foot");
  BLE.setAdvertisedService(footService);

  footService.addCharacteristic(footChar);
  BLE.addService(footService);

  BLE.advertise();

}

void loop() {
  ensurePhoneAdvertising();

  // Stay discoverable to the phone while idle. Only chase the ankle once the app
  // is actually connected/subscribed, otherwise IMU_Foot can disappear from scans.
  if (!footChar.subscribed()) {
    stopAnkleScan();
    resetWalkingClassifier();
    BLE.poll();
    delay(50);
    return;
  }

  startAnkleScan();

  BLEDevice peripheral = BLE.available();

  if (peripheral && peripheral.localName() == ankleName) {

    stopAnkleScan();

    if (peripheral.connect()) {

      if (peripheral.discoverAttributes()) {

        BLECharacteristic ankleChar =
          peripheral.characteristic(ankleUUID);

        ankleChar.subscribe();

        while (peripheral.connected() && footChar.subscribed()) {
          ensurePhoneAdvertising();

          // Each ankle notification becomes one feature frame for the trained windowed model.
          if (ankleChar.valueUpdated()) {
            float footAx, footAy, footAz;
            float footGx, footGy, footGz;
            float footAxNorm, footAyNorm, footAzNorm;

            ankleChar.readValue((byte*)ankleData,24);

            IMU.readAcceleration(footAx,footAy,footAz);
            IMU.readGyroscope(footGx,footGy,footGz);

            normalizeAcceleration(footAx, footAy, footAz, footAxNorm, footAyNorm, footAzNorm);
            filter.updateIMU(footGx,footGy,footGz,footAxNorm,footAyNorm,footAzNorm);

            float footRoll = filter.getRoll();
            float footPitch = filter.getPitch();
            float footYaw = filter.getYaw();

            addWalkingSample(
              footRoll,
              footPitch,
              footYaw,
              footGx,
              footGy,
              footGz,
              ankleData[0],
              ankleData[1],
              ankleData[2],
              ankleData[3],
              ankleData[4],
              ankleData[5]
            );

            float footAngle = predictFootAngle(
              footRoll,
              footPitch,
              footYaw,
              footGx,
              footGy,
              footGz,
              ankleData[0],
              ankleData[2],
              ankleData[3],
              ankleData[4],
              ankleData[5]
            );
            bool walking = walkingClassifier();

            outPacket[0] = footAngle;
            outPacket[1] = walking ? 1.0f : 0.0f;
            outPacket[2] = footAx;
            outPacket[3] = footAy;
            outPacket[4] = footAz;

			if(footChar.subscribed()){
				footChar.writeValue((byte*)outPacket,20);
			}
          }

          BLE.poll();
          ensurePhoneAdvertising();
        }

        if (peripheral.connected() && !footChar.subscribed()) {
          peripheral.disconnect();
        }

        resetWalkingClassifier();
      }

      startAnkleScan();
    }
  }

  BLE.poll();
}
