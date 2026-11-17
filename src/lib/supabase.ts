import { createClient } from "@supabase/supabase-js";
import type { BoxRecord, DeviceModelOption } from "./data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const warehouseChangedEvent = "warehouse-data-changed";

function ensureClient() {
  if (!supabase) throw new Error("Konfigurasi Supabase belum lengkap. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di environment.");
  return supabase;
}

export function databaseError(cause: unknown): Error {
  const detail = cause && typeof cause === "object" ? cause as { code?: string; message?: string } : {};
  if (detail.code === "23505") return new Error("Nomor box, SN, MAC, atau model sudah terdaftar. Periksa data terbaru sebelum menyimpan.");
  if (detail.code === "23503") return new Error("Model masih dipakai box atau sudah dihapus. Muat ulang data sebelum melanjutkan.");
  if (detail.code === "PGRST116") return new Error("Data sudah dihapus atau tidak dapat diakses. Muat ulang data sebelum melanjutkan.");
  if (detail.code === "42501") return new Error("Akses ditolak. Masuk dengan akun operator yang memiliki izin Supabase.");
  if (detail.code === "PGRST202") return new Error("Database perlu diperbarui. Jalankan supabase/schema.sql di SQL Editor Supabase.");
  if (detail.code === "PGRST205" || detail.code === "42P01") return new Error("Tabel belum tersedia. Jalankan supabase/schema.sql di SQL Editor Supabase.");
  return new Error(detail.message || (typeof cause === "string" ? cause : "Tidak dapat terhubung ke Supabase. Periksa koneksi lalu coba lagi."));
}

function changed() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(warehouseChangedEvent));
}

type DbDevice = { id: string; unit_sequence: number; mac_address: string | null; serial_number: string };
type DbBox = { id: string; name: string; box_number: string; status: "confirmed" | "review"; scanned_at: string; updated_at: string; model: { code: string; label: string } | null; devices: DbDevice[] };

export async function getBoxes(): Promise<BoxRecord[]> {
  const client = ensureClient();
  const rows: DbBox[] = [];
  const pageSize = 500;
  // Supabase limits each response; keep dashboard counts and exports complete.
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("boxes").select("id,name,box_number,status,scanned_at,updated_at,model:device_models(code,label),devices(id,unit_sequence,mac_address,serial_number)").order("scanned_at", { ascending: false }).order("id").range(offset, offset + pageSize - 1);
    if (error) throw databaseError(error);
    const page = (data ?? []) as unknown as DbBox[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows.map(box => ({
    id: box.id, name: box.name, number: box.box_number, model: box.model?.code ?? "", scannedAt: box.scanned_at, updatedAt: box.updated_at,
    date: new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(box.scanned_at)), status: box.status,
    devices: [...(box.devices ?? [])].sort((a, b) => a.unit_sequence - b.unit_sequence).map(device => ({ id: device.id, mac: device.mac_address ?? "", serial: device.serial_number })),
  }));
}

export async function getDeviceModels(): Promise<DeviceModelOption[]> {
  const client = ensureClient();
  const models: DeviceModelOption[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("device_models").select("id,code,label").eq("is_active", true).order("label").order("id").range(offset, offset + 499);
    if (error) throw databaseError(error);
    models.push(...(data ?? []).map(row => ({ id: row.code, label: row.label })));
    if (!data || data.length < 500) return models;
  }
}

export async function insertBox(box: Omit<BoxRecord, "id">): Promise<void> {
  const { error } = await ensureClient().rpc("save_warehouse_box", { payload: boxPayload(box) });
  if (error) throw databaseError(error);
  changed();
}

export function boxPayload(box: Omit<BoxRecord, "id">) {
  return { name: box.name.trim(), box_number: box.number.trim(), model_code: box.model, status: box.status,
    devices: box.devices.map(device => ({ mac_address: device.mac.trim().toUpperCase() || null, serial_number: device.serial.trim() })) };
}

export async function updateBoxInDb(box: BoxRecord, expectedUpdatedAt: string): Promise<void> {
  const { error } = await ensureClient().rpc("save_warehouse_box", { payload: boxPayload(box), target_box_id: box.id, expected_updated_at: expectedUpdatedAt });
  if (error) throw databaseError(error);
  changed();
}

export async function deleteBoxInDb(id: string): Promise<void> {
  const { data, error } = await ensureClient().from("boxes").delete().eq("id", id).select("id").single();
  if (error) throw databaseError(error);
  if (!data) throw new Error("Box sudah dihapus atau tidak dapat diakses.");
  changed();
}

export async function deleteAllBoxes(): Promise<void> {
  const { error } = await ensureClient().from("boxes").delete().not("id", "is", null);
  if (error) throw databaseError(error);
  changed();
}

export async function addDeviceModel(label: string): Promise<void> {
  const { error } = await ensureClient().from("device_models").insert({ code: label.trim().toUpperCase(), label: label.trim() });
  if (error) throw databaseError(error);
  changed();
}

export async function deleteDeviceModel(code: string): Promise<void> {
  const { error } = await ensureClient().from("device_models").delete().eq("code", code).select("id").single();
  if (error) throw databaseError(error);
  changed();
}
