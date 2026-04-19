import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings as SettingsIcon, Save } from "lucide-react";
import DataBackup from "@/components/DataBackup";

export default function Settings() {
  const [form, setForm] = useState({
    default_hourly_rate: "50",
    coach_name: "",
    coach_email: "",
    coach_phone: "",
    coach_address: "",
    coach_website: "",
    tax_number: "",
    payment_instructions_etransfer: "",
    accepts_cheque_cash: true,
  });
  const [id, setId] = useState(null);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    base44.entities.Profile.list().then((list) => {
      if (list[0]) {
        setId(list[0].id);
        setForm((f) => ({
          ...f,
          ...Object.fromEntries(
            Object.entries(list[0]).map(([k, v]) => [k, v == null ? f[k] || "" : typeof v === "boolean" ? v : String(v)])
          ),
        }));
      }
    });
    base44.auth.me().then((u) => {
      setForm((f) => ({ ...f, coach_email: f.coach_email || u.email || "" }));
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      default_hourly_rate: Number(form.default_hourly_rate) || 50,
      coach_name: form.coach_name.trim() || undefined,
      coach_email: form.coach_email.trim() || undefined,
      coach_phone: form.coach_phone.trim() || undefined,
      coach_address: form.coach_address.trim() || undefined,
      coach_website: form.coach_website.trim() || undefined,
      tax_number: form.tax_number.trim() || undefined,
      payment_instructions_etransfer: form.payment_instructions_etransfer.trim() || undefined,
      accepts_cheque_cash: form.accepts_cheque_cash,
    };
    if (id) await base44.entities.Profile.update(id, payload);
    else {
      const created = await base44.entities.Profile.create(payload);
      setId(created.id);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <SettingsIcon className="w-6 h-6 text-slate-600" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-0.5">Configure your coaching preferences</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900">Lesson Settings</h2>
          <p className="text-sm text-slate-500 mb-4">Configure your default rates and lesson preferences.</p>
          <Field label="Default Hourly Rate ($) *">
            <Input
              type="number"
              step="0.01"
              value={form.default_hourly_rate}
              onChange={(e) => set("default_hourly_rate", e.target.value)}
            />
          </Field>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900">Coach Information</h2>
          <p className="text-sm text-slate-500 mb-4">This information will appear on your invoices.</p>
          <div className="space-y-4">
            <Field label="Name (optional)">
              <Input value={form.coach_name} onChange={(e) => set("coach_name", e.target.value)} placeholder="Your name" />
            </Field>
            <Field label="Email (optional)">
              <Input
                type="email"
                value={form.coach_email}
                onChange={(e) => set("coach_email", e.target.value)}
                placeholder="coach@example.com"
              />
            </Field>
            <Field label="Phone (optional)">
              <Input
                value={form.coach_phone}
                onChange={(e) => set("coach_phone", e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </Field>
            <Field label="Address (optional)">
              <Input
                value={form.coach_address}
                onChange={(e) => set("coach_address", e.target.value)}
                placeholder="123 Main St, City, State"
              />
            </Field>
            <Field label="Website (optional)">
              <Input
                value={form.coach_website}
                onChange={(e) => set("coach_website", e.target.value)}
                placeholder="https://example.com"
              />
            </Field>
            <Field label="Tax/Business Number (optional)">
              <Input
                value={form.tax_number}
                onChange={(e) => set("tax_number", e.target.value)}
                placeholder="e.g., GST/HST Number, Tax ID"
              />
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900">Payment Instructions</h2>
          <p className="text-sm text-slate-500 mb-4">Shown at the bottom of every invoice.</p>
          <div className="space-y-4">
            <Field label="E-Transfer email">
              <Input
                type="email"
                value={form.payment_instructions_etransfer}
                onChange={(e) => set("payment_instructions_etransfer", e.target.value)}
                placeholder="coach@example.com"
              />
            </Field>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.accepts_cheque_cash}
                onChange={(e) => set("accepts_cheque_cash", e.target.checked)}
              />
              Accept cheque &amp; cash
            </label>
          </div>
        </section>

        <div className="flex items-center justify-between">
          {saved && <span className="text-sm text-green-600">Saved!</span>}
          <Button type="submit" className="bg-slate-900 hover:bg-slate-800 ml-auto">
            <Save className="w-4 h-4 mr-2" /> Save Settings
          </Button>
        </div>
      </form>

      <div className="mt-6">
        <DataBackup />
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
