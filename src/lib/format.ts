const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

// 102477 → ١٠٢٤٧٧
export function ar(n: number | string) {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}

// ١٠٢٤٧٧ → 102477 (لما اللاعب يكتب بالأرقام العربية)
export function toLatinDigits(s: string) {
  return s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// ٩:٤١ م
export function timeAr(iso: string) {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${ar(`${h}:${m}`)} ${d.getHours() < 12 ? 'ص' : 'م'}`;
}

function daysAgo(d: Date) {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((start(new Date()) - start(d)) / 86400000);
}

// اليوم / أمس / الأحد / ١٢/١٠
export function dayAr(iso: string) {
  const d = new Date(iso);
  const n = daysAgo(d);
  if (n === 0) return 'اليوم';
  if (n === 1) return 'أمس';
  if (n < 7) return DAYS[d.getDay()];
  return ar(`${d.getDate()}/${d.getMonth() + 1}`);
}

// وقت آخر رسالة بقائمة المحادثات
export function whenAr(iso: string) {
  return daysAgo(new Date(iso)) === 0 ? timeAr(iso) : dayAr(iso);
}
