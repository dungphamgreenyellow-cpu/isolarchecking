import React from "react";
import ProdDistributionChart from "../../components/charts/inverter/ProdDistributionChart";
import InvEfficiencyChart from "../../components/charts/inverter/InvEfficiencyChart";
import InvTemperatureHeatmap from "../../components/charts/inverter/InvTemperatureHeatmap";
import VoltageProfileChart from "../../components/charts/inverter/VoltageProfileChart";
import FrequencyChart from "../../components/charts/inverter/FrequencyChart";

export default function ReportPage2({ data, inverterAnalytics }) {
  return (
    <div className="page-break space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <ProdDistributionChart inverterAnalytics={inverterAnalytics} />
        </div>
        <div>
          <InvEfficiencyChart inverterAnalytics={inverterAnalytics} />
        </div>
      </div>
      <div>
        <InvTemperatureHeatmap inverterAnalytics={inverterAnalytics} />
      </div>
      <div>
        <VoltageProfileChart inverterAnalytics={inverterAnalytics} />
      </div>
      <div>
        <FrequencyChart inverterAnalytics={inverterAnalytics} />
      </div>
    </div>
  );
}
