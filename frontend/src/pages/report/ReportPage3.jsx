import React from "react";

export default function ReportPage3() {
  return (
    <div className="space-y-4 page-break">
      <h2 className="text-xl font-semibold">DATA SOURCES &amp; METHODOLOGY</h2>
      <section>
        <h3 className="font-medium">1. Data Sources</h3>
        <p>
          This report is based on high-resolution production logs from the
          FusionSolar monitoring system, PVSyst design reports, and optional
          irradiance or weather data where available.
        </p>
      </section>
      <section>
        <h3 className="font-medium">2. Key Calculations</h3>
        <p>
          Daily energy, specific yield, and performance ratio (PR) are computed
          from inverter-level records, normalized by the installed DC capacity
          and, when provided, by measured or reference irradiance.
        </p>
      </section>
      <section>
        <h3 className="font-medium">3. Advanced Diagnostics</h3>
        <p>
          Outlier detection, inverter availability, clipping behavior, and
          thermal derating patterns are evaluated using time-series analytics
          and cross-checks between inverters.
        </p>
      </section>
      <section>
        <h3 className="font-medium">4. Notes</h3>
        <p>
          All results should be interpreted in the context of the data
          availability and quality. Any missing or inconsistent data periods are
          documented in the detailed time-series views.
        </p>
      </section>
    </div>
  );
}
