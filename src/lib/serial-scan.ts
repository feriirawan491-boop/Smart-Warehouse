export function serialNumbers(values: { rawValue: string }[]): string[] {
  const serials = new Set<string>();
  for (const { rawValue } of values) {
    const value = rawValue.trim().toUpperCase();
    if (/^\d{12}$/.test(value)) serials.add(value);
    for (const match of value.matchAll(/(?:SERIAL(?:\s*NUMBER)?|S\/?N)\s*[:=]\s*(\d{12})(?!\d)/g)) serials.add(match[1]);
  }
  return [...serials];
}
