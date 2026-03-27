#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#include <MadgwickAHRS.h>

Madgwick filter;

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

float footAngleModel(
  float gx,float gy,float gz,
  float rollA,float yawA,
  float rollF, float yawF)
{
  return rollA * 0.5 + yawA * 0.3 + gx * 0.2;
}

void setup() {

  Serial.begin(115200);
  while(!Serial);

  IMU.begin();
  BLE.begin();

  filter.begin(200);

  BLE.setLocalName("IMU_Foot");
  BLE.setAdvertisedService(footService);

  footService.addCharacteristic(footChar);
  BLE.addService(footService);

  BLE.advertise();
  BLE.scan();

  Serial.println("Foot scanning");
}

void loop() {

  BLEDevice peripheral = BLE.available();

  if (peripheral && peripheral.localName() == ankleName) {

    BLE.stopScan();

    if (peripheral.connect()) {

      Serial.println("Connected to ankle");

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

            float footAngle =
              footAngleModel(ax,ay,az,ankleData[4],ankleData[5],filter.getRoll(),filter.getYaw());

            outPacket[0] = footAngle;
            outPacket[1] = ankleData[0];
            outPacket[2] = ankleData[1];
            outPacket[3] = ankleData[2];
            outPacket[4] = ankleData[3];

			if(footChar.subscribed()){
				footChar.writeValue((byte*)outPacket,20);
				Serial.println("Forwarded result to Python");
			}
          }

          BLE.poll();
        }
      }

      BLE.scan();
    }
  }
}