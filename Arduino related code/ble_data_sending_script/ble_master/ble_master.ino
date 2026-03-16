#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#include <MadgwickAHRS.h>

Madgwick filter;

const char* slaveName = "IMU_Sender";
const char* slaveCharUUID = "19B10011-E8F2-537E-4F6C-D104768A1214";

BLEService forwardService("19B10020-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic forwardChar(
  "19B10021-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  24
);

float packet[6];

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

  BLE.setLocalName("IMU_Master1");
  BLE.setAdvertisedService(forwardService);

  forwardService.addCharacteristic(forwardChar);
  BLE.addService(forwardService);

  filter.begin(200);

  BLE.advertise();

  Serial.println("Master advertising for Python");

  BLE.scan();
}

void loop() {

  BLEDevice peripheral = BLE.available();

  if (peripheral && peripheral.localName() == slaveName) {

    Serial.println("Slave found");
    BLE.stopScan();

    if (peripheral.connect()) {

      Serial.println("Connected to slave");

      if (peripheral.discoverAttributes()) {

        BLECharacteristic slaveChar =
          peripheral.characteristic(slaveCharUUID);

        if (slaveChar) {

          slaveChar.subscribe();

          while (peripheral.connected()) {

            float ax, ay, az;
            float gx, gy, gz;

            if (slaveChar.valueUpdated()) {

              slaveChar.readValue((byte*)packet, 12);

                    IMU.readAcceleration(ax, ay, az);
                    
                    IMU.readGyroscope(gx, gy, gz);

                    float norm = sqrt(ax*ax + ay*ay + az*az);
                    ax /= norm;
                    ay /= norm;
                    az /= norm;

                    filter.updateIMU(gx, gy, gz, ax, ay, az);

                    packet[3]  = filter.getRoll();
                    packet[4] = filter.getPitch();
                    packet[5]  = filter.getYaw();

                  if (forwardChar.subscribed()) {
                      forwardChar.writeValue((byte*)packet, 24);
                    Serial.println("Sent packet to Python");
                  }
                 

              
            }

            BLE.poll();
          }
        }
      }

      Serial.println("Slave disconnected");
      BLE.scan();
    }
  }
}