#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#include <MadgwickAHRS.h>

Madgwick filter;

BLEService imuService("19B10010-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic imuChar(
  "19B10011-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  24
);

float data[6];

void setup() {

  Serial.begin(115200);
  while (!Serial);

  if (!BLE.begin()) {
    Serial.println("BLE failed");
    while (1);
  }

  if (!IMU.begin()) {
    Serial.println("IMU failed");
    while (1);
  }

  filter.begin(200);

  BLE.setLocalName("IMU_Sender");
  BLE.setAdvertisedService(imuService);

  imuService.addCharacteristic(imuChar);
  BLE.addService(imuService);

  BLE.advertise();

  Serial.println("Sender advertising...");
}

void loop() {

  BLEDevice central = BLE.central();

  if (central) {

    Serial.print("Connected to: ");
    Serial.println(central.address());

    while (central.connected()) {

      float ax, ay, az;
      float gx, gy, gz;

      if (IMU.accelerationAvailable() &&
          IMU.gyroscopeAvailable()) {

        IMU.readAcceleration(ax, ay, az);
        IMU.readGyroscope(gx, gy, gz);

        float norm = sqrt(ax*ax + ay*ay + az*az);
        ax /= norm;
        ay /= norm;
        az /= norm;

        filter.updateIMU(gx, gy, gz, ax, ay, az);

        data[0]  = filter.getRoll();
        data[1] = filter.getPitch();
        data[2]  = filter.getYaw();
        data[3] = gx;
        data[4] = gy;
        data[5] = gz;

        if (imuChar.subscribed()){
          imuChar.writeValue((byte*)data, 24);
          Serial.println("Packet sent!");
        }
      }

      delay(50); //20hz
    }

    Serial.println("Disconnected");
  }
}