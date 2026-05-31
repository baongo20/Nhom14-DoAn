"""
Data preprocessing pipeline for Conv1D-LSTM model input.

Transforms raw HardwareSnapshot metrics into normalized feature vectors
using the actual MinMaxScaler that was fitted during model training,
and maintains a sliding window buffer for sequence formation.
"""

import os
import logging
import numpy as np
from collections import deque
from typing import List, Optional, Dict, Any

from .config import (
    FEATURE_COLUMNS,
    NUM_FEATURES,
    SEQUENCE_LENGTH,
    SCALER_PATH,
)

logger = logging.getLogger("Preprocess")

# ── Scaler Loader (lazy singleton) ────────────────────────────────────────

_scaler = None


def _load_scaler():
    """Load the MinMaxScaler from disk (lazy, cached)."""
    global _scaler
    if _scaler is not None:
        return _scaler
    try:
        import joblib
        if not os.path.isfile(SCALER_PATH):
            logger.warning(f"Scaler file not found at '{SCALER_PATH}'")
            return None
        _scaler = joblib.load(SCALER_PATH)
        logger.info(f"Scaler loaded: {type(_scaler).__name__} with {_scaler.n_features_in_} features")
        return _scaler
    except Exception as e:
        logger.error(f"Failed to load scaler: {e}")
        return None


# ── Feature Extractor ─────────────────────────────────────────────────────

class FeatureExtractor:
    """
    Extracts the 6 features (matching the scaler) from a HardwareSnapshot dict.
    """

    # Mapping from snapshot dict paths to our feature names
    SNAPSHOT_PATHS = {
        "cpu_temperature": ("cpu", "temperature"),
        "cpu_usage":       ("cpu", "overall_usage"),
        "cpu_load":        ("cpu", "load_avg"),       # list; we take the 1-min average
        "memory_usage":    ("memory", "virtual", "percent"),
        "battery_level":   ("battery", "percent"),
        "cpu_power":       ("cpu", "power_draw"),
    }

    @staticmethod
    def extract(snapshot_dict: Dict[str, Any]) -> Dict[str, float]:
        features: Dict[str, float] = {}

        for feat_name, path in FeatureExtractor.SNAPSHOT_PATHS.items():
            val = snapshot_dict
            try:
                for key in path:
                    val = val.get(key, {}) if isinstance(val, dict) else {}
                # Special handling: cpu_load is a list, take first element (1-min avg)
                if feat_name == "cpu_load" and isinstance(val, list) and len(val) > 0:
                    val = val[0]
                features[feat_name] = float(val) if val is not None else 0.0
            except (TypeError, IndexError, ValueError):
                features[feat_name] = 0.0

        return features


# ── Scaler-Based Normalizer ───────────────────────────────────────────────

class ScalerNormalizer:
    """
    Normalizes feature vectors using the actual MinMaxScaler from training.
    Falls back to identity (no normalization) if scaler is unavailable.
    """

    def __init__(self):
        self.scaler = _load_scaler()
        if self.scaler is None:
            logger.warning("No scaler available — using identity normalization.")

    def normalize(self, features: Dict[str, float]) -> np.ndarray:
        """
        Convert a dict of raw feature values into a normalized numpy array.
        Returns shape (NUM_FEATURES,).
        """
        arr = np.zeros(NUM_FEATURES, dtype=np.float32)
        for i, col in enumerate(FEATURE_COLUMNS):
            arr[i] = features.get(col, 0.0)

        if self.scaler is not None:
            # Use DataFrame with feature names to avoid sklearn warnings
            try:
                import pandas as pd
                df = pd.DataFrame([arr.tolist()], columns=FEATURE_COLUMNS)
                arr = self.scaler.transform(df).flatten().astype(np.float32)
            except ImportError:
                arr = self.scaler.transform(arr.reshape(1, -1)).flatten()

        return arr

    def denormalize(self, normalized: np.ndarray, feature_idx: int) -> float:
        """
        Convert a single normalized value back to the original scale.
        Uses the scaler's inverse transform for the given feature index.
        """
        if self.scaler is None:
            return float(normalized) if np.ndim(normalized) == 0 else float(normalized[0])

        # Build a full-size normalized vector (zeros for other features)
        full = np.zeros((1, NUM_FEATURES), dtype=np.float32)
        full[0, feature_idx] = normalized if np.ndim(normalized) == 0 else normalized[0]
        try:
            import pandas as pd
            df = pd.DataFrame(full, columns=FEATURE_COLUMNS)
            inv = self.scaler.inverse_transform(df)
        except ImportError:
            inv = self.scaler.inverse_transform(full)
        return float(inv[0, feature_idx])

    def denormalize_vector(self, normalized: np.ndarray) -> np.ndarray:
        """Convert a full normalized vector back to original scale."""
        if self.scaler is None:
            return normalized
        try:
            import pandas as pd
            df = pd.DataFrame(normalized.reshape(1, -1), columns=FEATURE_COLUMNS)
            return self.scaler.inverse_transform(df).flatten()
        except ImportError:
            return self.scaler.inverse_transform(normalized.reshape(1, -1)).flatten()


# ── Sliding Window Buffer ─────────────────────────────────────────────────

class SlidingWindowBuffer:
    """
    Maintains a fixed-size sliding window of normalized feature vectors.
    """

    def __init__(self, maxlen: int = SEQUENCE_LENGTH):
        self.maxlen = maxlen
        self.buffer: deque = deque(maxlen=maxlen)

    def append(self, vector: np.ndarray):
        self.buffer.append(vector)

    def is_full(self) -> bool:
        return len(self.buffer) >= self.maxlen

    def fill_ratio(self) -> float:
        return len(self.buffer) / self.maxlen

    def get_sequence(self) -> Optional[np.ndarray]:
        """
        Returns a numpy array of shape (1, SEQUENCE_LENGTH, NUM_FEATURES)
        if the buffer is full, otherwise None.
        """
        if not self.is_full():
            return None
        return np.array(self.buffer, dtype=np.float32).reshape(1, self.maxlen, NUM_FEATURES)

    def reset(self):
        self.buffer.clear()


# ── DataPreprocessor (orchestrator) ───────────────────────────────────────

class DataPreprocessor:
    """
    Orchestrates the full preprocessing pipeline:
    1. Extract features from snapshot
    2. Normalize features using the actual MinMaxScaler
    3. Append to sliding window
    4. Return sequence tensor if buffer is full
    """

    def __init__(self, sequence_length: int = SEQUENCE_LENGTH):
        self.extractor = FeatureExtractor()
        self.normalizer = ScalerNormalizer()
        self.buffer = SlidingWindowBuffer(maxlen=sequence_length)
        self.sequence_length = sequence_length

    def process(self, snapshot_dict: Dict[str, Any]) -> Optional[np.ndarray]:
        """
        Process a single snapshot and return a sequence tensor if the buffer is full.
        Returns None if still warming up.
        """
        features = self.extractor.extract(snapshot_dict)
        normalized = self.normalizer.normalize(features)
        self.buffer.append(normalized)
        return self.buffer.get_sequence()

    def get_latest_raw(self, snapshot_dict: Dict[str, Any]) -> np.ndarray:
        """Get the normalized vector for the current snapshot (without buffer)."""
        features = self.extractor.extract(snapshot_dict)
        return self.normalizer.normalize(features)

    def denormalize_feature(self, normalized_value: float, feature_idx: int) -> float:
        return self.normalizer.denormalize(normalized_value, feature_idx)

    def reset(self):
        self.buffer.reset()
