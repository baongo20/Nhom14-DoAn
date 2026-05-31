"""
Real-time Anomaly Detection Simulation for Section 4.5.2
"Simulation Results of Real-time Anomaly Detection System"

Description:
  - Generates simulated data with 6 features over 200 time steps
  - Injects 2 synthetic anomalies at steps 80 and 150
  - Measures end-to-end inference time per window
  - Compares Residual Error vs Threshold to determine STATUS
  - Outputs formatted table and statistical analysis

Usage:
  python simulate_realtime.py
"""

import os
import sys
import time
import numpy as np
import pandas as pd

# Add backend to path for imports
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, backend_dir)

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress TensorFlow logs

from ai.inference import InferenceEngine
from ai.config import (
    FEATURE_COLUMNS, SEQUENCE_LENGTH, PRIMARY_FEATURE,
    PRIMARY_FEATURE_INDEX, ANOMALY_THRESHOLD_MSE
)

# ─────────────────────────────────────────────────────────────────────────────
# 1. GENERATE SIMULATED DATA
# ─────────────────────────────────────────────────────────────────────────────

def generate_simulated_data(n_steps: int = 200, seed: int = 42) -> pd.DataFrame:
    """
    Generate simulated data for 6 features over n_steps time steps.

    Normal data: oscillates around baseline values with small Gaussian noise.
    Anomalies: sudden spikes in cpu_temperature at specified steps.
    """
    rng = np.random.default_rng(seed)

    # Baseline values (typical laptop values under normal load)
    baselines = {
        "cpu_temperature": 55.0,   # deg C
        "cpu_usage":       30.0,   # %
        "cpu_load":         1.0,   # load average
        "memory_usage":    45.0,   # %
        "battery_level":   80.0,   # %
        "cpu_power":       25.0,   # W
    }

    # Noise amplitudes
    noises = {
        "cpu_temperature": 3.0,
        "cpu_usage":       8.0,
        "cpu_load":        0.3,
        "memory_usage":    4.0,
        "battery_level":   1.0,
        "cpu_power":       5.0,
    }

    data = {}
    for col in FEATURE_COLUMNS:
        # Random walk around baseline
        values = baselines[col] + noises[col] * rng.normal(0, 1, n_steps)
        values = np.maximum(values, 0)  # no negative values
        data[col] = values

    # ── Inject Anomalies ──
    # Anomaly 1: CPU temperature spike at step 80
    data["cpu_temperature"][80:85] = baselines["cpu_temperature"] + np.array([25, 30, 35, 28, 20])

    # Anomaly 2: CPU usage + temperature spike at step 150
    data["cpu_temperature"][150:155] = baselines["cpu_temperature"] + np.array([20, 28, 32, 25, 15])
    data["cpu_usage"][150:155] = baselines["cpu_usage"] + np.array([40, 55, 60, 45, 30])

    return pd.DataFrame(data)


# ─────────────────────────────────────────────────────────────────────────────
# 2. REAL-TIME DETECTION SIMULATION
# ─────────────────────────────────────────────────────────────────────────────

