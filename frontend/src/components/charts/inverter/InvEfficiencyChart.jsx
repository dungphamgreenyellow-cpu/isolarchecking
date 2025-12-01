import React from "react";

const pastelColors = [
  "#66B2FF",
  "#E6C4FF",
  "#FFAB91",
  "#B4E1C5",
  "#FFD97D",
];

export default function InvEfficiencyChart({ inverterAnalytics }) {
  const effMap = inverterAnalytics?.hourly?.efficiency || null;
  const inverterList = inverterAnalytics?.inverterList || [];
  if (!effMap || inverterList.length === 0) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  const hours = Object.keys(effMap);
  if (hours.length === 0) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  const width = 260;
  const height = 140;
  const padding = 20;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  // Flatten values to determine Y scale (0-100%)
  const allValues = [];
  hours.forEach((h) => {
    inverterList.forEach((inv) => {
      const v = toNumberOrNull(effMap[h]?.[inv]);
      if (v != null) allValues.push(v);
    });
  });
  const minVal = allValues.length ? Math.min(...allValues, 80) : 90;
  const maxVal = allValues.length ? Math.max(...allValues, 100) : 100;

  const xForIndex = (idx) => {
    if (hours.length === 1) return padding + innerWidth / 2;
    return padding + (idx / (hours.length - 1)) * innerWidth;
  };

  const yForValue = (v) => {
    if (v == null) return null;
    const clamped = Math.max(minVal, Math.min(maxVal, v));
    const ratio = (clamped - minVal) / (maxVal - minVal || 1);
    return padding + innerHeight - ratio * innerHeight;
  };

  const polylines = inverterList.map((inv, idx) => {
    const color = pastelColors[idx % pastelColors.length];
    const points = hours
      .map((h, hIdx) => {
        const val = toNumberOrNull(effMap[h]?.[inv]);
        const y = yForValue(val);
        if (y == null) return null;
        const x = xForIndex(hIdx);
        return `${x},${y}`;
      })
      .filter(Boolean)
      .join(" ");
    if (!points) return null;
    return (
      <polyline
        key={inv}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        points={points}
      />
    );
  });

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm">
      <h3 className="text-sm font-semibold mb-2">Inverter Efficiency (Hourly)</h3>
      <svg width={width} height={height}>
        {/* X axis */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#e5e7eb"
          strokeWidth={0.5}
        />
        {/* Y grid (min/max) */}
        <line
          x1={padding}
          y1={padding}
          x2={width - padding}
          y2={padding}
          stroke="#f3f4f6"
          strokeWidth={0.5}
        />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#f3f4f6"
          strokeWidth={0.5}
        />
        {polylines}
      </svg>
      <div className="mt-1 text-[10px] text-gray-500">
        Eff. based on inverter log (%)
      </div>
    </div>
  );
}

function toNumberOrNull(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
