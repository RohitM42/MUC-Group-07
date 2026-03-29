from pathlib import Path
import pickle
import sys

import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

CLASSIFIER_DIR = Path(__file__).resolve().parent
raw_dir = CLASSIFIER_DIR / "raw"
models_dir = CLASSIFIER_DIR / "models"
models_dir.mkdir(parents=True, exist_ok=True)

# I'm going to assume its foot angle in degrees = foot yaw - ankle yaw since both Inward and
# Outward angles are mentioned. (I'm calculating angle of the foot relative to the ankle)
# Of which the values were already defined so, I'm not sure about the need for Linear Regression
# unless I'm supposed to calculate Inward/Outward from roll?

default_dataset_path = raw_dir / "imu_data_1774622714.csv"
dataset_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_dataset_path

dataframe = pd.read_csv(dataset_path)

required_columns = [
    "Roll1", "Pitch1", "Yaw1",
    "gx", "gy", "gz",
    "Roll2", "Pitch2", "Yaw2",
    "ax", "ay", "az",
]

dataframe["foot_angle_degree"] = dataframe["Yaw1"] - dataframe["Yaw2"]

feature_columns = required_columns

X = dataframe[feature_columns]
y = dataframe["foot_angle_degree"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
)

model = LinearRegression()
model.fit(X_train, y_train)

predicted_angles = model.predict(X_test)
mean_absolute_error_deg = mean_absolute_error(y_test, predicted_angles)

print("MAE:", round(mean_absolute_error_deg, 4))

model_path = models_dir / "angle_linear_regression.pkl"
with model_path.open("wb") as f:
    pickle.dump(model, f)

print(f"[Saved] {model_path}")
