// src/data/ghiBaseline.js
export const ghiBaselineMonthly = {
  Vietnam: [135, 145, 165, 170, 180, 175, 170, 160, 155, 150, 135, 130],
  Thailand: [150, 160, 175, 185, 190, 180, 170, 160, 155, 150, 145, 140],
  Philippines: [140, 145, 160, 165, 170, 165, 160, 155, 150, 145, 140, 135],
  Indonesia: [155, 160, 165, 165, 165, 160, 155, 155, 155, 155, 155, 155],
  Malaysia: [130, 135, 145, 150, 155, 155, 155, 150, 145, 140, 135, 130],
  India: [135, 150, 175, 190, 200, 195, 190, 180, 170, 160, 145, 135],
  China: [100, 120, 145, 165, 180, 190, 200, 190, 160, 135, 110, 95],
  Japan: [85, 105, 140, 165, 180, 190, 185, 165, 135, 105, 85, 75],
  Korea: [80, 95, 125, 155, 175, 185, 180, 160, 130, 100, 80, 70],
  Singapore: [145, 150, 155, 160, 160, 160, 155, 155, 150, 150, 145, 145],
};

export function getMonthlyGHI(country, month) {
  const arr = ghiBaselineMonthly[country] || ghiBaselineMonthly["Vietnam"];
  return arr[month - 1] || 0;
}
