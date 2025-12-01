import React from "react";

function getHeatmapColor(value) {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n)) return "#f5f5f5";
  // simple gradient: cool (blue) to hot (red)
  const t = Math.max(0, Math.min(1, (n - 25) / 35)); // 25-60°C
  const r = Math.round(255 * t);
  const g = Math.round(160 * (1 - t));
  const b = Math.round(255 * (1 - t));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function InvTemperatureHeatmap({ inverterAnalytics }) {
  if (!inverterAnalytics) return <div>InvTemperature Heatmap Chart</div>;
  const { hourly, inverterList = [] } = inverterAnalytics;
  if (!hourly.temperature || inverterList.length === 0) {
    return <div>InvTemperature Heatmap Chart</div>;
  }
  const hours = Object.keys(
    hourly.temperature[inverterList[0]] || {}
  );

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm">
      <h3 className="text-sm font-semibold mb-2">Inverter Temperature Heatmap</h3>
      <div className="overflow-x-auto">
        <div className="min-w-full">
          <div className="grid" style={{ gridTemplateColumns: `120px repeat(${hours.length}, minmax(32px, 1fr))` }}>
            <div className="font-semibold text-xs flex items-center">Inverter</div>
            {hours.map((h) => (
              <div key={h} className="text-[10px] text-center font-medium">
                {h}
              </div>
            ))}
            {inverterList.map((inv) => (
              <React.Fragment key={inv}>
                <div className="text-xs flex items-center pr-1 font-medium">
                  {inv}
                </div>
                {hours.map((h) => {
                  const v = hourly.temperature?.[inv]?.[h];
                  return (
                    <div
                      key={h}
                      className="h-6 text-[10px] flex items-center justify-center border border-white"
                      style={{ backgroundColor: getHeatmapColor(v) }}
                    >
                      {typeof v === "number" ? v.toFixed(1) : v ?? ""}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
