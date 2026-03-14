#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>

BLEService imuService("19B10010-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic imuChar(
  "19B10011-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  36
);

float data[9];

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

      if (IMU.accelerationAvailable())
        IMU.readAcceleration(data[0], data[1], data[2]);

      if (IMU.gyroscopeAvailable())
        IMU.readGyroscope(data[3], data[4], data[5]);

      if (IMU.magneticFieldAvailable())
        IMU.readMagneticField(data[6], data[7], data[8]);

      imuChar.writeValue((byte*)data, 36);

      Serial.println("Packet sent");

      delay(100);
    }

    Serial.println("Disconnected");
  }
}