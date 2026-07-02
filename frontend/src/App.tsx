import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { clearSession, getToken, getUser } from "./api";
import AlertsPage from "./pages/AlertsPage";
import AuditPage from "./pages/AuditPage";
import DashboardPage from "./pages/DashboardPage";
import IncidentsPage from "./pages/IncidentsPage";
import LoginPage from "./pages/LoginPage";

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive ? "bg-panel-2 text-accent" : "text-ink-dim hover:text-ink"
    }`;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex items-center gap-6 border-b border-edge bg-panel px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">
            SOC<span className="text-accent">Triage</span>
          </span>
          <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-dim">
            mini-SOAR
          </span>
        </div>
        <nav className="flex gap-1">
          <NavLink to="/" end className={linkCls}>Dashboard</NavLink>
          <NavLink to="/alerts" className={linkCls}>Alerts</NavLink>
          <NavLink to="/incidents" className={linkCls}>Incidents</NavLink>
          <NavLink to="/audit" className={linkCls}>Audit Log</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-ink-dim">
          <span>{getUser()}</span>
          <button
            className="rounded border border-edge px-2 py-1 text-xs hover:bg-panel-2"
            onClick={() => {
              clearSession();
              navigate("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/alerts" element={<Protected><AlertsPage /></Protected>} />
      <Route path="/incidents" element={<Protected><IncidentsPage /></Protected>} />
      <Route path="/audit" element={<Protected><AuditPage /></Protected>} />
    </Routes>
  );
}
