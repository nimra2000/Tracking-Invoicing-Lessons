import { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Trash2, ChevronLeft, ChevronRight, Calendar as CalIcon, List as ListIcon } from "lucide-react";
import { lessonAmount, money, formatDate } from "@/lib/format";
import { recalcInvoice } from "@/lib/invoiceRecalc";

const DURATION_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 5); // 5..60
const LESSON_TYPES = [
  "Private",
  "Semi Private",
  "Competition",
  "Choreography",
  "Off-Ice Training",
  "Expenses",
];

function isoKey(d) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

export default function Lessons() {
  const [lessons, setLessons] = useState([]);
  const [skaters, setSkaters] = useState([]);
  const [mode, setMode] = useState("calendar"); // 'calendar' | 'list'
  const [calView, setCalView] = useState("week"); // 'week' | 'day'
  const [cursor, setCursor] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    const [ls, sk] = await Promise.all([
      base44.entities.Lesson.list(),
      base44.entities.Skater.list(),
    ]);
    setLessons(ls);
    setSkaters(sk);
  };

  const skaterMap = useMemo(() => Object.fromEntries(skaters.map((s) => [s.id, s])), [skaters]);

  const totalRevenue = lessons.reduce((s, l) => s + lessonAmount(l), 0);
  const uninvoiced = lessons.filter((l) => !l.invoice_id).length;

  const nav = (delta) => {
    const d = new Date(cursor);
    if (mode === "calendar" && calView === "week") d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCursor(d);
  };

  const handleSaved = () => refresh();
  const handleDeleted = () => refresh();

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Lessons</h1>
          <p className="text-slate-500 mt-1">Track your daily lessons</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              onClick={() => setMode("calendar")}
              className={`inline-flex items-center gap-2 px-4 h-9 text-sm rounded-lg ${
                mode === "calendar" ? "bg-slate-900 text-white" : "text-slate-700"
              }`}
            >
              <CalIcon className="w-4 h-4" /> Calendar
            </button>
            <button
              onClick={() => setMode("list")}
              className={`inline-flex items-center gap-2 px-4 h-9 text-sm rounded-lg ${
                mode === "list" ? "bg-slate-900 text-white" : "text-slate-700"
              }`}
            >
              <ListIcon className="w-4 h-4" /> List
            </button>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-slate-900 hover:bg-slate-800 rounded-xl h-11 px-5"
          >
            <Plus className="w-4 h-4 mr-2" /> Log Lesson
          </Button>
        </div>
      </div>

      {mode === "calendar" && (
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="px-4 h-9 rounded-lg border border-slate-200 bg-white text-sm"
          >
            Today
          </button>
          <button onClick={() => nav(1)} className="p-2 rounded-lg hover:bg-slate-100">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white ml-3 p-1">
            <button
              onClick={() => setCalView("week")}
              className={`px-4 h-8 text-sm rounded-md ${calView === "week" ? "bg-slate-900 text-white" : "text-slate-700"}`}
            >
              Week
            </button>
            <button
              onClick={() => setCalView("day")}
              className={`px-4 h-8 text-sm rounded-md ${calView === "day" ? "bg-slate-900 text-white" : "text-slate-700"}`}
            >
              Day
            </button>
          </div>
        </div>
      )}

      {mode === "calendar" ? (
        calView === "week" ? (
          <WeekView cursor={cursor} lessons={lessons} skaterMap={skaterMap} onEdit={setEditing} />
        ) : (
          <DayView cursor={cursor} lessons={lessons} skaterMap={skaterMap} onEdit={setEditing} />
        )
      ) : (
        <ListView lessons={lessons} skaterMap={skaterMap} onEdit={setEditing} onChange={handleDeleted} />
      )}

      <div className="grid grid-cols-3 gap-4 mt-6">
        <StatTile label="Total Lessons" value={lessons.length} />
        <StatTile label="Total Revenue" value={money(totalRevenue)} />
        <StatTile label="Uninvoiced" value={uninvoiced} />
      </div>

      {(showForm || editing) && (
        <LessonModal
          lesson={editing}
          skaters={skaters}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function DayCard({ date, lessons, skaterMap, isToday, onEdit, large }) {
  return (
    <div
      className={`bg-white rounded-2xl border ${
        isToday ? "border-purple-400 ring-2 ring-purple-200" : "border-slate-200"
      } overflow-hidden flex flex-col ${large ? "min-h-[360px]" : "min-h-[220px]"}`}
    >
      <div className="p-3 bg-slate-50 border-b border-slate-100">
        <div className="text-xs font-medium text-slate-500">
          {date.toLocaleDateString("en-US", { weekday: "short" })}
        </div>
        <div className={`text-2xl font-bold ${isToday ? "text-purple-600" : "text-slate-900"}`}>
          {date.getDate()}
        </div>
        <div className="text-xs text-slate-400">{date.getFullYear()}</div>
      </div>
      <div className="flex-1 p-2 overflow-y-auto">
        {lessons.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            No lessons
          </div>
        ) : (
          <div className="space-y-2">
            {lessons.map((l) => (
              <button
                key={l.id}
                onClick={() => onEdit(l)}
                className="w-full text-left p-2 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-100 text-xs"
              >
                <div className="font-medium text-slate-900 truncate">
                  {skaterMap[l.skater_id]?.name || "—"}
                </div>
                <div className="text-slate-500">
                  {l.lesson_type} · {l.duration_mins} min
                </div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {money(lessonAmount(l))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WeekView({ cursor, lessons, skaterMap, onEdit }) {
  const start = startOfWeek(cursor);
  const todayKey = isoKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  return (
    <div className="grid grid-cols-7 gap-3">
      {days.map((d) => {
        const key = isoKey(d);
        const dayLessons = lessons.filter((l) => l.date === key);
        return (
          <DayCard
            key={key}
            date={d}
            lessons={dayLessons}
            skaterMap={skaterMap}
            isToday={key === todayKey}
            onEdit={onEdit}
          />
        );
      })}
    </div>
  );
}

function DayView({ cursor, lessons, skaterMap, onEdit }) {
  const key = isoKey(cursor);
  const todayKey = isoKey(new Date());
  const dayLessons = lessons.filter((l) => l.date === key);
  return (
    <DayCard
      date={cursor}
      lessons={dayLessons}
      skaterMap={skaterMap}
      isToday={key === todayKey}
      onEdit={onEdit}
      large
    />
  );
}

function ListView({ lessons, skaterMap, onEdit, onChange }) {
  const sorted = [...lessons].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {sorted.length === 0 ? (
        <div className="py-16 text-center text-slate-400">No lessons</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {sorted.map((l) => (
            <LessonRow
              key={l.id}
              lesson={l}
              skater={skaterMap[l.skater_id]}
              onEdit={() => onEdit(l)}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonRow({ lesson, skater, onEdit, onChange }) {
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm("Delete this lesson?")) return;
    const invoiceId = lesson.invoice_id;
    await base44.entities.Lesson.delete(lesson.id);
    if (invoiceId) await recalcInvoice(invoiceId);
    onChange();
  };
  return (
    <div className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer" onClick={onEdit}>
      <div>
        <div className="font-medium text-slate-900">{skater?.name || "—"}</div>
        <div className="text-xs text-slate-500">
          {formatDate(lesson.date)} · {lesson.lesson_type} · {lesson.duration_mins} min
          {lesson.invoice_id && <span className="ml-2 text-sky-600">· Invoiced</span>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="font-semibold text-slate-900">{money(lessonAmount(lesson))}</div>
        <button onClick={handleDelete} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function LessonModal({ lesson, skaters, onClose, onSaved }) {
  const [form, setForm] = useState(
    lesson
      ? { ...lesson, rate: String(lesson.rate), duration_mins: String(lesson.duration_mins) }
      : {
          lesson_type: "Private",
          skater_id: "",
          date: new Date().toISOString().slice(0, 10),
          duration_mins: "30",
          pricing_type: "hourly",
          rate: "",
          notes: "",
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (lesson) return;
    if (!form.skater_id) return;
    const sk = skaters.find((s) => s.id === form.skater_id);
    if (sk && !form.rate) set("rate", String(sk.default_hourly_rate));
  }, [form.skater_id]);

  const totalCost = useMemo(() => {
    const rate = Number(form.rate);
    const dur = Number(form.duration_mins);
    if (!rate || !dur) return 0;
    return form.pricing_type === "flat" ? rate : (dur / 60) * rate;
  }, [form.rate, form.duration_mins, form.pricing_type]);

  const handleDelete = async () => {
    if (!lesson) return;
    if (!confirm("Delete this lesson?")) return;
    const invoiceId = lesson.invoice_id;
    await base44.entities.Lesson.delete(lesson.id);
    if (invoiceId) await recalcInvoice(invoiceId);
    onSaved();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.skater_id) return setError("Select a skater");
    if (!form.rate || Number(form.rate) <= 0) return setError("Enter a valid rate");
    setError("");
    setSaving(true);
    try {
      const payload = {
        skater_id: form.skater_id,
        date: form.date,
        lesson_type: form.lesson_type,
        duration_mins: Number(form.duration_mins),
        pricing_type: form.pricing_type,
        rate: Number(form.rate),
        notes: form.notes?.trim() || undefined,
      };
      let invoiceIdToRecalc = null;
      if (lesson) {
        invoiceIdToRecalc = lesson.invoice_id || null;
        await base44.entities.Lesson.update(lesson.id, payload);
      } else {
        await base44.entities.Lesson.create(payload);
      }
      if (invoiceIdToRecalc) await recalcInvoice(invoiceIdToRecalc);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">{lesson ? "Edit Lesson" : "Log New Lesson"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        {lesson?.invoice_id && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 text-xs">
            This lesson is on an invoice. Changes will update the invoice total automatically.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Lesson Type *">
            <Select value={form.lesson_type} onChange={(v) => set("lesson_type", v)} options={LESSON_TYPES} />
          </Field>
          <Field label="Skater *">
            <Select
              value={form.skater_id}
              onChange={(v) => set("skater_id", v)}
              options={skaters.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Select skater"
            />
          </Field>
          <Field label="Date *">
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Duration (min) *">
            <Select
              value={String(form.duration_mins)}
              onChange={(v) => set("duration_mins", v)}
              options={DURATION_OPTIONS.map((n) => ({ value: String(n), label: `${n} min` }))}
            />
          </Field>
          <Field label="Pricing *">
            <div className="flex gap-4">
              {["hourly", "flat"].map((p) => (
                <label key={p} className="inline-flex items-center gap-2 text-sm capitalize cursor-pointer">
                  <input
                    type="radio"
                    checked={form.pricing_type === p}
                    onChange={() => set("pricing_type", p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </Field>
          <Field label={`Rate ($) * ${form.pricing_type === "hourly" ? "(per hour)" : "(flat)"}`}>
            <Input
              type="number"
              step="0.01"
              value={form.rate}
              onChange={(e) => set("rate", e.target.value)}
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
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-xs text-slate-500">Total Cost</div>
            <div className="text-2xl font-bold text-slate-900">{money(totalCost)}</div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-between items-center pt-1">
            {lesson ? (
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
                {saving ? "Saving..." : lesson ? "Save" : "Save Lesson"}
              </Button>
            </div>
          </div>
        </form>
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

function Select({ value, onChange, options, placeholder }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white text-sm"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
