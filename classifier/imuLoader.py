from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

CLASSIFIER_DIR = Path(__file__).resolve().parent
data_dir = CLASSIFIER_DIR / "data"
raw_dir = data_dir / "raw"
processed_dir = data_dir / "processed"

raw_dir.mkdir(parents=True, exist_ok=True)
processed_dir.mkdir(parents=True, exist_ok=True)

walking_dataset_path = raw_dir / "imu_data_1774622714.csv"

if not walking_dataset_path.exists():
    print(f"[Error] Missing filtered IMU dataset: {walking_dataset_path}")
else:
    dataframe = pd.read_csv(walking_dataset_path)
    dataframe["label"] = "other"

    dataframe.loc[(dataframe["timestamp"] >= 18051) & (dataframe["timestamp"] < 34051),"label"] = "standing_still"

    dataframe.loc[(dataframe["timestamp"] >= 34051) & (dataframe["timestamp"] <= 99480),"label"] = "walking"

    dataframe.loc[(dataframe["timestamp"] > 99480) & (dataframe["timestamp"] <= 106051),"label"] = "sitting_down"

    output_path = processed_dir / "filtered_imu_labeled.csv"
    dataframe.to_csv(output_path, index=False)
    print(f"[Saved] {output_path}")

    feature_columns = [
        "Roll1", "Pitch1", "Yaw1",
        "gx", "gy", "gz",
        "Roll2", "Pitch2", "Yaw2",
        "ax", "ay", "az",
    ]

    window_size = 12
    window_rows = []

    for start in range(0, len(dataframe) - window_size + 1, window_size):
        window = dataframe.iloc[start:start + window_size]

        if window["label"].nunique() != 1:
            continue

        window_label = window["label"].iloc[0]
        if window_label == "other":
            continue

        flattened_values = {}
        for row_index, (_, row) in enumerate(window.iterrows()):
            for column in feature_columns:
                flattened_values[f"{column}_{row_index}"] = row[column]

        flattened_values["label"] = window_label
        window_rows.append(flattened_values)

    windowed_dataframe = pd.DataFrame(window_rows)
    windowed_dataframe["binary_label"] = windowed_dataframe["label"].replace({
        "walking": "walking",
        "standing_still": "not_walking",
        "sitting_down": "not_walking",
    })

    window_output_path = processed_dir / "windowed_filtered_imu_dataset.csv"
    windowed_dataframe.to_csv(window_output_path, index=False)
    print(f"[Saved] {window_output_path}")

    X = windowed_dataframe.drop(columns=["label", "binary_label"])
    y = windowed_dataframe["binary_label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
