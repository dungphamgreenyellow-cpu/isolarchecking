import React from "react";
import { Line } from "react-chartjs-2";

const pastelColors = [
  "#9CC9FF",
  "#A0D995",
  "#E6C4FF",
  "#FFAB91",
  "#FFCC80",
  "#CBA6FF",
];

export default function InvEfficiencyChart({ inverterAnalytics }) {
  if (!inverterAnalytics) return <div>InvEfficiency Chart</div>;
  const { hourly, inverterList = [] } = inverterAnalytics;
  const hours = Object.keys(hourly.efficiency || {});

  const datasets = inverterList.map((inv, idx) => ({
    label: inv,
    data: hours.map((h) =>
      hourly.efficiency?.[h] &&
      numberOrNull(hourly.efficiency[h][inv])
    ),
    borderColor: pastelColors[idx % pastelColors.length],
    fill: false,
    tension: 0.2,
  }));

  const data = {
    labels: hours,
    datasets,
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm">
      <h3 className="text-sm font-semibold mb-2">Inverter Efficiency by Hour</h3>
      <Line data={data} />
    </div>
  );
}

function numberOrNull(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
