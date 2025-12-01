export function buildInverterAnalytics(log) {
  const inverterList = Object.keys(log.inverterEnergy || {});

  const totalProduction = {};
  inverterList.forEach((inv) => {
    totalProduction[inv] = log.inverterEnergy[inv] || 0;
  });

  const hours = ["07","08","09","10","11","12","13","14","15","16","17"];
  const hourly = {
    efficiency: {},
    temperature: {},
    voltage: {},
    frequency: {},
  };

  hours.forEach((h) => {
    hourly.efficiency[h] = {};
    hourly.voltage[h] = { A: null, B: null, C: null };
    hourly.frequency[h] = null;
  });

  inverterList.forEach((inv) => {
    hourly.temperature[inv] = {};
    hours.forEach((h) => {
      hourly.temperature[inv][h] = null;
    });
  });

  if (log.rawRows && Array.isArray(log.rawRows)) {
    const agg = {
      eff: {},
      temp: {},
      voltA: {},
      voltB: {},
      voltC: {},
      freq: {},
    };

    inverterList.forEach((inv) => {
      hours.forEach((h) => {
        agg.eff[`${inv}_${h}`] = [];
        agg.temp[`${inv}_${h}`] = [];
      });
    });

    hours.forEach((h) => {
      agg.voltA[h] = [];
      agg.voltB[h] = [];
      agg.voltC[h] = [];
      agg.freq[h] = [];
    });

    log.rawRows.forEach((row) => {
      const inv = row.inverter;
      if (!inverterList.includes(inv)) return;
      const d = new Date(row.datetime);
      const hour = String(d.getHours()).padStart(2, "0");
      if (!hours.includes(hour)) return;

      if (row.efficiency != null) agg.eff[`${inv}_${hour}`].push(row.efficiency);
      if (row.temperature != null) agg.temp[`${inv}_${hour}`].push(row.temperature);

      if (row.voltA != null) agg.voltA[hour].push(row.voltA);
      if (row.voltB != null) agg.voltB[hour].push(row.voltB);
      if (row.voltC != null) agg.voltC[hour].push(row.voltC);

      if (row.frequency != null) agg.freq[hour].push(row.frequency);
    });

    hours.forEach((h) => {
      const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
      hourly.voltage[h] = {
        A: avg(agg.voltA[h]),
        B: avg(agg.voltB[h]),
        C: avg(agg.voltC[h]),
      };
      hourly.frequency[h] = avg(agg.freq[h]);
    });

    inverterList.forEach((inv) => {
      hours.forEach((h) => {
        const key = `${inv}_${h}`;
        const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
        hourly.efficiency[h][inv] = avg(agg.eff[key]);
        hourly.temperature[inv][h] = avg(agg.temp[key]);
      });
    });
  }

  return { inverterList, totalProduction, hourly };
}
