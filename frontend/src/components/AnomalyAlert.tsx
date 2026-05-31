import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Thermometer,
  Cpu,
  HardDrive,
  Activity,
  X,
  Zap,
  CheckCircle,
} from "lucide-react";
import type { AnomalyData } from "../types";

interface AnomalyAlertProps {
  anomaly: AnomalyData | null;
  modelActive: boolean;
  warmingUp: boolean;
}

export const AnomalyAlert: React.FC<AnomalyAlertProps> = ({
  anomaly,
  modelActive,
  warmingUp,
}) => {
  const [dismissedAnomaly, setDismissedAnomaly] = useState(false);

  // Reset dismiss state when a new anomaly arrives
  useEffect(() => {
    if (anomaly?.is_anomaly) {
      setDismissedAnomaly(false);
    }
  }, [anomaly?.is_anomaly, anomaly?.anomaly_score]);

  if (warmingUp) return null;

  // ── ANOMALY DETECTED ────────────────────────────────────────────────
  if (anomaly?.is_anomaly && !dismissedAnomaly) {
    const getAnomalyIcon = () => {
      const type = anomaly.anomaly_type || "";
      if (type.includes("cpu") || type.includes("temp"))
        return <Thermometer className="w-5 h-5" />;
      if (type.includes("memory") || type.includes("mem"))
        return <HardDrive className="w-5 h-5" />;
      if (type.includes("disk")) return <Activity className="w-5 h-5" />;
      if (type.includes("net")) return <Zap className="w-5 h-5" />;
      return <AlertTriangle className="w-5 h-5" />;
    };

    const getSeverityColor = () => {
      const score = anomaly.anomaly_score;
      if (score > 0.15) return "bg-rose-500/10 border-rose-500/30 text-rose-400";
      if (score > 0.08) return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
    };

    const getSeverityLabel = () => {
      const score = anomaly.anomaly_score;
      if (score > 0.15) return "CRITICAL";
      if (score > 0.08) return "WARNING";
      return "ALERT";
    };

    return (
      <div className="fixed top-20 right-6 z-50 max-w-md w-full animate-slide-in">
        <div className={`rounded-2xl p-4 border shadow-xl backdrop-blur-xl ${getSeverityColor()}`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">{getAnomalyIcon()}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {getSeverityLabel()} — Anomaly Detected
                </span>
                <span className="text-[10px] font-mono opacity-70">
                  (score: {anomaly.anomaly_score.toFixed(3)})
                </span>
              </div>
              <p className="text-sm opacity-90 leading-relaxed">{anomaly.details}</p>
              {anomaly.anomaly_type && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded">
                    Affected: {anomaly.anomaly_type}
                  </span>
                  {modelActive && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 px-2 py-0.5 rounded">
                      AI Model Active
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setDismissedAnomaly(true)}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-black/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SYSTEM NORMAL (always visible when model is active and no anomaly) ──
  if (modelActive && anomaly !== null && !anomaly.is_anomaly) {
    return (
      <div className="fixed top-20 right-6 z-50 max-w-md w-full animate-slide-in">
        <div className="rounded-2xl p-4 border shadow-xl backdrop-blur-xl bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">
                  ✅ SYSTEM NORMAL
                </span>
              </div>
              <p className="text-sm opacity-90 leading-relaxed">
                All metrics are within expected ranges. No anomalies detected.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded">
                  AI Model Monitoring
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
