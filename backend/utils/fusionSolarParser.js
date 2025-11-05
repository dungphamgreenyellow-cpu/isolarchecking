// Deprecated: XLSX-based parser removed. Use compute/fusionSolarParser.js (CSV-only).
module.exports = {
  readWorkbook: () => { throw new Error('Removed: use CSV /analysis/compute endpoint'); },
  aggregateDailyFromFusion: () => [],
  validate31days: () => {},
};
