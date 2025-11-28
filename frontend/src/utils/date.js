export function normalizeDateString(input) {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d)) return input;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateDisplay(input) {
  if (!input) return "—";
  const d = new Date(input);
  if (isNaN(d)) return input;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
