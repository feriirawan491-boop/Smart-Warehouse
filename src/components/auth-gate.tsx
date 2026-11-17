"use client";

import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Boxes, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { WarehouseProvider } from "./warehouse-provider";

const OperatorContext = createContext<Session | null>(null);
export function useOperator() { return useContext(OperatorContext)?.user ?? null; }

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let active = true;
    let authEventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, current) => {
      if (!active) return;
      authEventReceived = true;
      setSession(current); setChecking(false);
    });
    void supabase.auth.getSession().then(({ data, error: cause }) => {
      if (!active || authEventReceived) return;
      setSession(data.session); setChecking(false);
      if (cause) setError("Sesi tidak dapat dipulihkan. Silakan masuk kembali.");
    }).catch(() => { if (active) { setError("Koneksi autentikasi gagal. Periksa jaringan lalu masuk kembali."); setChecking(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setError("");
    try {
      const { data, error: cause } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (cause) {
        setError(cause.code === "invalid_credentials" ? "Email atau kata sandi salah." : cause.code === "email_not_confirmed" ? "Email akun belum dikonfirmasi. Hubungi admin gudang." : "Gagal masuk. Periksa koneksi dan akun Supabase Anda.");
        return;
      }
      setSession(data.session); setPassword("");
    } catch { setError("Tidak dapat terhubung. Periksa jaringan lalu coba lagi."); }
    finally { setBusy(false); }
  }

  if (checking) return <main className="auth-page"><p role="status">Memeriksa sesi operator…</p></main>;
  if (session) return <OperatorContext.Provider value={session}><WarehouseProvider key={session.user.id}>{children}</WarehouseProvider></OperatorContext.Provider>;
  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span className="brand-mark"><Boxes size={24}/></span><b>gudang.in</b></div>
    <h1>Masuk ke gudang</h1><p>Gunakan akun operator untuk mengelola inventaris dan menerima pembaruan realtime.</p>
    {!supabase ? <p className="form-error" role="alert">Konfigurasi Supabase belum lengkap. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY pada .env.local, lalu mulai ulang aplikasi.</p> : <form onSubmit={login} className="auth-form">
      <label className="field"><span>Email operator</span><input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy}/></label>
      <label className="field"><span>Kata sandi</span><input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy} type="submit"><LogIn size={17}/>{busy ? "Sedang masuk…" : "Masuk"}</button>
      <small>Akun operator disediakan oleh admin gudang.</small>
    </form>}
  </section></main>;
}
