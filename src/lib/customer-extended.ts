// Extended Customer Metadata (Guarantor, Alternate Phones, National ID, KYC Documents)

export interface CustomerGuarantor {
  name?: string;
  phone?: string;
  nationalId?: string;
  relation?: string; // صلة القرابة (أب، أخ، زوج/زوجة، خال/عم، زميل عمل، صديق)
  address?: string;
  workplace?: string;
}

export interface CustomerKYC {
  idCardFront?: string; // base64 data URL
  idCardBack?: string;  // base64 data URL
  utilityBill?: string;  // base64 data URL
  guarantorIdCard?: string; // base64 data URL
}

export interface CustomerExtendedInfo {
  nationalId?: string;
  alternatePhone?: string;
  workPhone?: string;
  governorate?: string;
  birthDate?: string;
  gender?: "male" | "female";
  guarantor?: CustomerGuarantor;
  kyc?: CustomerKYC;
}

const EXT_TAG_START = "<!--SEGILLY_CUST_EXT:";
const EXT_TAG_END = ":SEGILLY_CUST_EXT-->";

/**
 * Encodes extended metadata into the customer notes string.
 * This guarantees 100% persistence on any existing Supabase schema without database migrations.
 */
export function encodeCustomerNotes(rawNotes: string | null | undefined, ext: CustomerExtendedInfo): string {
  const cleanRaw = (rawNotes || "")
    .replace(new RegExp(`${EXT_TAG_START}[\\s\\S]*?${EXT_TAG_END}`, "g"), "")
    .trim();

  const hasAnyExt =
    ext.nationalId ||
    ext.alternatePhone ||
    ext.workPhone ||
    ext.governorate ||
    ext.birthDate ||
    ext.gender ||
    (ext.guarantor && (ext.guarantor.name || ext.guarantor.phone || ext.guarantor.nationalId || ext.guarantor.relation || ext.guarantor.address)) ||
    (ext.kyc && (ext.kyc.idCardFront || ext.kyc.idCardBack || ext.kyc.utilityBill || ext.kyc.guarantorIdCard));

  if (!hasAnyExt) {
    return cleanRaw;
  }

  const jsonStr = JSON.stringify(ext);
  const extBlock = `${EXT_TAG_START}${jsonStr}${EXT_TAG_END}`;

  return cleanRaw ? `${cleanRaw}\n\n${extBlock}` : extBlock;
}

/**
 * Decodes the raw notes string into regular user notes and structured extended info.
 */
export function decodeCustomerNotes(notesStr: string | null | undefined): {
  rawNotes: string;
  ext: CustomerExtendedInfo;
} {
  if (!notesStr) {
    return { rawNotes: "", ext: {} };
  }

  const match = notesStr.match(new RegExp(`${EXT_TAG_START}([\\s\\S]*?)${EXT_TAG_END}`));
  let ext: CustomerExtendedInfo = {};

  if (match && match[1]) {
    try {
      ext = JSON.parse(match[1]);
    } catch {
      ext = {};
    }
  }

  const rawNotes = notesStr
    .replace(new RegExp(`${EXT_TAG_START}[\\s\\S]*?${EXT_TAG_END}`, "g"), "")
    .trim();

  return { rawNotes, ext };
}
