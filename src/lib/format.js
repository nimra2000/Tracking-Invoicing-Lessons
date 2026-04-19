export function lessonAmount(lesson) {
  if (lesson.pricing_type === "flat") return Number(lesson.rate);
  return (Number(lesson.duration_mins) / 60) * Number(lesson.rate);
}

export function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export function monthLabel(yyyyMm) {
  if (!yyyyMm) return "";
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(y, m - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
