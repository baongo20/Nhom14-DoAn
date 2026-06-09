import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  // AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  ComposedChart,
} from "recharts";
import type { HistoryPoint, PredictedMetrics } from "../types";

interface LiveChartProps {
  history: HistoryPoint[];
  predictions: PredictedMetrics[];
}

type ChartMetric = "cpu" | "memory" | "temp" | "power";

export const LiveChart: React.FC<LiveChartProps> = ({
  history,
  predictions,
}) => {
  const [activeMetric, setActiveMetric] = useState<ChartMetric>("cpu");
  const [showPrediction, setShowPrediction] = useState(true);

  const configs = {
    cpu: {
      name: "CPU Utilization",
      unit: "%",
      color: "#6366f1",
      gradId: "colorCpu",
      dataKey: "cpu" as const,
      predKey: "predictedCpu" as const,
      domain: [0, 100] as [number, number],
    },
    memory: {
      name: "Memory Utilization",
      unit: "%",
      color: "#a855f7",
      gradId: "colorMemory",
      dataKey: "memory" as const,
      predKey: "predictedMemory" as const,
      domain: [0, 100] as [number, number],
    },
    temp: {
      name: "CPU Temperature",
      unit: "°C",
      color: "#f43f5e",
      gradId: "colorTemp",
      dataKey: "temp" as const,
      predKey: "predictedTemp" as const,
      domain: [0, 100] as [number, number],
    },
    power: {
      name: "CPU Power Draw",
      unit: "W",
      color: "#10b981",
      gradId: "colorPower",
      dataKey: "power" as const,
      predKey: "predictedPower" as const,
      domain: [0, "auto"] as any,
    },
  };

  const currentConfig = configs[activeMetric];

  // Build chart data with prediction overlay points (memoized)
  const chartData = useMemo(() => {
    const data = [...history];

    // Add prediction future points if available
    if (showPrediction && predictions.length > 0 && history.length > 0) {
      const lastTime = history.length > 0
        ? new Date(history[history.length - 1].timeStr)
        : new Date();
      const baseMs = lastTime instanceof Date && !isNaN(lastTime.getTime())
        ? lastTime.getTime()
        : Date.now();

      predictions.forEach((pred, i) => {
        const futureTime = new Date(baseMs + (i + 1) * 500);
        const timeStr = futureTime.toTimeString().split(" ")[0];

        const predPoint: HistoryPoint = {
          timeStr,
          cpu: pred.cpu_usage,
          memory: pred.memory_usage,
          temp: pred.cpu_temperature,
          power: pred.cpu_power,
        };
        data.push(predPoint);
      });
    }

    return data;
  }, [history, predictions, showPrediction]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const isPredicted = payload[0]?.payload?.isPredicted;
      return (
        <div className="glass-panel rounded-xl p-3 shadow-lg border border-slate-700/40 text-xs">
          <p className="text-slate-400 font-medium mb-1">
            {payload[0].payload.timeStr}
          </p>
          {payload.map((entry: any, idx: number) => (
            <p
              key={idx}
              className="font-bold flex items-center gap-1.5"
              style={{ color: entry.color }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}: {entry.value.toFixed(1)}
              {currentConfig.unit}
              {isPredicted ? " (predicted)" : ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col h-full min-h-[380px]">
      {/* Chart Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-100 tracking-wide">
            Real-time Performance Chart
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Live tracking historical snapshot (past 60 seconds)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Prediction Toggle */}
          {predictions.length > 0 && (
            <button
              onClick={() => setShowPrediction(!showPrediction)}
              className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-300 border ${
                showPrediction
                  ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/30"
                  : "bg-slate-900/60 text-slate-500 border-slate-800/80 hover:text-slate-300"
              }`}
            >
              {showPrediction ? "Prediction ON" : "Prediction OFF"}
            </button>
          )}

          {/* Tab Selection */}
          <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-800/80 gap-1 overflow-x-auto">
            {(Object.keys(configs) as ChartMetric[]).map((key) => {
              const isActive = activeMetric === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveMetric(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  {key.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart body */}
      <div className="flex-1 w-full min-h-[260px]">
        {history.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Waiting for live data transmission...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id={currentConfig.gradId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={currentConfig.color}
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor={currentConfig.color}
                    stopOpacity={0.0}
                  />
                </linearGradient>
                <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                opacity={0.15}
                vertical={false}
              />

              <XAxis
                dataKey="timeStr"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                dy={10}
                tickFormatter={(val: string, idx: number) => {
                  // Show fewer labels to avoid clutter
                  return idx % 10 === 0 ? val : "";
                }}
              />

              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                domain={currentConfig.domain as any}
                dx={-10}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "#475569",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
              />

              {/* Actual data area */}
              <Area
                type="monotone"
                dataKey={currentConfig.dataKey}
                stroke={currentConfig.color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${currentConfig.gradId})`}
                isAnimationActive={false}
                name={currentConfig.name}
                connectNulls={false}
              />

              {/* Prediction line (dashed, amber) */}
              {showPrediction && predictions.length > 0 && (
                <Line
                  type="monotone"
                  dataKey={currentConfig.predKey}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  isAnimationActive={false}
                  name={`${currentConfig.name} (Predicted)`}
                  connectNulls={true}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
export default LiveChart;
