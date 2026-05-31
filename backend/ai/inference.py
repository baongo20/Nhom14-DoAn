"""
Inference engine for Conv1D-LSTM anomaly detection & time forecasting.

The actual model:
- Input:  (None, 10, 6)  — 10 timesteps of 6 normalized features
- Output: (None, 1)      — single normalized value (next-step forecast for cpu_temperature)

Provides:
- Time series forecasting (iterative multi-step prediction)
- Anomaly detection (MSE-based when model available, z-score fallback otherwise)
- Graceful degradation when no .h5 model is present
"""

import time
import logging
import numpy as np
from typing import Optional, Dict, Any, List, Tuple
from collections import deque

from .config import (
    MODEL_PATH,
    SEQUENCE_LENGTH,
    PREDICTION_HORIZON,
    ANOMALY_THRESHOLD_MSE,
    ANOMALY_ZSCORE_THRESHOLD,
    FEATURE_COLUMNS,
    NUM_FEATURES,
    PRIMARY_FEATURE,
    PRIMARY_FEATURE_INDEX,
    USE_THREAD_POOL,
)
from .preprocess import DataPreprocessor
from .model_loader import ModelLoader

logger = logging.getLogger("InferenceEngine")


class StatisticalFallback:
    """
    Statistical anomaly detection using rolling z-score.
    Used when no ML model is available.
    """

    def __init__(self, window: int = SEQUENCE_LENGTH, z_threshold: float = ANOMALY_ZSCORE_THRESHOLD):
        self.window = window
        self.z_threshold = z_threshold
        self.history: Dict[str, deque] = {
            col: deque(maxlen=window) for col in FEATURE_COLUMNS
        }

    def update(self, features: Dict[str, float]):
        for col in FEATURE_COLUMNS:
            self.history[col].append(features.get(col, 0.0))

    def check_anomaly(self, features: Dict[str, float]) -> Tuple[bool, float, str]:
        """
        Returns (is_anomaly, max_z_score, anomaly_type).
        """
        max_z = 0.0
        worst_col = ""

        for col in FEATURE_COLUMNS:
            vals = list(self.history[col])
            if len(vals) < 5:
                continue

            mean = np.mean(vals)
            std = np.std(vals) + 1e-8
            current = features.get(col, 0.0)
            z = abs(current - mean) / std

            if z > max_z:
                max_z = z
                worst_col = col

        is_anomaly = max_z > self.z_threshold

        # Determine anomaly type based on worst feature
        anomaly_type = ""
        if is_anomaly:
            if worst_col in ("cpu_temperature", "cpu_usage", "cpu_load", "cpu_power"):
                anomaly_type = "cpu_anomaly"
            elif worst_col == "memory_usage":
                anomaly_type = "memory_anomaly"
            elif worst_col == "battery_level":
                anomaly_type = "battery_anomaly"
            else:
                anomaly_type = "unknown_anomaly"

        return is_anomaly, float(max_z), anomaly_type

    def forecast(self, horizon: int = PREDICTION_HORIZON) -> List[Dict[str, float]]:
        """
        Simple linear extrapolation forecast as fallback.
        """
        predictions = []
        for _ in range(horizon):
            step = {}
            for col in FEATURE_COLUMNS:
                vals = list(self.history[col])
                if len(vals) >= 3:
                    # Linear trend from last 3 points
                    slope = (vals[-1] - vals[-3]) / 2.0
                    next_val = vals[-1] + slope
                elif len(vals) >= 1:
                    next_val = vals[-1]
                else:
                    next_val = 0.0
                step[col] = round(max(0.0, next_val), 2)
            predictions.append(step)
        return predictions


