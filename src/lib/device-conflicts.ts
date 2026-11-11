import { validMac, validSerial, type BoxRecord } from "./data";

export type DeviceConflict = {
  field: "mac" | "serial";
  value: string;
  rows: number[];
  boxes: { name: string; number: string }[];
};

const normalize = (field: DeviceConflict["field"], value: string) => field === "mac"
  ? value.replace(/[:\-\s]/g, "").toUpperCase() : value.trim();

export function findDeviceConflicts(rows: { mac?: string; serial?: string }[], boxes: BoxRecord[]): DeviceConflict[] {
  const conflicts: DeviceConflict[] = [];
  for (const field of ["mac", "serial"] as const) {
    const occurrences = new Map<string, number[]>();
    rows.forEach((row, index) => {
      const value = normalize(field, row[field] ?? "");
      if (!(field === "mac" ? validMac(value) : validSerial(value))) return;
      const positions = occurrences.get(value) ?? [];
      positions.push(index + 1);
      occurrences.set(value, positions);
    });
    const existing = new Map<string, DeviceConflict["boxes"]>();
    for (const box of boxes) for (const device of box.devices) {
      const value = normalize(field, device[field]);
      if (!occurrences.has(value)) continue;
      const matches = existing.get(value) ?? [];
      if (!matches.some(match => match.number === box.number)) matches.push({ name: box.name, number: box.number });
      existing.set(value, matches);
    }
    for (const [value, positions] of occurrences) {
      const matches = existing.get(value) ?? [];
      if (positions.length > 1 || matches.length) conflicts.push({ field, value, rows: positions, boxes: matches });
    }
  }
  return conflicts;
}

export function deviceConflictMessage(conflict: DeviceConflict): string {
  const details: string[] = [];
  if (conflict.rows.length > 1) details.push(`sama pada baris ${conflict.rows.join(", ")}`);
  if (conflict.boxes.length) details.push(`sudah terdaftar di ${conflict.boxes.map(box => `${box.name} (nomor ${box.number})`).join(", ")}`);
  const label = conflict.field === "mac" ? "MAC Address" : "Serial Number";
  return `${label} ${conflict.value} ${details.join(" dan ")}. Periksa atau ganti ${conflict.field === "mac" ? "MAC" : "SN"} sebelum menyimpan.`;
}
