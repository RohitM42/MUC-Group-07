#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>

const int ledPin = 13;

BLEService imuService("19B10010-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic imuChar(
  "19B10011-E8F2-537E-4F6C-D104768A1214",
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

  BLE.setLocalName("IMU_Sender");
  BLE.setAdvertisedService(imuService);

  imuService.addCharacteristic(imuChar);
  BLE.addService(imuService);

  BLE.advertise();

}

void loop() {

  BLEDevice central = BLE.central();

  if (central) {

    while (central.connected()) {

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
        }
      }

      delay(50); //20hz
    }

  }
}