class InferenceResult:
    """Container for inference output."""

    def __init__(
        self,
        prediction: Optional[List[Dict[str, float]]] = None,
        forecast_confidence: float = 0.0,
        is_anomaly: bool = False,
        anomaly_score: float = 0.0,
        anomaly_type: Optional[str] = None,
        anomaly_details: str = "System operating within normal parameters.",
        model_active: bool = False,
        warming_up: bool = False,
    ):
        self.prediction = prediction
        self.forecast_confidence = forecast_confidence
        self.is_anomaly = is_anomaly
        self.anomaly_score = anomaly_score
        self.anomaly_type = anomaly_type
        self.anomaly_details = anomaly_details
        self.model_active = model_active
        self.warming_up = warming_up

    def to_dict(self) -> Dict[str, Any]:
        return {
            "prediction": {
                "next_steps": self.prediction or [],
                "forecast_confidence": self.forecast_confidence,
            },
            "anomaly": {
                "is_anomaly": self.is_anomaly,
                "anomaly_score": round(self.anomaly_score, 4),
                "anomaly_type": self.anomaly_type,
                "details": self.anomaly_details,
            },
            "model_active": self.model_active,
            "warming_up": self.warming_up,
        }


class InferenceEngine:
    """
    Main inference engine that coordinates preprocessing, model inference,
    and anomaly detection.
    """

    def __init__(self):
        self.preprocessor = DataPreprocessor(sequence_length=SEQUENCE_LENGTH)
        self.model_loader = ModelLoader(MODEL_PATH)
        self.fallback = StatisticalFallback(window=SEQUENCE_LENGTH)
        self._model = None
        self._last_prediction: Optional[np.ndarray] = None
        self._consecutive_anomalies = 0

    @property
    def model_active(self) -> bool:
        return self._model is not None

    def initialize(self):
        """Attempt to load the model. Call once at startup."""
        self._model = self.model_loader.load()
        if self._model:
            logger.info("Conv1D-LSTM model loaded and active.")
        else:
            logger.info("No model available — using statistical fallback.")

    def _run_model_inference(self, sequence: np.ndarray) -> np.ndarray:
        """
        Run the Conv1D-LSTM model to predict the next timestep's normalized value.
        Returns array of shape (1, 1).
        """
        return self._model.predict(sequence, verbose=0)

    def _compute_mse_anomaly(
        self, predicted_normalized: float, actual_normalized: float
    ) -> Tuple[float, bool]:
        """Compute MSE between predicted and actual for the primary feature."""
        mse = float((predicted_normalized - actual_normalized) ** 2)
        is_anomaly = mse > ANOMALY_THRESHOLD_MSE
        return mse, is_anomaly

    def _generate_multi_step_forecast(
        self, sequence: np.ndarray
    ) -> Tuple[List[Dict[str, float]], float]:
        """
        Generate multi-step forecast using iterative prediction.

        The model outputs a single normalized value (next cpu_temperature).
        For other features, we use the last known value (persistence forecast).
        Returns (list of predicted feature dicts, confidence score).
        """
        predictions = []
        current_seq = sequence.copy()

        for step in range(PREDICTION_HORIZON):
            # Predict next normalized value for the primary feature
            next_pred = self._model.predict(current_seq, verbose=0)  # shape (1, 1)
            next_val_normalized = next_pred[0, 0]

            # Denormalize the primary feature value
            next_val_raw = self.preprocessor.denormalize_feature(
                next_val_normalized, PRIMARY_FEATURE_INDEX
            )

            # Build full feature dict: use last known values for other features,
            # model prediction for the primary feature
            last_raw = self.preprocessor.get_latest_raw({})  # won't work; use buffer
            # Instead, get the last row of the current sequence (normalized) and denormalize
            last_normalized = current_seq[0, -1, :]  # shape (NUM_FEATURES,)
            last_denormalized = self.preprocessor.normalizer.denormalize_vector(last_normalized)

            pred_dict = {}
            for i, col in enumerate(FEATURE_COLUMNS):
                if i == PRIMARY_FEATURE_INDEX:
                    pred_dict[col] = round(next_val_raw, 2)
                else:
                    pred_dict[col] = round(float(last_denormalized[i]), 2)

            predictions.append(pred_dict)

            # Slide window: remove first timestep, append new normalized vector
            # For the primary feature, use the model output; for others, keep last value
            new_normalized = last_normalized.copy()
            new_normalized[PRIMARY_FEATURE_INDEX] = next_val_normalized

            current_seq = np.roll(current_seq, shift=-1, axis=1)
            current_seq[0, -1, :] = new_normalized

        # Confidence decays with each step
        confidence = max(0.3, 1.0 - (PREDICTION_HORIZON * 0.12))
        return predictions, round(confidence, 3)

    def analyze(self, snapshot_dict: Dict[str, Any]) -> InferenceResult:
        """
        Main entry point: process a snapshot and return inference results.
        """
        # 1. Preprocess
        sequence = self.preprocessor.process(snapshot_dict)

        # 2. Get raw features for fallback / anomaly comparison
        raw_features = self.preprocessor.extractor.extract(snapshot_dict)

        # 3. Update statistical fallback history
        self.fallback.update(raw_features)

        # 4. Check if buffer is still warming up
        if sequence is None:
            return InferenceResult(
                warming_up=True,
                model_active=self.model_active,
                anomaly_details=(
                    f"Model is warming up: "
                    f"{self.preprocessor.buffer.fill_ratio() * 100:.0f}% buffer filled."
                ),
            )

        # 5. Run inference
        if self.model_active:
            try:
                # Multi-step forecast
                predictions, confidence = self._generate_multi_step_forecast(sequence)

                # Anomaly detection via MSE between predicted and actual primary feature
                actual_normalized = self.preprocessor.get_latest_raw(snapshot_dict)
                predicted_normalized = self._model.predict(sequence, verbose=0)[0, 0]

                mse, is_anomaly = self._compute_mse_anomaly(
                    predicted_normalized, actual_normalized[PRIMARY_FEATURE_INDEX]
                )

                # Determine anomaly type
                anomaly_type = None
                if is_anomaly:
                    self._consecutive_anomalies += 1
                    anomaly_type = PRIMARY_FEATURE
                else:
                    self._consecutive_anomalies = 0

                details = self._build_anomaly_details(
                    is_anomaly, mse, anomaly_type, raw_features
                )

                return InferenceResult(
                    prediction=predictions,
                    forecast_confidence=confidence,
                    is_anomaly=is_anomaly,
                    anomaly_score=mse,
                    anomaly_type=anomaly_type,
                    anomaly_details=details,
                    model_active=True,
                )

            except Exception as e:
                logger.error(f"Model inference failed: {e}. Falling back to statistical.")
                # Fall through to statistical fallback

        # 6. Statistical fallback
        is_anomaly, z_score, anomaly_type = self.fallback.check_anomaly(raw_features)
        predictions = self.fallback.forecast()

        if is_anomaly:
            self._consecutive_anomalies += 1
        else:
            self._consecutive_anomalies = 0

        details = self._build_anomaly_details(
            is_anomaly, z_score, anomaly_type, raw_features, is_statistical=True
        )

        return InferenceResult(
            prediction=predictions,
            forecast_confidence=0.5,  # Lower confidence for statistical method
            is_anomaly=is_anomaly,
            anomaly_score=z_score,
            anomaly_type=anomaly_type,
            anomaly_details=details,
            model_active=False,
        )

    def _build_anomaly_details(
        self,
        is_anomaly: bool,
        score: float,
        anomaly_type: Optional[str],
        raw_features: Dict[str, float],
        is_statistical: bool = False,
    ) -> str:
        """Build a human-readable anomaly description."""
        if not is_anomaly:
            return "System operating within normal parameters."

        method = "Statistical (z-score)" if is_statistical else "Deep Learning (MSE)"
        parts = [f"[{method}] Anomaly detected"]

        if anomaly_type and anomaly_type in raw_features:
            parts.append(f"in '{anomaly_type}' (current: {raw_features[anomaly_type]:.1f})")

        parts.append(f"score: {score:.4f}")

        if self._consecutive_anomalies > 3:
            parts.append("— PERSISTENT anomaly, recommended action needed.")

        return " ".join(parts)

    def reset(self):
        """Reset the engine state (buffer, history)."""
        self.preprocessor.reset()
        self.fallback = StatisticalFallback(window=SEQUENCE_LENGTH)
        self._consecutive_anomalies = 0
        logger.info("Inference engine reset.")
