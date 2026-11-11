import { afterEach, describe, expect, it, vi } from "vitest";
import { createBarcodeReader } from "./barcode";

const { decode } = vi.hoisted(() => ({ decode: vi.fn() }));
vi.mock("@zxing/library", () => ({
  BrowserMultiFormatReader: class { decode = decode; },
  BarcodeFormat: { 4: "CODE_128" },
  NotFoundException: class NotFoundException extends Error {}
}));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("mobile barcode reader", () => {
  it("decodes without a native BarcodeDetector", async () => {
    vi.stubGlobal("window", {});
    decode.mockReturnValue({ getText: () => "324462875638", getBarcodeFormat: () => 4 });
    const reader = await createBarcodeReader();
    expect(await reader.detect({} as HTMLVideoElement)).toEqual([
      { rawValue: "324462875638", format: "code_128" }
    ]);
  });

  it("uses the fallback when the native constructor fails", async () => {
    vi.stubGlobal("window", { BarcodeDetector: class { constructor() { throw new Error("Unsupported"); } } });
    const { NotFoundException } = await import("@zxing/library");
    decode.mockImplementation(() => { throw new NotFoundException(); });
    const reader = await createBarcodeReader();
    expect(await reader.detect({} as HTMLVideoElement)).toEqual([]);
  });

  it("keeps a working native detector", async () => {
    const nativeDetect = vi.fn().mockResolvedValue([]);
    vi.stubGlobal("window", { BarcodeDetector: class { detect = nativeDetect; } });
    const reader = await createBarcodeReader();
    await reader.detect({} as HTMLVideoElement);
    expect(nativeDetect).toHaveBeenCalledOnce();
    expect(decode).not.toHaveBeenCalled();
  });
});
