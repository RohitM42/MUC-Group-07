#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#include <MadgwickAHRS.h>

Madgwick filter;

BLEService imuService("19B10020-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic imuChar(
  "19B10021-E8F2-537E-4F6C-D104768A1214",
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

  BLE.setLocalName("IMU_Ankle");
  BLE.setAdvertisedService(imuService);

  imuService.addCharacteristic(imuChar);
  BLE.addService(imuService);

  filter.begin(200);

  BLE.advertise();

  Serial.println("Advertising for Python");
}

void loop() {

  BLEDevice central = BLE.central();

  if (central) {
	  Serial.println("Connected");

    while (central.connected()) {
      float gx, gy, gz;

      if (IMU.accelerationAvailable() &&
          IMU.gyroscopeAvailable()) {

        IMU.readAcceleration(data[3], data[4], data[5]);
        IMU.readGyroscope(gx, gy, gz);

        float norm = sqrt(data[3]*data[3] + data[4]*data[4] + data[5]*data[5]);
        data[3] /= norm;
        data[4] /= norm;
        data[5] /= norm;

        filter.updateIMU(gx, gy, gz, data[3], data[4], data[5]);

        data[0]  = filter.getRoll();
        data[1] = filter.getPitch();
        data[2]  = filter.getYaw();

        if (imuChar.subscribed()){
          imuChar.writeValue((byte*)data, 24);
		  Serial.println("Sent packet");
        }
      }

      delay(50); //20hz
    }
	
	Serial.println("Disconnected");

  }
}