import { useState, useEffect } from "react";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/excel-helper";
import { openPdfDocument, esc } from "@/lib/pdf-doc";

export type LicenseTier = "trial" | "starter" | "pro" | "enterprise";
export type LicenseStatus = "active" | "trial" | "expired" | "suspended";

export interface ModulePermissions {
  allowPos: boolean;
  allowInstallments: boolean;
  allowWarehouse: boolean;
  allowStorefront: boolean;
  allowWhatsApp: boolean;
  allowMultiBranch: boolean;
  maxBranches: number;
  maxCashiers: number;
  maxProducts: number;
}

export interface LicenseRecord {
  id: string;
  key: string;
  tier: LicenseTier;
  tierLabel: string;
  clientName: string;
  clientPhone: string;
  shopName: string;
  issueDate: string;
  expiryDate: string; // ISO date or "LIFETIME"
  status: LicenseStatus;
  paidAmount: number;
  currency: string;
  billingCycle: "trial" | "monthly" | "yearly" | "lifetime";
  notes?: string;
  hardwareIncluded?: string;
  modules: ModulePermissions;
  lastActiveDate?: string;
  deviceFingerprint?: string;
}

const STORAGE_KEY_CURRENT_LICENSE = "segilly_active_license_v1";
const STORAGE_KEY_ADMIN_LICENSES = "segilly_admin_all_licenses_v1";
const STORAGE_KEY_ADMIN_PIN = "segilly_super_admin_pin_v1";

const DEFAULT_MODULES: Record<LicenseTier, ModulePermissions> = {
  trial: {
    allowPos: true,
    allowInstallments: true,
    allowWarehouse: true,
    allowStorefront: true,
    allowWhatsApp: true,
    allowMultiBranch: true,
    maxBranches: 2,
    maxCashiers: 2,
    maxProducts: 500,
  },
  starter: {
    allowPos: true,
    allowInstallments: false,
    allowWarehouse: true,
    allowStorefront: false,
    allowWhatsApp: false,
    allowMultiBranch: false,
    maxBranches: 1,
    maxCashiers: 2,
    maxProducts: 2000,
  },
  pro: {
    allowPos: true,
    allowInstallments: true,
    allowWarehouse: true,
    allowStorefront: true,
    allowWhatsApp: true,
    allowMultiBranch: true,
    maxBranches: 5,
    maxCashiers: 10,
    maxProducts: 20000,
  },
  enterprise: {
    allowPos: true,
    allowInstallments: true,
    allowWarehouse: true,
    allowStorefront: true,
    allowWhatsApp: true,
    allowMultiBranch: true,
    maxBranches: 99,
    maxCashiers: 99,
    maxProducts: 999999,
  },
};

export const TIER_CONFIG: Record<
  LicenseTier,
  { label: string; color: string; desc: string; defaultPrice: number }
> = {
  trial: {
    label: "فترة تجريبية (14 يوم)",
    color: "amber",
    desc: "تجربة كاملة لكافة موديولات النظام بدون أي قيود",
    defaultPrice: 0,
  },
  starter: {
    label: "الباقة الأساسية (كاشير + مخزن)",
    color: "blue",
    desc: "فرع واحد، نقاط بيع سريعة، إدارة المخزن والباركود",
    defaultPrice: 350,
  },
  pro: {
    label: "باقة برو الاحترافية (شاملة)",
    color: "emerald",
    desc: "فروع متعددة، أقساط، متجر أونلاين، وواتساب تلقائي",
    defaultPrice: 650,
  },
  enterprise: {
    label: "الباقة المؤسسية (مدى الحياة)",
    color: "purple",
    desc: "ترخيص دائم مفتوح بدون اشتراك شهري مع هاردوير ودعم متميز",
    defaultPrice: 7500,
  },
};

