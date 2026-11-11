import { describe, expect, it } from "vitest";
import { initialBoxes } from "./data";
import { deviceConflictMessage, findDeviceConflicts } from "./device-conflicts";

describe("duplicate device data", () => {
  it("finds an existing MAC even when its formatting differs", () => {
    const conflicts = findDeviceConflicts([{ mac: "5c:ff:a9:4c:cc:a8", serial: "999999999999" }], initialBoxes);
    expect(conflicts).toEqual([{
      field: "mac", value: "5CFFA94CCCA8", rows: [1], boxes: [{ name: "BOX 1", number: "320080532609300063" }]
    }]);
    expect(deviceConflictMessage(conflicts[0])).toContain("MAC Address 5CFFA94CCCA8 sudah terdaftar di BOX 1");
  });

  it("detects identical device rows by both MAC and serial", () => {
    const row = { mac: "AABBCCDDEEFF", serial: "123456789012" };
    expect(findDeviceConflicts([row, row], []).map(conflict => ({ field: conflict.field, rows: conflict.rows }))).toEqual([
      { field: "mac", rows: [1, 2] }, { field: "serial", rows: [1, 2] }
    ]);
  });

  it("still blocks an existing MAC when the serial is changed", () => {
    expect(findDeviceConflicts([{ mac: "5CFFA94CCCA8", serial: "999999999999" }], initialBoxes).map(conflict => conflict.field)).toEqual(["mac"]);
  });

  it("allows unique identifiers and ignores empty MAC values", () => {
    expect(findDeviceConflicts([{ mac: "AABBCCDDEEFF", serial: "123456789012" }], initialBoxes)).toEqual([]);
    expect(findDeviceConflicts([{ mac: "", serial: "" }, { mac: "", serial: "" }], initialBoxes)).toEqual([]);
  });
});
