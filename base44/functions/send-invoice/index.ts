import { createClientFromRequest } from "npm:@base44/sdk";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function formatDate(isoDate: string | undefined | null): string {
  if (!isoDate) return "";
  const base = String(isoDate).slice(0, 10);
  const d = new Date(base + "T00:00:00");
  if (isNaN(d.getTime())) return String(isoDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function deriveMonthLabel(yyyyMm: string | undefined): string {
  if (!yyyyMm) return "";
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) return yyyyMm;
  return new Date(y, m - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function lessonAmount(l: { duration_mins: number; pricing_type: string; rate: number }): number {
  if (l.pricing_type === "flat") return Number(l.rate);
  return (l.duration_mins / 60) * Number(l.rate);
}

async function buildInvoicePDF(
  profile: any,
  skater: any,
  invoice: any,
  lessons: any[]
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const PAGE_W = 612;
  const LEFT = 50;
  const RIGHT = PAGE_W - 50;

  const grey = rgb(0.45, 0.45, 0.5);
  const black = rgb(0.08, 0.08, 0.1);

  let y = 740;

  // Coach header
  if (profile.coach_name) {
    page.drawText(profile.coach_name, { x: LEFT, y, size: 14, font: bold, color: black });
    y -= 16;
  }
  for (const line of [profile.coach_address, profile.coach_phone ? `Phone: ${profile.coach_phone}` : null, profile.coach_email ? `Email: ${profile.coach_email}` : null].filter(Boolean)) {
    page.drawText(line, { x: LEFT, y, size: 9, font: regular, color: grey });
    y -= 12;
  }
  y -= 8;
  page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 1, color: black });
  y -= 20;

  // INVOICE title
  page.drawText("INVOICE", { x: LEFT, y, size: 22, font: bold, color: black });
  y -= 26;

  // Invoice Date / Period
  const invoiceDateText = formatDate(invoice.invoice_date) || formatDate(invoice.created_date) || formatDate(new Date().toISOString());
  const periodText = invoice.period_label || deriveMonthLabel(invoice.month) || invoice.month || "—";
  page.drawText("Invoice Date", { x: LEFT, y, size: 8, font: regular, color: grey });
  page.drawText("Invoice Period", { x: LEFT + 100, y, size: 8, font: regular, color: grey });
  y -= 14;
  page.drawText(invoiceDateText, { x: LEFT, y, size: 11, font: bold, color: black });
  page.drawText(periodText, { x: LEFT + 100, y, size: 11, font: bold, color: black });
  y -= 32;

  // BILL TO — draw rect below the cursor, then advance past it
  const billHeight = 50;
  page.drawRectangle({
    x: LEFT,
    y: y - billHeight,
    width: RIGHT - LEFT,
    height: billHeight,
    color: rgb(0.96, 0.96, 0.98),
  });
  page.drawText("BILL TO", { x: LEFT + 14, y: y - 16, size: 8, font: regular, color: grey });
  page.drawText(skater.billing_name || skater.name, {
    x: LEFT + 14,
    y: y - 34,
    size: 13,
    font: bold,
    color: black,
  });
  y -= billHeight + 24;

  // Table header
  page.drawText("DATE", { x: LEFT, y, size: 8, font: bold, color: grey });
  page.drawText("LESSON TYPE", { x: LEFT + 95, y, size: 8, font: bold, color: grey });
  page.drawText("DURATION", { x: LEFT + 215, y, size: 8, font: bold, color: grey });
  page.drawText("RATE", { x: LEFT + 320, y, size: 8, font: bold, color: grey });
  const amountX = RIGHT - 50;
  page.drawText("AMOUNT", { x: amountX, y, size: 8, font: bold, color: grey });
  y -= 10;
  page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.9) });
  y -= 16;

  for (const l of lessons) {
    const amt = lessonAmount(l);
    const rateStr = l.pricing_type === "hourly" ? `$${Number(l.rate).toFixed(0)}/hr` : `$${Number(l.rate).toFixed(2)} flat`;
    const durationStr = `${l.duration_mins} min`;
    page.drawText(formatDate(l.date), { x: LEFT, y, size: 9, font: regular, color: black });
    page.drawText(l.lesson_type || "Private", { x: LEFT + 95, y, size: 9, font: regular, color: black });
    page.drawText(durationStr, { x: LEFT + 215, y, size: 9, font: regular, color: black });
    page.drawText(rateStr, { x: LEFT + 320, y, size: 9, font: regular, color: black });
    const amtStr = `$${amt.toFixed(2)}`;
    const amtW = bold.widthOfTextAtSize(amtStr, 9);
    page.drawText(amtStr, { x: RIGHT - amtW, y, size: 9, font: bold, color: black });
    y -= 18;
    if (y < 140) break; // prevent overflow for now (single-page)
  }

  // Divider line before totals
  y -= 4;
  page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.9) });
  y -= 20;

  // Totals — each on its own row with proper spacing
  const subtotalStr = `$${(invoice.subtotal || 0).toFixed(2)}`;
  const subtotalW = regular.widthOfTextAtSize(subtotalStr, 10);
  page.drawText("Subtotal", { x: RIGHT - 180, y, size: 10, font: regular, color: grey });
  page.drawText(subtotalStr, { x: RIGHT - subtotalW, y, size: 10, font: regular, color: black });
  y -= 18;

  if (invoice.tax_amount && invoice.tax_amount > 0) {
    const taxStr = `$${invoice.tax_amount.toFixed(2)}`;
    const taxW = regular.widthOfTextAtSize(taxStr, 10);
    page.drawText(`Tax (${invoice.tax_rate}%)`, { x: RIGHT - 180, y, size: 10, font: regular, color: grey });
    page.drawText(taxStr, { x: RIGHT - taxW, y, size: 10, font: regular, color: black });
    y -= 18;
  }

  // Extra gap before Total so the bigger text has room
  y -= 8;
  const totalStr = `$${(invoice.total || 0).toFixed(2)}`;
  const totalW = bold.widthOfTextAtSize(totalStr, 14);
  page.drawText("Total Amount Due", { x: RIGHT - 220, y, size: 14, font: bold, color: black });
  page.drawText(totalStr, { x: RIGHT - totalW, y, size: 14, font: bold, color: black });
  y -= 40;

  // Payment Instructions
  if (profile.payment_instructions_etransfer || profile.accepts_cheque_cash) {
    page.drawRectangle({ x: LEFT, y: y - 52, width: RIGHT - LEFT, height: 60, color: rgb(0.97, 0.97, 0.99) });
    page.drawText("Payment Instructions", { x: LEFT + 12, y: y - 4, size: 10, font: bold, color: black });
    page.drawText("We accept the following payment methods:", { x: LEFT + 12, y: y - 18, size: 8, font: regular, color: grey });
    let py = y - 30;
    if (profile.payment_instructions_etransfer) {
      page.drawText("E-Transfer:", { x: LEFT + 12, y: py, size: 8, font: bold, color: black });
      page.drawText(profile.payment_instructions_etransfer, { x: LEFT + 65, y: py, size: 8, font: regular, color: black });
      py -= 10;
    }
    if (profile.accepts_cheque_cash) {
      page.drawText("Cheque & Cash:", { x: LEFT + 12, y: py, size: 8, font: bold, color: black });
      page.drawText("Accepted", { x: LEFT + 80, y: py, size: 8, font: regular, color: black });
    }
  }

  return await pdf.save();
}

