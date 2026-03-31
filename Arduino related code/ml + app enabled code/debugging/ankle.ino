#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#include <MadgwickAHRS.h>
#include <math.h>

Madgwick filter;

BLEService ankleService("19B10030-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic ankleChar(
  "19B10031-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  24
);

// Packet layout sent to the foot Arduino:
// [roll, pitch, yaw, ax_norm, ay_norm, az_norm]
float packet[6];

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

void setup() {
  Serial.begin(115200);
  while(!Serial);

  if (!IMU.begin()) {
    Serial.println("IMU failed");
    while (1);
  }

  if (!BLE.begin()) {
    Serial.println("BLE failed");
    while (1);
  }

  filter.begin(200);

  BLE.setLocalName("IMU_Ankle");
  BLE.setAdvertisedService(ankleService);

  ankleService.addCharacteristic(ankleChar);
  BLE.addService(ankleService);

  BLE.advertise();

  Serial.println("Ankle ready");
}

void loop() {
  BLEDevice central = BLE.central();

  if (central) {
    Serial.println("Foot connected");

    while (central.connected()) {
      float ax, ay, az;
      float gx, gy, gz;
      float axNorm, ayNorm, azNorm;

      IMU.readAcceleration(ax, ay, az);
      IMU.readGyroscope(gx, gy, gz);

      normalizeAcceleration(ax, ay, az, axNorm, ayNorm, azNorm);
      filter.updateIMU(gx, gy, gz, axNorm, ayNorm, azNorm);

      packet[0] = filter.getRoll();
      packet[1] = filter.getPitch();
      packet[2] = filter.getYaw();
      packet[3] = axNorm;
      packet[4] = ayNorm;
      packet[5] = azNorm;

      if (ankleChar.subscribed()) {
        ankleChar.writeValue((byte*)packet, 24);
        Serial.println("Sent ankle feature frame");
      }

      delay(50);
    }

    Serial.println("Foot disconnected");
  }
}
