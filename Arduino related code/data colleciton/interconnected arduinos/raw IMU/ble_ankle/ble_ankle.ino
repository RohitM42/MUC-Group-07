#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>

const int ledPin = 13;

const char* slaveName = "IMU_Sender";
const char* slaveCharUUID = "19B10011-E8F2-537E-4F6C-D104768A1214";

BLEService forwardService("19B10020-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic forwardChar(
  "19B10021-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  48
);

float packet[12];

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

  BLE.setLocalName("IMU_Master");
  BLE.setAdvertisedService(forwardService);

  forwardService.addCharacteristic(forwardChar);
  BLE.addService(forwardService);

  BLE.advertise();

  BLE.scan();
}

void loop() {

  BLEDevice peripheral = BLE.available();

  if (peripheral && peripheral.localName() == slaveName) {

    BLE.stopScan();

    if (peripheral.connect()) {


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
                  }
                 

              
            }

            BLE.poll();
          }
        }
      }

      BLE.scan();
    }
  }
}