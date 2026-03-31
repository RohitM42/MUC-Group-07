#pragma once
// Generated from classifier/models/angle_linear_regression.pkl
// Feature order: Roll1, Pitch1, Yaw1, gx, gy, gz, Roll2, Yaw2, ax, ay, az
constexpr int ANGLE_MODEL_FEATURE_COUNT = 11;
constexpr float ANGLE_MODEL_INTERCEPT = -507.936228960f;
constexpr float ANGLE_MODEL_COEF[ANGLE_MODEL_FEATURE_COUNT] = {
  -0.976031606f, -2.600780705f, 3.598756066f, -0.008871574f, 0.018885750f, 0.006531465f, 0.452005345f, -0.001603224f, -99.224143891f, -68.885773591f, -31.657849574f
};
