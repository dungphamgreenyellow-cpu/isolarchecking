import React from "react";

export default function InvTemperatureHeatmap({ inverterAnalytics }) {
  if (!inverterAnalytics) return <div>InvTemperature Heatmap Chart</div>;
  const { hourly } = inverterAnalytics;
  const inverters = Object.keys(hourly.temperature || {});
  const hours = inverters.length
    ? Object.keys(hourly.temperature[inverters[0]] || {})
    : [];
  return (
    <div>
      <p>InvTemperature Heatmap</p>
      <table>
        <thead>
          <tr>
            <th>Inverter</th>
            {hours.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inverters.map((inv) => (
            <tr key={inv}>
              <td>{inv}</td>
              {hours.map((h) => (
                <td key={h}>{hourly.temperature[inv]?.[h] ?? "-"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
