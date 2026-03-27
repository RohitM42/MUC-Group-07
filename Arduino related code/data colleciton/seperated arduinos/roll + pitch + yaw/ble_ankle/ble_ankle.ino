#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#include <MadgwickAHRS.h>

Madgwick filter;

const int ledPin = 13;

BLEService imuService("19B10020-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic imuChar(
  "19B10021-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  24
);

float data[6];

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

  BLE.setLocalName("IMU_Ankle");
  BLE.setAdvertisedService(imuService);

  imuService.addCharacteristic(imuChar);
  BLE.addService(imuService);

  filter.begin(200);

  BLE.advertise();
}

void loop() {

  BLEDevice central = BLE.central();

  if (central) {

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
        }
      }

      delay(50); //20hz
    }

  }
}