export function skaterIdsOf(lesson) {
  return Array.isArray(lesson.skater_ids) ? lesson.skater_ids : [];
}

export function invoiceMappingOf(lesson) {
  return lesson.invoice_mapping && typeof lesson.invoice_mapping === "object"
    ? lesson.invoice_mapping
    : {};
}

export function lessonTotal(lesson) {
  if (lesson.pricing_type === "flat") return Number(lesson.rate || 0);
  return (Number(lesson.duration_mins || 0) / 60) * Number(lesson.rate || 0);
}

export function perSkaterAmount(lesson) {
  const n = Math.max(1, skaterIdsOf(lesson).length);
  return lessonTotal(lesson) / n;
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
