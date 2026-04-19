import { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  money,
  formatDate,
  skaterIdsOf,
  invoiceMappingOf,
  lessonTotal,
  perSkaterAmount,
} from "@/lib/format";
import { recalcInvoice } from "@/lib/invoiceRecalc";

const DURATION_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 5);
const LESSON_TYPES = [
  "Private",
  "Semi Private",
  "Competition",
  "Choreography",
  "Off-Ice Training",
  "Expenses",
];

// Which lesson types allow multiple skaters in the same lesson.
const MULTI_SKATER_TYPES = new Set(["Semi Private", "Off-Ice Training"]);

// Color swatches per lesson type: { tile, dot } Tailwind class lists.
const TYPE_STYLES = {
  Private: { tile: "bg-sky-50 hover:bg-sky-100 border-sky-200", dot: "bg-sky-500" },
  "Semi Private": { tile: "bg-purple-50 hover:bg-purple-100 border-purple-200", dot: "bg-purple-500" },
  Competition: { tile: "bg-amber-50 hover:bg-amber-100 border-amber-200", dot: "bg-amber-500" },
  Choreography: { tile: "bg-pink-50 hover:bg-pink-100 border-pink-200", dot: "bg-pink-500" },
  "Off-Ice Training": { tile: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200", dot: "bg-emerald-500" },
  Expenses: { tile: "bg-slate-100 hover:bg-slate-200 border-slate-300", dot: "bg-slate-500" },
};
const DEFAULT_STYLE = { tile: "bg-slate-50 hover:bg-slate-100 border-slate-200", dot: "bg-slate-400" };
const styleFor = (type) => TYPE_STYLES[type] || DEFAULT_STYLE;

function isoKey(d) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function lessonSkaterNames(lesson, skaterMap) {
  return skaterIdsOf(lesson)
    .map((id) => skaterMap[id]?.name || "—")
    .join(", ");
}

export default function Lessons() {
  const [lessons, setLessons] = useState([]);
  const [skaters, setSkaters] = useState([]);
  const [calView, setCalView] = useState("week");
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

  const totalRevenue = lessons.reduce((s, l) => s + lessonTotal(l), 0);
  const uninvoiced = lessons.filter((l) => {
    const ids = skaterIdsOf(l);
    const mapping = invoiceMappingOf(l);
    return ids.some((sid) => !mapping[sid]);
  }).length;

  const nav = (delta) => {
    const d = new Date(cursor);
    if (calView === "week") d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCursor(d);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Lessons</h1>
          <p className="text-slate-500 mt-1">Track your daily lessons</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setShowForm(true)}
            className="bg-slate-900 hover:bg-slate-800 rounded-xl h-11 px-5"
          >
            <Plus className="w-4 h-4 mr-2" /> Log Lesson
          </Button>
        </div>
      </div>

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

      {calView === "week" ? (
        <WeekView cursor={cursor} lessons={lessons} skaterMap={skaterMap} onEdit={setEditing} />
      ) : (
        <DayView cursor={cursor} lessons={lessons} skaterMap={skaterMap} onEdit={setEditing} />
      )}

      <ColorLegend />

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
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 min-w-0">
      <div className="text-xs md:text-sm text-slate-500 truncate">{label}</div>
      <div className="text-lg md:text-2xl font-bold text-slate-900 mt-1 truncate tabular-nums">
        {value}
      </div>
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
            {lessons.map((l) => {
              const names = lessonSkaterNames(l, skaterMap);
              const s = styleFor(l.lesson_type);
              return (
                <button
                  key={l.id}
                  onClick={() => onEdit(l)}
                  className={`w-full text-left p-2 rounded-lg border text-xs ${s.tile}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                    <div className="font-medium text-slate-900 truncate">{names}</div>
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    {l.lesson_type} · {l.pricing_type === "flat" ? "—" : `${l.duration_mins} min`}
                  </div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {money(lessonTotal(l))}
                  </div>
                </button>
              );
            })}
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
    <div className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto snap-x">
      <div
        className="grid grid-flow-col auto-cols-[minmax(9rem,1fr)] gap-3 md:grid-flow-row md:auto-cols-auto md:grid-cols-7"
      >
        {days.map((d) => {
          const key = isoKey(d);
          const dayLessons = lessons.filter((l) => l.date === key);
          return (
            <div key={key} className="snap-start">
              <DayCard
                date={d}
                lessons={dayLessons}
                skaterMap={skaterMap}
                isToday={key === todayKey}
                onEdit={onEdit}
              />
            </div>
          );
        })}
      </div>
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

function ColorLegend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
      <span className="text-slate-500 font-medium">Lesson types:</span>
      {LESSON_TYPES.map((type) => {
        const s = styleFor(type);
        return (
          <span key={type} className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
            {type}
          </span>
        );
      })}
    </div>
  );
}

function LessonModal({ lesson, skaters, onClose, onSaved }) {
  const initialSkaterIds = lesson ? skaterIdsOf(lesson) : [];
  const [profileDefaultRate, setProfileDefaultRate] = useState(null);
  const [form, setForm] = useState(
    lesson
      ? {
          ...lesson,
          skater_ids: initialSkaterIds,
          rate: String(lesson.rate),
          duration_mins: String(lesson.duration_mins),
        }
      : {
          lesson_type: "Private",
          skater_ids: [],
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

  const isMulti = MULTI_SKATER_TYPES.has(form.lesson_type);

  // Load coach's default hourly rate once.
  useEffect(() => {
    base44.entities.Profile.list().then((list) => {
      const rate = list[0]?.default_hourly_rate;
      if (rate) setProfileDefaultRate(rate);
    });
  }, []);

  // Prepopulate rate with coach's default when creating a new lesson.
  useEffect(() => {
    if (lesson) return;
    if (form.rate) return;
    if (profileDefaultRate) set("rate", String(profileDefaultRate));
  }, [profileDefaultRate]);

  // When switching from multi to single, trim skater_ids to the first one.
  useEffect(() => {
    if (!isMulti && form.skater_ids.length > 1) {
      set("skater_ids", form.skater_ids.slice(0, 1));
    }
  }, [form.lesson_type]);

  // For single-skater lessons, prefer the skater's individual default rate
  // when it's set (and the user hasn't manually typed a different rate).
  useEffect(() => {
    if (lesson) return;
    if (isMulti) return;
    if (form.skater_ids.length !== 1) return;
    const sk = skaters.find((s) => s.id === form.skater_ids[0]);
    if (!sk) return;
    const skRate = Number(sk.default_hourly_rate);
    if (!skRate) return;
    const currentRate = Number(form.rate);
    // Overwrite only if empty or currently equal to the coach's default.
    if (!form.rate || currentRate === profileDefaultRate) {
      set("rate", String(skRate));
    }
  }, [form.skater_ids, form.lesson_type]);

  const totalCost = useMemo(() => {
    const rate = Number(form.rate);
    const dur = Number(form.duration_mins);
    if (!rate || !dur) return 0;
    return form.pricing_type === "flat" ? rate : (dur / 60) * rate;
  }, [form.rate, form.duration_mins, form.pricing_type]);

  const nSkaters = Math.max(1, form.skater_ids.length);
  const perSkater = form.skater_ids.length > 0 ? totalCost / nSkaters : 0;

  const handleDelete = async () => {
    if (!lesson) return;
    if (!confirm("Delete this lesson?")) return;
    const mapping = invoiceMappingOf(lesson);
    const invoiceIds = [...new Set(Object.values(mapping).filter(Boolean))];
    await base44.entities.Lesson.delete(lesson.id);
    for (const id of invoiceIds) await recalcInvoice(id);
    onSaved();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.skater_ids.length === 0)
      return setError(isMulti ? "Add at least one skater to the group" : "Select a skater");
    if (!form.rate || Number(form.rate) <= 0) return setError("Enter a valid rate");
    setError("");
    setSaving(true);
    try {
      const payload = {
        skater_ids: form.skater_ids,
        date: form.date,
        lesson_type: form.lesson_type,
        duration_mins: Number(form.duration_mins),
        pricing_type: form.pricing_type,
        rate: Number(form.rate),
        notes: form.notes?.trim() || undefined,
      };
      let invoicesToRecalc = [];
      if (lesson) {
        const mapping = invoiceMappingOf(lesson);
        invoicesToRecalc = [...new Set(Object.values(mapping).filter(Boolean))];
        await base44.entities.Lesson.update(lesson.id, payload);
      } else {
        await base44.entities.Lesson.create(payload);
      }
      for (const id of invoicesToRecalc) await recalcInvoice(id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const anyInvoiced = lesson && Object.keys(invoiceMappingOf(lesson)).length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">{lesson ? "Edit Lesson" : "Log New Lesson"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        {anyInvoiced && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 text-xs">
            This lesson is on an invoice. Changes will update those invoice totals automatically.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Lesson Type *">
            <Select value={form.lesson_type} onChange={(v) => set("lesson_type", v)} options={LESSON_TYPES} />
          </Field>

          {isMulti ? (
            <Field label="Skaters in Group *">
              <SkaterMultiPicker
                skaters={skaters}
                value={form.skater_ids}
                onChange={(ids) => set("skater_ids", ids)}
              />
            </Field>
          ) : (
            <Field label="Skater *">
              <Select
                value={form.skater_ids[0] || ""}
                onChange={(v) => set("skater_ids", v ? [v] : [])}
                options={skaters.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Select skater"
              />
            </Field>
          )}

          <Field label="Date *">
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label={`Duration (min)${form.pricing_type === "flat" ? "" : " *"}`}>
            {form.pricing_type === "flat" ? (
              <div className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-400 flex items-center">
                —
              </div>
            ) : (
              <Select
                value={String(form.duration_mins)}
                onChange={(v) => set("duration_mins", v)}
                options={DURATION_OPTIONS.map((n) => ({ value: String(n), label: `${n} min` }))}
              />
            )}
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
          <Field
            label={form.pricing_type === "hourly" ? "Hourly Rate ($) *" : "Flat Rate ($) *"}
          >
            <Input
              type="number"
              step="0.01"
              value={form.rate}
              onChange={(e) => set("rate", e.target.value)}
            />
            <div className="text-xs text-slate-500 mt-1">
              {form.pricing_type === "hourly"
                ? "Hourly rate for the whole lesson. When a lesson has multiple skaters, the cost is split among them."
                : "Flat cost for the whole lesson. When a lesson has multiple skaters, the cost is split among them."}
            </div>
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
            {form.skater_ids.length === 0 ? (
              <>
                <div className="text-xs text-slate-500">
                  {isMulti ? "Add skaters to calculate cost" : "Select a skater to calculate cost"}
                </div>
                <div className="text-2xl font-bold text-slate-900">$-</div>
              </>
            ) : form.skater_ids.length === 1 ? (
              <>
                <div className="text-xs text-slate-500">Lesson cost</div>
                <div className="text-2xl font-bold text-slate-900">{money(totalCost)}</div>
              </>
            ) : (
              <>
                <div className="text-xs text-slate-500">Cost per skater</div>
                <div className="text-2xl font-bold text-slate-900">{money(perSkater)}</div>
                <div className="text-xs text-slate-500 mt-2">
                  {form.skater_ids.length} skaters · lesson total {money(totalCost)}
                </div>
              </>
            )}
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

function SkaterMultiPicker({ skaters, value, onChange }) {
  const [query, setQuery] = useState("");
  const selectedIds = new Set(value);
  const unselected = skaters
    .filter((s) => !selectedIds.has(s.id))
    .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const add = (id) => {
    onChange([...value, id]);
    setQuery("");
  };
  const remove = (id) => onChange(value.filter((v) => v !== id));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const sk = skaters.find((s) => s.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 bg-slate-900 text-white rounded-full px-3 py-1 text-xs"
              >
                {sk?.name || "—"}
                <button type="button" onClick={() => remove(id)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={value.length === 0 ? "Add skater to group" : "Add another skater"}
        />
        {query && unselected.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {unselected.slice(0, 12).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => add(s.id)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
