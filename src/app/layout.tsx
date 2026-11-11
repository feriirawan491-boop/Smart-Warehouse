import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = { title: "Smart Warehouse — Inventaris", description: "Kelola pemindaian label dan inventaris perangkat warehouse." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="id"><body suppressHydrationWarning><AppShell>{children}</AppShell></body></html>; }
