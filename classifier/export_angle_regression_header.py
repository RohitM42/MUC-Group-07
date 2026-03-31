from __future__ import annotations

import argparse
import io
import pickle
import struct
from pathlib import Path


CLASSIFIER_DIR = Path(__file__).resolve().parent
REPO_ROOT = CLASSIFIER_DIR.parent
DEFAULT_MODEL_PATH = CLASSIFIER_DIR / "models" / "angle_linear_regression.pkl"
DEFAULT_OUTPUT_PATH = REPO_ROOT / "Arduino related code" / "ml + app enabled code" / "angle_model.h"

FEATURE_NAMES = [
    "Roll1",
    "Pitch1",
    "Yaw1",
    "gx",
    "gy",
    "gz",
    "Roll2",
    "Yaw2",
    "ax",
    "ay",
    "az",
]


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


class LinearRegression:
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
            ("sklearn.linear_model._base", "LinearRegression"): LinearRegression,
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


def render_header(model_path: Path) -> str:
    with model_path.open("rb") as model_file:
        model = FakeUnpickler(io.BytesIO(model_file.read())).load()

    feature_names = model.feature_names_in_.data
    coefficients = model.coef_.data
    intercept = model.intercept_

    if feature_names != FEATURE_NAMES:
        raise ValueError(f"Unexpected angle model feature order: {feature_names}")

    if len(coefficients) != len(FEATURE_NAMES):
        raise ValueError("Angle regression feature count does not match the live Arduino feature set.")

    lines = [
        "#pragma once",
        f"// Generated from {model_path.relative_to(REPO_ROOT)}",
        "// Feature order: Roll1, Pitch1, Yaw1, gx, gy, gz, Roll2, Yaw2, ax, ay, az",
        f"constexpr int ANGLE_MODEL_FEATURE_COUNT = {len(FEATURE_NAMES)};",
        f"constexpr float ANGLE_MODEL_INTERCEPT = {format_float(intercept)};",
        "constexpr float ANGLE_MODEL_COEF[ANGLE_MODEL_FEATURE_COUNT] = {",
    ]

    coef_line = ", ".join(format_float(value) for value in coefficients)
    lines.append(f"  {coef_line}")
    lines.append("};")
    lines.append("")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export classifier/models/angle_linear_regression.pkl into an Arduino header."
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
