import type { BarcodeValue } from "./barcode";

type Region = { x: number; y: number; width: number; height: number };
export type PhotoScanProgress = { completed: number; total: number; found: number };
type LocatedBarcode = BarcodeValue & { x: number; y: number };

// Overlap preserves barcodes and their quiet zones near crop boundaries.
export function photoRegions(width: number, height: number): Region[] {
  const regions: Region[] = [{ x: 0, y: 0, width, height }];
  for (const count of [4, 10]) {
    const bandHeight = Math.min(height, Math.ceil(height / count * 1.6));
    for (let index = 0; index < count; index++) {
      const y = Math.round((height - bandHeight) * index / (count - 1));
      regions.push({ x: 0, y, width, height: bandHeight });
    }
  }
  for (const x of [0, Math.floor(width * .4)]) {
    for (const y of [0, Math.floor(height * .4)]) {
      regions.push({ x, y, width: width - Math.floor(width * .4), height: height - Math.floor(height * .4) });
    }
  }
  return regions;
}

export function grayscale(pixels: Uint8ClampedArray): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(pixels.length / 4);
  for (let index = 0; index < gray.length; index++) {
    const offset = index * 4;
    const alpha = pixels[offset + 3] / 255;
    gray[index] = (.299 * pixels[offset] + .587 * pixels[offset + 1] + .114 * pixels[offset + 2]) * alpha + 255 * (1 - alpha);
  }
  return gray;
}

export function enhanceContrast(gray: Uint8ClampedArray): Uint8ClampedArray {
  const histogram = new Uint32Array(256);
  for (const value of gray) histogram[value]++;
  const threshold = Math.max(1, Math.floor(gray.length * .01));
  let low = 0, high = 255, count = 0;
  while (low < 255 && (count += histogram[low]) < threshold) low++;
  count = 0;
  while (high > low && (count += histogram[high]) < threshold) high--;
  if (high - low < 8) return gray;
  return gray.map(value => Math.max(0, Math.min(255, (value - low) * 255 / (high - low))));
}

export async function createPhotoPixelReader() {
  const { MultiFormatOneDReader, QRCodeReader, DataMatrixReader, DecodeHintType, RGBLuminanceSource, HybridBinarizer, BinaryBitmap, BarcodeFormat, NotFoundException, ChecksumException, FormatException } = await import("@zxing/library");
  const formats = [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.ITF, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODABAR];
  const decodeHints = new Map<import("@zxing/library").DecodeHintType, boolean | typeof formats>([
    [DecodeHintType.TRY_HARDER, true], [DecodeHintType.POSSIBLE_FORMATS, formats]
  ]);
  const readers = [new MultiFormatOneDReader(decodeHints), new QRCodeReader(), new DataMatrixReader()];
  return (pixels: Uint8ClampedArray, width: number, height: number): LocatedBarcode | null => {
    const source = new RGBLuminanceSource(pixels, width, height);
    // Retry with stretched contrast and reversed polarity for dark labels.
    for (const variant of [source, new RGBLuminanceSource(enhanceContrast(pixels), width, height), source.invert()]) {
      const bitmap = new BinaryBitmap(new HybridBinarizer(variant));
      for (const reader of readers) {
        try {
          const result = reader.decode(bitmap, decodeHints);
          const points = result.getResultPoints() ?? [];
          const x = points.length ? points.reduce((sum, point) => sum + point.getX(), 0) / points.length : width / 2;
          const y = points.length ? points.reduce((sum, point) => sum + point.getY(), 0) / points.length : height / 2;
          return { rawValue: result.getText(), format: BarcodeFormat[result.getBarcodeFormat()].toLowerCase(), x, y };
        } catch (cause) {
          if (!(cause instanceof NotFoundException || cause instanceof ChecksumException || cause instanceof FormatException)) throw cause;
        } finally { reader.reset(); }
      }
    }
    return null;
  };
}

