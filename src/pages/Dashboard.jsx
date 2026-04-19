import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Calendar, Users, FileText, TrendingUp, DollarSign, X } from "lucide-react";
import {
  money,
  formatDate,
  lessonTotal,
  perSkaterAmount,
  skaterIdsOf,
} from "@/lib/format";

export default function Dashboard() {
  const [skaters, setSkaters] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    (async () => {
      const [sk, les, inv] = await Promise.all([
        base44.entities.Skater.list(),
        base44.entities.Lesson.list(),
        base44.entities.Invoice.list(),
      ]);
      setSkaters(sk);
      setLessons(les);
      setInvoices(inv);
    })();
  }, []);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthLessons = lessons.filter((l) => l.date?.startsWith(thisMonth));
  const monthlyRevenue = thisMonthLessons.reduce((s, l) => s + lessonTotal(l), 0);
  const pending = invoices.filter((i) => i.status === "pending");
  const skaterMap = Object.fromEntries(skaters.map((s) => [s.id, s]));

  const recent = [...lessons]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 5);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back! Here's your overview</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="text-sm font-bold bg-sky-100 inline-block px-2 py-0.5 rounded text-sky-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link to="/lessons" className="flex items-center gap-3 px-4 py-4 rounded-xl border border-slate-200 hover:bg-slate-50">
            <Calendar className="w-5 h-5 text-slate-600" /> Log a Lesson
          </Link>
          <Link to="/skaters" className="flex items-center gap-3 px-4 py-4 rounded-xl border border-slate-200 hover:bg-slate-50">
            <Users className="w-5 h-5 text-slate-600" /> Manage Skaters
          </Link>
          <Link to="/invoices" className="flex items-center gap-3 px-4 py-4 rounded-xl border border-slate-200 hover:bg-slate-50">
            <FileText className="w-5 h-5 text-slate-600" /> Generate Invoices
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Skaters" value={skaters.length} icon={Users} color="sky" />
        <StatCard
          label="This Month"
          value={thisMonthLessons.length}
          subtitle="lessons"
          icon={Calendar}
          color="purple"
        />
        <StatCard
          label="Monthly Revenue"
          value={money(monthlyRevenue)}
          subtitle="Click for breakdown"
          icon={TrendingUp}
          color="green"
          onClick={() => setShowBreakdown(true)}
        />
        <StatCard
          label="Pending Payments"
          value={money(pending.reduce((s, i) => s + (i.total || 0), 0))}
          subtitle={`${pending.length} invoices`}
          icon={DollarSign}
          color="orange"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Lessons</h2>
        {recent.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
            No lessons yet
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((l) => {
              const names = skaterIdsOf(l).map((id) => skaterMap[id]?.name || "—").join(", ");
              return (
                <div key={l.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{names || "—"}</div>
                    <div className="text-slate-500 text-xs">
                      {formatDate(l.date)} · {l.lesson_type} ·{" "}
                      {l.pricing_type === "flat" ? "—" : `${l.duration_mins} min`}
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900">{money(lessonTotal(l))}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showBreakdown && (
        <RevenueBreakdownModal
          monthLabel={new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
          lessons={thisMonthLessons}
          skaterMap={skaterMap}
          onClose={() => setShowBreakdown(false)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, subtitle, icon: Icon, color, onClick }) {
  const colorMap = {
    sky: "bg-sky-100 text-sky-600",
    purple: "bg-purple-100 text-purple-600",
    green: "bg-green-100 text-green-600",
    orange: "bg-orange-100 text-orange-600",
  };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200 p-5 text-left w-full ${
        onClick ? "hover:border-slate-300 hover:shadow-sm transition" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm text-slate-500">{label}</div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </Comp>
  );
}

function RevenueBreakdownModal({ monthLabel, lessons, skaterMap, onClose }) {
  // Allocate each lesson's cost across its skaters.
  const bySkater = {};
  for (const l of lessons) {
    const ids = skaterIdsOf(l);
    const share = perSkaterAmount(l);
    const list = ids.length ? ids : ["unknown"];
    for (const sid of list) {
      (bySkater[sid] ||= { lessons: 0, amount: 0 });
      bySkater[sid].lessons += 1;
      bySkater[sid].amount += share;
    }
  }
  const rows = Object.entries(bySkater)
    .map(([sid, info]) => ({
      sid,
      name: skaterMap[sid]?.name || "Unknown skater",
      lessons: info.lessons,
      amount: info.amount,
    }))
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-slate-900">Monthly Revenue</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">{monthLabel} · breakdown by skater</p>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">No lessons this month.</div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {rows.map((r) => (
              <div key={r.sid} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900 text-sm">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.lessons} lesson{r.lessons === 1 ? "" : "s"}</div>
                </div>
                <div className="font-semibold text-slate-900">{money(r.amount)}</div>
              </div>
            ))}
            <div className="px-4 py-3 flex items-center justify-between bg-slate-50">
              <div className="font-bold text-slate-900 text-sm">Total</div>
              <div className="font-bold text-slate-900">{money(total)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
