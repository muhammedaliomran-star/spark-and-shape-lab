/**
 * Arabic Number to Words (Tafqeet) - تفقيط الأرقام باللغة العربية
 * يدعم المبالغ المالية بالجنيه المصري والقرش وصيغ التذكير والتأنيث
 */

const ONES = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];

const TENS = [
  "",
  "",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
];

const HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

function convertGroup(number: number): string {
  let result = "";

  const hundreds = Math.floor(number / 100);
  const remainder = number % 100;

  if (hundreds > 0) {
    result += HUNDREDS[hundreds];
  }

  if (remainder > 0) {
    if (result !== "") {
      result += " و";
    }

    if (remainder < 20) {
      result += ONES[remainder];
    } else {
      const ones = remainder % 10;
      const tens = Math.floor(remainder / 10);

      if (ones > 0) {
        result += ONES[ones] + " و" + TENS[tens];
      } else {
        result += TENS[tens];
      }
    }
  }

  return result;
}

export function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";
  if (isNaN(num)) return "";

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) return "صفر";

  const groups: string[] = [];

  // Billions
  const billions = Math.floor(integerPart / 1_000_000_000);
  const afterBillions = integerPart % 1_000_000_000;

  if (billions > 0) {
    if (billions === 1) groups.push("مليار");
    else if (billions === 2) groups.push("ملياران");
    else if (billions >= 3 && billions <= 10) groups.push(convertGroup(billions) + " مليارات");
    else groups.push(convertGroup(billions) + " مليار");
  }

  // Millions
  const millions = Math.floor(afterBillions / 1_000_000);
  const afterMillions = afterBillions % 1_000_000;

  if (millions > 0) {
    if (millions === 1) groups.push("مليون");
    else if (millions === 2) groups.push("مليونان");
    else if (millions >= 3 && millions <= 10) groups.push(convertGroup(millions) + " ملايين");
    else groups.push(convertGroup(millions) + " مليون");
  }

  // Thousands
  const thousands = Math.floor(afterMillions / 1000);
  const remaining = afterMillions % 1000;

  if (thousands > 0) {
    if (thousands === 1) groups.push("ألف");
    else if (thousands === 2) groups.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) groups.push(convertGroup(thousands) + " آلاف");
    else groups.push(convertGroup(thousands) + " ألف");
  }

  // Units
  if (remaining > 0) {
    groups.push(convertGroup(remaining));
  }

  const text = groups.join(" و");

  return text;
}

export function tafqeetCurrency(
  amount: number,
  currencyName = "جنيه مصري",
  subCurrencyName = "قرش"
): string {
  if (amount === 0) return `فقط صفر ${currencyName} لا غير`;

  const integerPart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - integerPart) * 100);

  let result = "فقط وقدره ";

  if (integerPart > 0) {
    result += numberToArabicWords(integerPart) + " " + currencyName;
  }

  if (decimalPart > 0) {
    if (integerPart > 0) {
      result += " و";
    }
    result += numberToArabicWords(decimalPart) + " " + subCurrencyName;
  }

  result += " لا غير";

  return result;
}
