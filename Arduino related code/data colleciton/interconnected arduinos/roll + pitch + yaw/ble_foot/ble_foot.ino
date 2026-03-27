#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#include <MadgwickAHRS.h>

Madgwick filter;

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

  filter.begin(200);

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
        }
      }

      delay(50); //20hz
    }

  }
}