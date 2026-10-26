import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { verifyAdminToken } from "../api/admin.api";

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
  const [token, setToken] = useState("");
  const [checked, setChecked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 已存的口令先向后端核验，避免口令错误时页面各处只报“读取失败”。
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setChecked(true);
      return;
    }
    verifyAdminToken(stored)
      .then(() => {
        setToken(stored);
        setChecked(true);
      })
      .catch(() => {
        try {
          sessionStorage.removeItem("maat_admin_token");
        } catch {
          // ignore
        }
        setChecked(true);
      });
  }, []);

  if (!checked) {
    return <main className="admin-gate"><p className="muted">正在核验管理口令…</p></main>;
  }

  if (token) {
    return <>{children}</>;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError("请输入管理口令");
      return;
    }
    setSubmitting(true);
    setError(null);
    verifyAdminToken(trimmed)
      .then(() => {
        sessionStorage.setItem("maat_admin_token", trimmed);
        setToken(trimmed);
      })
      .catch((err: Error) => {
        setError(err.message?.includes("ADMIN_SECRET") ? err.message : "口令不正确，请核对后重试");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <main className="admin-gate">
      <form onSubmit={handleSubmit} className="glass">
        <span className="kicker">Admin Access</span>
        <h2 className="h2">管理端登录</h2>
        <p className="muted">输入管理口令进入配置端（公司、HR、用人部门使用）。</p>
        <label className="f-label">
          口令
          <input
            className="f-input"
            type="password"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder="管理口令"
            style={{ borderColor: error ? "var(--bad)" : undefined }}
            autoFocus
          />
        </label>
        {error ? <span className="small" style={{ color: "var(--bad)" }}>{error}</span> : null}
        <button type="submit" className="btn btn-gold" disabled={submitting}>
          {submitting ? "核验中…" : "进入管理端"}
        </button>
      </form>
    </main>
  );
}
