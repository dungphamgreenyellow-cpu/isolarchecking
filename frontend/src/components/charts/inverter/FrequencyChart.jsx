import React from "react";

export default function FrequencyChart({ inverterAnalytics }) {
  if (!inverterAnalytics) return <div>Frequency Chart</div>;
  const { hourly } = inverterAnalytics;
  const hours = Object.keys(hourly.frequency || {});
  return (
    <div>
      <p>Frequency Profile</p>
      <table>
        <thead>
          <tr>
            <th>Hour</th>
            <th>Frequency</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => (
            <tr key={h}>
              <td>{h}</td>
              <td>{hourly.frequency[h] ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