def simulate_realtime_detection(
    df: pd.DataFrame,
    threshold: float = ANOMALY_THRESHOLD_MSE
) -> pd.DataFrame:
    """
    Simulate the real-time anomaly detection pipeline.

    For each time step:
      1. Acquire sliding window of 10 most recent steps (6 features)
      2. Normalize using MinMaxScaler (loaded from scaler.gz)
      3. Predict cpu_temperature using Conv1D-LSTM model
      4. Compute Residual Error = |predicted - actual| (both in scaled space)
      5. Compare with threshold -> STATUS

    Returns:
        DataFrame with columns: step, predicted_scaled, actual_scaled,
        residual_error, threshold, status, processing_time_ms
    """
    engine = InferenceEngine()
    engine.initialize()

    results = []

    header = f"{'Step':>5} | {'Predicted':>10} | {'Actual':>10} | {'Residual':>10} | {'Threshold':>9} | {'Time(ms)':>10} | {'STATUS'}"
    print("=" * len(header))
    print(header)
    print("-" * len(header))

    for step in range(len(df)):
        # Get current row
        row = df.iloc[step]

        # Build simulated snapshot dict
        snapshot = {
            "timestamp": time.time(),
            "cpu": {
                "overall_usage": float(row["cpu_usage"]),
                "load_avg": [float(row["cpu_load"]), float(row["cpu_load"]), float(row["cpu_load"])],
                "temperature": float(row["cpu_temperature"]),
                "power_draw": float(row["cpu_power"]),
            },
            "memory": {
                "virtual": {"percent": float(row["memory_usage"])},
                "swap": {"percent": 10.0},
            },
            "battery": {
                "percent": float(row["battery_level"]),
                "power_plugged": True,
                "secs_left": -1,
            },
            "disk": {"partitions": [], "read_speed_bps": 0, "write_speed_bps": 0},
            "network": {"interfaces": [], "upload_speed_bps": 0, "download_speed_bps": 0},
            "processes": [],
            "system": {"os_name": "Windows", "os_version": "10", "hostname": "sim", "cpu_model": "Sim", "ram_total": 17179869184, "uptime_seconds": 3600},
        }

        # Measure inference time
        t_start = time.perf_counter()
        result = engine.analyze(snapshot)
        t_elapsed = (time.perf_counter() - t_start) * 1000  # convert to ms

        # Only record when buffer is full (not warming up)
        if not result.warming_up and engine.model_active:
            # Get predicted value from result
            if result.prediction and len(result.prediction) > 0:
                predicted_raw = result.prediction[0].get(PRIMARY_FEATURE, 0.0)
            else:
                predicted_raw = 0.0

            actual_raw = float(row[PRIMARY_FEATURE])

            # Normalize actual value using the same scaler
            features_dict = {col: float(row[col]) for col in FEATURE_COLUMNS}
            actual_normalized = engine.preprocessor.normalizer.normalize(features_dict)
            actual_scaled = actual_normalized[PRIMARY_FEATURE_INDEX]

            # Get model prediction in scaled space
            sequence = engine.preprocessor.buffer.get_sequence()
            if sequence is not None and engine._model is not None:
                predicted_scaled = float(engine._model.predict(sequence, verbose=0)[0, 0])
            else:
                predicted_scaled = 0.0

            # Compute residual error
            residual = abs(predicted_scaled - actual_scaled)

            # Determine STATUS
            is_anomaly = residual > threshold
            status = "** ANOMALY **" if is_anomaly else "   NORMAL   "

            results.append({
                "step": step,
                "predicted_scaled": round(predicted_scaled, 4),
                "actual_scaled": round(actual_scaled, 4),
                "residual_error": round(residual, 4),
                "threshold": threshold,
                "status": "ANOMALY" if is_anomaly else "NORMAL",
                "processing_time_ms": round(t_elapsed, 3),
                "predicted_raw": round(predicted_raw, 2),
                "actual_raw": round(actual_raw, 2),
            })

            # Print to console (important steps or anomalies)
            if is_anomaly or step < 15 or step % 20 == 0:
                print(f"{step:>5} | {predicted_scaled:>10.4f} | {actual_scaled:>10.4f} | {residual:>10.4f} | {threshold:>9.4f} | {t_elapsed:>8.3f} | {status}")

    print("=" * len(header))
    return pd.DataFrame(results)


# ─────────────────────────────────────────────────────────────────────────────
# 3. ANALYZE RESULTS
# ─────────────────────────────────────────────────────────────────────────────

