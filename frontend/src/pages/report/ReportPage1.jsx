import React from "react";
import ProjectHeader from "../ReportHeader";

// Placeholder sub-sections for KPI summary
function ExecutiveSummary({ data }) {
  return <div>Executive Summary</div>;
}

function DailyProductionChart({ data }) {
  return <div>Daily Production Chart</div>;
}

function DailyRPRChart({ data }) {
  return <div>Daily RPR Chart</div>;
}

function EnergyFlowWaterfall({ data }) {
  return <div>Energy Flow Waterfall</div>;
}

function PerformanceTable({ data }) {
  return <div>Performance Table</div>;
}

export default function ReportPage1({ data }) {
  return (
    <div className="page-break space-y-4">
      <ProjectHeader data={data} />
      <ExecutiveSummary data={data} />
      <DailyProductionChart data={data} />
      <DailyRPRChart data={data} />
      <EnergyFlowWaterfall data={data} />
      <PerformanceTable data={data} />
    </div>
  );
}
