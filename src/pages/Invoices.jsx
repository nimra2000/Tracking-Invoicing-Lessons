import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Plus, X, Send, Trash2, CheckCircle2 } from "lucide-react";
import { lessonAmount, money, formatDate, monthLabel } from "@/lib/format";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [skaters, setSkaters] = useState([]);
  const [showGen, setShowGen] = useState(false);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    const [inv, les, sk] = await Promise.all([
      base44.entities.Invoice.list(),
      base44.entities.Lesson.list(),
      base44.entities.Skater.list(),
    ]);
    inv.sort((a, b) => (b.invoice_date || "").localeCompare(a.invoice_date || ""));
    setInvoices(inv);
    setLessons(les);
    setSkaters(sk);
  };

  const skaterMap = useMemo(
    () => Object.fromEntries(skaters.map((s) => [s.id, s])),
    [skaters]
  );

  const totals = useMemo(() => {
    const pending = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + (i.total || 0), 0);
    const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total || 0), 0);
    return { pending, paid };
  }, [invoices]);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500 mt-1">Generate and track invoices</p>
        </div>
        <Button
          onClick={() => setShowGen(true)}
          className="bg-slate-900 hover:bg-slate-800 rounded-xl h-11 px-5"
        >
          <Plus className="w-4 h-4 mr-2" /> Generate Invoices
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 mb-6 overflow-hidden">
        {invoices.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            No invoices yet
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                skater={skaterMap[inv.skater_id]}
                onClick={() => setViewing(inv)}
                onChange={refresh}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Total Invoices" value={invoices.length} />
        <StatTile label="Pending" value={money(totals.pending)} color="text-orange-600" />
        <StatTile label="Paid" value={money(totals.paid)} color="text-green-600" />
      </div>

      {showGen && (
        <GenerateModal
          lessons={lessons}
          skaters={skaters}
          onClose={() => setShowGen(false)}
          onDone={refresh}
        />
      )}
      {viewing && (
        <InvoiceDetail
          invoice={viewing}
          skater={skaterMap[viewing.skater_id]}
          lessons={lessons.filter((l) => l.invoice_id === viewing.id)}
          onClose={() => setViewing(null)}
          onChange={refresh}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, color = "text-slate-900" }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function InvoiceRow({ invoice, skater, onClick, onChange }) {
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm("Delete this invoice? (Lessons will become uninvoiced again.)")) return;
    const lessons = (await base44.entities.Lesson.list()).filter((l) => l.invoice_id === invoice.id);
    for (const l of lessons) await base44.entities.Lesson.update(l.id, { invoice_id: "" });
    await base44.entities.Invoice.delete(invoice.id);
    onChange();
  };
  return (
    <div
      onClick={onClick}
      className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
    >
      <div>
        <div className="font-medium text-slate-900">
          {skater?.billing_name || skater?.name || "—"}
        </div>
        <div className="text-xs text-slate-500">
          {invoice.period_label || invoice.month} · issued {formatDate(invoice.invoice_date)}
          {invoice.sent_at && <span className="ml-2 text-sky-600">· Sent</span>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs px-2 py-1 rounded ${
            invoice.status === "paid" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
          }`}
        >
          {invoice.status}
        </span>
        <div className="font-semibold text-slate-900">{money(invoice.total)}</div>
        <button onClick={handleDelete} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function GenerateModal({ lessons, skaters, onClose, onDone }) {
  const [periodType, setPeriodType] = useState("single");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [endMonth, setEndMonth] = useState(new Date().toISOString().slice(0, 7));
  const [taxRate, setTaxRate] = useState("0");
  const [selected, setSelected] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const uninvoicedInPeriod = useMemo(() => {
    const matches = (date) => {
      if (!date) return false;
      const m = date.slice(0, 7);
      if (periodType === "single") return m === month;
      return m >= month && m <= endMonth;
    };
    return lessons.filter((l) => !l.invoice_id && matches(l.date));
  }, [lessons, periodType, month, endMonth]);

  const bySkater = useMemo(() => {
    const map = {};
    for (const l of uninvoicedInPeriod) {
      (map[l.skater_id] ||= []).push(l);
    }
    return map;
  }, [uninvoicedInPeriod]);

  const toggleSkater = (sid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selected.size === 0) return setError("Select at least one skater");
    setError("");
    setGenerating(true);
    try {
      const rate = Number(taxRate) || 0;
      const label = periodType === "single" ? monthLabel(month) : `${monthLabel(month)} – ${monthLabel(endMonth)}`;
      const periodKey = periodType === "single" ? month : `${month}_${endMonth}`;
      for (const skaterId of selected) {
        const skLessons = bySkater[skaterId] || [];
        const subtotal = skLessons.reduce((s, l) => s + lessonAmount(l), 0);
        const tax_amount = subtotal * (rate / 100);
        const total = subtotal + tax_amount;
        const invoice = await base44.entities.Invoice.create({
          skater_id: skaterId,
          month: periodKey,
          invoice_date: new Date().toISOString().slice(0, 10),
          period_label: label,
          tax_rate: rate,
          subtotal,
          tax_amount,
          total,
          status: "pending",
        });
        for (const l of skLessons) {
          await base44.entities.Lesson.update(l.id, { invoice_id: invoice.id });
        }
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setGenerating(false);
    }
  };

  const skatersWithLessons = Object.keys(bySkater);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Generate Invoices</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">Billing Period Type</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white text-sm"
            >
              <option value="single">Single Month</option>
              <option value="range">Month Range</option>
            </select>
          </div>
          <div className={periodType === "range" ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1.5">
                {periodType === "single" ? "Invoice Month" : "From Month"}
              </label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            {periodType === "range" && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">To Month</label>
                <Input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">Tax Rate (%)</label>
            <Input
              type="number"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">
              Select Skaters to Invoice
            </label>
            {skatersWithLessons.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center bg-slate-50 rounded-xl">
                No uninvoiced lessons found for this period.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {skatersWithLessons.map((sid) => {
                  const sk = skaters.find((s) => s.id === sid);
                  const ls = bySkater[sid];
                  const subtotal = ls.reduce((s, l) => s + lessonAmount(l), 0);
                  return (
                    <label
                      key={sid}
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(sid)}
                          onChange={() => toggleSkater(sid)}
                        />
                        <div>
                          <div className="text-sm font-medium">{sk?.name || "—"}</div>
                          <div className="text-xs text-slate-500">{ls.length} lessons</div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">{money(subtotal)}</div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || selected.size === 0}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {generating ? "Generating..." : "Generate Invoices"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetail({ invoice, skater, lessons, onClose, onChange }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const { data } = await base44.functions.invoke("send-invoice", { invoice_id: invoice.id });
      setResult(data);
      if (data?.success) onChange();
    } catch (err) {
      setResult({ error: err.message || String(err) });
    } finally {
      setSending(false);
    }
  };

  const togglePaid = async () => {
    const newStatus = invoice.status === "paid" ? "pending" : "paid";
    await base44.entities.Invoice.update(invoice.id, { status: newStatus });
    onChange();
    onClose();
  };

  const recipients = skater?.billing_emails?.length ? skater.billing_emails : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Invoice Detail</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-sm text-slate-500 mb-4">
          <div><span className="font-medium text-slate-900">Bill To:</span> {skater?.billing_name || skater?.name}</div>
          <div><span className="font-medium text-slate-900">Period:</span> {invoice.period_label || invoice.month}</div>
          <div><span className="font-medium text-slate-900">Invoice Date:</span> {formatDate(invoice.invoice_date)}</div>
          <div>
            <span className="font-medium text-slate-900">Recipients:</span>{" "}
            {recipients.length ? recipients.join(", ") : <span className="text-red-600">No billing emails on file</span>}
          </div>
        </div>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2">Date</th>
              <th className="py-2">Type</th>
              <th className="py-2 text-right">Duration</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lessons.map((l) => (
              <tr key={l.id}>
                <td className="py-2">{formatDate(l.date)}</td>
                <td className="py-2">{l.lesson_type}</td>
                <td className="py-2 text-right">{l.duration_mins} min</td>
                <td className="py-2 text-right">
                  {l.pricing_type === "hourly" ? `$${l.rate}/hr` : `${money(l.rate)} flat`}
                </td>
                <td className="py-2 text-right font-medium">{money(lessonAmount(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1 text-sm text-right">
          <div>
            <span className="text-slate-500 mr-4">Subtotal</span>
            <span className="inline-block w-20">{money(invoice.subtotal)}</span>
          </div>
          {invoice.tax_amount > 0 && (
            <div>
              <span className="text-slate-500 mr-4">Tax ({invoice.tax_rate}%)</span>
              <span className="inline-block w-20">{money(invoice.tax_amount)}</span>
            </div>
          )}
          <div className="text-lg font-bold text-slate-900 pt-1">
            <span className="mr-4">Total Amount Due</span>
            <span className="inline-block w-24">{money(invoice.total)}</span>
          </div>
        </div>

        {result && (
          <div
            className={`mt-4 p-3 rounded-xl text-sm ${
              result.success
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {result.success
              ? `Sent to ${(result.sent_to || []).join(", ")} (${result.pdf_size} byte PDF, ${result.line_items} line items)`
              : `Error: ${result.error}${result.details ? ` — ${result.details}` : ""}`}
          </div>
        )}

        <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={togglePaid}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {invoice.status === "paid" ? "Mark Pending" : "Mark Paid"}
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !recipients.length}
            className="bg-slate-900 hover:bg-slate-800 ml-auto"
          >
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Sending..." : invoice.sent_at ? "Resend Invoice" : "Send Invoice"}
          </Button>
        </div>
      </div>
    </div>
  );
}
