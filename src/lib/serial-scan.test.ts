import { describe, expect, it } from "vitest";
import { serialNumbers } from "./serial-scan";

describe("SN-only device scan", () => {
  it("extracts serials and excludes box and MAC values", () => {
    expect(serialNumbers([
      { rawValue: "003246287562" }, { rawValue: "SN: 324462875638" },
      { rawValue: "MAC: 123456789012" }, { rawValue: "5CFFA94CCCA8" },
      { rawValue: "320080532609300063" }
    ])).toEqual(["003246287562", "324462875638"]);
  });
  it("deduplicates repeated detections and rejects incomplete serials", () => {
    expect(serialNumbers([{rawValue:"123456789012"},{rawValue:"S/N=123456789012"},{rawValue:"SN: 123"}])).toEqual(["123456789012"]);
  });
});
