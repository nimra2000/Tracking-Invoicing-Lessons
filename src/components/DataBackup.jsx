import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Database, Download, Upload } from "lucide-react";
import { stringifyCSV, parseCSV, downloadCSV } from "@/lib/csv";
import { skaterIdsOf } from "@/lib/format";

const SKATER_HEADERS = ["name", "billing_name", "billing_emails", "default_hourly_rate", "notes"];
const LESSON_HEADERS = [
  "date",
  "skater_names",
  "lesson_type",
  "duration_mins",
  "pricing_type",
  "rate",
  "notes",
];

export default function DataBackup() {
  const [status, setStatus] = useState(null); // { type: 'ok'|'error', message: string }
  const skaterFileRef = useRef(null);
  const lessonFileRef = useRef(null);

  const setOk = (message) => setStatus({ type: "ok", message });
  const setErr = (message) => setStatus({ type: "error", message });

  const handleExport = async () => {
    setStatus(null);
    try {
      const [skaters, lessons] = await Promise.all([
        base44.entities.Skater.list(),
        base44.entities.Lesson.list(),
      ]);
      const skMap = Object.fromEntries(skaters.map((s) => [s.id, s.name]));
      const skaterRows = skaters.map((s) => ({
        name: s.name || "",
        billing_name: s.billing_name || "",
        billing_emails: (s.billing_emails || []).join(";"),
        default_hourly_rate: s.default_hourly_rate ?? "",
        notes: s.notes || "",
      }));
      const lessonRows = lessons.map((l) => ({
        date: l.date || "",
        skater_names: skaterIdsOf(l)
          .map((id) => skMap[id] || "")
          .join(";"),
        lesson_type: l.lesson_type || "",
        duration_mins: l.duration_mins ?? "",
        pricing_type: l.pricing_type || "",
        rate: l.rate ?? "",
        notes: l.notes || "",
      }));
      downloadCSV("skaters.csv", stringifyCSV(SKATER_HEADERS, skaterRows));
      downloadCSV("lessons.csv", stringifyCSV(LESSON_HEADERS, lessonRows));
      setOk(`Exported ${skaters.length} skaters and ${lessons.length} lessons.`);
    } catch (err) {
      setErr(err.message || String(err));
    }
  };

  const readFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(file);
    });

  const handleImportSkaters = async (e) => {
    setStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFile(file);
      const { records } = parseCSV(text);
      let created = 0;
      let skipped = 0;
      for (const r of records) {
        const name = (r.name || "").trim();
        const rate = Number(r.default_hourly_rate);
        if (!name || !rate || rate <= 0) {
          skipped++;
          continue;
        }
        const emails = (r.billing_emails || "")
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        await base44.entities.Skater.create({
          name,
          billing_name: (r.billing_name || "").trim() || undefined,
          billing_emails: emails,
          default_hourly_rate: rate,
          notes: (r.notes || "").trim() || undefined,
        });
        created++;
      }
      setOk(
        `Imported ${created} skater${created === 1 ? "" : "s"}${
          skipped > 0 ? ` (skipped ${skipped} row${skipped === 1 ? "" : "s"} with missing name or rate)` : ""
        }.`
      );
    } catch (err) {
      setErr(err.message || String(err));
    } finally {
      if (skaterFileRef.current) skaterFileRef.current.value = "";
    }
  };

  const handleImportLessons = async (e) => {
    setStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFile(file);
      const { records } = parseCSV(text);
      const skaters = await base44.entities.Skater.list();
      const byName = Object.fromEntries(skaters.map((s) => [s.name.toLowerCase(), s.id]));
      let created = 0;
      let skipped = 0;
      const unmatched = new Set();
      for (const r of records) {
        // Accept either `skater_names` (new) or `skater_name` (legacy).
        const rawNames = r.skater_names || r.skater_name || "";
        const names = rawNames
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const skaterIds = [];
        let hasUnmatched = false;
        for (const name of names) {
          const id = byName[name.toLowerCase()];
          if (id) skaterIds.push(id);
          else {
            hasUnmatched = true;
            unmatched.add(name);
          }
        }
        const duration = Number(r.duration_mins);
        const rate = Number(r.rate);
        const pricing = (r.pricing_type || "hourly").trim().toLowerCase();
        if (skaterIds.length === 0 || hasUnmatched || !r.date || !duration || !rate) {
          skipped++;
          continue;
        }
        await base44.entities.Lesson.create({
          skater_ids: skaterIds,
          date: r.date.trim(),
          lesson_type: (r.lesson_type || "Private").trim(),
          duration_mins: duration,
          pricing_type: pricing === "flat" ? "flat" : "hourly",
          rate,
          notes: (r.notes || "").trim() || undefined,
        });
        created++;
      }
      const unmatchedMsg =
        unmatched.size > 0
          ? ` Unknown skaters: ${[...unmatched].slice(0, 5).join(", ")}${unmatched.size > 5 ? "…" : ""}.`
          : "";
      setOk(
        `Imported ${created} lesson${created === 1 ? "" : "s"}${
          skipped > 0 ? ` (skipped ${skipped})` : ""
        }.${unmatchedMsg}`
      );
    } catch (err) {
      setErr(err.message || String(err));
    } finally {
      if (lessonFileRef.current) lessonFileRef.current.value = "";
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
          <Database className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Data Backup</h2>
          <p className="text-sm text-slate-500">
            Export your skaters and lessons to CSV, or import them back.
          </p>
        </div>
      </div>

      <div className="mb-5">
        <h3 className="font-medium text-slate-900 mb-1">Export data</h3>
        <p className="text-xs text-slate-500 mb-3">
          Downloads two CSV files — one for skaters and one for lessons.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          className="border-slate-200"
        >
          <Download className="w-4 h-4 mr-2" /> Download CSV files
        </Button>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h3 className="font-medium text-slate-900 mb-1">Import data</h3>
        <p className="text-xs text-slate-500 mb-3">
          Upload a previously exported CSV. Records will be added to your existing data.
          Import skaters first, then lessons (lessons reference skaters by name).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="cursor-pointer border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-center gap-2 text-sm hover:bg-slate-50">
            <Upload className="w-4 h-4" /> Import skaters CSV
            <input
              ref={skaterFileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportSkaters}
              className="hidden"
            />
          </label>
          <label className="cursor-pointer border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-center gap-2 text-sm hover:bg-slate-50">
            <Upload className="w-4 h-4" /> Import lessons CSV
            <input
              ref={lessonFileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportLessons}
              className="hidden"
            />
          </label>
        </div>
        <details className="mt-4 text-xs text-slate-500">
          <summary className="cursor-pointer font-medium text-slate-700">CSV column reference</summary>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            <div>
              <span className="font-semibold">skaters.csv:</span> {SKATER_HEADERS.join(", ")}
            </div>
            <div>
              <span className="font-semibold">lessons.csv:</span> {LESSON_HEADERS.join(", ")}
            </div>
            <div className="text-slate-400 pt-1 not-italic">
              billing_emails is semicolon-separated; pricing_type is "hourly" or "flat"; date is YYYY-MM-DD.
            </div>
          </div>
        </details>
      </div>

      {status && (
        <div
          className={`mt-4 p-3 rounded-xl text-sm ${
            status.type === "ok"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {status.message}
        </div>
      )}
    </section>
  );
}
