import { describe, expect, it } from "vitest";
import { sampleBoxes as initialBoxes } from "./data";
import { findSerialConflicts, serialConflictMessage } from "./serial-conflicts";

describe("Serial Number uniqueness", () => {
  it("identifies every repeated row while preserving leading zeros", () => {
    const conflicts = findSerialConflicts([
      { serial: "003246287562" }, { serial: "999999999999" }, { serial: "003246287562" }
    ], []);
    expect(conflicts).toEqual([{ serial: "003246287562", rows: [1, 3], boxes: [] }]);
    expect(serialConflictMessage(conflicts[0])).toContain("baris 1, 3");
  });

  it("finds a serial already recorded in any model and identifies its box", () => {
    const conflicts = findSerialConflicts([{ serial: "323962794243" }], initialBoxes);
    expect(conflicts).toEqual([{
      serial: "323962794243", rows: [1], boxes: [{ name: "BOX 1", number: "320101002609220242" }]
    }]);
    expect(serialConflictMessage(conflicts[0])).toContain("sudah terdaftar di BOX 1 (nomor 320101002609220242)");
  });

  it("reports both a repeated row and an existing stored serial", () => {
    const rows = [{ serial: "324462875638" }, { serial: "324462875638" }];
    const conflict = findSerialConflicts(rows, initialBoxes)[0];
    expect(conflict.rows).toEqual([1, 2]);
    expect(conflict.boxes).toHaveLength(1);
    expect(serialConflictMessage(conflict)).toContain("sama pada baris 1, 2 dan sudah terdaftar");
  });

  it("clears conflicts when the value is corrected or a repeated row is removed", () => {
    expect(findSerialConflicts([{ serial: "003246287562" }, { serial: "003246287563" }], initialBoxes)).toEqual([]);
    expect(findSerialConflicts([{ serial: "003246287562" }], initialBoxes)).toEqual([]);
  });

  it("does not label incomplete or empty serials as duplicates", () => {
    expect(findSerialConflicts([{ serial: "" }, { serial: "" }, { serial: "123" }, { serial: "123" }], [])).toEqual([]);
  });
});
