import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import "./globals.css";

export const metadata: Metadata = { title: "Smart Warehouse — Inventaris", description: "Kelola pemindaian label dan inventaris perangkat warehouse." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="id"><body suppressHydrationWarning><AuthGate><AppShell>{children}</AppShell></AuthGate></body></html>; }
