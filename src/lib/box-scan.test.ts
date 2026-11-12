import { describe, expect, it } from "vitest";
import { boxNumberCandidates, boxNumberError } from "./box-scan";
import { sampleBoxes } from "./data";

describe("box-first barcode scan", () => {
  it("keeps the box number separate from serial and MAC barcodes", () => {
    expect(boxNumberCandidates([
      { rawValue: "324462875638" }, { rawValue: "5CFFA94CCCA8" },
      { rawValue: "320080532609300063" }, { rawValue: "BOX NO: 320080532609300063" }
    ])).toEqual(["320080532609300063"]);
  });
  it("requires a selection instead of silently choosing among boxes", () => {
    expect(boxNumberCandidates([{ rawValue: "320080532609300063" }, { rawValue: "320080532609300064" }])).toHaveLength(2);
  });
  it("rejects empty, invalid, or already recorded box numbers", () => {
    expect(boxNumberError("", [])).not.toBe("");
    expect(boxNumberError("ABC123", [])).not.toBe("");
    expect(boxNumberError(sampleBoxes[0].number, sampleBoxes)).toContain("sudah tercatat");
    expect(boxNumberError("320080532609300999", sampleBoxes)).toBe("");
  });
});
