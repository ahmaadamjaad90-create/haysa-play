const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

// 102477 → ١٠٢٤٧٧
export function ar(n: number | string) {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}

// ١٠٢٤٧٧ → 102477 (لما اللاعب يكتب بالأرقام العربية)
export function toLatinDigits(s: string) {
  return s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}
