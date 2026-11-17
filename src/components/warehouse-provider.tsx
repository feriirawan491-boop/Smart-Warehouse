"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { BoxRecord, DeviceModelOption } from "@/lib/data";
import { databaseError, getBoxes, getDeviceModels, supabase, warehouseChangedEvent } from "@/lib/supabase";
import { createRefreshQueue } from "@/lib/refresh-queue";

type Connection = "connecting" | "realtime" | "retrying" | "offline";
type WarehouseData = { boxes: BoxRecord[]; models: DeviceModelOption[]; ready: boolean; loading: boolean; error: string; connection: Connection; lastSynced: string | null; refresh: () => Promise<void> };
const WarehouseContext = createContext<WarehouseData | null>(null);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<{ boxes: BoxRecord[]; models: DeviceModelOption[] }>({ boxes: [], models: [] });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<Connection>("connecting");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const queue = createRefreshQueue(async () => {
      if (active) setLoading(true);
      const [boxes, models] = await Promise.all([getBoxes(), getDeviceModels()]);
      return { boxes, models };
    }, snapshot => {
      setData(snapshot); setReady(true); setError(""); setLoading(false); setLastSynced(new Date().toISOString());
    }, cause => { setError(databaseError(cause).message); setLoading(false); });
    refreshRef.current = () => queue.refresh();
    const request = () => { clearTimeout(timer); timer = setTimeout(() => { void queue.refresh(); }, 100); };
    const onOnline = () => { setConnection("connecting"); void queue.refresh(); };
    const onOffline = () => setConnection("offline");
    const onVisible = () => { if (document.visibilityState === "visible") void queue.refresh(); };
    const channel = client.channel(`warehouse-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "boxes" }, request)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, request)
      .on("postgres_changes", { event: "*", schema: "public", table: "device_models" }, request)
      .subscribe(status => {
        if (!active) return;
        setConnection(!navigator.onLine ? "offline" : status === "SUBSCRIBED" ? "realtime" : "retrying");
        // Refetch after subscribing and reconnecting to close the initial-fetch gap.
        if (status === "SUBSCRIBED") void queue.refresh();
      });
    if (!navigator.onLine) setConnection("offline");
    void queue.refresh();
    // Reconcile missed events (including tabs waking from sleep).
    const interval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === "visible") void queue.refresh();
    }, 30000);
    window.addEventListener(warehouseChangedEvent, request);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false; queue.stop(); clearTimeout(timer); clearInterval(interval);
      refreshRef.current = async () => {};
      window.removeEventListener(warehouseChangedEvent, request);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      void client.removeChannel(channel);
    };
  }, []);

  return <WarehouseContext.Provider value={{ ...data, ready, loading, error, connection, lastSynced, refresh }}>{children}</WarehouseContext.Provider>;
}

export function useWarehouse() {
  const value = useContext(WarehouseContext);
  if (!value) throw new Error("useWarehouse harus digunakan di dalam WarehouseProvider.");
  return value;
}
