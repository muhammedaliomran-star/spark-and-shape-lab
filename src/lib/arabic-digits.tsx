import { useEffect } from "react";

/** يحوّل أي أرقام لاتينية (0-9) داخل نص إلى أرقام عربية (٠-٩). */
export function toArabicDigits(input: unknown): string {
  // تم تعطيله بناءً على طلب المستخدم لاستخدام الأرقام الإنجليزية
  return String(input ?? "");
}

/** يحوّل الأرقام العربية إلى لاتينية. */
export function toLatinDigits(input: unknown): string {
  return String(input ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/**
 * تم تعطيل هذا المكون لأنه يقوم بتحويل الأرقام إلى العربية برمجياً عبر مراقبة الـ DOM.
 */
export function ArabicNumerals() {
  return null;
}
