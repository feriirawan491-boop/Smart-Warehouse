import { validSerial, type BoxRecord } from "./data";

export type SerialConflict = {
  serial: string;
  rows: number[];
  boxes: { name: string; number: string }[];
};

export function findSerialConflicts(rows: { serial: string }[], boxes: BoxRecord[]): SerialConflict[] {
  const occurrences = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const serial = row.serial.trim();
    if (!validSerial(serial)) return;
    const positions = occurrences.get(serial) ?? [];
    positions.push(index + 1);
    occurrences.set(serial, positions);
  });
  const existing = new Map<string, SerialConflict["boxes"]>();
  for (const box of boxes) {
    for (const device of box.devices) {
      const serial = device.serial.trim();
      if (!occurrences.has(serial)) continue;
      const matches = existing.get(serial) ?? [];
      if (!matches.some(match => match.number === box.number)) matches.push({ name: box.name, number: box.number });
      existing.set(serial, matches);
    }
  }
  return [...occurrences].flatMap(([serial, positions]) => {
    const matches = existing.get(serial) ?? [];
    return positions.length > 1 || matches.length ? [{ serial, rows: positions, boxes: matches }] : [];
  });
}

export function serialConflictMessage(conflict: SerialConflict): string {
  const details: string[] = [];
  if (conflict.rows.length > 1) details.push(`sama pada baris ${conflict.rows.join(", ")}`);
  if (conflict.boxes.length) details.push(`sudah terdaftar di ${conflict.boxes.map(box => `${box.name} (nomor ${box.number})`).join(", ")}`);
  return `Serial Number ${conflict.serial} ${details.join(" dan ")}. Periksa atau ganti SN sebelum menyimpan.`;
}
