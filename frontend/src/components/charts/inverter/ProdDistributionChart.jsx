import React from "react";
import { Doughnut } from "react-chartjs-2";

export default function ProdDistributionChart({ inverterAnalytics }) {
  if (!inverterAnalytics) return <div>ProdDistribution Chart</div>;
  const { totalProduction } = inverterAnalytics;
  const labels = Object.keys(totalProduction || {});
  const values = Object.values(totalProduction || {});

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: [
          "#9CC9FF",
          "#66B2FF",
          "#E6C4FF",
          "#FFAB91",
          "#FFCC80",
        ],
      },
    ],
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm">
      <h3 className="text-sm font-semibold mb-2">Inverter Production Distribution</h3>
      <Doughnut data={data} />
    </div>
  );
}
