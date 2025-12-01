import React from "react";

export default function FrequencyChart({ inverterAnalytics }) {
  const freqMap = inverterAnalytics?.hourly?.frequency || null;
  const hours = freqMap ? Object.keys(freqMap) : [];
  if (!freqMap || hours.length === 0) {
    return <div className="text-sm text-gray-500">No data</div>;
  }
  const values = hours.map((h) => toNumberOrNull(freqMap[h]));
  const numeric = values.filter((v) => v != null);
  if (numeric.length === 0) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  const minVal = Math.min(...numeric, 49.5);
  const maxVal = Math.max(...numeric, 50.5);
  const width = 260;
  const height = 140;
  const padding = 20;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

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

  const points = values
    .map((v, idx) => {
      const y = yForValue(v);
      if (y == null) return null;
      const x = xForIndex(idx);
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");
  if (!points) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm">
      <h3 className="text-sm font-semibold mb-1">Grid Frequency Stability (Hz)</h3>
      <svg width={width} height={height}>
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#e5e7eb"
          strokeWidth={0.5}
        />
        <polyline
          fill="none"
          stroke="#66D1A7"
          strokeWidth={1.5}
          points={points}
        />
      </svg>
      <div className="mt-1 text-[10px] text-gray-500">
        Expected range ~49.8–50.2 Hz
      </div>
    </div>
  );
}

function toNumberOrNull(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
