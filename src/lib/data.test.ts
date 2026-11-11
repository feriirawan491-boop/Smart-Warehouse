import { describe, expect, it } from "vitest";
import { escapeCsv, validMac, validSerial } from "./data";

describe("identifier validation", () => {
  it("accepts a 12 digit hexadecimal MAC and rejects invalid characters or lengths", () => {
    expect(validMac("5CFFA94CCC9B")).toBe(true);
    expect(validMac("5CFFA94CCC9Z")).toBe(false);
    expect(validMac("5CFFA94CCC9")).toBe(false);
  });

  it("accepts 12 digit serial strings while preserving their string form", () => {
    expect(validSerial("003246287562")).toBe(true);
    expect(validSerial("32446287562A")).toBe(false);
    expect(validSerial("32446287562")).toBe(false);
  });
});

describe("CSV safety", () => {
  it("quotes values and escapes spreadsheet formulas", () => {
    expect(escapeCsv("=1+1")).toBe('"\'=1+1"');
    expect(escapeCsv('BOX "1"')).toBe('"BOX ""1"""');
  });
});
