import React from "react";

export default function VoltageProfileChart({ inverterAnalytics }) {
  const voltage = inverterAnalytics?.hourly?.voltage || null;
  const hours = voltage ? Object.keys(voltage) : [];
  if (!voltage || hours.length === 0) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  const dataA = hours.map((h) => toNumberOrNull(voltage[h]?.A));
  const dataB = hours.map((h) => toNumberOrNull(voltage[h]?.B));
  const dataC = hours.map((h) => toNumberOrNull(voltage[h]?.C));
  const allVals = [...dataA, ...dataB, ...dataC].filter((v) => v != null);
  if (allVals.length === 0) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  const minVal = Math.min(...allVals, 200);
  const maxVal = Math.max(...allVals, 260);

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

  const makePolyline = (values, color, key) => {
    const points = values
      .map((v, idx) => {
        const y = yForValue(v);
        if (y == null) return null;
        const x = xForIndex(idx);
        return `${x},${y}`;
      })
      .filter(Boolean)
      .join(" ");
    if (!points) return null;
    return (
      <polyline
        key={key}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        points={points}
      />
    );
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm">
      <h3 className="text-sm font-semibold mb-2">Grid Voltage Profile (Hourly, Phase A/B/C)</h3>
      <svg width={width} height={height}>
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#e5e7eb"
          strokeWidth={0.5}
        />
        {makePolyline(dataA, "#FFD97D", "A")}
        {makePolyline(dataB, "#A0D995", "B")}
        {makePolyline(dataC, "#CBA6FF", "C")}
      </svg>
      <div className="mt-1 flex gap-3 text-[10px] text-gray-600">
        <span className="flex items-center">
          <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: "#FFD97D" }} />
          Phase A
        </span>
        <span className="flex items-center">
          <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: "#A0D995" }} />
          Phase B
        </span>
        <span className="flex items-center">
          <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: "#CBA6FF" }} />
          Phase C
        </span>
      </div>
    </div>
  );
}

function toNumberOrNull(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
