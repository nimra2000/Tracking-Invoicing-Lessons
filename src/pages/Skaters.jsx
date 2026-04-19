import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, X, Trash2, ChevronRight } from "lucide-react";
import { money } from "@/lib/format";

export default function Skaters() {
  const [skaters, setSkaters] = useState([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    refresh();
    base44.entities.Profile.list().then((list) => setProfile(list[0] || null));
  }, []);

  const refresh = async () => {
    const list = await base44.entities.Skater.list();
    list.sort((a, b) => a.name.localeCompare(b.name));
    setSkaters(list);
  };

  const filtered = skaters.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Skaters</h1>
          <p className="text-slate-500 mt-1">Manage your skating students</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-slate-900 hover:bg-slate-800 rounded-xl h-11 px-4 shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Skater
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skaters..."
          className="pl-10 h-11 bg-white border-slate-200 rounded-xl"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            {skaters.length === 0 ? "No skaters yet" : "No matches"}
          </div>
        ) : (
          <>
            <div className="px-5 py-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
              Click a skater to edit their profile.
            </div>
            <div className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <SkaterRow key={s.id} skater={s} onEdit={() => setEditing(s)} onChange={refresh} />
              ))}
            </div>
          </>
        )}
      </div>

      {(showForm || editing) && (
        <SkaterModal
          skater={editing}
          defaultRate={profile?.default_hourly_rate || 50}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function SkaterRow({ skater, onEdit, onChange }) {
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete ${skater.name}?`)) return;
    await base44.entities.Skater.delete(skater.id);
    onChange();
  };
  return (
    <div
      onClick={onEdit}
      role="button"
      tabIndex={0}
      className="group px-5 py-4 flex items-center justify-between hover:bg-sky-50/60 cursor-pointer transition-colors"
    >
      <div>
        <div className="font-medium text-slate-900 group-hover:text-sky-900">{skater.name}</div>
        <div className="text-xs text-slate-500">
          {money(skater.default_hourly_rate)}/hr
          {skater.billing_name ? ` · Bill to: ${skater.billing_name}` : ""}
          {skater.billing_emails?.length ? ` · ${skater.billing_emails.join(", ")}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition" />
      </div>
    </div>
  );
}

function SkaterModal({ skater, defaultRate, onClose, onSaved }) {
  const isEdit = Boolean(skater);
  const [form, setForm] = useState(
    isEdit
      ? {
          name: skater.name || "",
          billing_name: skater.billing_name || "",
          billing_email: "",
          billing_emails: skater.billing_emails || [],
          default_hourly_rate: String(skater.default_hourly_rate ?? defaultRate),
          notes: skater.notes || "",
        }
      : {
          name: "",
          billing_name: "",
          billing_email: "",
          billing_emails: [],
          default_hourly_rate: String(defaultRate),
          notes: "",
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const addEmail = () => {
    const trimmed = form.billing_email.trim();
    if (!trimmed) return;
    set("billing_emails", [...form.billing_emails, trimmed]);
    set("billing_email", "");
  };
  const removeEmail = (i) =>
    set("billing_emails", form.billing_emails.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Name is required");
    const rate = Number(form.default_hourly_rate);
    if (!rate || rate <= 0) return setError("Valid hourly rate required");
    setError("");
    setSaving(true);
    try {
      const emails = [...form.billing_emails];
      if (form.billing_email.trim()) emails.push(form.billing_email.trim());
      const payload = {
        name: form.name.trim(),
        billing_name: form.billing_name.trim() || undefined,
        billing_emails: emails,
        default_hourly_rate: rate,
        notes: form.notes.trim() || undefined,
      };
      if (isEdit) await base44.entities.Skater.update(skater.id, payload);
      else await base44.entities.Skater.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    if (!confirm(`Delete ${skater.name}?`)) return;
    try {
      await base44.entities.Skater.delete(skater.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">
            {isEdit ? "Edit Skater" : "Add New Skater"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Skater Name *">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field
            label="Billing Name"
            hint="(optional — parent or business)"
          >
            <Input
              value={form.billing_name}
              onChange={(e) => set("billing_name", e.target.value)}
              placeholder="Defaults to skater name"
            />
          </Field>
          <Field label="Billing Emails (optional)">
            <div className="flex gap-2">
              <Input
                type="email"
                value={form.billing_email}
                onChange={(e) => set("billing_email", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                placeholder="Add email address"
              />
              <Button
                type="button"
                onClick={addEmail}
                className="bg-slate-900 h-11 w-11 p-0 rounded-xl"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {form.billing_emails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.billing_emails.map((em, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-slate-100 rounded-full px-3 py-1 text-xs"
                  >
                    {em}
                    <button type="button" onClick={() => removeEmail(i)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
          <Field label="Default Hourly Rate ($) *">
            <Input
              type="number"
              step="0.01"
              value={form.default_hourly_rate}
              onChange={(e) => set("default_hourly_rate", e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </Field>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-between items-center pt-2">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-slate-900 hover:bg-slate-800">
                {saving ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900 mb-1.5">
        {label}
        {hint && <span className="text-slate-400 font-normal ml-1">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
