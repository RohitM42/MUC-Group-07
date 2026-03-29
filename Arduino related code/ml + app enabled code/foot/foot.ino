#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#include <MadgwickAHRS.h>

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

// Foot angle: yaw difference between ankle and foot sensors (degrees).
// Positive = foot turned outward relative to ankle, negative = inward.
// This is the direct geometric equivalent of what angle_linear_regression.pkl was trained to predict.
float computeFootAngle(float ankleYaw, float footYaw)
{
  return ankleYaw - footYaw;
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

  filter.begin(200);

  BLE.setLocalName("IMU_Foot");
  BLE.setAdvertisedService(footService);

  footService.addCharacteristic(footChar);
  BLE.addService(footService);

  BLE.advertise();
  BLE.scan();

}

void loop() {

  BLEDevice peripheral = BLE.available();

  if (peripheral && peripheral.localName() == ankleName) {

    BLE.stopScan();

    if (peripheral.connect()) {

      if (peripheral.discoverAttributes()) {

        BLECharacteristic ankleChar =
          peripheral.characteristic(ankleUUID);

        ankleChar.subscribe();

        while (peripheral.connected()) {

          if (ankleChar.valueUpdated()) {

            ankleChar.readValue((byte*)ankleData,24);

            float ax,ay,az;
            float gx,gy,gz;

            IMU.readAcceleration(ax,ay,az);
            IMU.readGyroscope(gx,gy,gz);

            filter.updateIMU(gx,gy,gz,ax,ay,az);

            float footAngle = computeFootAngle(ankleData[5], filter.getYaw());

            outPacket[0] = footAngle;
            outPacket[1] = ankleData[0];
            outPacket[2] = ankleData[1];
            outPacket[3] = ankleData[2];
            outPacket[4] = ankleData[3];

			if(footChar.subscribed()){
				footChar.writeValue((byte*)outPacket,20);
			}
          }

          BLE.poll();
        }
      }

      BLE.scan();
    }
  }
}