import React from "react";

export default function InvEfficiencyChart({ inverterAnalytics }) {
  if (!inverterAnalytics) return <div>InvEfficiency Chart</div>;
  const { hourly } = inverterAnalytics;
  const hours = Object.keys(hourly.efficiency || {});
  const inverters = new Set();
  hours.forEach((h) => {
    Object.keys(hourly.efficiency[h] || {}).forEach((inv) => inverters.add(inv));
  });
  return (
    <div>
      <p>InvEfficiency Chart (hourly)</p>
      <table>
        <thead>
          <tr>
            <th>Hour</th>
            {Array.from(inverters).map((inv) => (
              <th key={inv}>{inv}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => (
            <tr key={h}>
              <td>{h}</td>
              {Array.from(inverters).map((inv) => (
                <td key={inv}>{hourly.efficiency[h]?.[inv] ?? "-"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
