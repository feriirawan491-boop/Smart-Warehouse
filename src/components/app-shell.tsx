"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Boxes, ChevronLeft, CircleHelp, ClipboardList, Cpu, FileSpreadsheet, LayoutDashboard, Menu, ScanLine, ShieldCheck, LogOut, X } from "lucide-react";

import { useWarehouse } from "./warehouse-provider";
import { useOperator } from "./auth-gate";
import { supabase } from "@/lib/supabase";

const links = [
  { label: "Ringkasan", href: "/", icon: LayoutDashboard },
  { label: "Data Device", href: "/devices", icon: Cpu },
  { label: "Riwayat scan", href: "/history", icon: ClipboardList },
  { label: "Ekspor data", href: "/export", icon: FileSpreadsheet }
];

export function AppShell({ children }: { children: ReactNode }) {
  const { error, loading, ready, connection, lastSynced, refresh } = useWarehouse();
  const operator = useOperator();
  const operatorName = operator?.user_metadata?.name || operator?.email?.split("@")[0] || "Operator";
  const initials = operatorName.slice(0, 2).toUpperCase();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const connectionLabel = error ? "Sinkronisasi bermasalah" : connection === "offline" ? "Tidak ada koneksi" : !ready ? "Memuat data…" : connection === "realtime" ? "Realtime aktif" : "Menghubungkan ulang…";
  async function signOut() {
    if (!supabase || signingOut) return;
    setSigningOut(true); setSignOutError("");
    try {
      const { error: cause } = await supabase.auth.signOut();
      if (cause) setSignOutError("Belum berhasil keluar. Periksa jaringan dan coba lagi.");
    } catch { setSignOutError("Belum berhasil keluar. Periksa jaringan dan coba lagi."); }
    finally { setSigningOut(false); }
  }
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  return <div className="app-shell">
    {open && <button aria-label="Tutup navigasi" className="mobile-scrim" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Boxes size={21} strokeWidth={2.3} /></div><span>gudang<span className="brand-light">.in</span></span><button className="icon-btn mobile-close" aria-label="Tutup menu" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="main-nav" aria-label="Navigasi utama">{links.map(({ label, href, icon: Icon }) => <button key={href} className={`nav-item ${path === href ? "nav-active" : ""}`} onClick={() => { router.push(href); setOpen(false); }}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></button>)}</nav>
      <div className="nav-caption nav-caption-bottom">TOOLS</div>
      <button className="nav-item" onClick={() => { setOpen(false); if(path.startsWith("/scan/new")){window.location.assign("/scan/new?camera=1");return;} router.push("/scan/new?camera=1"); }}><ScanLine size={18} strokeWidth={1.8} /><span>Scan label baru</span></button>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18} /></div><strong>Butuh bantuan?</strong><p>Hubungi tim admin bila mengalami kendala.</p><button onClick={() => window.alert("Hubungi admin gudang melalui kanal internal.")}>Hubungi admin <ChevronLeft size={14} className="help-arrow" /></button></div><button className="profile" aria-label="Keluar dari akun" title="Keluar dari akun" disabled={signingOut} onClick={() => void signOut()}><div className="profile-avatar">{initials}</div><div className="profile-text"><strong>{operatorName}</strong><span>{signingOut ? "Sedang keluar…" : "Operator · Keluar"}</span></div><LogOut size={17} /></button></div>
    </aside>
    <main className="main-area"><header className="topbar"><button className="icon-btn mobile-menu" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Warehouse</span><ChevronLeft className="crumb-chevron" size={14} /><strong>{path.startsWith("/boxes/") ? "Detail box" : path === "/devices" ? "Data Device" : path === "/history" ? "Riwayat scan" : path === "/export" ? "Ekspor data" : path.startsWith("/scan") ? "Scan label" : "Ringkasan"}</strong></div><div className="topbar-right"><div className={`status-online ${connection !== "realtime" || error ? "status-disconnected" : ""}`} role="status" title={lastSynced ? `Data diperbarui ${new Date(lastSynced).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB` : undefined}><span className="online-dot" />{connectionLabel}</div><button className="icon-btn top-help" aria-label="Pusat bantuan" onClick={() => window.alert("Pusat bantuan — Smart Warehouse") }><CircleHelp size={18} /></button><div className="top-avatar">{initials}</div></div></header><section className="page-content">{(error || signOutError) && <div className="sync-error" role="alert"><span>{error || signOutError}{ready && error ? " Data yang ditampilkan adalah hasil sinkronisasi terakhir." : ""}</span><button className="btn btn-secondary btn-small" disabled={loading} onClick={() => { setSignOutError(""); void refresh(); }}>{loading ? "Memuat…" : "Coba lagi"}</button></div>}{!ready && !error ? <p className="sync-loading" role="status">Memuat inventaris Supabase…</p> : children}</section><footer className="app-footer"><span>© 2026 Smart Warehouse</span><span><ShieldCheck size={14} /> {error ? "Periksa sinkronisasi data" : ready ? "Data terhubung ke Supabase" : "Menghubungkan Supabase…"}</span></footer></main>
  </div>;
}
