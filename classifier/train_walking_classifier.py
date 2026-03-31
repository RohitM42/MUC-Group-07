from pathlib import Path
import pickle

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

CLASSIFIER_DIR = Path(__file__).resolve().parent
data_dir = CLASSIFIER_DIR / "data"
processed_dir = data_dir / "processed"
models_dir = CLASSIFIER_DIR / "models"

processed_dir.mkdir(parents=True, exist_ok=True)
models_dir.mkdir(parents=True, exist_ok=True)

dataset_path = processed_dir / "windowed_filtered_imu_dataset.csv"

if not dataset_path.exists():
    raise FileNotFoundError(f"Missing dataset: {dataset_path}")

dataframe = pd.read_csv(dataset_path)

X = dataframe.drop(columns=["label", "binary_label"], errors="ignore")
y = dataframe["binary_label"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y,
)

model = Pipeline([
    ("scaler", StandardScaler()),
    ("classifier", LogisticRegression(max_iter=2000, random_state=42)),
])

model.fit(X_train, y_train)

y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

# Purely for evaluation.
print(y.value_counts())
print("Accuracy:", round(accuracy, 4))

model_path = models_dir / "walking_logistic_regression.pkl"
with model_path.open("wb") as f:
    pickle.dump(model, f)

print(f"[Saved] {model_path}")
