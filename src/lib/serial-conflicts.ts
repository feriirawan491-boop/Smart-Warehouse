import type { BoxRecord } from "./data";
import { findDeviceConflicts, deviceConflictMessage } from "./device-conflicts";

export type SerialConflict = {
  serial: string;
  rows: number[];
  boxes: { name: string; number: string }[];
};

export function findSerialConflicts(rows: { serial: string }[], boxes: BoxRecord[]): SerialConflict[] {
  return findDeviceConflicts(rows, boxes).filter(conflict => conflict.field === "serial")
    .map(({ value, rows, boxes }) => ({ serial: value, rows, boxes }));
}

export function serialConflictMessage(conflict: SerialConflict): string {
  return deviceConflictMessage({ field: "serial", value: conflict.serial, rows: conflict.rows, boxes: conflict.boxes });
}
