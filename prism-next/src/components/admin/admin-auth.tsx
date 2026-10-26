"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Gem, KeyRound } from "lucide-react";
import { clearAdminToken, getAdminToken, setAdminToken, verifyAdmin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthState = { verified: boolean; ready: boolean; signOut: () => void };
const AdminAuth = createContext<AuthState>({ verified: false, ready: false, signOut: () => {} });

export const useAdminAuth = () => useContext(AdminAuth);

/** 管理端登录门槛：以后端 /api/admin/verify 核验结果为准，口令仅存于当前浏览器会话。 */
export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState(false);
  const [ready, setReady] = useState(false);
  const signOut = useCallback(() => { clearAdminToken(); setVerified(false); }, []);
  useEffect(() => {
    const token = getAdminToken();
    if (!token) { setReady(true); return; }
    verifyAdmin(token)
      .then(() => { setVerified(true); setReady(true); })
      .catch(() => { clearAdminToken(); setReady(true); });
  }, []);
  return <AdminAuth.Provider value={{ verified, ready, signOut }}>{verified ? children : <AdminLogin ready={ready} onVerified={() => setVerified(true)} />}</AdminAuth.Provider>;
}

function AdminLogin({ ready, onVerified }: { ready: boolean; onVerified: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) { setError("请输入管理口令"); return; }
    setBusy(true); setError(null);
    try {
      await verifyAdmin(trimmed);
      setAdminToken(trimmed);
      onVerified();
    } catch (err) {
      const message = err instanceof Error ? err.message : "核验失败";
      setError(message.includes("ADMIN_SECRET") ? message : "口令不正确，请核对后重试");
    } finally { setBusy(false); }
  }
  if (!ready) return <div className="grid min-h-[320px] place-items-center text-[11px] text-slate-600" role="status">正在核验管理口令…</div>;
  return <div className="grid min-h-[420px] place-items-center px-6">
    <form onSubmit={submit} className="w-full max-w-[380px] rounded-2xl border border-white/[.08] bg-[#0f1721]/80 p-8">
      <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border border-sky-100/12 bg-sky-100/[.04]"><Gem className="size-5 text-sky-100/70" strokeWidth={1.15} /></span><div><p className="text-[14px] tracking-wider text-slate-200">管理端登录</p><p className="mt-1 font-mono text-[7px] tracking-[.22em] text-slate-600">ASSESSMENT STUDIO</p></div></div>
      <label htmlFor="admin-secret" className="mt-7 block text-[11px] text-slate-400">管理口令<span className="ml-2 text-[9px] text-slate-700">面向公司、HR 与用人部门的配置端</span></label>
      <Input id="admin-secret" type="password" value={token} onChange={event => { setToken(event.target.value); setError(null); }} placeholder="输入管理口令" autoFocus className={`mt-2.5 h-11 border-white/10 bg-white/[.025] text-[12px] placeholder:text-slate-700 ${error ? "border-rose-300/50" : ""}`} aria-invalid={Boolean(error)} />
      {error ? <p className="mt-2 text-[10px] text-rose-300/80" role="alert">{error}</p> : null}
      <Button type="submit" disabled={busy} className="mt-6 w-full gap-3 bg-slate-200 text-[11px] font-normal text-slate-950 hover:bg-white">{busy ? "核验中…" : "进入管理端"}<KeyRound className="size-3.5" /></Button>
      <p className="mt-4 text-center text-[9px] leading-5 text-slate-700">口令仅保存在当前浏览器会话，界面进入以后端核验成功为准。</p>
    </form>
  </div>;
}