// Initial Seed Data for the Super Admin
const SEED_LICENSES: LicenseRecord[] = [
  {
    id: "lic-001",
    key: "SEG-PRO-9842-7719-B31A",
    tier: "pro",
    tierLabel: "باقة برو الاحترافية (سنوي)",
    clientName: "أحمد محمود العوضي",
    clientPhone: "01012345678",
    shopName: "محلات العوضي للملابس والأحذية",
    issueDate: "2026-01-15",
    expiryDate: "2027-01-15",
    status: "active",
    paidAmount: 6000,
    currency: "ج.م",
    billingCycle: "yearly",
    notes: "تم تسليم طابعة فواتير Xprinter مع باقة الأجهزة",
    hardwareIncluded: "طابعة 80mm + قارئ باركود ليزر",
    modules: DEFAULT_MODULES.pro,
  },
  {
    id: "lic-002",
    key: "SEG-ENT-4410-1892-F90C",
    tier: "enterprise",
    tierLabel: "الباقة المؤسسية (مدى الحياة)",
    clientName: "م. طارق عبد العزيز",
    clientPhone: "01122334455",
    shopName: "مجموعة الصفا للأدوات الكهربائية والأجهزة",
    issueDate: "2025-11-01",
    expiryDate: "LIFETIME",
    status: "active",
    paidAmount: 12000,
    currency: "ج.م",
    billingCycle: "lifetime",
    notes: "3 فروع + سيستم أقساط متكامل",
    hardwareIncluded: "2 طابعة باركود استيكر + درج نقدية 5 خانات",
    modules: DEFAULT_MODULES.enterprise,
  },
  {
    id: "lic-003",
    key: "SEG-STA-5521-8890-C20B",
    tier: "starter",
    tierLabel: "الباقة الأساسية (شهري)",
    clientName: "كريم حسن علي",
    clientPhone: "01234567890",
    shopName: "ميني ماركت البركة",
    issueDate: "2026-08-01",
    expiryDate: "2026-09-01",
    status: "active",
    paidAmount: 350,
    currency: "ج.م",
    billingCycle: "monthly",
    notes: "اشتراك شهري متجدد عبر فودافون كاش",
    modules: DEFAULT_MODULES.starter,
  },
  {
    id: "lic-004",
    key: "SEG-TRI-1109-3341-D88A",
    tier: "trial",
    tierLabel: "فترة تجريبية",
    clientName: "مصطفى إبراهيم",
    clientPhone: "01599887766",
    shopName: "بوتيك الأناقة كيدز",
    issueDate: "2026-08-20",
    expiryDate: "2026-09-03",
    status: "trial",
    paidAmount: 0,
    currency: "ج.م",
    billingCycle: "trial",
    notes: "طلب تجربة نظام استيكرات الباركود والمقاسات",
    modules: DEFAULT_MODULES.trial,
  },
  {
    id: "lic-005",
    key: "SEG-STA-9912-4411-E10F",
    tier: "starter",
    tierLabel: "الباقة الأساسية (شهري)",
    clientName: "سامح رفعت",
    clientPhone: "01098765432",
    shopName: "محل النور للإكسسوارات",
    issueDate: "2026-07-15",
    expiryDate: "2026-08-15",
    status: "expired",
    paidAmount: 350,
    currency: "ج.م",
    billingCycle: "monthly",
    notes: "انتهى الاشتراك وجاري التواصل للتجديد السنوي",
    modules: DEFAULT_MODULES.starter,
  },
];

/**
 * Generate a formatted, cryptographically random license key
 */
