#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>

const char* slaveName = "IMU_Sender";
const char* slaveCharUUID = "19B10011-E8F2-537E-4F6C-D104768A1214";

BLEService forwardService("19B10020-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic forwardChar(
  "19B10021-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  72
);

float packet[18];

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

              slaveChar.readValue((byte*)packet, 36);

              if (IMU.accelerationAvailable())
                IMU.readAcceleration(packet[9], packet[10], packet[11]);

              if (IMU.gyroscopeAvailable())
                IMU.readGyroscope(packet[12], packet[13], packet[14]);

              if (IMU.magneticFieldAvailable())
                IMU.readMagneticField(packet[15], packet[16], packet[17]);

              forwardChar.writeValue((byte*)packet, 72);

              Serial.println("Forwarded 18 IMU values to Python");
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