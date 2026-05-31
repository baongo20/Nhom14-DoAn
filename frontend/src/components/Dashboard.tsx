import React from 'react';
import {
  Cpu, HardDrive, Thermometer, Zap, Activity, Battery, Laptop, RefreshCw
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { LiveChart } from './LiveChart';
import { ProcessTable } from './ProcessTable';
import { AiInsights } from './AiInsights';
import { PredictionGauge } from './PredictionGauge';
import type {
  HardwareSnapshot,
  HistoryPoint,
  PredictedMetrics,
  AnomalyData,
} from '../types';

interface DashboardProps {
  snapshot: HardwareSnapshot | null;
  history: HistoryPoint[];
  isConnected: boolean;
  onReconnect: () => void;
  predictions: PredictedMetrics[];
  forecastConfidence: number;
  anomaly: AnomalyData | null;
  modelActive: boolean;
  warmingUp: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  snapshot,
  history,
  isConnected,
  onReconnect,
  predictions,
  forecastConfidence,
  anomaly,
  modelActive,
  warmingUp,
}) => {
  // Helper to format Bytes to human-readable string
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Helper to format Network/Disk Speed
  const formatSpeed = (bytesPerSec: number) => {
    return `${formatBytes(bytesPerSec, 1)}/s`;
  };

  // Helper to format Uptime Seconds to standard text
  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  // Buffer fill percentage for warming up indicator
  const bufferFillPercent = snapshot ? 100 : 0;

  if (!snapshot) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin" />
          <Activity className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">Synchronizing Telemetry Channels</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
            Connecting to native FastAPI service on Windows... Ensure Python backend is running.
          </p>
        </div>
        {!isConnected && (
          <button
            onClick={onReconnect}
            className="mt-4 px-4 py-2 bg-slate-800 border border-slate-700/60 rounded-xl text-xs font-semibold text-slate-300 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1.5 shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reconnect Now
          </button>
        )}
      </div>
    );
  }

  const { system, cpu, memory, battery, disk, network, processes } = snapshot;

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-6">

      {/* Top Banner Status Bar */}
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-glass">
        {/* Glow indicator decoration */}
        <div className="absolute right-0 top-0 w-48 h-full bg-gradient-to-l from-indigo-500/5 to-transparent pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
            <Laptop className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-wide text-slate-100 flex items-center gap-2">
              {system.hostname.toUpperCase()}
              <span className={`w-2.5 h-2.5 rounded-full inline-block ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} title={isConnected ? 'WebSocket Connected' : 'Disconnected'} />
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{system.cpu_model}</p>
          </div>
        </div>

        {/* System Specifications */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 text-xs w-full md:w-auto relative z-10 border-t border-slate-800/80 md:border-none pt-4 md:pt-0">
          <div>
            <span className="text-slate-500 font-medium uppercase tracking-wider block">OS Platform</span>
            <span className="text-slate-300 font-semibold mt-0.5 block truncate max-w-[120px]" title={system.os_version}>
              {system.os_name}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-medium uppercase tracking-wider block">Total Memory</span>
            <span className="text-slate-300 font-semibold mt-0.5 block">
              {formatBytes(system.ram_total, 1)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-medium uppercase tracking-wider block">System Uptime</span>
            <span className="text-slate-300 font-semibold mt-0.5 block font-mono">
              {formatUptime(system.uptime_seconds)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-medium uppercase tracking-wider block">Core Frequency</span>
            <span className="text-slate-300 font-semibold mt-0.5 block">
              {(cpu.frequency_mhz / 1000).toFixed(2)} GHz
            </span>
          </div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* CPU Card */}
        <MetricCard
          title="CPU Utilization"
          value={`${cpu.overall_usage.toFixed(1)}%`}
          subtext={`${cpu.physical_cores} Cores / ${cpu.logical_cores} Threads`}
          icon={<Cpu className="w-5 h-5" />}
          percent={cpu.overall_usage}
          badge={`Load Avg: ${cpu.load_avg[0].toFixed(2)}`}
          badgeType={cpu.overall_usage > 85 ? 'error' : cpu.overall_usage > 60 ? 'warning' : 'success'}
          colorClass="from-blue-500 to-indigo-600"
          predictionGauge={
            <PredictionGauge
              predictions={predictions}
              currentValue={cpu.overall_usage}
              metricKey="cpu_usage"
              label="CPU"
              unit="%"
            />
          }
        />

        {/* Memory Card */}
        <MetricCard
          title="RAM Memory"
          value={`${memory.virtual.percent.toFixed(1)}%`}
          subtext={`Used: ${formatBytes(memory.virtual.used, 1)} / ${formatBytes(memory.virtual.total, 1)}`}
          icon={<HardDrive className="w-5 h-5" />}
          percent={memory.virtual.percent}
          badge={`Swap: ${memory.swap.percent.toFixed(0)}%`}
          badgeType={memory.virtual.percent > 85 ? 'error' : memory.virtual.percent > 65 ? 'warning' : 'success'}
          colorClass="from-purple-500 to-indigo-600"
          predictionGauge={
            <PredictionGauge
              predictions={predictions}
              currentValue={memory.virtual.percent}
              metricKey="memory_usage"
              label="RAM"
              unit="%"
            />
          }
        />

        {/* CPU Temp Card */}
        <MetricCard
          title="Core Temperature"
          value={`${cpu.temperature.toFixed(0)} °C`}
          subtext={cpu.temperature_estimated ? "Smart fallback thermodynamic calculation" : "Native BIOS query"}
          icon={<Thermometer className="w-5 h-5" />}
          estimated={cpu.temperature_estimated}
          badge={cpu.temperature > 80 ? 'CRITICAL' : cpu.temperature > 65 ? 'WARNING' : 'HEALTHY'}
          badgeType={cpu.temperature > 80 ? 'error' : cpu.temperature > 65 ? 'warning' : 'success'}
          colorClass="from-rose-500 to-red-600"
          predictionGauge={
            <PredictionGauge
              predictions={predictions}
              currentValue={cpu.temperature}
              metricKey="cpu_temperature"
              label="Temp"
              unit="°C"
            />
          }
        />

        {/* Power Draw Card */}
        <MetricCard
          title="Estimated Power Draw"
          value={`${cpu.power_draw.toFixed(1)} W`}
          subtext="Dynamic power calculation based on TDP load"
          icon={<Zap className="w-5 h-5" />}
          estimated={cpu.power_draw_estimated}
          badge="THERMAL ACTIVE"
          badgeType="info"
          colorClass="from-emerald-500 to-teal-600"
          predictionGauge={
            <PredictionGauge
              predictions={predictions}
              currentValue={cpu.power_draw}
              metricKey="cpu_power"
              label="Power"
              unit="W"
            />
          }
        />

        {/* Network Bandwidth */}
        <MetricCard
          title="Network I/O Speed"
          value={formatSpeed(network.download_speed_bps)}
          subtext={`Upload Rate: ${formatSpeed(network.upload_speed_bps)}`}
          icon={<Activity className="w-5 h-5" />}
          badge="ACTIVE STREAM"
          badgeType="info"
          colorClass="from-cyan-500 to-blue-600"
        />

        {/* Battery Capacity */}
        <MetricCard
          title="Battery & AC Power"
          value={`${battery.percent}%`}
          subtext={
            battery.power_plugged
              ? 'Plugged into power grid (AC)'
              : battery.secs_left > 0
                ? `Discharging (Approx. ${Math.round(battery.secs_left / 60)}m left)`
                : 'Discharging (Calculating...)'
          }
          icon={<Battery className="w-5 h-5" />}
          percent={battery.percent}
          badge={battery.power_plugged ? 'AC CHARGING' : 'BATTERY POWER'}
          badgeType={battery.power_plugged ? 'success' : 'warning'}
          colorClass="from-indigo-500 to-violet-600"
        />
      </div>

      {/* Middle Split Grid (Chart and AI Insights) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LiveChart history={history} predictions={predictions} />
        </div>
        <div>
          <AiInsights
            cpuUsage={cpu.overall_usage}
            memoryUsage={memory.virtual.percent}
            temperature={cpu.temperature}
            batteryPlugged={battery.power_plugged}
            diskWriteSpeedBps={disk.write_speed_bps}
            predictions={predictions}
            forecastConfidence={forecastConfidence}
            anomaly={anomaly}
            modelActive={modelActive}
            warmingUp={warmingUp}
            bufferFillPercent={bufferFillPercent}
          />
        </div>
      </div>

      {/* Bottom Process Explorer Table */}
      <div className="grid grid-cols-1">
        <ProcessTable processes={processes} />
      </div>

    </div>
  );
};
export default Dashboard;
