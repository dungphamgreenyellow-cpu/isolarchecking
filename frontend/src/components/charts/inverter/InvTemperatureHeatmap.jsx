import React from "react";

function getHeatmapColor(value) {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n)) return "#f3f4f6";
  if (n < 30) return "#dbeafe";
  if (n < 40) return "#bfdbfe";
  if (n < 50) return "#fdba74";
  return "#f97373";
}

export default function InvTemperatureHeatmap({ inverterAnalytics }) {
  const inverterList = inverterAnalytics?.inverterList || [];
  const tempMap = inverterAnalytics?.hourly?.temperature || null;
  if (!tempMap || inverterList.length === 0) {
    return <div className="text-sm text-gray-500">No data</div>;
  }
  const sample = inverterList[0];
  const hours = sample
    ? Object.keys(tempMap[sample] || {})
    : [];
  if (hours.length === 0) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm">
      <h3 className="text-sm font-semibold mb-2">Inverter Temperature Heatmap (°C)</h3>
      <div className="overflow-x-auto">
        <div
          className="grid text-[10px]"
          style={{ gridTemplateColumns: `120px repeat(${hours.length}, minmax(32px, 1fr))` }}
        >
          <div className="font-semibold flex items-center">Inverter</div>
          {hours.map((h) => (
            <div key={h} className="text-center font-medium">
              {h}
            </div>
          ))}
          {inverterList.map((inv) => (
            <React.Fragment key={inv}>
              <div className="flex items-center pr-1 font-medium">
                {inv}
              </div>
              {hours.map((h) => {
                const v = tempMap?.[inv]?.[h];
                return (
                  <div
                    key={h}
                    className="text-center py-1 border border-white"
                    style={{ backgroundColor: getHeatmapColor(v) }}
                  >
                    {typeof v === "number"
                        ? `${v.toFixed(0)}°`
                      : "-"}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
