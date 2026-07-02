import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={submit} className="w-80 rounded-lg border border-edge bg-panel p-8">
        <h1 className="mb-1 text-xl font-bold">
          SOC<span className="text-accent">Triage</span>
        </h1>
        <p className="mb-6 text-sm text-ink-dim">Analyst console sign-in</p>
        <label className="mb-1 block text-xs uppercase tracking-wide text-ink-dim">Username</label>
        <input
          className="mb-4 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <label className="mb-1 block text-xs uppercase tracking-wide text-ink-dim">Password</label>
        <input
          type="password"
          className="mb-4 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p className="mb-3 text-sm text-p1">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded bg-accent py-2 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