export function generateLicenseKey(tier: LicenseTier): string {
  const prefixMap: Record<LicenseTier, string> = {
    trial: "SEG-TRI",
    starter: "SEG-STA",
    pro: "SEG-PRO",
    enterprise: "SEG-ENT",
  };

  const rnd = (len = 4) =>
    Math.random()
      .toString(36)
      .substring(2, 2 + len)
      .toUpperCase();

  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefixMap[tier]}-${num}-${rnd(4)}-${rnd(4)}`;
}

/**
 * Get all licenses for Super Admin
 */
export function getAdminLicenses(): LicenseRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN_LICENSES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_ADMIN_LICENSES, JSON.stringify(SEED_LICENSES));
      return SEED_LICENSES;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_LICENSES;
  }
}

/**
 * Save updated admin licenses
 */
export function saveAdminLicenses(licenses: LicenseRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ADMIN_LICENSES, JSON.stringify(licenses));
  } catch (e) {
    console.error("Failed to save admin licenses:", e);
  }
}

/**
 * Get currently active license for this store instance
 */
export function getCurrentLicense(): LicenseRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT_LICENSE);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse current license:", e);
  }

  // Default active trial license for new installations (14 days from now)
  const now = new Date();
  const expiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const defaultLicense: LicenseRecord = {
    id: "current-default",
    key: "SEG-PRO-TRIAL-DEMO-2026",
    tier: "pro",
    tierLabel: "نسخة مرخصة تجارياً (باقة برو)",
    clientName: "المدير العام",
    clientPhone: "01000000000",
    shopName: "متجري التجاري",
    issueDate: now.toISOString().slice(0, 10),
    expiryDate: expiry.toISOString().slice(0, 10),
    status: "active",
    paidAmount: 0,
    currency: "ج.م",
    billingCycle: "yearly",
    modules: DEFAULT_MODULES.pro,
  };

  localStorage.setItem(STORAGE_KEY_CURRENT_LICENSE, JSON.stringify(defaultLicense));
  return defaultLicense;
}

/**
 * Activate a license key on the local instance
 */
export function activateLicenseKey(
  inputKey: string,
  clientDetails?: { name?: string; phone?: string; shopName?: string }
): { success: boolean; message: string; license?: LicenseRecord } {
  const cleanKey = inputKey.trim().toUpperCase();

  if (!cleanKey || cleanKey.length < 12) {
    return { success: false, message: "مفتاح الترخيص غير صالح أو قصير جداً" };
  }

  // Check if exists in admin database
  const all = getAdminLicenses();
  const found = all.find((l) => l.key.toUpperCase() === cleanKey);

  let newLicense: LicenseRecord;

  if (found) {
    newLicense = { ...found, status: "active" };
  } else {
    // Determine tier from prefix
    let tier: LicenseTier = "pro";
    if (cleanKey.startsWith("SEG-TRI")) tier = "trial";
    else if (cleanKey.startsWith("SEG-STA")) tier = "starter";
    else if (cleanKey.startsWith("SEG-ENT")) tier = "enterprise";

    const now = new Date();
    const expiry =
      tier === "enterprise"
        ? "LIFETIME"
        : new Date(now.getTime() + (tier === "trial" ? 14 : 365) * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

    newLicense = {
      id: `lic-${Date.now()}`,
      key: cleanKey,
      tier,
      tierLabel: TIER_CONFIG[tier].label,
      clientName: clientDetails?.name || "العميل المرخص",
      clientPhone: clientDetails?.phone || "—",
      shopName: clientDetails?.shopName || "الفرع الرئيسي",
      issueDate: now.toISOString().slice(0, 10),
      expiryDate: expiry,
      status: "active",
      paidAmount: TIER_CONFIG[tier].defaultPrice,
      currency: "ج.م",
      billingCycle: tier === "enterprise" ? "lifetime" : tier === "starter" ? "monthly" : "yearly",
      modules: DEFAULT_MODULES[tier],
    };

    // Add to all licenses
    saveAdminLicenses([newLicense, ...all]);
  }

  localStorage.setItem(STORAGE_KEY_CURRENT_LICENSE, JSON.stringify(newLicense));
  return {
    success: true,
    message: `تم تفعيل ترخيص (${newLicense.tierLabel}) بنجاح!`,
    license: newLicense,
  };
}

/**
 * Super Admin Pin Helper
 */
export function getSuperAdminPin(): string {
  return localStorage.getItem(STORAGE_KEY_ADMIN_PIN) || "9999";
}

export function setSuperAdminPin(newPin: string): void {
  localStorage.setItem(STORAGE_KEY_ADMIN_PIN, newPin);
}

/**
 * Calculate remaining days
 */
export function calculateDaysRemaining(expiryDate: string): {
  days: number;
  isLifetime: boolean;
  isExpired: boolean;
  isWarning: boolean;
} {
  if (expiryDate === "LIFETIME" || !expiryDate) {
    return { days: 9999, isLifetime: true, isExpired: false, isWarning: false };
  }

  const exp = new Date(expiryDate).getTime();
  const now = new Date().getTime();
  const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

  return {
    days: diffDays,
    isLifetime: false,
    isExpired: diffDays < 0,
    isWarning: diffDays <= 7 && diffDays >= 0,
  };
}

/**
 * Format WhatsApp License Message
 */
export function generateLicenseWhatsAppMessage(lic: LicenseRecord): string {
  const isLife = lic.expiryDate === "LIFETIME";
  return `عناية الأستاذ / ${lic.clientName} المحترم 🌸
