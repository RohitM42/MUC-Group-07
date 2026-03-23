import asyncio
import struct
import csv
import time
import os

from bleak import BleakScanner, BleakClient

# ---------- CONFIG ----------
DEVICES = {
    "IMU_Ankle": "ankle",
    "IMU_Foot": "foot"
}

CHAR_UUIDS = {
    "ankle": "19B10021-E8F2-537E-4F6C-D104768A1214",
    "foot":  "19B10011-E8F2-537E-4F6C-D104768A1214"
}

start_time = None

latest_data = {
    "ankle": None,
    "foot": None
}

# ---------- CSV Setup ----------
script_dir = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(script_dir, "dataset"), exist_ok=True)
csv_path = os.path.join(script_dir, f"dataset/imu_data_{int(time.time())}.csv")

csv_file = open(csv_path, "w", newline="")
csv_writer = csv.writer(csv_file)

csv_writer.writerow([
    "timestamp",
    "ax_ankle","ay_ankle","az_ankle","gx_ankle","gy_ankle","gz_ankle",
    "ax_foot","ay_foot","az_foot","gx_foot","gy_foot","gz_foot"
])

# ---------- Data Handler ----------
def make_handler(role):
    def handle_data(sender, data):
        global start_time

        values = struct.unpack("ffffff", data)
        latest_data[role] = values

        if all(latest_data.values()):
            ax_a, ay_a, az_a, gx_a, gy_a, gz_a = latest_data["ankle"]
            ax_f, ay_f, az_f, gx_f, gy_f, gz_f = latest_data["foot"]

            t = int((time.time() - start_time) * 1000)

            print(f"[{t}]",
                  "Ankle:", latest_data["ankle"],
                  "Foot:", latest_data["foot"])

            csv_writer.writerow([
                t,
                ax_a, ay_a, az_a, gx_a, gy_a, gz_a,
                ax_f, ay_f, az_f, gx_f, gy_f, gz_f
            ])

    return handle_data


# ---------- Connect ----------
async def connect_device(device_name, role):
    print(f"Scanning for {device_name}...")

    devices = await BleakScanner.discover()
    target = next((d for d in devices if d.name == device_name), None)

    if target is None:
        print(f"{device_name} not found")
        return None

    print(f"Connecting to {device_name} ({target.address})")

    client = BleakClient(target)
    await client.connect()

    print(f"{device_name} connected")

    await client.start_notify(CHAR_UUIDS[role], make_handler(role))

    return client


# ---------- Main ----------
async def main():
    global start_time
    start_time = time.time()

    clients = await asyncio.gather(
        connect_device("IMU_Ankle", "ankle"),
        connect_device("IMU_Foot", "foot")
    )

    try:
        while True:
            await asyncio.sleep(1)

    except KeyboardInterrupt:
        print("Stopping...")

    finally:
        for client in clients:
            if client:
                await client.disconnect()

        csv_file.close()
        print("CSV saved")


asyncio.run(main())