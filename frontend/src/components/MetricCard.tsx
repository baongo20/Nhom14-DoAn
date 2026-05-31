import React from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  percent?: number; // 0 to 100 for gauge
  badge?: string;
  badgeType?: "success" | "warning" | "error" | "info";
  estimated?: boolean;
  colorClass?: string; // e.g. "from-blue-500 to-indigo-600"
  predictionGauge?: React.ReactNode; // Optional prediction trend gauge
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtext,
  icon,
  percent,
  badge,
  badgeType = "info",
  estimated = false,
  colorClass = "from-indigo-500 to-purple-600",
  predictionGauge,
}) => {
  // SVG circular progress parameters
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    percent !== undefined
      ? circumference -
        (Math.min(Math.max(percent, 0), 100) / 100) * circumference
      : 0;

  const getBadgeStyles = () => {
    switch (badgeType) {
      case "success":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "warning":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "error":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "info":
      default:
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[160px] group">
      {/* Background glow hover effect */}
      <div
        className={`absolute -right-10 -top-10 w-24 h-24 bg-gradient-to-br ${colorClass} opacity-[0.03] group-hover:opacity-[0.08] blur-xl rounded-full transition-opacity duration-500`}
      />

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl bg-slate-800/40 text-slate-300 border border-slate-700/30 group-hover:border-indigo-500/20 group-hover:text-indigo-400 transition-all duration-300`}
          >
            {icon}
          </div>
          <div>
            <span className="text-slate-400 text-sm font-medium tracking-wide block">
              {title}
            </span>
            {badge && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 mt-1 rounded text-[10px] font-semibold tracking-wider uppercase ${getBadgeStyles()}`}
              >
                {badge}
              </span>
            )}
            {estimated && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 mt-1 ml-1 rounded text-[10px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20 tracking-wider uppercase"
                title="Estimated based on usage load"
              >
                Estimated
              </span>
            )}
          </div>
        </div>

        {/* Circular Gauge */}
        {percent !== undefined && (
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="stroke-slate-800/50"
                strokeWidth="4"
                fill="transparent"
              />
              {/* Progress circle */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="stroke-indigo-500 circle-progress"
                strokeWidth="4.5"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  stroke:
                    percent > 85
                      ? "rgb(244 63 94)"
                      : percent > 65
                        ? "rgb(245 158 11)"
                        : "rgb(99 102 241)",
                }}
              />
            </svg>
            <span className="absolute text-xs font-semibold text-slate-300">
              {Math.round(percent)}%
            </span>
          </div>
        )}
      </div>

      {/* Main Value Display */}
      <div className="mt-auto">
        <div className="flex items-baseline gap-1">
          <h2
            className={`text-3xl font-bold tracking-tight bg-gradient-to-r ${colorClass} bg-clip-text text-transparent group-hover:scale-[1.01] transition-transform duration-300`}
          >
            {value}
          </h2>
        </div>
        {subtext && (
          <p className="text-xs text-slate-500 mt-1 font-medium">{subtext}</p>
        )}
        {/* Prediction trend gauge */}
        {predictionGauge}
      </div>
    </div>
  );
};
export default MetricCard;
