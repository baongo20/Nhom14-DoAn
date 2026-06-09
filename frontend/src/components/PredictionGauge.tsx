import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { PredictedMetrics } from '../types';

interface PredictionGaugeProps {
  predictions: PredictedMetrics[];
  currentValue: number;
  metricKey: keyof PredictedMetrics;
  label: string;
  unit?: string;
}

export const PredictionGauge: React.FC<PredictionGaugeProps> = ({
  predictions,
  currentValue,
  metricKey,
  label,
  unit = '',
}) => {
  if (!predictions || predictions.length === 0) return null;

  // Get the last predicted value (furthest forecast)
  const lastPredicted = predictions[predictions.length - 1][metricKey];
  // const nextPredicted = predictions[0][metricKey];

  // Calculate trend
  const trend = lastPredicted - currentValue;
  const absTrend = Math.abs(trend);

  const getTrendIcon = () => {
    if (absTrend < 0.5) return <Minus className="w-3.5 h-3.5 text-slate-400" />;
    if (trend > 0) return <TrendingUp className="w-3.5 h-3.5 text-rose-400" />;
    return <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />;
  };

  const getTrendColor = () => {
    if (absTrend < 0.5) return 'text-slate-400';
    if (trend > 0) return 'text-rose-400';
    return 'text-emerald-400';
  };

  // Mini sparkline using CSS
  const getSparklineWidth = () => {
    const values = [currentValue, ...predictions.map(p => p[metricKey])];
    const max = Math.max(...values, 1);
    return values.map(v => (v / max) * 100);
  };

  const sparklineData = getSparklineWidth();

  return (
    <div className="mt-2 pt-2 border-t border-slate-800/40">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
          {label} Forecast
        </span>
        <div className={`flex items-center gap-1 text-[10px] font-semibold ${getTrendColor()}`}>
          {getTrendIcon()}
          <span>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}{unit}
          </span>
        </div>
      </div>

      {/* Mini sparkline bar */}
      <div className="flex items-end gap-[2px] h-6">
        {sparklineData.map((width, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t-sm transition-all duration-300 ${
              i === 0
                ? 'bg-indigo-500/60'
                : 'bg-indigo-500/30'
            }`}
            style={{ height: `${Math.max(width, 5)}%` }}
            title={`${i === 0 ? 'Current' : `+${i}s`}: ${[currentValue, ...predictions.map(p => p[metricKey])][i].toFixed(1)}${unit}`}
          />
        ))}
      </div>

      <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
        <span>now</span>
        <span>+{predictions.length * 0.5}s</span>
      </div>
    </div>
  );
};

export default PredictionGauge;
