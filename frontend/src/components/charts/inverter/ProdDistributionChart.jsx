import React from "react";

export default function ProdDistributionChart({ inverterAnalytics }) {
  if (!inverterAnalytics) return <div>ProdDistribution Chart</div>;
  const { inverterList, totalProduction } = inverterAnalytics;
  return (
    <div>
      <p>ProdDistribution Chart</p>
      <ul>
        {inverterList.map((inv) => (
          <li key={inv}>
            {inv}: {totalProduction[inv] ?? 0}
          </li>
        ))}
      </ul>
    </div>
  );
}
