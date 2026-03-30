import asyncio
import struct
import csv
import time
import os

from bleak import BleakScanner, BleakClient

#the device name and uuid are dependent on the code on the arduino and may need to be changed
DEVICE_NAME = "IMU_Master"
CHAR_UUID = "19B10021-E8F2-537E-4F6C-D104768A1214"
start_time = None

# ---------- CSV Setup ----------
script_dir = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(script_dir, "dataset"), exist_ok=True)
csv_path = os.path.join(script_dir, "dataset", f"imu_data_{int(time.time())}.csv")

csv_file = open(csv_path, "w", newline="")
csv_writer = csv.writer(csv_file)

csv_writer.writerow([
    "timestamp",
    "Roll1","Pitch1","Yaw1",
    "gx", "gy", "gz",
    "Roll2","Pitch2","Yaw2",
    "ax", "ay", "az"
])

# ---------- Data Handler ----------
def handle_data(sender, data):

    global start_time

    values = struct.unpack("ffffffffffff", data)

    # these values are from the foot
    Roll1, Pitch1, Yaw1 = values[0:3]
    gx, gy, gz = values[3:6]
    #these values are from the leg
    Roll2, Pitch2, Yaw2 = values[6:9]
    ax, ay, az = values[9:12]


    # Relative time in milliseconds since connection
    t = int((time.time() - start_time) * 1000)

    print("Roll1:", Roll1,
          "Pitch1:", Pitch1,
          "Yaw1:", Yaw1,
          "gx:", gx,
          "gy:", gy,
          "gz:", gz,
          "Roll2:", Roll2,
          "Pitch2:", Pitch2,
          "Yaw2:", Yaw2,
          "ax:", ax,
          "ay:", ay,
          "az:", az)

    csv_writer.writerow([
        t,
        Roll1, Pitch1, Yaw1,
        gx, gy, gz,
        Roll2, Pitch2, Yaw2,
        ax, ay, az
    ])


# ---------- Main BLE Loop ----------
async def main():

    print("Scanning for device...")

    devices = await BleakScanner.discover()

    target = None
    for d in devices:
        if d.name == DEVICE_NAME:
            target = d
            break

    if target is None:
        print("Device not found")
        return

    print("Connecting to", target.address)

    async with BleakClient(target) as client:

        print("Connected!")
        
        global start_time
        start_time = time.time()

        await client.start_notify(CHAR_UUID, handle_data)

        try:
            while True:
                await asyncio.sleep(1)

        except KeyboardInterrupt:
            print("Stopping...")

        finally:
            csv_file.close()
            print("CSV saved")


asyncio.run(main())
