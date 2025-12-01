import React from "react";

export default function ProdDistributionChart({ inverterAnalytics }) {
  if (!inverterAnalytics || !inverterAnalytics.totalProduction) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  const entries = Object.entries(inverterAnalytics.totalProduction || {});
  if (entries.length === 0) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  const total = entries.reduce(
    (sum, [, v]) => sum + (Number(v) || 0),
    0
  );
  if (!total) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  const pastelColors = [
    "#9CC9FF",
    "#66B2FF",
    "#E6C4FF",
    "#FFAB91",
    "#FFCC80",
    "#B4E1C5",
  ];

  const radius = 40;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = entries.map(([name, raw], idx) => {
    const value = Number(raw) || 0;
    const ratio = value / total;
    const length = ratio * circumference;
    const segment = {
      name,
      value,
      percent: (ratio * 100).toFixed(1),
      color: pastelColors[idx % pastelColors.length],
      length,
      offset,
    };
    offset -= length;
    return segment;
  });

  const center = 60;

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm">
      <h3 className="text-sm font-semibold mb-2">Production Distribution per Inverter</h3>
      <div className="flex gap-4 items-center">
        <svg width={120} height={120} viewBox="0 0 120 120">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={strokeWidth}
          />
          {segments.map((seg, idx) => (
            <circle
              key={seg.name}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.length} ${circumference}`}
              strokeDashoffset={seg.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="flex-1 space-y-1">
          {segments.map((seg) => (
            <div key={seg.name} className="flex items-center text-xs text-gray-700">
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: seg.color }}
              />
              <span className="flex-1 truncate">{seg.name}</span>
              <span className="ml-2 text-gray-500">{seg.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
