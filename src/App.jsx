import { useState, useEffect } from "react";
import { Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Settings as SettingsIcon,
  LogIn,
  Loader2,
} from "lucide-react";
import Dashboard from "@/pages/Dashboard.jsx";
import Skaters from "@/pages/Skaters.jsx";
import Lessons from "@/pages/Lessons.jsx";
import Invoices from "@/pages/Invoices.jsx";
import Settings from "@/pages/Settings.jsx";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/skaters", label: "Skaters", icon: Users },
  { to: "/lessons", label: "Lessons", icon: Calendar },
  { to: "/invoices", label: "Invoices", icon: FileText },
];

function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-6 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-400 to-cyan-300 flex items-center justify-center text-white text-lg">
          ⛸
        </div>
        <div>
          <div className="font-semibold text-slate-900 text-sm">IceSheet Invoices</div>
          <div className="text-xs text-slate-500">Coaching Management</div>
        </div>
      </div>
      <nav className="flex-1 px-3 pt-2 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            <Icon className="w-4 h-4" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-200">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`
          }
        >
          <SettingsIcon className="w-4 h-4" /> Settings
        </NavLink>
      </div>
    </aside>
  );
}

function LoginScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/30 flex items-center justify-center">
      <div className="max-w-sm w-full px-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-sky-400 to-cyan-300 flex items-center justify-center text-white text-2xl mb-4">
          ⛸
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">IceSheet Invoices</h1>
        <p className="text-slate-500 mb-8 text-sm">Sign in to manage your coaching business.</p>
        <Button
          onClick={() => base44.auth.loginWithProvider("google", window.location.href)}
          className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800"
        >
          <LogIn className="w-4 h-4 mr-2" /> Sign in with Google
        </Button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    base44.auth
      .me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/skaters" element={<Skaters />} />
          <Route path="/lessons" element={<Lessons />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
