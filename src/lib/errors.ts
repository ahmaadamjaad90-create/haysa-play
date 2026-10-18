// رسالة خطأ للاعب، ومعها التفاصيل الإنجليزية بين قوسين عشان نعرف شو صار
export function errorText(e: unknown) {
  const detail = e instanceof Error ? e.message : String(e);
  return `صار خطأ، جرّب كمان مرة (${detail})`;
}
