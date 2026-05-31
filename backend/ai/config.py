"""
Configuration constants for the Conv1D-LSTM anomaly detection & time forecasting system.

Matches the actual trained model:
- Input:  (None, 10, 6)  — 10 timesteps, 6 features
- Output: (None, 1)      — single normalized value (cpu_temperature forecast)
- Scaler: sklearn MinMaxScaler fitted on the 6 features below
"""

import os

# ── Model & Scaler Paths ─────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "conv1d_lstm.h5")
SCALER_PATH = os.path.join(BASE_DIR, "models", "scaler.gz")

# ── Sequence / Window Configuration ──────────────────────────────────────
SEQUENCE_LENGTH = 10       # Number of past timesteps used for prediction (10 * 0.5s = 5s)
PREDICTION_HORIZON = 5     # Number of future timesteps to predict (5 * 0.5s = 2.5s ahead)
SAMPLE_INTERVAL = 0.5      # Seconds between samples (must match WebSocket loop)

# ── Anomaly Detection ────────────────────────────────────────────────────
ANOMALY_THRESHOLD_MSE = 0.05   # MSE threshold above which a point is flagged as anomalous
ANOMALY_ZSCORE_THRESHOLD = 3.0 # Z-score threshold for statistical fallback

# ── Feature Configuration (matches scaler feature order) ─────────────────
FEATURE_COLUMNS = [
    "cpu_temperature",   # °C
    "cpu_usage",         # %
    "cpu_load",          # load average (normalized)
    "memory_usage",      # %
    "battery_level",     # %
    "cpu_power",         # W
]

NUM_FEATURES = len(FEATURE_COLUMNS)

# The model predicts a single normalized value.
# We interpret it as the next-step forecast for the PRIMARY_FEATURE (cpu_temperature).
PRIMARY_FEATURE = "cpu_temperature"
PRIMARY_FEATURE_INDEX = FEATURE_COLUMNS.index(PRIMARY_FEATURE)  # 0

# ── Inference Performance ────────────────────────────────────────────────
INFERENCE_TIMEOUT = 0.3   # Max seconds allowed for a single inference call
USE_THREAD_POOL = True    # Run model inference in a background thread
