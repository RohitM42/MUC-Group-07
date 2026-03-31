#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#include <MadgwickAHRS.h>
#include <math.h>

Madgwick filter;

const int ledPin = 13;

BLEService ankleService("19B10030-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic ankleChar(
  "19B10031-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  24
);

// Packet layout sent to the foot Arduino:
// [roll, pitch, yaw, ax_norm, ay_norm, az_norm]
float packet[6];

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

void normalizeAcceleration(
  float ax,
  float ay,
  float az,
  float &axNorm,
  float &ayNorm,
  float &azNorm)
{
  float norm = sqrt(ax * ax + ay * ay + az * az);

  if (norm < 0.000001f) {
    axNorm = 0.0f;
    ayNorm = 0.0f;
    azNorm = 0.0f;
    return;
  }

  axNorm = ax / norm;
  ayNorm = ay / norm;
  azNorm = az / norm;
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

  // Match the collector configuration the walking model was trained against.
  filter.begin(200);

  BLE.setLocalName("IMU_Ankle");
  BLE.setAdvertisedService(ankleService);

  ankleService.addCharacteristic(ankleChar);
  BLE.addService(ankleService);

  BLE.advertise();

}

void loop() {
  BLEDevice central = BLE.central();

  if (central) {

    while (central.connected()) {

      float ax,ay,az;
      float gx,gy,gz;
      float axNorm, ayNorm, azNorm;

      IMU.readAcceleration(ax,ay,az);
      IMU.readGyroscope(gx,gy,gz);

      normalizeAcceleration(ax, ay, az, axNorm, ayNorm, azNorm);

      filter.updateIMU(gx,gy,gz,axNorm,ayNorm,azNorm);

      float roll = filter.getRoll();
      float pitch = filter.getPitch();
      float yaw  = filter.getYaw();

      packet[0] = roll;
      packet[1] = pitch;
      packet[2] = yaw;
      packet[3] = axNorm;
      packet[4] = ayNorm;
      packet[5] = azNorm;

	  if(ankleChar.subscribed()){
		ankleChar.writeValue((byte*)packet,24);
	  }

      delay(50);
    }
  }
}
