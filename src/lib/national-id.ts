// Egyptian National ID Parser and Validator (14 digits)
// Structure: [Century][YY][MM][DD][Governorate (2)][Sequence (4)][Check (1)]

export const EG_GOVERNORATES: Record<string, string> = {
  "01": "القاهرة",
  "02": "الإسكندرية",
  "03": "بورسعيد",
  "04": "السويس",
  "11": "دمياط",
  "12": "الدقهلية",
  "13": "الشرقية",
  "14": "القليوبية",
  "15": "كفر الشيخ",
  "16": "الغربية",
  "17": "المنوفية",
  "18": "البحيرة",
  "19": "الإسماعيلية",
  "21": "الجيزة",
  "22": "بني سويف",
  "23": "الفيوم",
  "24": "المنيا",
  "25": "أسيوط",
  "26": "سوهاج",
  "27": "قنا",
  "28": "أسوان",
  "29": "الأقصر",
  "31": "البحر الأحمر",
  "32": "الوادي الجديد",
  "33": "مطروح",
  "34": "شمال سيناء",
  "35": "جنوب سيناء",
  "88": "خارج الجمهورية",
};

export interface NationalIdInfo {
  isValid: boolean;
  error?: string;
  birthDate?: string; // YYYY-MM-DD
  birthDateDisplay?: string; // DD/MM/YYYY
  age?: number;
  governorate?: string;
  governorateCode?: string;
  gender?: "male" | "female";
  genderLabel?: string;
  century?: number;
}

export function parseEgyptianNationalId(nid: string): NationalIdInfo {
  const clean = nid.replace(/\D/g, "");
  if (clean.length !== 14) {
    return {
      isValid: false,
      error: "الرقم القومي يجب أن يتكون من 14 رقماً بالضبط",
    };
  }

  const centuryDigit = clean[0];
  if (centuryDigit !== "2" && centuryDigit !== "3") {
    return {
      isValid: false,
      error: "الرقم الأول يجب أن يكون 2 (مواليد 1900-1999) أو 3 (مواليد 2000-2099)",
    };
  }

  const centuryBase = centuryDigit === "2" ? 1900 : 2000;
  const yearTwoDigits = parseInt(clean.substring(1, 3), 10);
  const birthYear = centuryBase + yearTwoDigits;
  const birthMonth = parseInt(clean.substring(3, 5), 10);
  const birthDay = parseInt(clean.substring(5, 7), 10);

  if (birthMonth < 1 || birthMonth > 12) {
    return {
      isValid: false,
      error: "الشهر المستخرج من الرقم القومي غير صحيح",
    };
  }

  if (birthDay < 1 || birthDay > 31) {
    return {
      isValid: false,
      error: "اليوم المستخرج من الرقم القومي غير صحيح",
    };
  }

  const dateObj = new Date(birthYear, birthMonth - 1, birthDay);
  if (
    dateObj.getFullYear() !== birthYear ||
    dateObj.getMonth() !== birthMonth - 1 ||
    dateObj.getDate() !== birthDay
  ) {
    return {
      isValid: false,
      error: "تاريخ الميلاد المستخرج غير مطابق للتقويم",
    };
  }

  // Governorate
  const govCode = clean.substring(7, 9);
  const governorate = EG_GOVERNORATES[govCode] || "غير محدد";

  // Gender (13th digit: Odd = Male, Even = Female)
  const genderDigit = parseInt(clean[12], 10);
  const isMale = genderDigit % 2 !== 0;
  const gender: "male" | "female" = isMale ? "male" : "female";
  const genderLabel = isMale ? "ذكر" : "أنثى";

  // Calculate age
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const mDiff = today.getMonth() - (birthMonth - 1);
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDay)) {
    age--;
  }

  const mmStr = String(birthMonth).padStart(2, "0");
  const ddStr = String(birthDay).padStart(2, "0");
  const birthDate = `${birthYear}-${mmStr}-${ddStr}`;
  const birthDateDisplay = `${ddStr}/${mmStr}/${birthYear}`;

  return {
    isValid: true,
    birthDate,
    birthDateDisplay,
    age,
    governorate,
    governorateCode: govCode,
    gender,
    genderLabel,
    century: centuryBase,
  };
}
