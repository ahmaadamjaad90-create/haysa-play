const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

// 102477 → ١٠٢٤٧٧
export function ar(n: number | string) {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}
