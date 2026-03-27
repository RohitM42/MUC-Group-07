#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>

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

  BLE.setLocalName("IMU_Foot");
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

        IMU.readAcceleration(data[0], data[1], data[2]);
        IMU.readGyroscope(data[3], data[4], data[5]);

        float norm = sqrt(data[0]*data[0] + data[1]*data[1] + data[2]*data[2]);
        data[0] /= norm;
        data[1] /= norm;
        data[2] /= norm;

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