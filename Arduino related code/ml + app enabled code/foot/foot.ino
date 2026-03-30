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
bool wasAppSubscribed = false;
bool scanningForAnkle = false;

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

float wrapAngleDegrees(float angle)
{
  while (angle > 180.0f) angle -= 360.0f;
  while (angle < -180.0f) angle += 360.0f;
  return angle;
}

// Foot angle: foot yaw relative to ankle yaw (degrees).
// This matches the training-side convention: Yaw1 - Yaw2.
float computeFootAngle(float ankleYaw, float footYaw)
{
  return wrapAngleDegrees(footYaw - ankleYaw);
}

void ensurePhoneAdvertising()
{
  bool appSubscribed = footChar.subscribed();

  if (wasAppSubscribed && !appSubscribed) {
    BLE.advertise();
  }

  if (!appSubscribed) {
    BLE.advertise();
  }

  wasAppSubscribed = appSubscribed;
}

void startAnkleScan()
{
  if (!scanningForAnkle) {
    BLE.scan();
    scanningForAnkle = true;
  }
}

void stopAnkleScan()
{
  if (scanningForAnkle) {
    BLE.stopScan();
    scanningForAnkle = false;
  }
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

  // We publish roughly every 50 ms, so keep the filter rate close to 20 Hz.
  filter.begin(20);

  BLE.setLocalName("IMU_Foot");
  BLE.setAdvertisedService(footService);

  footService.addCharacteristic(footChar);
  BLE.addService(footService);

  BLE.advertise();

}

void loop() {
  ensurePhoneAdvertising();

  // Stay discoverable to the phone while idle. Only chase the ankle once the app
  // is actually connected/subscribed, otherwise IMU_Foot can disappear from scans.
  if (!footChar.subscribed()) {
    stopAnkleScan();
    BLE.poll();
    delay(50);
    return;
  }

  startAnkleScan();

  BLEDevice peripheral = BLE.available();

  if (peripheral && peripheral.localName() == ankleName) {

    stopAnkleScan();

    if (peripheral.connect()) {

      if (peripheral.discoverAttributes()) {

        BLECharacteristic ankleChar =
          peripheral.characteristic(ankleUUID);

        ankleChar.subscribe();

        while (peripheral.connected() && footChar.subscribed()) {
          ensurePhoneAdvertising();

          if (ankleChar.valueUpdated()) {

            ankleChar.readValue((byte*)ankleData,24);

            float ax,ay,az;
            float gx,gy,gz;

            float mx,my,mz;
            IMU.readAcceleration(ax,ay,az);
            IMU.readGyroscope(gx,gy,gz);
            IMU.readMagneticField(mx,my,mz);

            filter.update(gx,gy,gz,ax,ay,az,mx,my,mz);

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
          ensurePhoneAdvertising();
        }

        if (peripheral.connected() && !footChar.subscribed()) {
          peripheral.disconnect();
        }
      }

      startAnkleScan();
    }
  }

  BLE.poll();
}
