import { base44 } from "@/api/base44Client";
import { lessonAmount } from "@/lib/format";

/**
 * Recompute the subtotal / tax_amount / total of an invoice based on the
 * current lesson records that point at it.
 *
 * Call this whenever a lesson attached to an invoice is created, edited,
 * or deleted. It's a no-op for lessons not on an invoice.
 */
export async function recalcInvoice(invoiceId) {
  if (!invoiceId) return;
  const invoice = await base44.entities.Invoice.get(invoiceId).catch(() => null);
  if (!invoice) return;
  const all = await base44.entities.Lesson.list();
  const lessons = all.filter((l) => l.invoice_id === invoiceId);
  const subtotal = lessons.reduce((s, l) => s + lessonAmount(l), 0);
  const taxRate = Number(invoice.tax_rate || 0);
  const tax_amount = subtotal * (taxRate / 100);
  const total = subtotal + tax_amount;
  await base44.entities.Invoice.update(invoiceId, { subtotal, tax_amount, total });
}
