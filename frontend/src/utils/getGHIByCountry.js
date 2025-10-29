import { ghiBaseline } from "../data/ghiBaseline";

/**
 * Trả về GHI_P50 hoặc GHI_P5 theo tên quốc gia
 * @param {string} countryName
 * @param {'P50'|'P5'} percentile
 */
export function getGHIByCountry(countryName, percentile = "P50") {
  if (!countryName) return null;

  const found = ghiBaseline.find(
    (item) => item.country.toLowerCase() === countryName.toLowerCase()
  );

  if (!found) return null;

  return percentile === "P5" ? found.GHI_P5 : found.GHI_P50;
}
