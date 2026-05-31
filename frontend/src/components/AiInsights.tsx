import React from 'react';
import {
  BrainCircuit,
  Cpu,
  Database,
  Battery,
  HardDrive,
  Thermometer,
  Activity,
  Zap,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { PredictedMetrics, AnomalyData } from '../types';

interface AiInsightsProps {
  cpuUsage: number;
  memoryUsage: number;
  temperature: number;
  batteryPlugged: boolean;
  diskWriteSpeedBps: number;
  predictions: PredictedMetrics[];
  forecastConfidence: number;
  anomaly: AnomalyData | null;
  modelActive: boolean;
  warmingUp: boolean;
  bufferFillPercent: number;
}

export const AiInsights: React.FC<AiInsightsProps> = ({
  cpuUsage,
  memoryUsage,
  temperature,
  batteryPlugged,
  diskWriteSpeedBps,
  predictions,
  forecastConfidence,
  anomaly,
  modelActive,
  warmingUp,
  bufferFillPercent,
}) => {
  // ── Auto-generated evaluations (always active) ──────────────────────

  const getEvaluations = () => {
    const items: Array<{
      icon: React.ReactNode;
      title: string;
      text: string;
      status: string;
    }> = [];

    // CPU check
    if (cpuUsage > 80) {
      items.push({
        icon: <Cpu className="w-4 h-4 text-rose-400" />,
        title: 'CPU Stress Detected',
        text: 'High utilization detected. Recommending closing heavy resource background threads or active video editors.',
        status: 'critical',
      });
    } else if (cpuUsage > 50) {
      items.push({
        icon: <Cpu className="w-4 h-4 text-amber-400" />,
        title: 'Moderate CPU Workload',
        text: 'System processing moderate load. Fans may scale up. Thermal levels are currently stable.',
        status: 'warning',
      });
    } else {
      items.push({
        icon: <Cpu className="w-4 h-4 text-emerald-400" />,
        title: 'CPU Core Performance',
        text: 'Processor load is highly optimal. Deep power-saving states are active for idle logical threads.',
        status: 'optimal',
      });
    }

    // Thermal check
    if (temperature > 75) {
      items.push({
        icon: <Thermometer className="w-4 h-4 text-rose-400" />,
        title: 'Elevated CPU Temperature',
        text: 'Processor temperature is higher than normal. Ensure laptop vents are clear or adjust fan curves.',
        status: 'critical',
      });
    } else {
      items.push({
        icon: <Thermometer className="w-4 h-4 text-emerald-400" />,
        title: 'Thermal Dissipation Health',
        text: 'Core temperature is highly healthy. Operating safely far below the thermal throttling limit (100°C).',
        status: 'optimal',
      });
    }

    // Memory check
    if (memoryUsage > 85) {
      items.push({
        icon: <Database className="w-4 h-4 text-rose-400" />,
        title: 'RAM Saturation Risk',
        text: 'Physical RAM usage exceeds 85%. Closing inactive browser tabs or IDE windows is highly advised.',
        status: 'critical',
      });
    } else {
      items.push({
        icon: <Database className="w-4 h-4 text-emerald-400" />,
        title: 'Memory Allocations',
        text: 'System memory is efficiently allocated. Abundant caching space remains for standard processes.',
        status: 'optimal',
      });
    }

    // Battery check
    if (batteryPlugged) {
      items.push({
        icon: <Battery className="w-4 h-4 text-blue-400" />,
        title: 'Constant AC Power',
        text: 'System connected to mains power. To prolong long-term battery cell health, limit charge thresholds to 80% if supported.',
        status: 'info',
      });
    } else {
      items.push({
        icon: <Battery className="w-4 h-4 text-amber-400" />,
        title: 'On Battery Power',
        text: 'Active battery discharge. Screen brightness reduction and disabling Bluetooth could yield up to 45 mins extra usage.',
        status: 'warning',
      });
    }

    // Disk write speed check
    if (diskWriteSpeedBps > 1024 * 1024 * 10) {
      items.push({
        icon: <HardDrive className="w-4 h-4 text-amber-400" />,
        title: 'Active Disk Operations',
        text: `High disk write load detected (${(diskWriteSpeedBps / 1024 / 1024).toFixed(1)} MB/s). Avoid interrupting deep file transfers.`,
        status: 'warning',
      });
    } else {
      items.push({
        icon: <HardDrive className="w-4 h-4 text-emerald-400" />,
        title: 'Disk Write Channel',
        text: 'Storage write channels are running optimally. No persistent disk thrashing or heavy swapping detected.',
        status: 'optimal',
      });
    }

    return items;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'border-l-2 border-rose-500 bg-rose-500/5';
      case 'warning':
        return 'border-l-2 border-amber-500 bg-amber-500/5';
      case 'optimal':
        return 'border-l-2 border-emerald-500 bg-emerald-500/5';
      case 'info':
      default:
        return 'border-l-2 border-blue-500 bg-blue-500/5';
    }
  };

  // ── Forecast Summary ────────────────────────────────────────────────

  const getForecastSummary = () => {
    if (!predictions || predictions.length === 0) return null;

    const last = predictions[predictions.length - 1];
    const changes: string[] = [];

    if (Math.abs(last.cpu_usage - cpuUsage) > 5) {
      changes.push(
        `CPU ${last.cpu_usage > cpuUsage ? '↑' : '↓'} ${Math.abs(last.cpu_usage - cpuUsage).toFixed(1)}%`
      );
    }
    if (Math.abs(last.cpu_temperature - temperature) > 3) {
      changes.push(
        `Temp ${last.cpu_temperature > temperature ? '↑' : '↓'} ${Math.abs(last.cpu_temperature - temperature).toFixed(1)}°C`
      );
    }
    if (Math.abs(last.memory_usage - memoryUsage) > 3) {
      changes.push(
        `RAM ${last.memory_usage > memoryUsage ? '↑' : '↓'} ${Math.abs(last.memory_usage - memoryUsage).toFixed(1)}%`
      );
    }

    if (changes.length === 0) return 'Metrics stable — no significant change predicted.';
    return `Next ${(predictions.length * 0.5).toFixed(1)}s forecast: ${changes.join(', ')}.`;
  };

  // ── Anomaly Banner ──────────────────────────────────────────────────

  const getAnomalyBanner = () => {
    if (warmingUp) {
      return {
        icon: <Activity className="w-4 h-4 text-indigo-400" />,
        text: `AI engine warming up: ${bufferFillPercent.toFixed(0)}% data buffer filled.`,
        color: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      };
    }

    if (anomaly?.is_anomaly) {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
        text: anomaly.details,
        color: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      };
    }

    return {
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
      text: 'All systems nominal. No anomalies detected.',
      color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    };
  };

  const banner = getAnomalyBanner();
  const evaluations = getEvaluations();
  const forecastSummary = getForecastSummary();

  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col h-full min-h-[380px]">
      {/* Glow Effects */}
      <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full" />
      <div className="absolute left-1/3 bottom-0 w-24 h-24 bg-purple-500/10 blur-[40px] rounded-full" />

      {/* Title */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/15 rounded-xl border border-indigo-500/30 text-indigo-400 animate-pulse-slow">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 tracking-wide">A.I Core Diagnostics</h3>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                modelActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {modelActive ? 'Deep Learning Active' : 'Statistical Mode'}
            </span>
          </div>
        </div>

        {/* Confidence indicator */}
        {predictions.length > 0 && (
          <div className="text-right">
            <div className="text-[10px] text-slate-500 font-medium">Confidence</div>
            <div className="text-xs font-bold text-indigo-400">
              {(forecastConfidence * 100).toFixed(0)}%
            </div>
          </div>
        )}
      </div>

      {/* Anomaly / Status Banner */}
      <div
        className={`${banner.color} rounded-xl p-3 mb-4 flex items-start gap-2 relative z-10`}
      >
        <div className="flex-shrink-0 mt-0.5">{banner.icon}</div>
        <p className="text-xs leading-relaxed">{banner.text}</p>
      </div>

      {/* Forecast Summary */}
      {forecastSummary && (
        <div className="mb-4 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
              Forecast
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{forecastSummary}</p>
        </div>
      )}

      {/* Evaluation Items */}
      <div className="flex-1 space-y-3 overflow-y-auto max-h-[240px] pr-1 relative z-10">
        {evaluations.map((item, idx) => (
          <div
            key={idx}
            className={`p-3.5 rounded-xl flex gap-3 ${getStatusColor(
              item.status
            )} border border-slate-800/40 hover:border-slate-700/30 transition-all duration-300`}
          >
            <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
            <div>
              <h5 className="font-bold text-xs text-slate-200">{item.title}</h5>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                {item.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-3 mt-3 border-t border-slate-800/40 relative z-10">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span className="font-mono">
            {modelActive ? '🧠 Conv1D-LSTM' : '📊 Statistical'}
          </span>
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3" />
            Real-time auto-analysis
          </span>
        </div>
      </div>
    </div>
  );
};

export default AiInsights;