تحية طيبة، يسعدنا تسليمكم بيانات ترخيص برنامج *سِجلّي (Segilly POS & ERP)*:

🏪 *بيانات المنشأة:* ${lic.shopName}
🔑 *مفتاح التفعيل (License Key):*
\`${lic.key}\`

📦 *الباقة:* ${lic.tierLabel}
📅 *تاريخ الإصدار:* ${lic.issueDate}
⏳ *تاريخ انتهاء الترخيص:* ${isLife ? "مدى الحياة (دائم)" : lic.expiryDate}
${lic.hardwareIncluded ? `🖨️ *الأجهزة المشمولة:* ${lic.hardwareIncluded}` : ""}

✨ *طريقة التفعيل:*
1. افتح البرنامج ثم ادخل على "الإعدادات" > "الترخيص والاشتراك".
2. الصق مفتاح التفعيل واضغط "تفعيل الترخيص".

لأي استفسار أو دعم فني يسعدنا خدمتكم دائماً! 🌟`;
}

/**
 * Print Official License Certificate
 */
export function printLicenseCertificate(lic: LicenseRecord): void {
  const isLife = lic.expiryDate === "LIFETIME";
  const docHtml = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="utf-8">
  <title>شهادة ترخيص برنامج سِجلّي - ${esc(lic.shopName)}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 24px;
      color: #111;
      background: #fff;
    }
    .cert-border {
      border: 6px double #0d9488;
      border-radius: 20px;
      padding: 30px;
      position: relative;
      background: radial-gradient(circle at center, #f0fdfa 0%, #ffffff 100%);
    }
    .header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 28px; font-weight: 900; color: #0f766e; margin: 6px 0; }
    .sub { font-size: 13px; color: #666; letter-spacing: 2px; }
    .key-box {
      background: #134e4a;
      color: #fff;
      padding: 16px 24px;
      border-radius: 12px;
      text-align: center;
      margin: 20px 0;
    }
    .key-text { font-family: monospace; font-size: 22px; font-weight: bold; letter-spacing: 3px; color: #2dd4bf; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
    .item { background: rgba(255,255,255,0.9); border: 1px solid #ccfbf1; padding: 12px 16px; border-radius: 10px; }
    .item-label { font-size: 11px; color: #666; font-weight: bold; }
    .item-val { font-size: 14px; font-weight: bold; color: #0f766e; margin-top: 4px; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #0d9488; padding-top: 16px; }
    .stamp { border: 2px dashed #0d9488; border-radius: 50%; width: 90px; height: 90px; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 10px; font-weight: bold; color: #0d9488; }
  </style>
</head>
<body>
  <div class="cert-border">
    <div class="header">
      <div class="sub">SEGILLY POS & ERP COMMERCIAL LICENSE</div>
      <div class="title">شهادة ترخيص تجاري معتمد</div>
      <div style="font-size: 14px; color: #333;">تشهد إدارة النظام بأن المنشأة الموضحة أدناه تمتلك ترخيصاً رسمياً لاستخدام المنظومة</div>
    </div>

    <div class="key-box">
      <div style="font-size: 12px; opacity: 0.85; margin-bottom: 4px;">مفتاح التفعيل الرسمي (License Key)</div>
      <div class="key-text">${esc(lic.key)}</div>
    </div>

    <div class="grid">
      <div class="item">
        <div class="item-label">اسم المنشأة / المتجر:</div>
        <div class="item-val">${esc(lic.shopName)}</div>
      </div>
      <div class="item">
        <div class="item-label">اسم العميل المسؤول:</div>
        <div class="item-val">${esc(lic.clientName)} (${esc(lic.clientPhone)})</div>
      </div>
      <div class="item">
        <div class="item-label">نوع الباقة المرخصة:</div>
        <div class="item-val">${esc(lic.tierLabel)}</div>
      </div>
      <div class="item">
        <div class="item-label">صلاحية الترخيص:</div>
        <div class="item-val">${isLife ? "مدى الحياة (ترخيص دائم)" : `حتى ${esc(lic.expiryDate)}`}</div>
      </div>
      <div class="item">
        <div class="item-label">عدد الفروع المسموح بها:</div>
        <div class="item-val">${lic.modules.maxBranches} فرع</div>
      </div>
      <div class="item">
        <div class="item-label">الموديولات المفعلة:</div>
        <div class="item-val" style="font-size: 11px;">
          ${[
            lic.modules.allowPos && "نقاط البيع السريعة",
            lic.modules.allowWarehouse && "إدارة المخازن والباركود",
            lic.modules.allowInstallments && "نظام الأقساط والديون",
            lic.modules.allowStorefront && "المتجر الإلكتروني",
            lic.modules.allowWhatsApp && "واتساب الذكي",
          ]
            .filter(Boolean)
            .join(" • ")}
        </div>
      </div>
    </div>

    ${
      lic.hardwareIncluded
        ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 16px; border-radius: 8px; font-size: 12px; margin-bottom: 16px;">
        <strong>الأجهزة الموردة مع الترخيص:</strong> ${esc(lic.hardwareIncluded)}
      </div>`
        : ""
    }

    <div class="footer">
      <div>
        <div style="font-size: 11px; color: #666;">تاريخ الإصدار: ${esc(lic.issueDate)}</div>
        <div style="font-size: 10px; color: #999; margin-top: 2px;">رقم السجل: ${esc(lic.id)}</div>
      </div>
      <div class="stamp">
        معتمد رسمياً<br>Segilly POS
      </div>
      <div style="text-align: left;">
        <div style="font-size: 12px; font-weight: bold; color: #0f766e;">إدارة التراخيص والدعم الفني</div>
        <div style="font-size: 10px; color: #666;">سِجلّي لإدارة الأنشطة التجارية</div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

  openPdfDocument(docHtml, { autoPrint: true, features: "width=800,height=900" });
}

/**
 * Export all clients and licenses to Excel
 */
export function exportLicensesToExcel(licenses: LicenseRecord[]): void {
  const data = licenses.map((l) => ({
    "رقم الترخيص": l.id,
    "اسم المتجر": l.shopName,
    "اسم العميل": l.clientName,
    "رقم الهاتف": l.clientPhone,
    "الباقة": l.tierLabel,
    "مفتاح التفعيل": l.key,
    "تاريخ الإصدار": l.issueDate,
    "تاريخ الانتهاء": l.expiryDate,
    "الحالة":
      l.status === "active"
        ? "ساري"
        : l.status === "trial"
        ? "تجريبي"
        : l.status === "expired"
        ? "منتهي"
        : "موقوف",
    "المبلغ المدفوع": l.paidAmount,
    "الأجهزة الموردة": l.hardwareIncluded || "—",
    "ملاحظات": l.notes || "—",
  }));

  exportToExcel(
    [{ sheetName: "سجل_التراخيص_والمشتركين", data }],
    `تراخيص_عملاء_سجلي_${new Date().toISOString().slice(0, 10)}`
  );
}

/**
 * React Hook to access current active license
 */
export function useCurrentLicense() {
  const [license, setLicense] = useState<LicenseRecord>(getCurrentLicense);

  const refresh = () => {
    setLicense(getCurrentLicense());
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_CURRENT_LICENSE) {
        refresh();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return { license, refresh };
}
