import React from "react";
import { Line } from "react-chartjs-2";

export default function FrequencyChart({ inverterAnalytics }) {
  if (!inverterAnalytics) return <div>Frequency Chart</div>;
  const { hourly } = inverterAnalytics;
  const hours = Object.keys(hourly.frequency || {});
  const freq = hours.map((h) => numberOrNull(hourly.frequency?.[h]));

  const data = {
    labels: hours,
    datasets: [
      {
        label: "Grid Freq (Hz)",
        data: freq,
        borderColor: "#66D1A7",
        fill: false,
        tension: 0.2,
      },
    ],
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm">
      <h3 className="text-sm font-semibold mb-2">Grid Frequency Profile</h3>
      <Line data={data} />
    </div>
  );
}

function numberOrNull(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
