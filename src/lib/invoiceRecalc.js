import { base44 } from "@/api/base44Client";
import { perSkaterAmount, invoiceMappingOf } from "@/lib/format";

/**
 * Recompute the subtotal / tax_amount / total of an invoice based on the
 * per-skater shares of the current lesson records that point at it.
 *
 * If the totals actually change, stamp `recalculated_at` — the UI uses this
 * against `sent_at` to warn when a sent invoice has drifted out of sync.
 */
export async function recalcInvoice(invoiceId) {
  if (!invoiceId) return;
  const invoice = await base44.entities.Invoice.get(invoiceId).catch(() => null);
  if (!invoice) return;
  const all = await base44.entities.Lesson.list();
  const skaterId = invoice.skater_id;

  const lessons = all.filter((l) => invoiceMappingOf(l)[skaterId] === invoiceId);
  const subtotal = lessons.reduce((s, l) => s + perSkaterAmount(l), 0);
  const taxRate = Number(invoice.tax_rate || 0);
  const tax_amount = subtotal * (taxRate / 100);
  const total = subtotal + tax_amount;

  const changed =
    Math.abs(subtotal - Number(invoice.subtotal || 0)) > 0.001 ||
    Math.abs(total - Number(invoice.total || 0)) > 0.001;

  const patch = { subtotal, tax_amount, total };
  if (changed) patch.recalculated_at = new Date().toISOString();

  await base44.entities.Invoice.update(invoiceId, patch);
}
