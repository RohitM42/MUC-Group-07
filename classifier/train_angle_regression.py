from pathlib import Path
import pickle
import sys

import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

CLASSIFIER_DIR = Path(__file__).resolve().parent
data_dir = CLASSIFIER_DIR / "data"
raw_dir = data_dir / "raw"
processed_dir = data_dir / "processed"
models_dir = CLASSIFIER_DIR / "models"

processed_dir.mkdir(parents=True, exist_ok=True)
models_dir.mkdir(parents=True, exist_ok=True)

default_dataset_path = raw_dir / "imu_data_1774622714.csv"
dataset_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_dataset_path

required_columns = [
    "timestamp",
    "Roll1", "Pitch1", "Yaw1",
    "gx", "gy", "gz",
    "Roll2", "Pitch2", "Yaw2",
    "ax", "ay", "az",
]


live_feature_columns = [
    "Roll1", "Pitch1", "Yaw1",
    "gx", "gy", "gz",
    "Roll2", "Yaw2",
    "ax", "ay", "az",
]

angle_segments = [
    (140104, 154300, 0),
    (154300, 167100, -10),
    (167100, 177100, -20),
    (177100, 187600, -30),
    (187600, 197600, 0),
    (197600, 207500, 10),
    (207500, 217900, 30),
    (217900, 239000, 0),
]

if not dataset_path.exists():
    raise FileNotFoundError(f"Missing dataset: {dataset_path}")

dataframe = pd.read_csv(dataset_path)

missing_columns = [column for column in required_columns if column not in dataframe.columns]
if missing_columns:
    raise ValueError(f"Missing required columns: {missing_columns}")

dataframe["target_angle_deg"] = pd.NA

for index, (start_ms, end_ms, angle_deg) in enumerate(angle_segments):
    end_is_inclusive = index == len(angle_segments) - 1
    mask = dataframe["timestamp"] >= start_ms
    if end_is_inclusive:
        mask &= dataframe["timestamp"] <= end_ms
    else:
        mask &= dataframe["timestamp"] < end_ms

    dataframe.loc[mask, "target_angle_deg"] = angle_deg

labeled_dataframe = dataframe.dropna(subset=["target_angle_deg"]).copy()
labeled_dataframe["target_angle_deg"] = labeled_dataframe["target_angle_deg"].astype(float)

if labeled_dataframe.empty:
    raise ValueError("No rows matched the angle timestamp segments.")

processed_dataset_path = processed_dir / "angle_segments_labeled.csv"
labeled_dataframe.to_csv(processed_dataset_path, index=False)

feature_columns = live_feature_columns
X = labeled_dataframe[feature_columns]
y = labeled_dataframe["target_angle_deg"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y,
)

model = LinearRegression()
model.fit(X_train, y_train)

predicted_angles = model.predict(X_test)
mean_absolute_error_deg = mean_absolute_error(y_test, predicted_angles)

print("Angle counts:")
print(y.value_counts().sort_index())
print("Live features:")
print(feature_columns)
print("MAE:", round(mean_absolute_error_deg, 4))

model_path = models_dir / "angle_linear_regression.pkl"
with model_path.open("wb") as f:
    pickle.dump(model, f)

print(f"[Saved] {processed_dataset_path}")
print(f"[Saved] {model_path}")
