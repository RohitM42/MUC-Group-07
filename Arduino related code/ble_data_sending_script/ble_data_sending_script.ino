#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>

// this id may need to be changed when using multiple arduinos
BLEService imuService("19B10010-E8F2-537E-4F6C-D104768A1214");

//if the above id is changed, change the below id
BLECharacteristic imuCharacteristic(
  "19B10011-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  36
);

float imuData[9]; // ax ay az gx gy gz mx my mz

void setup() {
  Serial.begin(115200);

  if (!IMU.begin()) {
    Serial.println("Failed to initialize IMU!");
    while (1);
  }

  if (!BLE.begin()) {
    Serial.println("Failed to start BLE!");
    while (1);
  }

  BLE.setLocalName("Nano33BLE_IMU");
  BLE.setAdvertisedService(imuService);

  imuService.addCharacteristic(imuCharacteristic);
  BLE.addService(imuService);

  BLE.advertise();

  Serial.println("BLE IMU streaming device ready");
}

void loop() {

  BLEDevice central = BLE.central();

  if (central) {

    Serial.print("Connected to: ");
    Serial.println(central.address());

    while (central.connected()) {

      if (IMU.accelerationAvailable())
        IMU.readAcceleration(imuData[0], imuData[1], imuData[2]);

      if (IMU.gyroscopeAvailable())
        IMU.readGyroscope(imuData[3], imuData[4], imuData[5]);

      if (IMU.magneticFieldAvailable())
        IMU.readMagneticField(imuData[6], imuData[7], imuData[8]);

      imuCharacteristic.writeValue((byte*)imuData, 36);

      delay(20); // ~50 Hz
    }

    Serial.println("Disconnected");
  }
}