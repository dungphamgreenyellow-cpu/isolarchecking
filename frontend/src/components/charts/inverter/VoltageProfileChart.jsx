import React from "react";
import { Line } from "react-chartjs-2";

export default function VoltageProfileChart({ inverterAnalytics }) {
  if (!inverterAnalytics) return <div>VoltageProfile Chart</div>;
  const { hourly } = inverterAnalytics;
  const hours = Object.keys(hourly.voltage || {});
  const dataA = hours.map((h) => numberOrNull(hourly.voltage?.[h]?.A));
  const dataB = hours.map((h) => numberOrNull(hourly.voltage?.[h]?.B));
  const dataC = hours.map((h) => numberOrNull(hourly.voltage?.[h]?.C));

  const data = {
    labels: hours,
    datasets: [
      { label: "Phase A", data: dataA, borderColor: "#FFD97D", fill: false, tension: 0.2 },
      { label: "Phase B", data: dataB, borderColor: "#A0D995", fill: false, tension: 0.2 },
      { label: "Phase C", data: dataC, borderColor: "#CBA6FF", fill: false, tension: 0.2 },
    ],
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm">
      <h3 className="text-sm font-semibold mb-2">Voltage Profile by Phase</h3>
      <Line data={data} />
    </div>
  );
}

function numberOrNull(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
