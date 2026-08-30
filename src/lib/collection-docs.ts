import { esc, openPdfDocument, pdfCss, pdfFontLink } from "./pdf-doc";
import { code39Svg } from "./shipping-docs";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export interface DemandLetterData {
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerNationalId?: string | null;
  totalBalance: number;
  overdueAmount: number;
  daysLate: number;
  invoices: Array<{
    invoiceNo: string;
    date: string;
    dueDate?: string;
    total: number;
    paid: number;
    remaining: number;
    daysLate: number;
  }>;
  shopName?: string;
  shopPhone?: string;
  shopAddress?: string;
  taxNumber?: string;
  paymentChannels?: {
    instaPay?: string;
    vodafoneCash?: string;
    bankAccount?: string;
  };
  deadlineDays?: number;
}

export interface CollectorSheetItem {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  invoiceNo: string;
  dueDate: string;
  daysLate: number;
  remainingAmount: number;
  totalCustomerBalance: number;
  lastPromiseDate?: string | null;
  statusSeverity: "soon" | "due" | "minor" | "moderate" | "critical";
}

const egp = (n: number) =>
  new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
    Math.round(n || 0)
  );

/**
 * 1. طباعة خطاب مطالبة وإنذار مالي رسمي A4 للعميل
 */
export function printDemandLetterA4(data: DemandLetterData) {
  const shop = data.shopName || "سِجلّي لإدارة الحسابات";
  const dateStr = format(new Date(), "yyyy/MM/dd");
  const deadlineDays = data.deadlineDays || 7;
  const barcode = code39Svg(`DEMAND-${data.customerPhone?.replace(/\D/g, "").slice(-8) || "0000"}`, { height: 36 });

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>خطاب مطالبة مالية رسمية — ${esc(data.customerName)}</title>
  ${pdfFontLink}
  <style>
    ${pdfCss}
    .letter-body {
      font-size: 13px;
      line-height: 1.8;
      color: #1e293b;
      margin: 20px 0;
    }
    .callout-box {
      background: #fef2f2;
      border: 1.5px solid #f87171;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 18px 0;
      color: #991b1b;
    }
    .payment-box {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 12px;
      padding: 14px 18px;
      margin: 18px 0;
      color: #166534;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 11.5px;
    }
    .table-custom th {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      font-weight: 800;
      text-align: right;
    }
    .table-custom td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <!-- Header -->
    <div class="doc-head">
      <div class="doc-id">
        <div>
          <div class="brand">${esc(shop)}</div>
          <div class="brand-sub">إدارة المتابعة والتحصيل المالي · ${esc(data.shopAddress || "المركز الرئيسي")}</div>
        </div>
      </div>
      <div class="doc-meta">
        <div>التاريخ: <b>${dateStr}</b></div>
        <div>رقم الإخطار: <b style="font-family: monospace;">NOTIF-${Math.floor(100000 + Math.random() * 900000)}</b></div>
        <div>هاتف الإدارة: <b>${esc(data.shopPhone || "-")}</b></div>
      </div>
    </div>

    <!-- Target Customer Header -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 18px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 11px; color: #64748b; font-weight: bold;">السيد / السيدة المحترمة:</div>
        <div style="font-size: 17px; font-weight: 900; color: #0f172a;">${esc(data.customerName)}</div>
        <div style="font-size: 11.5px; color: #475569; margin-top: 2px;">
          الهاتف: <b dir="ltr">${esc(data.customerPhone || "-")}</b>
          ${data.customerAddress ? ` · العنوان: <b>${esc(data.customerAddress)}</b>` : ""}
          ${data.customerNationalId ? ` · الرقم القومي: <b>${esc(data.customerNationalId)}</b>` : ""}
        </div>
      </div>
      <div style="text-align: left;">
        <div style="font-size: 11px; color: #be123c; font-weight: bold;">إجمالي المستحق المطلوب سداده</div>
        <div style="font-size: 24px; font-weight: 900; color: #be123c; font-family: 'Cairo', sans-serif;">
          ${egp(data.overdueAmount || data.totalBalance)} <span style="font-size: 12px; font-weight: normal;">ج.م</span>
        </div>
      </div>
    </div>

    <!-- Letter Body -->
    <div class="letter-body">
      <p style="margin-top: 12px;">
        تحية طيبة وبعد،،،<br>
        نحيطكم علماً بأنه بمراجعة حساباتكم طرفنا، تبيّن وجود أقساط ومبالغ مستحقة السداد متأخرة عن موعدها المحدد منذ <b>${data.daysLate} يوماً</b>، ولم يتم تسويتها حتى تاريخ تحرير هذا الخطاب.
      </p>

      <!-- Invoices Breakdown Table -->
      <table class="table-custom">
        <thead>
          <tr>
            <th>#</th>
            <th>رقم الفاتورة / القسط</th>
            <th>تاريخ المعاملة</th>
            <th>تاريخ الاستحقاق</th>
            <th>أيام التأخر</th>
            <th style="text-align: left;">إجمالي الفاتورة</th>
            <th style="text-align: left;">المدفوع</th>
            <th style="text-align: left;">المتبقي المستحق</th>
          </tr>
        </thead>
        <tbody>
          ${data.invoices
            .map(
              (inv, i) => `
            <tr>
              <td>${i + 1}</td>
              <td style="font-weight: bold; font-family: monospace;">#${esc(inv.invoiceNo)}</td>
              <td>${esc(inv.date)}</td>
              <td>${esc(inv.dueDate || "-")}</td>
              <td style="font-weight: bold; color: ${inv.daysLate > 0 ? "#dc2626" : "#059669"};">
                ${inv.daysLate > 0 ? `${inv.daysLate} يوم متأخر` : "مستحق اليوم"}
              </td>
              <td style="text-align: left;">${egp(inv.total)} ج.م</td>
              <td style="text-align: left; color: #059669;">${egp(inv.paid)} ج.م</td>
              <td style="text-align: left; font-weight: 800; color: #dc2626;">${egp(inv.remaining)} ج.م</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
        <tfoot>
          <tr style="background: #f8fafc; font-weight: 900;">
            <td colspan="7" style="text-align: right; padding: 10px;">إجمالي المبالغ المستحقة المطلوبة فوراً:</td>
            <td style="text-align: left; font-size: 14px; color: #dc2626; padding: 10px;">${egp(data.overdueAmount || data.totalBalance)} ج.م</td>
          </tr>
        </tfoot>
      </table>

      <!-- Warning Box -->
      <div class="callout-box">
        <div style="font-weight: 900; font-size: 13.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
          ⚠️ مهلة وإشعار بالسداد:
        </div>
        <div>
          يُرجى التكرم بسرعة المبادرة بسداد المبلغ المذكور أعلاه في موعد أقصاه <b>(${deadlineDays}) أيام عمل</b> من تاريخ استلام هذا الإشعار، وذلك لتفادي تراكم الفوائد أو اتخاذ الإجراءات الإدارية والقانونية وحظر التعامل الائتماني.
        </div>
      </div>

      <!-- Payment Channels Box -->
      <div class="payment-box">
        <div style="font-weight: 800; font-size: 12px; margin-bottom: 6px;">💳 قنوات وطرق السداد المعتمدة والمتاحة:</div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 11px;">
          <div>• سداد نقدي بالخزينة: <b>مقر المحل / المتجر</b></div>
          <div>• تحويل إنستاباي (InstaPay): <b>${esc(data.paymentChannels?.instaPay || data.shopPhone || "متاح بالطلب")}</b></div>
          <div>• محفظة فودافون كاش: <b>${esc(data.paymentChannels?.vodafoneCash || data.shopPhone || "متاح")}</b></div>
        </div>
      </div>
    </div>

    <!-- Signatures -->
    <div style="margin-top: 36px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
      <div style="text-align: center; width: 220px;">
        <div style="font-size: 11px; color: #64748b; font-weight: bold;">توقيع / استلام العميل</div>
        <div style="height: 48px;"></div>
        <div style="font-size: 11px; color: #334155; border-top: 1px solid #cbd5e1; padding-top: 4px;">الاسم: .......................................</div>
      </div>

      <div style="text-align: center;">
        <div style="margin-bottom: 6px;">${barcode}</div>
        <div style="font-size: 9px; color: #94a3b8; font-family: monospace;">OFFICIAL DEMAND NOTICE</div>
      </div>

      <div style="text-align: center; width: 220px;">
        <div style="font-size: 11px; color: #64748b; font-weight: bold;">ختم واعتماد الإدارة المالية</div>
        <div style="height: 48px; display: flex; align-items: center; justify-content: center;">
          <div style="border: 2px dashed #94a3b8; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #94a3b8; font-weight: bold;">
            ختم المتجر
          </div>
        </div>
        <div style="font-size: 11px; color: #334155; border-top: 1px solid #cbd5e1; padding-top: 4px;">${esc(shop)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  openPdfDocument(html);
}

/**
 * 2. طباعة كشف خطة تحصيل ميداني للمحصلين (Collector Run Sheet A4)
 */
export function printCollectorSheetA4(
  items: CollectorSheetItem[],
  shopName: string = "سِجلّي",
  shopPhone: string = ""
) {
  const dateStr = format(new Date(), "yyyy/MM/dd");
  const totalAmount = items.reduce((sum, it) => sum + it.remainingAmount, 0);

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>كشف خطة التحصيل الميداني — ${dateStr}</title>
  ${pdfFontLink}
  <style>
    ${pdfCss}
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
    th { background: #f1f5f9; padding: 8px 6px; border: 1px solid #cbd5e1; font-weight: 800; text-align: right; }
    td { padding: 7px 6px; border: 1px solid #e2e8f0; vertical-align: middle; }
    .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 10px; text-align: center; }
  </style>
</head>
<body>
  <div class="sheet">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
      <div>
        <h2 style="font-size: 18px; font-weight: 900; margin: 0;">${esc(shopName)} — كشف خطة التحصيل الميداني والزيارات</h2>
        <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
          تاريخ الكشف: <b>${dateStr}</b> · هاتف الإدارة: <b>${esc(shopPhone || "-")}</b>
        </div>
      </div>
      <div style="text-align: left;">
        <div style="font-size: 11px; color: #64748b;">اسم المحصل الميداني:</div>
        <div style="font-size: 13px; font-weight: bold;">................................................</div>
      </div>
    </div>

    <div class="kpi-row">
      <div class="kpi-card" style="border-color: #be123c; background: #fff1f2;">
        <span style="color: #9f1239; font-size: 11px; font-weight: bold;">عدد العملاء في الكشف</span>
        <b style="color: #be123c; font-size: 16px; display: block; font-family: 'Cairo', sans-serif;">${items.length} عميل</b>
      </div>
      <div class="kpi-card" style="border-color: #059669; background: #ecfdf5;">
        <span style="color: #047857; font-size: 11px; font-weight: bold;">إجمالي المستهدف تحصيله</span>
        <b style="color: #059669; font-size: 16px; display: block; font-family: 'Cairo', sans-serif;">${egp(totalAmount)} ج.م</b>
      </div>
      <div class="kpi-card" style="border-color: #3b82f6; background: #eff6ff;">
        <span style="color: #1d4ed8; font-size: 11px; font-weight: bold;">تاريخ الطباعة</span>
        <b style="color: #1e40af; font-size: 14px; display: block;">${format(new Date(), "HH:mm dd/MM")}</b>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 25px;">#</th>
          <th>اسم العميل</th>
          <th>رقم الهاتف</th>
          <th>العنوان / المنطقة</th>
          <th>الفاتورة</th>
          <th>التأخر</th>
          <th style="text-align: left;">المبلغ المستحق</th>
          <th style="width: 140px;">نتيجة الزيارة والملاحظات</th>
          <th style="width: 80px;">المبلغ المحصل</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (it, i) => `
          <tr>
            <td>${i + 1}</td>
            <td style="font-weight: bold;">${esc(it.customerName)}</td>
            <td dir="ltr" style="font-family: monospace; font-size: 10px;">${esc(it.customerPhone || "-")}</td>
            <td style="font-size: 10px; color: #475569;">${esc(it.customerAddress || "غير محدد")}</td>
            <td style="font-family: monospace; font-size: 10px;">#${esc(it.invoiceNo)}</td>
            <td style="font-weight: bold; color: ${it.daysLate > 30 ? "#dc2626" : it.daysLate > 0 ? "#d97706" : "#059669"};">
              ${it.daysLate > 0 ? `${it.daysLate} يوم` : "اليوم"}
            </td>
            <td style="text-align: left; font-weight: 800; color: #dc2626;">${egp(it.remainingAmount)} ج.م</td>
            <td style="border-bottom: 1px dotted #94a3b8;"></td>
            <td style="border-bottom: 1px dotted #94a3b8;"></td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
      <div>توقيع المحصل الميداني: ...............................</div>
      <div>المراجع المالي: ...............................</div>
      <div>استلام الخزينة: ...............................</div>
    </div>
  </div>
</body>
</html>`;

  openPdfDocument(html);
}

/**
 * 3. توليد نصوص التذكيرات الذكية ورسائل الواتساب المتنوعة
 */
export type SmartReminderTone = "friendly" | "formal" | "final_warning" | "promise_reminder" | "instant_pay";

export interface SmartReminderParams {
  tone: SmartReminderTone;
  customerName: string;
  amount: number;
  totalBalance: number;
  daysLate: number;
  invoiceNo: string;
  shopName: string;
  paymentChannels?: {
    instaPay?: string;
    vodafoneCash?: string;
  };
  promiseDate?: string;
}

export function generateSmartReminderText(p: SmartReminderParams): string {
  const shop = p.shopName || "سِجلّي";
  const numAmt = egp(p.amount);
  const numBal = egp(p.totalBalance);

  switch (p.tone) {
    case "friendly":
      return `أهلاً بحضرتك يا أستاذ ${p.customerName} 🌿\nتحية طيبة من ${shop}.\nبنفكرك بود بموعد قسطك بقيمة *${numAmt} ج.م*${p.daysLate > 0 ? ` (متأخر ${p.daysLate} يوم)` : ` المستحق اليوم`} الخاص بفاتورة رقم #${p.invoiceNo}.\nلو في أي ظرف أو استفسار إحنا دايماً في خدمتك. شكراً لذوقك وتعاونك معانا! 🙏`;

    case "formal":
      return `السيد/ ${p.customerName} المحترم،\nتحية طيبة من إدارة ${shop}.\nنود إحاطة سيادتكم علماً بأن القسط المستحق عليكم بقيمة *${numAmt} ج.م* ${p.daysLate > 0 ? `متأخر السداد منذ ${p.daysLate} يوماً` : `مستحق السداد اليوم`}، وإجمالي الحساب المستحق *${numBal} ج.م*.\nنرجو التكرم بسرعة سداد المبلغ لتحديث الحساب وتجنب تراكم المديونية.\nشاكرين حسن تعاونكم.`;

    case "final_warning":
      return `⚠️ *إنذار مالي نهائي وإشعار بالسداد*\nالسيد/ ${p.customerName}،\nنحيطكم علماً بوجود مديونية متأخرة طرفنا بقيمة *${numAmt} ج.م* عن فاتورة رقم #${p.invoiceNo} متأخرة منذ *${p.daysLate} يوماً*، وإجمالي الرصيد *${numBal} ج.م*.\nنمنحكم مهلة نهائية قدرها (7) أيام من تاريخه لتسوية الحساب، وإلا سنضطر آسفين لاتخاذ كافة الإجراءات القانونية والإدارية اللازمة لحفظ حقوقنا.\nإدارة ${shop}`;

    case "promise_reminder":
      return `عزيزي الأستاذ ${p.customerName}،\nتحية طيبة من ${shop}.\nبناءً على تواصلنا السابق ووعدكم الكريم بالسداد بتاريخ *${p.promiseDate || "اليوم"}* لقسط بقيمة *${numAmt} ج.م*، نرجو تأكيد التحويل في الموعد المتفق عليه.\nشاكرين التزامكم الدائم! 🤝`;

    case "instant_pay": {
      let channelsText = "";
      if (p.paymentChannels?.instaPay) {
        channelsText += `\n⚡ *إنستاباي (InstaPay):* \`${p.paymentChannels.instaPay}\``;
      }
      if (p.paymentChannels?.vodafoneCash) {
        channelsText += `\n📱 *محفظة كاش:* \`${p.paymentChannels.vodafoneCash}\``;
      }
      if (!channelsText) {
        channelsText = `\n💵 متاح السداد نقداً بالفرع أو عبر إنستاباي والمحافظ الإلكترونية.`;
      }

      return `مرحباً أستاذ ${p.customerName}،\nلتسهيل سداد قسطك بقيمة *${numAmt} ج.م* (${shop})، يمكنك التحويل الفوري الآن عبر الطرق التالية:${channelsText}\nبعد التحويل يرجى إرسال صورة الإيصال لتأكيد وقيد السداد فوراً. شكراً لك! ✨`;
    }
  }
}
