import { validSerial, type BoxRecord } from "./data";
import { boxNumberError } from "./box-scan";
import { findSerialConflicts, serialConflictMessage } from "./serial-conflicts";

export function updateBox(boxes: BoxRecord[], original: BoxRecord, edited: BoxRecord): BoxRecord[] {
  const current = boxes.find(box => box.id === original.id);
  if (!current) throw new Error("Box sudah dihapus. Kembali ke Riwayat scan.");
  if (JSON.stringify(current) !== JSON.stringify(original)) throw new Error("Data box telah berubah di tab lain. Muat ulang halaman sebelum mengedit.");
  const next = { ...edited, id: original.id, name: edited.name.trim(), number: edited.number.trim() };
  if (!next.name) throw new Error("Nama box wajib diisi.");
  const others = boxes.filter(box => box.id !== original.id);
  const numberError = boxNumberError(next.number, others);
  if (numberError) throw new Error(numberError);
  if (!next.devices.length || next.devices.some(device => !validSerial(device.serial))) throw new Error("Isi minimal satu perangkat dengan SN 12 digit.");
  const conflicts = findSerialConflicts(next.devices, others);
  if (conflicts.length) throw new Error(conflicts.map(serialConflictMessage).join(" "));
  return boxes.map(box => box.id === original.id ? next : box);
}
