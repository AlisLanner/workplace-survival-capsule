import { type FormEvent, type ReactNode, useState } from "react";

function getStoredToken(): string {
  try {
    return sessionStorage.getItem("maat_admin_token") ?? "";
  } catch {
    return "";
  }
}

export function getAdminToken(): string {
  return getStoredToken();
}

export function AdminGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(getStoredToken);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (token) {
    return <>{children}</>;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    sessionStorage.setItem("maat_admin_token", trimmed);
    setToken(trimmed);
    setError(false);
  }

  return (
    <main className="admin-gate">
      <form onSubmit={handleSubmit} className="glass">
        <span className="kicker">Admin Access</span>
        <h2 className="h2">管理后台</h2>
        <p className="muted">输入管理员密钥进入后台。</p>
        <label className="f-label">
          密钥
          <input
            className="f-input"
            type="password"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            placeholder="管理员密钥"
            style={{ borderColor: error ? "var(--bad)" : undefined }}
            autoFocus
          />
        </label>
        {error ? <span className="small" style={{ color: "var(--bad)" }}>请输入密钥</span> : null}
        <button type="submit" className="btn btn-gold">
          进入后台
        </button>
      </form>
    </main>
  );
}
