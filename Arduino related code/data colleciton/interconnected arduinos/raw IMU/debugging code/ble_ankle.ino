#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>

const char* slaveName = "IMU_Sender";
const char* slaveCharUUID = "19B10011-E8F2-537E-4F6C-D104768A1214";

BLEService forwardService("19B10020-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic forwardChar(
  "19B10021-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  48
);

float packet[12];

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

  BLE.setLocalName("IMU_Master");
  BLE.setAdvertisedService(forwardService);

  forwardService.addCharacteristic(forwardChar);
  BLE.addService(forwardService);

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

            if (slaveChar.valueUpdated()) {

              slaveChar.readValue((byte*)packet, 24);

                    IMU.readAcceleration(packet[6], packet[7], packet[8]);
                    
                    IMU.readGyroscope(packet[9], packet[10], packet[11]);

                    float norm = sqrt(packet[6]*packet[6] + packet[7]*packet[7] + packet[8]*packet[8]);
                    packet[6] /= norm;
                    packet[7] /= norm;
                    packet[8] /= norm;

                  if (forwardChar.subscribed()) {
                    forwardChar.writeValue((byte*)packet, 48);
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