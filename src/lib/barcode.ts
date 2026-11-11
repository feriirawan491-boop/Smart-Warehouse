export type BarcodeValue = { rawValue: string; format: string };
export type BarcodeReader = {
  detect(source: HTMLVideoElement | HTMLImageElement): Promise<BarcodeValue[]>;
};

export async function createBarcodeReader(): Promise<BarcodeReader> {
  const NativeDetector = (window as Window & {
    BarcodeDetector?: new () => BarcodeReader;
  }).BarcodeDetector;
  if (NativeDetector) {
    try { return new NativeDetector(); } catch { /* Use the JavaScript reader. */ }
  }

  const { BrowserMultiFormatReader, BarcodeFormat, NotFoundException } = await import("@zxing/library");
  const reader = new BrowserMultiFormatReader();
  return {
    async detect(source) {
      try {
        const result = reader.decode(source);
        return [{ rawValue: result.getText(), format: BarcodeFormat[result.getBarcodeFormat()].toLowerCase() }];
      } catch (cause) {
        if (cause instanceof NotFoundException) return [];
        throw cause;
      }
    }
  };
}
