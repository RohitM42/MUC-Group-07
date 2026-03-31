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

//tinyML defintions
#define INPUT_SIZE 4
#define HIDDEN_SIZE 6
#define WINDOW_SIZE 10

float axBuffer[WINDOW_SIZE];
float ayBuffer[WINDOW_SIZE];
float azBuffer[WINDOW_SIZE];

int bufferIndex = 0;
bool windowFull = false;

float W1[INPUT_SIZE][HIDDEN_SIZE] = {
  {0.1,0.2,0.3,0.2,0.1,0.2},
  {0.2,0.1,0.1,0.3,0.2,0.1},
  {0.1,0.2,0.2,0.1,0.2,0.3},
  {0.3,0.1,0.2,0.2,0.1,0.1}
};

float Bias1[HIDDEN_SIZE] = {0};

float W2[HIDDEN_SIZE] = {0.2,0.1,0.3,0.2,0.2,0.1};
float Bias2 = 0;

void addSample(float ax, float ay, float az)
{
  axBuffer[bufferIndex] = ax;
  ayBuffer[bufferIndex] = ay;
  azBuffer[bufferIndex] = az;

  bufferIndex++;

  if(bufferIndex >= WINDOW_SIZE)
  {
    bufferIndex = 0;
    windowFull = true;
  }
}

float relu(float x){
  return x > 0 ? x : 0;
}

float sigmoid(float x){
  return 1.0/(1.0+exp(-x));
}

void computeFeatures(
  float &meanMag,
  float &stdMag,
  float &maxMag,
  float &minMag)
{

  float sum = 0;
  float mags[WINDOW_SIZE];

  maxMag = -1000;
  minMag = 1000;

  for(int i=0;i<WINDOW_SIZE;i++)
  {
    float mag =
      sqrt(axBuffer[i]*axBuffer[i] +
           ayBuffer[i]*ayBuffer[i] +
           azBuffer[i]*azBuffer[i]);

    mags[i] = mag;

    sum += mag;

    if(mag > maxMag) maxMag = mag;
    if(mag < minMag) minMag = mag;
  }

  meanMag = sum / WINDOW_SIZE;

  float var = 0;

  for(int i=0;i<WINDOW_SIZE;i++)
  {
    float d = mags[i] - meanMag;
    var += d*d;
  }

  stdMag = sqrt(var / WINDOW_SIZE);
}

bool walkingClassifier()
{

  float meanMag, stdMag, maxMag, minMag;

  computeFeatures(meanMag, stdMag, maxMag, minMag);

  float input[4] = {
    meanMag,
    stdMag,
    maxMag,
    minMag
  };

  // placeholder linear model

  float score =
      input[0]*1.2
    + input[1]*2.0
    + input[2]*0.5
    - input[3]*0.3
    - 1.5;

  float prob = 1.0 / (1.0 + exp(-score));

  return prob > 0.5;
}
// end of tinyML definitions

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

  BLE.setLocalName("IMU_Ankle");
  BLE.setAdvertisedService(ankleService);

  ankleService.addCharacteristic(ankleChar);
  BLE.addService(ankleService);

  BLE.advertise();

}

void loop() {
  bool walking = false;

  
  BLEDevice central = BLE.central();

  if (central) {

    while (central.connected()) {

      float ax,ay,az;
      float gx,gy,gz;

      IMU.readAcceleration(ax,ay,az);
      IMU.readGyroscope(gx,gy,gz);

      addSample(ax, ay, az);

      filter.updateIMU(gx,gy,gz,ax,ay,az);

      float roll = filter.getRoll();
      float yaw  = filter.getYaw();

      if(windowFull){
      walking = walkingClassifier();
      }

      packet[0] = walking;
      packet[1] = ax;
      packet[2] = ay;
      packet[3] = az;
      packet[4] = roll;
      packet[5] = yaw;

	  if(ankleChar.subscribed()){
		ankleChar.writeValue((byte*)packet,24);
	  }

      delay(50);
    }
  }
}
