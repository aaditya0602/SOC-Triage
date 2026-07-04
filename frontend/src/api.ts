const TOKEN_KEY = "soc_token";
const USER_KEY = "soc_user";

/** Backend origin. Empty = same origin (vite proxy in dev, single-host deploys). */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): string | null {
  return localStorage.getItem(USER_KEY);
}

export function setSession(token: string, username: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, username);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (resp.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${resp.status}`);
  }
  return resp.json();
}

export async function login(username: string, password: string) {
  const resp = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail || "Login failed");
  }
  const data = await resp.json();
  setSession(data.access_token, data.username);
  return data;
}
