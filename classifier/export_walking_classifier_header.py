from __future__ import annotations

import argparse
import io
import pickle
import struct
from pathlib import Path


CLASSIFIER_DIR = Path(__file__).resolve().parent
REPO_ROOT = CLASSIFIER_DIR.parent
DEFAULT_MODEL_PATH = CLASSIFIER_DIR / "models" / "walking_logistic_regression.pkl"
DEFAULT_OUTPUT_PATH = REPO_ROOT / "Arduino related code" / "ml + app enabled code" / "walking_model.h"

BASE_FEATURE_NAMES = (
    "Roll1",
    "Pitch1",
    "Yaw1",
    "gx",
    "gy",
    "gz",
    "Roll2",
    "Pitch2",
    "Yaw2",
    "ax",
    "ay",
    "az",
)
WINDOW_SIZE = 12
FEATURE_COUNT = len(BASE_FEATURE_NAMES) * WINDOW_SIZE


class FakeDType:
    def __new__(cls, code: str = "f8", *args):
        instance = super().__new__(cls)
        instance.code = code
        return instance

    def __setstate__(self, state):
        self.state = state


class FakeNDArray:
    def __new__(cls, *args, **kwargs):
        instance = super().__new__(cls)
        instance.shape = ()
        instance.data = None
        return instance

    def __setstate__(self, state):
        _, shape, dtype, _, raw = state
        self.shape = shape
        self.dtype = dtype

        code = getattr(dtype, "code", "")

        if isinstance(raw, (bytes, bytearray)):
            if "f8" in code:
                count = len(raw) // 8
                self.data = list(struct.unpack("<" + "d" * count, raw))
            elif "i8" in code:
                count = len(raw) // 8
                self.data = list(struct.unpack("<" + "q" * count, raw))
            elif "i4" in code:
                count = len(raw) // 4
                self.data = list(struct.unpack("<" + "i" * count, raw))
            else:
                self.data = list(raw)
        else:
            self.data = list(raw)


class Pipeline:
    pass


class StandardScaler:
    pass


class LogisticRegression:
    pass


def _reconstruct(subtype, shape, order):
    return subtype.__new__(subtype)


def scalar(dtype, raw):
    code = getattr(dtype, "code", "")

    if "i8" in code:
        return struct.unpack("<q", raw)[0]
    if "i4" in code:
        return struct.unpack("<i", raw)[0]
    if "f8" in code:
        return struct.unpack("<d", raw)[0]

    return raw


class FakeUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        mapping = {
            ("sklearn.pipeline", "Pipeline"): Pipeline,
            ("sklearn.preprocessing._data", "StandardScaler"): StandardScaler,
            ("sklearn.linear_model._logistic", "LogisticRegression"): LogisticRegression,
            ("numpy._core.multiarray", "_reconstruct"): _reconstruct,
            ("numpy._core.multiarray", "scalar"): scalar,
            ("numpy", "ndarray"): FakeNDArray,
            ("numpy", "dtype"): FakeDType,
        }

        if (module, name) in mapping:
            return mapping[(module, name)]

        return super().find_class(module, name)


def format_float(value: float) -> str:
    return f"{value:.9f}f"


def render_array(name: str, values: list[float], line_size: int = 6) -> str:
    lines = [f"constexpr float {name}[WALKING_MODEL_FEATURE_COUNT] = {{"]

    for index in range(0, len(values), line_size):
        chunk = ", ".join(format_float(value) for value in values[index:index + line_size])
        suffix = "," if index + line_size < len(values) else ""
        lines.append(f"  {chunk}{suffix}")

    lines.append("};")
    return "\n".join(lines)


def load_pipeline(model_path: Path):
    with model_path.open("rb") as model_file:
        return FakeUnpickler(io.BytesIO(model_file.read())).load()


def expected_feature_names() -> list[str]:
    return [
        f"{feature_name}_{frame_index}"
        for frame_index in range(WINDOW_SIZE)
        for feature_name in BASE_FEATURE_NAMES
    ]


def render_header(model_path: Path) -> str:
    pipeline = load_pipeline(model_path)
    scaler = pipeline.steps[0][1]
    classifier = pipeline.steps[1][1]

    feature_names = scaler.feature_names_in_.data
    means = scaler.mean_.data
    scales = scaler.scale_.data
    coefficients = classifier.coef_.data
    intercept = classifier.intercept_.data[0]
    classes = classifier.classes_.data

    if classes != ["not_walking", "walking"]:
        raise ValueError(f"Unexpected class ordering: {classes}")

    if feature_names != expected_feature_names():
        raise ValueError("The saved model feature order no longer matches the Arduino window layout.")

    if not (len(means) == len(scales) == len(coefficients) == FEATURE_COUNT):
        raise ValueError("Model dimensions do not match the expected 12x12 walking window.")

    parts = [
        "#pragma once",
        f"// Generated from {model_path.relative_to(REPO_ROOT)}",
        "// Feature order per frame: Roll1, Pitch1, Yaw1, gx, gy, gz, Roll2, Pitch2, Yaw2, ax, ay, az",
        "constexpr int WALKING_MODEL_WINDOW_SIZE = 12;",
        "constexpr int WALKING_MODEL_FEATURES_PER_SAMPLE = 12;",
        "constexpr int WALKING_MODEL_FEATURE_COUNT = 144;",
        f"constexpr float WALKING_MODEL_INTERCEPT = {format_float(intercept)};",
        render_array("WALKING_MODEL_MEAN", means),
        render_array("WALKING_MODEL_SCALE", scales),
        render_array("WALKING_MODEL_COEF", coefficients),
        "",
    ]

    return "\n".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export classifier/models/walking_logistic_regression.pkl into an Arduino header."
    )
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    args = parser.parse_args()

    model_path = args.model.resolve()
    output_path = args.output.resolve()

    header = render_header(model_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(header)

    print(f"[Saved] {output_path}")


if __name__ == "__main__":
    main()
