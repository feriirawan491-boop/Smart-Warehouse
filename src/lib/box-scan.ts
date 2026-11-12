import type { BoxRecord } from "./data";

export function boxNumberCandidates(values: { rawValue: string }[]): string[] {
  const candidates = new Set<string>();
  for (const { rawValue } of values) {
    const value = rawValue.trim().toUpperCase();
    const tagged = value.match(/BOX(?:\s*(?:NUMBER|NO\.?))?\s*[:=#-]?\s*(\d{8,30})(?!\d)/);
    if (tagged) candidates.add(tagged[1]);
    // A bare 12-digit value is a device serial, not a box number.
    if (/^\d{8,30}$/.test(value) && value.length !== 12) candidates.add(value);
  }
  return [...candidates];
}

export function boxNumberError(number: string, boxes: BoxRecord[]): string {
  if (!/^\d{8,30}$/.test(number)) return "Nomor box harus berisi 8–30 digit angka.";
  if (boxes.some(box => box.number === number)) return "Nomor box ini sudah tercatat. Scan barcode box lain.";
  return "";
}