def analyze_results(results: pd.DataFrame):
    """Statistical analysis of simulation results."""
    if len(results) == 0:
        print("No results to analyze.")
        return

    print("\n" + "=" * 70)
    print("SIMULATION RESULTS ANALYSIS")
    print("=" * 70)

    # Inference time statistics
    times = results["processing_time_ms"]
    print("\n[End-to-End Inference Time Statistics]:")
    print(f"  - Samples:          {len(results)}")
    print(f"  - Mean:             {times.mean():.3f} ms")
    print(f"  - Min:              {times.min():.3f} ms")
    print(f"  - Max:              {times.max():.3f} ms")
    print(f"  - Std Dev:          {times.std():.3f} ms")

    # Anomaly detection statistics
    anomalies = results[results["status"] == "ANOMALY"]
    normals = results[results["status"] == "NORMAL"]

    print("\n[Anomaly Detection Statistics]:")
    print(f"  - Total steps:      {len(results)}")
    print(f"  - Normal:           {len(normals)} ({len(normals)/len(results)*100:.1f}%)")
    print(f"  - Anomalies:        {len(anomalies)} ({len(anomalies)/len(results)*100:.1f}%)")

    if len(anomalies) > 0:
        print("\n[Detected Anomaly Steps]:")
        for _, row in anomalies.iterrows():
            print(f"  - Step {int(row['step'])}: Residual={row['residual_error']:.4f} > Threshold={row['threshold']:.4f}")

    # Current threshold
    print(f"\n[Detection Threshold]: {results['threshold'].iloc[0]:.4f}")

    # Residual error statistics
    residuals = results["residual_error"]
    print("\n[Residual Error Statistics]:")
    print(f"  - Mean:             {residuals.mean():.4f}")
    print(f"  - Max:              {residuals.max():.4f}")
    print(f"  - Median:           {residuals.median():.4f}")

    # Example output (matching report format)
    print("\n[Example Output - Anomaly Case]:")
    print("  [REAL-TIME ALERT SYSTEM]")
    if len(anomalies) > 0:
        sample = anomalies.iloc[0]
        print(f"  Processing Time:     {sample['processing_time_ms']/1000:.4f} seconds")
        print(f"  Predicted Temp (Scaled): {sample['predicted_scaled']:.4f}")
        print(f"  Actual Temp (Scaled):    {sample['actual_scaled']:.4f}")
        print(f"  Residual Error:          {sample['residual_error']:.4f}")
        print(f"  Threshold Limit:         {sample['threshold']:.4f}")
        print(f"  STATUS: ANOMALY DETECTED - TRIGGERING ALERT!")

    print("\n[Example Output - Normal Case]:")
    if len(normals) > 0:
        sample = normals.iloc[0]
        print(f"  Processing Time:     {sample['processing_time_ms']/1000:.4f} seconds")
        print(f"  Predicted Temp (Scaled): {sample['predicted_scaled']:.4f}")
        print(f"  Actual Temp (Scaled):    {sample['actual_scaled']:.4f}")
        print(f"  Residual Error:          {sample['residual_error']:.4f}")
        print(f"  Threshold Limit:         {sample['threshold']:.4f}")
        print(f"  STATUS: SYSTEM OPERATING WITHIN NORMAL PARAMETERS")


# ─────────────────────────────────────────────────────────────────────────────
# 4. MAIN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 70)
    print("REAL-TIME ANOMALY DETECTION SIMULATION")
    print("Section 4.5.2 - Simulation Results")
    print("=" * 70)

    # Step 1: Generate simulated data
    print("\n[Generating simulated data...]")
    df = generate_simulated_data(n_steps=200)
    print(f"  - Steps: {len(df)}")
    print(f"  - Features: {len(df.columns)}")
    print(f"  - Feature list: {list(df.columns)}")
    print(f"  - Anomaly injected at steps 80-84 (CPU temperature spike)")
    print(f"  - Anomaly injected at steps 150-154 (CPU usage + temperature spike)")

    # Step 2: Run simulation
    print("\n[Running real-time detection simulation...]\n")
    results = simulate_realtime_detection(df)

    # Step 3: Analyze results
    analyze_results(results)

    # Step 4: Export to CSV
    output_file = "simulation_results.csv"
    results.to_csv(output_file, index=False)
    print(f"\n[Results saved to: {output_file}]")

    print("\n" + "=" * 70)
    print("SIMULATION COMPLETE")
    print("=" * 70)
