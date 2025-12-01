import React from "react";

export default function VoltageProfileChart({ inverterAnalytics }) {
  if (!inverterAnalytics) return <div>VoltageProfile Chart</div>;
  const { hourly } = inverterAnalytics;
  const hours = Object.keys(hourly.voltage || {});
  return (
    <div>
      <p>Voltage Profile (A/B/C)</p>
      <table>
        <thead>
          <tr>
            <th>Hour</th>
            <th>A</th>
            <th>B</th>
            <th>C</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => (
            <tr key={h}>
              <td>{h}</td>
              <td>{hourly.voltage[h]?.A ?? "-"}</td>
              <td>{hourly.voltage[h]?.B ?? "-"}</td>
              <td>{hourly.voltage[h]?.C ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