function buildMimeWithAttachment(
  from: string,
  to: string,
  subject: string,
  body: string,
  pdfBytes: Uint8Array,
  pdfFilename: string
): string {
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
  const b64pdf = base64Encode(pdfBytes).replace(/(.{76})/g, "$1\r\n");
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    body,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFilename}"`,
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64pdf,
    `--${boundary}--`,
  ].join("\r\n");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { invoice_id } = await req.json();
    if (!invoice_id) return Response.json({ error: "invoice_id required" }, { status: 400 });

    const invoice = await base44.entities.Invoice.get(invoice_id);
    if (!invoice) return Response.json({ error: "Invoice not found" }, { status: 404 });
    console.log("[send-invoice] invoice record:", JSON.stringify(invoice));

    const skater = await base44.entities.Skater.get(invoice.skater_id);
    if (!skater) return Response.json({ error: "Skater not found" }, { status: 404 });

    const lessons = (await base44.entities.Lesson.list()).filter(
      (l: any) => l.invoice_id === invoice_id
    );
    lessons.sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Always recompute totals from current lessons so edits are reflected.
    const recomputedSubtotal = lessons.reduce((s: number, l: any) => s + lessonAmount(l), 0);
    const recomputedTaxAmount = recomputedSubtotal * (Number(invoice.tax_rate || 0) / 100);
    const recomputedTotal = recomputedSubtotal + recomputedTaxAmount;
    const driftedSubtotal = Math.abs(recomputedSubtotal - Number(invoice.subtotal || 0)) > 0.001;
    if (driftedSubtotal) {
      await base44.entities.Invoice.update(invoice_id, {
        subtotal: recomputedSubtotal,
        tax_amount: recomputedTaxAmount,
        total: recomputedTotal,
      });
    }
    invoice.subtotal = recomputedSubtotal;
    invoice.tax_amount = recomputedTaxAmount;
    invoice.total = recomputedTotal;

    const profiles = await base44.entities.Profile.list();
    const profile = profiles[0] || { coach_email: user.email };

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("gmail");

    const pdfBytes = await buildInvoicePDF(profile, skater, invoice, lessons);

    const recipients = (skater.billing_emails && skater.billing_emails.length
      ? skater.billing_emails
      : [skater.email || user.email]
    ).filter(Boolean);
    if (recipients.length === 0) {
      return Response.json({ error: "No recipient emails on file for this skater" }, { status: 400 });
    }

    const billTo = skater.billing_name || skater.name;
    const periodLabel = invoice.period_label || invoice.month;
    const subject = `Invoice for ${periodLabel}`;
    const body = `Hi ${billTo},\n\nPlease find your invoice for ${periodLabel} attached.\n\nTotal Amount Due: $${invoice.total.toFixed(2)}\n\nThank you!`;
    const filename = `invoice-${skater.name.replace(/\s+/g, "-")}-${invoice.month}.pdf`;

    const mime = buildMimeWithAttachment(
      user.email,
      recipients.join(", "),
      subject,
      body,
      pdfBytes,
      filename
    );
    const raw = base64UrlEncode(new TextEncoder().encode(mime));

    const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });

    if (!gmailRes.ok) {
      const errorText = await gmailRes.text();
      return Response.json({ error: "Gmail API error", details: errorText }, { status: 502 });
    }

    await base44.entities.Invoice.update(invoice_id, { sent_at: new Date().toISOString() });

    return Response.json({
      success: true,
      sent_to: recipients,
      pdf_size: pdfBytes.length,
      line_items: lessons.length,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
