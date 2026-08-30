import { esc, openPdfDocument, pdfCss, pdfFontLink } from "./pdf-doc";
import { code39Svg } from "./shipping-docs";
import { tafqeetCurrency } from "./tafqeet";
import * as XLSX from "xlsx";

export interface PaymentVoucherPrintData {
  voucherNo: string;
  type: "receipt" | "payment";
  category: "customer" | "supplier" | "carrier" | "expense" | "custody_partner" | "general";
  categoryLabel?: string;
  partyName: string;
  partyPhone?: string | null;
  amount: number;
  paymentMethod: string;
  paymentMethodDetails?: {
    referenceNo?: string;
    walletPhone?: string;
    bankName?: string;
    bankAccount?: string;
    chequeNumber?: string;
    chequeDueDate?: string;
    chequeStatus?: string;
  };
  voucherDate: string;
  description?: string | null;
  allocations?: Array<{
    title: string;
    amount: number;
    remaining?: number;
  }>;
  previousBalance?: number;
  currentBalance?: number;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
}

const egp = (n: number) =>
  new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
    Math.round(n || 0)
  );

/**
 * 1. طباعة سند قبض / صرف A4 رسمي احترافي بالتفقيط والترويسة
 */
export function printPaymentVoucherA4(data: PaymentVoucherPrintData) {
  const isReceipt = data.type === "receipt";
  const title = isReceipt ? "سند قبض نقدية وتحصيل" : "سند صرف نقدية ومدفوعات";
  const titleEn = isReceipt ? "OFFICIAL RECEIPT VOUCHER" : "OFFICIAL PAYMENT VOUCHER";
  const accentColor = isReceipt ? "#059669" : "#dc2626";
  const accentBg = isReceipt ? "#ecfdf5" : "#fef2f2";
  const barcode = code39Svg(data.voucherNo.replace(/[^0-9A-Z]/gi, "") || "VOUCHER", { height: 42 });
  const tafqeet = tafqeetCurrency(data.amount, "جنيه مصري", "قرش");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${esc(title)} — #${esc(data.voucherNo)}</title>
  ${pdfFontLink}
  <style>
    ${pdfCss}
    .sheet {
      max-width: 850px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      padding: 32px;
      border-radius: 16px;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 24px;
    }
    .badge-type {
      display: inline-block;
      padding: 8px 24px;
      background: ${accentBg};
      color: ${accentColor};
      border: 2px solid ${accentColor};
      border-radius: 12px;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .amount-hero {
      background: #f8fafc;
      border: 2px dashed ${accentColor};
      border-radius: 14px;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 20px 0;
    }
    .amount-val {
      font-size: 26px;
      font-weight: 900;
      color: ${accentColor};
      font-family: 'Cairo', sans-serif;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .info-cell {
      background: #fafafa;
      border: 1px solid #edf2f7;
      padding: 12px 16px;
      border-radius: 10px;
    }
    .info-cell label {
      display: block;
      font-size: 11px;
      color: #64748b;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .info-cell span {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .tafqeet-box {
      background: #fff;
      border: 1px solid #e2e8f0;
      padding: 14px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 20px;
      line-height: 1.7;
    }
    .signatures-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
    .sign-box {
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      padding: 12px;
      min-height: 75px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sign-box label {
      font-size: 11.5px;
      font-weight: 700;
      color: #475569;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { border: none; box-shadow: none; padding: 10px; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <!-- Header -->
    <div class="header-box">
      <div>
        <div style="font-size: 22px; font-weight: 900; color: #0f172a; font-family: 'Cairo', sans-serif;">
          ${esc(data.storeName || "سِجلّي — إدارة المبيعات والأقساط")}
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
          ${esc(data.storeAddress || "نظام الفواتير والحسابات الذكي")} · هاتف: ${esc(data.storePhone || "201066830834")}
        </div>
      </div>

      <div style="text-align: left;">
        <div class="badge-type">${esc(title)}</div>
        <div style="font-size: 9.5px; color: #94a3b8; font-weight: 600; margin-top: 4px;">${titleEn}</div>
      </div>
    </div>

    <!-- Metadata & Barcode -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px;">
      <div>
        <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
          رقم السند: <span style="font-family: monospace; color: ${accentColor}; font-size: 15px;">#${esc(data.voucherNo)}</span>
        </div>
        <div style="font-size: 11.5px; color: #64748b; margin-top: 3px;">
          تاريخ السند: <b>${esc(data.voucherDate)}</b>
        </div>
      </div>
      <div>
        ${barcode}
      </div>
    </div>

    <!-- Hero Amount Box -->
    <div class="amount-hero">
      <div>
        <span style="font-size: 12px; color: #64748b; font-weight: 700; display: block;">المبلغ المسجل:</span>
        <span class="amount-val">${egp(data.amount)} <span style="font-size: 14px; font-weight: normal;">ج.م</span></span>
      </div>
      <div style="text-align: left;">
        <span style="font-size: 11px; color: #64748b; display: block;">طريقة السداد:</span>
        <span style="font-size: 13.5px; font-weight: 800; color: #0f172a;">${esc(data.paymentMethod)}</span>
      </div>
    </div>

    <!-- Tafqeet -->
    <div class="tafqeet-box">
      <b>المبلغ بالحروف:</b> ${esc(tafqeet)}
    </div>

    <!-- Party Details -->
    <div class="info-grid">
      <div class="info-cell">
        <label>${isReceipt ? "استلمنا من السيد / الجهة:" : "صرفنا إلى السيد / الجهة:"}</label>
        <span>${esc(data.partyName)}</span>
        ${data.partyPhone ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">هاتف: ${esc(data.partyPhone)}</div>` : ""}
      </div>

      <div class="info-cell">
        <label>تصنيف الجهة:</label>
        <span>${esc(data.categoryLabel || "حساب تجاري")}</span>
      </div>
    </div>

    <!-- Payment details breakdown if electronic/cheque -->
    ${
      data.paymentMethodDetails && Object.values(data.paymentMethodDetails).some(Boolean)
        ? `
      <div class="info-cell" style="margin-bottom: 20px; background: #f0fdf4; border-color: #bbf7d0;">
        <label style="color: #166534;">تفاصيل وسيلة الدفع والتحويل:</label>
        <div style="font-size: 12px; color: #14532d; font-weight: 600; display: flex; flex-wrap: wrap; gap: 16px; margin-top: 4px;">
          ${data.paymentMethodDetails.referenceNo ? `<span>رقم المرجع / العملية: <b>${esc(data.paymentMethodDetails.referenceNo)}</b></span>` : ""}
          ${data.paymentMethodDetails.walletPhone ? `<span>رقم المحفظة: <b>${esc(data.paymentMethodDetails.walletPhone)}</b></span>` : ""}
          ${data.paymentMethodDetails.bankName ? `<span>البنك: <b>${esc(data.paymentMethodDetails.bankName)}</b></span>` : ""}
          ${data.paymentMethodDetails.bankAccount ? `<span>رقم الحساب: <b>${esc(data.paymentMethodDetails.bankAccount)}</b></span>` : ""}
          ${data.paymentMethodDetails.chequeNumber ? `<span>رقم الشيك: <b>${esc(data.paymentMethodDetails.chequeNumber)}</b></span>` : ""}
          ${data.paymentMethodDetails.chequeDueDate ? `<span>استحقاق الشيك: <b>${esc(data.paymentMethodDetails.chequeDueDate)}</b></span>` : ""}
          ${data.paymentMethodDetails.chequeStatus ? `<span>حالة الشيك: <b>${esc(data.paymentMethodDetails.chequeStatus)}</b></span>` : ""}
        </div>
      </div>
    `
        : ""
    }

    <!-- Statement / Description -->
    <div class="info-cell" style="margin-bottom: 20px;">
      <label>وذلك عن (البيان والغرض):</label>
      <span>${esc(data.description || (isReceipt ? "سداد دفعة نقدية / تسوية حساب" : "صرف نقدية / تسوية مستحقات"))}</span>
    </div>

    <!-- Allocations / Installments Table if any -->
    ${
      data.allocations && data.allocations.length > 0
        ? `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px;">تفصيل تسوية الفواتير / الأقساط:</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: right;">
              <th style="padding: 6px 10px; border: 1px solid #e2e8f0;">البيان / الفاتورة</th>
              <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">المبلغ المسدد</th>
              ${data.allocations[0]?.remaining !== undefined ? `<th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">المتبقي</th>` : ""}
            </tr>
          </thead>
          <tbody>
            ${data.allocations
              .map(
                (a) => `
              <tr>
                <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">${esc(a.title)}</td>
                <td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left; font-weight: 700; color: ${accentColor};">${egp(a.amount)} ج.م</td>
                ${a.remaining !== undefined ? `<td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">${egp(a.remaining)} ج.م</td>` : ""}
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
        : ""
    }

    <!-- Balances Summary if available -->
    ${
      data.currentBalance !== undefined
        ? `
      <div style="display: flex; justify-content: flex-end; gap: 20px; font-size: 11.5px; margin-bottom: 20px; padding: 10px 16px; background: #f8fafc; border-radius: 8px;">
        ${data.previousBalance !== undefined ? `<div>الرصيد السابق: <b>${egp(data.previousBalance)} ج.م</b></div>` : ""}
        <div>الرصيد المتبقي بعد السند: <b style="color: ${accentColor}; font-size: 12.5px;">${egp(data.currentBalance)} ج.م</b></div>
      </div>
    `
        : ""
    }

    <!-- Signatures -->
    <div class="signatures-row">
      <div class="sign-box">
        <label>توقيع المستلم</label>
        <span style="font-size: 10px; color: #94a3b8;">...................................</span>
      </div>
      <div class="sign-box">
        <label>أمين الخزينة / المحاسب</label>
        <span style="font-size: 10px; color: #94a3b8;">...................................</span>
      </div>
      <div class="sign-box">
        <label>اعتماد الإدارة</label>
        <span style="font-size: 10px; color: #94a3b8;">ختم واعتماد</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  openPdfDocument(html);
}

/**
 * 2. طباعة إيصال حراري POS 80mm لطابعات الفواتير الصغيرة
 */
export function printPaymentVoucherThermal80(data: PaymentVoucherPrintData) {
  const isReceipt = data.type === "receipt";
  const title = isReceipt ? "إيصال استلام نقدية" : "إيصال صرف نقدية";
  const tafqeet = tafqeetCurrency(data.amount, "جنيه", "قرش");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${esc(title)} — #${esc(data.voucherNo)}</title>
  ${pdfFontLink}
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif;
      font-size: 12px;
      color: #000;
      background: #fff;
      padding: 10px 4px;
      width: 78mm;
      margin: 0 auto;
    }
    .center { text-align: center; }
    .bold { font-weight: 800; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px; }
    .hero-amt { font-size: 18px; font-weight: 900; margin: 6px 0; text-align: center; border: 1px solid #000; padding: 6px; border-radius: 4px; }
    @media print {
      body { width: 100%; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="center bold" style="font-size: 15px;">${esc(data.storeName || "سِجلّي")}</div>
  <div class="center" style="font-size: 10px;">${esc(data.storePhone || "خدمة العملاء: 201066830834")}</div>
  <div class="divider"></div>

  <div class="center bold" style="font-size: 13px;">${esc(title)}</div>
  <div class="center" style="font-size: 10px;">رقم: #${esc(data.voucherNo)} · ${esc(data.voucherDate)}</div>

  <div class="hero-amt">
    ${egp(data.amount)} ج.م
  </div>

  <div class="center" style="font-size: 9.5px; margin-bottom: 6px;">
    ${esc(tafqeet)}
  </div>

  <div class="divider"></div>

  <div class="row">
    <span>الطرف:</span>
    <span class="bold">${esc(data.partyName)}</span>
  </div>
  ${data.partyPhone ? `<div class="row"><span>الموبايل:</span><span>${esc(data.partyPhone)}</span></div>` : ""}
  <div class="row">
    <span>طريقة الدفع:</span>
    <span class="bold">${esc(data.paymentMethod)}</span>
  </div>
  ${
    data.paymentMethodDetails?.referenceNo
      ? `<div class="row"><span>رقم العملية:</span><span class="bold">${esc(data.paymentMethodDetails.referenceNo)}</span></div>`
      : ""
  }

  ${
    data.description
      ? `
    <div class="divider"></div>
    <div style="font-size: 10px; line-height: 1.4;">
      <b>البيان:</b> ${esc(data.description)}
    </div>
  `
      : ""
  }

  ${
    data.currentBalance !== undefined
      ? `
    <div class="divider"></div>
    <div class="row bold">
      <span>المتبقي في الحساب:</span>
      <span>${egp(data.currentBalance)} ج.م</span>
    </div>
  `
      : ""
  }

  <div class="divider"></div>
  <div class="center" style="font-size: 9px; margin-top: 8px;">
    شكراً لتعاملكم معنا 🙏<br>
    سِجلّي — سجل أعمالك بدقة
  </div>
</body>
</html>`;

  openPdfDocument(html);
}

/**
 * 3. إنشاء رسالة WhatsApp جاهزة ومنسقة للسند
 */
export function generatePaymentWhatsAppText(data: PaymentVoucherPrintData): string {
  const isReceipt = data.type === "receipt";
  const title = isReceipt ? "إشعار استلام وسند قبض نقدية" : "إشعار صرف وسند نقدية";
  const date = data.voucherDate;

  return `🧾 *${title}*
رقم السند: #${data.voucherNo}
التاريخ: ${date}

👤 *الجهة:* ${data.partyName}
💵 *المبلغ المسجل:* ${egp(data.amount)} ج.م
💳 *طريقة الدفع:* ${data.paymentMethod}${
    data.paymentMethodDetails?.referenceNo ? `\n🔢 *رقم العملية:* ${data.paymentMethodDetails.referenceNo}` : ""
  }
📝 *البيان:* ${data.description || "سداد دفعة نقدية / تسوية حساب"}${
    data.currentBalance !== undefined ? `\n💰 *الرصيد المتبقي بعد السند:* ${egp(data.currentBalance)} ج.م` : ""
  }

_نشكركم لثقتكم وتعاملكم معنا_ 🙏
*${data.storeName || "سِجلّي — إدارة الحسابات والمدفوعات"}*`;
}

/**
 * 4. تصدير كشف السندات الكامل إلى ملف Excel (XLSX)
 */
export function exportPaymentsToExcel(
  vouchers: any[],
  partyLookup: {
    customers: Map<string, any>;
    suppliers: Map<string, any>;
    carriers: Map<string, any>;
  },
  filename = "كشف_سندات_القبض_والصرف.xlsx"
) {
  const rows = vouchers.map((v, index) => {
    let partyName = "-";
    let partyType = "عام / أخرى";
    let phone = "-";

    if (v.customerId) {
      const c = partyLookup.customers.get(v.customerId);
      partyName = c?.name || "عميل";
      partyType = "عميل";
      phone = c?.phone || "-";
    } else if (v.supplierId) {
      const s = partyLookup.suppliers.get(v.supplierId);
      partyName = s?.name || "مورد";
      partyType = "مورد";
      phone = s?.phone || "-";
    } else if (v.carrierId) {
      const cr = partyLookup.carriers.get(v.carrierId);
      partyName = cr?.name || "مندوب شحن";
      partyType = "مندوب شحن";
      phone = cr?.phone || "-";
    } else if (v.category) {
      partyName = v.partyName || v.category;
      partyType = v.category;
    }

    return {
      "م": index + 1,
      "رقم السند": v.id ? v.id.slice(0, 8) : "-",
      "التاريخ": v.voucherDate || v.createdAt?.slice(0, 10) || "-",
      "نوع السند": v.type === "receipt" ? "قبض (تحصيل)" : "صرف (مدفوعات)",
      "المبلغ (ج.م)": Number(v.amount || 0),
      "الجهة": partyName,
      "نوع الجهة": partyType,
      "رقم الهاتف": phone,
      "طريقة الدفع": v.paymentMethod || "نقدي",
      "البيان والتفاصيل": v.description || "-",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto column widths
  ws["!cols"] = [
    { wch: 4 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "سندات القبض والصرف");
  XLSX.writeFile(wb, filename);
}
