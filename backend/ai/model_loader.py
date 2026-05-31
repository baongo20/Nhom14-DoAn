"""
Model loader for Conv1D-LSTM .h5 model.

Supports lazy loading (load on first inference) and graceful fallback
when no model file is present.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger("ModelLoader")


class ModelLoadError(Exception):
    """Raised when the model cannot be loaded."""
    pass


class ModelLoader:
    """
    Handles loading and validation of the Keras .h5 model.
    """

    def __init__(self, model_path: str):
        self.model_path = model_path
        self._model = None
        self._load_attempted = False

    @property
    def is_available(self) -> bool:
        """Check if the model file exists on disk."""
        return os.path.isfile(self.model_path)

    @property
    def is_loaded(self) -> bool:
        """Check if the model has been successfully loaded into memory."""
        return self._model is not None

    def load(self) -> Optional[object]:
        """
        Load the model from disk. Returns the model object or None if not available.
        Only attempts loading once; subsequent calls return cached result.
        """
        if self._load_attempted:
            return self._model

        self._load_attempted = True

        if not self.is_available:
            logger.warning(
                f"Model file not found at '{self.model_path}'. "
                "Falling back to statistical anomaly detection."
            )
            return None

        try:
            import tensorflow as tf
            logger.info(f"Loading model from '{self.model_path}'...")
            self._model = tf.keras.models.load_model(self.model_path, compile=False)
            logger.info("Model loaded successfully.")

            # Validate expected input shape
            if hasattr(self._model, "input_shape"):
                expected = self._model.input_shape
                logger.info(f"Model expects input shape: {expected}")

            return self._model

        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            self._model = None
            return None

    def unload(self):
        """Release the model from memory."""
        self._model = None
        self._load_attempted = False
        import gc
        gc.collect()
