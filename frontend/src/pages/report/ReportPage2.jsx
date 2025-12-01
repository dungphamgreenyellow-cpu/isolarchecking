import React from "react";
import ProdDistributionChart from "../../components/charts/inverter/ProdDistributionChart";
import InvEfficiencyChart from "../../components/charts/inverter/InvEfficiencyChart";
import InvTemperatureHeatmap from "../../components/charts/inverter/InvTemperatureHeatmap";
import VoltageProfileChart from "../../components/charts/inverter/VoltageProfileChart";
import FrequencyChart from "../../components/charts/inverter/FrequencyChart";

export default function ReportPage2({ data }) {
  return (
    <div className="page-break space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <ProdDistributionChart data={data} />
        </div>
        <div>
          <InvEfficiencyChart data={data} />
        </div>
      </div>
      <div>
        <InvTemperatureHeatmap data={data} />
      </div>
      <div>
        <VoltageProfileChart data={data} />
      </div>
      <div>
        <FrequencyChart data={data} />
      </div>
    </div>
  );
}
