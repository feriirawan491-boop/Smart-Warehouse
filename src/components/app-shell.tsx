"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Boxes, ChevronLeft, CircleHelp, ClipboardList, Cpu, FileSpreadsheet, LayoutDashboard, Menu, ScanLine, Settings2, ShieldCheck, X } from "lucide-react";

const links = [
  { label: "Ringkasan", href: "/", icon: LayoutDashboard },
  { label: "Data Device", href: "/devices", icon: Cpu },
  { label: "Riwayat scan", href: "/history", icon: ClipboardList },
  { label: "Ekspor data", href: "/export", icon: FileSpreadsheet }
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  return <div className="app-shell">
    {open && <button aria-label="Tutup navigasi" className="mobile-scrim" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Boxes size={21} strokeWidth={2.3} /></div><span>gudang<span className="brand-light">.in</span></span><button className="icon-btn mobile-close" aria-label="Tutup menu" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="main-nav" aria-label="Navigasi utama">{links.map(({ label, href, icon: Icon }) => <button key={href} className={`nav-item ${path === href ? "nav-active" : ""}`} onClick={() => { router.push(href); setOpen(false); }}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{href === "/history" && <span className="nav-count">24</span>}</button>)}</nav>
      <div className="nav-caption nav-caption-bottom">TOOLS</div>
      <button className="nav-item" onClick={() => { setOpen(false); if(path.startsWith("/scan/new")){window.location.assign("/scan/new?camera=1");return;} router.push("/scan/new?camera=1"); }}><ScanLine size={18} strokeWidth={1.8} /><span>Scan label baru</span></button>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18} /></div><strong>Butuh bantuan?</strong><p>Hubungi tim admin bila mengalami kendala.</p><button onClick={() => window.alert("Hubungi admin gudang melalui kanal internal.")}>Hubungi admin <ChevronLeft size={14} className="help-arrow" /></button></div><button className="profile"><div className="profile-avatar">FA</div><div className="profile-text"><strong>Feri Irawan</strong><span>Operator gudang</span></div><Settings2 size={17} /></button></div>
    </aside>
    <main className="main-area"><header className="topbar"><button className="icon-btn mobile-menu" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Warehouse</span><ChevronLeft className="crumb-chevron" size={14} /><strong>{path === "/devices" ? "Data Device" : path === "/history" ? "Riwayat scan" : path === "/export" ? "Ekspor data" : path.startsWith("/scan") ? "Scan label" : "Ringkasan"}</strong></div><div className="topbar-right"><div className="status-online"><span className="online-dot" /> Sistem operasional</div><button className="icon-btn top-help" aria-label="Pusat bantuan" onClick={() => window.alert("Pusat bantuan — Smart Warehouse") }><CircleHelp size={18} /></button><div className="top-avatar">FA</div></div></header><section className="page-content">{children}</section><footer className="app-footer"><span>© 2026 Smart Warehouse</span><span><ShieldCheck size={14} /> Data tersimpan dengan aman</span></footer></main>
  </div>;
}
