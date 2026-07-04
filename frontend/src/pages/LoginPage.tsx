import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldHalf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { login } from "../api";

export default function LoginPage() {
  const [username, setUsername] = useState("analyst");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at 30% 20%, oklch(0.8 0.11 215 / 7%), transparent 60%), radial-gradient(500px circle at 75% 75%, oklch(0.74 0.13 300 / 6%), transparent 60%)",
        }}
      />
      <Card className="rise-in relative w-88 border-border/80">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/12">
            <ShieldHalf className="size-6 text-primary" />
          </div>
          <CardTitle className="text-lg tracking-tight">
            SOC<span className="text-primary">Triage</span>
          </CardTitle>
          <CardDescription>AI-assisted alert triage console</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-p1">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