export async function scanPhotoBarcodes(image: HTMLImageElement, onProgress: (progress: PhotoScanProgress) => void): Promise<BarcodeValue[]> {
  const decode = await createPhotoPixelReader();
  const found = new Map<string, LocatedBarcode>();
  const scale = Math.min(1, 2600 / Math.max(image.naturalWidth, image.naturalHeight));
  const NativeDetector = (window as Window & {
    BarcodeDetector?: new () => { detect(image: HTMLImageElement): Promise<(BarcodeValue & { boundingBox?: { x: number; y: number; width: number; height: number } })[]> };
  }).BarcodeDetector;
  if (NativeDetector) {
    try {
      for (const result of await new NativeDetector().detect(image)) {
        const box = result.boundingBox;
        found.set(result.rawValue, { ...result, x: box ? (box.x + box.width / 2) * scale : Infinity, y: box ? (box.y + box.height / 2) * scale : Infinity });
      }
    } catch { /* Continue with image processing when native detection fails. */ }
  }
  // Full images at two scales, overlapping strips, tiles, and slight deskew.
  // Try all orientations before spending time on individual strips.
  const stages = [{ angle: 0, whole: true }, { angle: 90, whole: true }, { angle: -8, whole: true }, { angle: 8, whole: true }, { angle: 0, whole: false }, { angle: 90, whole: false }];
  const canvas = document.createElement("canvas");
  const crop = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const cropContext = crop.getContext("2d", { willReadFrequently: true });
  if (!context || !cropContext) throw new Error("Pemrosesan foto tidak tersedia.");
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const total = 2 * (photoRegions(width, height).length + 1) + 2;
  let completed = 0;
  const started = performance.now();
  const results = () => [...found.values()].sort((a, b) => a.y - b.y || a.x - b.x).map(({ rawValue, format }) => ({ rawValue, format }));
  const publish = () => onProgress({ completed, total, found: found.size });
  publish();
  try {
    for (const { angle, whole } of stages) {
      const radians = angle * Math.PI / 180;
      const cosine = Math.abs(Math.cos(radians)), sine = Math.abs(Math.sin(radians));
      canvas.width = Math.ceil(width * cosine + height * sine);
      canvas.height = Math.ceil(width * sine + height * cosine);
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(radians);
      context.drawImage(image, -width / 2, -height / 2, width, height);
      context.setTransform(1, 0, 0, 1, 0, 0);
      const regions = whole ? [{ x: 0, y: 0, width: canvas.width, height: canvas.height }] : photoRegions(canvas.width, canvas.height).slice(1);
      for (const [index, region] of regions.entries()) {
        // Give the browser time to paint progress and handle touch input.
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
        const sizes = whole && index === 0 && (angle === 0 || angle === 90) ? [1200, 2400] : [2000];
        for (const size of sizes) {
          const resize = Math.min(2, size / Math.max(region.width, region.height));
          crop.width = Math.max(1, Math.round(region.width * resize));
          crop.height = Math.max(1, Math.round(region.height * resize));
          cropContext.fillStyle = "white";
          cropContext.fillRect(0, 0, crop.width, crop.height);
          cropContext.drawImage(canvas, region.x, region.y, region.width, region.height, 0, 0, crop.width, crop.height);
          const pixels = cropContext.getImageData(0, 0, crop.width, crop.height);
          const result = decode(grayscale(pixels.data), crop.width, crop.height);
          if (result && (!found.has(result.rawValue) || !Number.isFinite(found.get(result.rawValue)!.y))) {
            const dx = region.x + result.x / resize - canvas.width / 2;
            const dy = region.y + result.y / resize - canvas.height / 2;
            found.set(result.rawValue, { ...result, x: Math.cos(radians) * dx + Math.sin(radians) * dy + width / 2, y: -Math.sin(radians) * dx + Math.cos(radians) * dy + height / 2 });
          }
          completed++;publish();
          // Bound the work on older phones; keep every successful detection.
          if (performance.now() - started > 18000) return results();
        }
      }
    }
    return results();
  } finally { canvas.width = canvas.height = crop.width = crop.height = 0; }
}
