import asyncio
import struct
import csv
import time
import os

from bleak import BleakScanner, BleakClient

#the device name and uuid are dependent on the code on the arduino and may need to be changed
DEVICE_NAME = "Nano33BLE_IMU"
CHAR_UUID = "19B10011-E8F2-537E-4F6C-D104768A1214"
start_time = None

# ---------- CSV Setup ----------
script_dir = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(script_dir, "dataset"), exist_ok=True)
csv_path = os.path.join(script_dir, f"dataset\imu_data_{int(time.time())}.csv")

csv_file = open(csv_path, "w", newline="")
csv_writer = csv.writer(csv_file)

csv_writer.writerow([
    "timestamp",
    "ax","ay","az",
    "gx","gy","gz",
    "mx","my","mz"
])

# ---------- Data Handler ----------
def handle_data(sender, data):

    global start_time

    values = struct.unpack("fffffffff", data)

    ax, ay, az = values[0:3]
    gx, gy, gz = values[3:6]
    mx, my, mz = values[6:9]

    # Relative time in milliseconds since connection
    t = int((time.time() - start_time) * 1000)

    print("ACC:", ax, ay, az,
          "GYR:", gx, gy, gz,
          "MAG:", mx, my, mz)

    csv_writer.writerow([
        t,
        ax, ay, az,
        gx, gy, gz,
        mx, my, mz
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