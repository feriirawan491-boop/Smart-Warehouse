import { describe, expect, it } from "vitest";
import { createPhotoPixelReader, enhanceContrast, grayscale, photoRegions } from "./photo-barcode";

// Code 128-C fixtures including start, checksum and stop symbols.
const serialA = "211232 232121 132131 431111 421112 331121 132311 212321 2331112";
const serialB = "211232 232121 211313 431111 134111 112133 112331 213311 2331112";

function paintBarcode(pixels: Uint8ClampedArray, width: number, top: number, pattern: string, dark = 0, light = 255) {
  let x = 32;
  for (const symbol of pattern.split(" ")) {
    for (const [index, bar] of [...symbol].entries()) {
      const thickness = Number(bar) * 3;
      for (let row = top; row < top + 60; row++) pixels.fill(index % 2 === 0 ? dark : light, row * width + x, row * width + x + thickness);
      x += thickness;
    }
  }
}

describe("barcode photo decoding", () => {
  it.each([[0, 255], [140, 185], [255, 0]])("reads a real serial barcode with foreground %s and background %s", async (dark, light) => {
    const pixels = new Uint8ClampedArray(440 * 110).fill(light);
    paintBarcode(pixels, 440, 25, serialA, dark, light);
    const decode = await createPhotoPixelReader();
    expect(decode(pixels, 440, 110)).toMatchObject({ rawValue: "324462875638", format: "code_128" });
  });

  it("finds two separate barcodes using overlapping photo regions", async () => {
    const width = 440, height = 600;
    const pixels = new Uint8ClampedArray(width * height).fill(255);
    paintBarcode(pixels, width, 50, serialA);
    paintBarcode(pixels, width, 440, serialB);
    const decode = await createPhotoPixelReader();
    const values = new Set<string>();
    for (const region of photoRegions(width, height).filter(region => region.width === width)) {
      const result = decode(pixels.slice(region.y * width, (region.y + region.height) * width), width, region.height);
      if (result) values.add(result.rawValue);
    }
    expect([...values].sort()).toEqual(["323962794243", "324462875638"]);
  });

  it("does not invent a barcode in a blank photo", async () => {
    const decode = await createPhotoPixelReader();
    expect(decode(new Uint8ClampedArray(200 * 80).fill(255), 200, 80)).toBeNull();
  });

  it("composites transparent pixels on white and stretches a dim image", () => {
    expect([...grayscale(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]))]).toEqual([255, 0]);
    expect([...enhanceContrast(new Uint8ClampedArray([140, 140, 185, 185]))]).toEqual([0, 0, 255, 255]);
  });
});
