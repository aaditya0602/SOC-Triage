import { useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, Boxes, LayoutDashboard, LogOut, ScrollText, ShieldHalf,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { clearSession, getToken, getUser } from "./api";
import { useAlertStream } from "./ws";
import { cn } from "@/lib/utils";
import AlertsPage from "./pages/AlertsPage";
import AuditPage from "./pages/AuditPage";
import DashboardPage from "./pages/DashboardPage";
import IncidentsPage from "./pages/IncidentsPage";
import LoginPage from "./pages/LoginPage";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/alerts", label: "Alert queue", icon: Bell, end: false },
  { to: "/incidents", label: "Incidents", icon: Boxes, end: false },
  { to: "/audit", label: "Audit log", icon: ScrollText, end: false },
];

const TITLES: Record<string, string> = {
  "/": "Security overview",
  "/alerts": "Alert queue",
  "/incidents": "Incidents",
  "/audit": "Audit log",
};

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [live, setLive] = useState(false);

  // Global stream: connection status + toast on new high-severity alerts.
  useAlertStream(
    (event) => {
      if (event.event === "alert.completed" && ["P1", "P2"].includes(event.data.severity_band)) {
        toast.warning(`${event.data.severity_band} · ${event.data.rule_description}`, {
          description: event.data.src_ip ? `from ${event.data.src_ip} — score ${event.data.severity_score}` : undefined,
          action: { label: "Open", onClick: () => navigate("/alerts") },
        });
      }
    },
    setLive
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-56 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
            <ShieldHalf className="size-4.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none tracking-tight">
              SOC<span className="text-primary">Triage</span>
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">mini-SOAR</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/12 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="flex size-7 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold uppercase">
              {(getUser() ?? "?").slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{getUser()}</p>
              <p className="text-[10px] text-muted-foreground">analyst</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  onClick={() => {
                    clearSession();
                    navigate("/login");
                  }}
                >
                  <LogOut className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign out</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-56 flex-1">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-6 py-3.5 backdrop-blur">
          <h1 className="text-sm font-semibold">{TITLES[pathname] ?? "SOCTriage"}</h1>
          <div className="ml-auto flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", live ? "pulse-soft bg-emerald-400" : "bg-p4")} />
            {live ? "live stream" : "reconnecting…"}
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </div>

      <Toaster theme="dark" position="bottom-right" richColors closeButton />
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
