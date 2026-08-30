import {
  pdfDocument,
  openPdfDocument,
  PdfMeta,
  PdfKpi,
  esc,
  arabicDigitsScript,
} from "@/lib/pdf-doc";
import { fmt } from "@/lib/store";

export interface ExecutiveReportData {
  timeRangeLabel: string;
  generatedAt: Date;
  // Treasury & Debts
  treasuryLiquidity: number;
  totalCustomerDebt: number;
  totalSupplierDebt: number;
  // Performance
  collectedAmount: number;
  salesAmount: number;
  expensesAmount: number;
  netProfit: number;
  // Inventory
  inventoryCostValuation: number;
  inventorySaleValuation: number;
  lowStockCount: number;
  outOfStockCount: number;
  // Shipping & COD
  pendingCodAmount: number;
  unsettledShipmentsCount: number;
  // Audit
  healthScore: number;
  auditFindingsCount: number;
  // Storefront
  storefrontOrdersCount?: number;
  storefrontNewRevenue?: number;
  // Lists
  topProducts: Array<{ name: string; quantity: number; revenue: number; profit: number }>;
  dueTodayList: Array<{ customerName: string; phone?: string; amount: number; isLate: boolean }>;
  atRiskCustomers: Array<{ customerName: string; phone?: string; balance: number; daysLate: number }>;
}

export function generateExecutiveReportPdf(data: ExecutiveReportData): string {
  const meta: PdfMeta[] = [
    { label: "نوع التقرير", value: `الموجز التنفيذي للأداء (${data.timeRangeLabel})` },
    { label: "تاريخ الإصدار", value: data.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
    { label: "وقت التقرير", value: data.generatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) },
    { label: "مؤشر الرقابة", value: `${data.healthScore}%` },
  ];

  const kpis: PdfKpi[] = [
    {
      label: "السيولة النقدية (الخزائن)",
      value: `${fmt(data.treasuryLiquidity)} ج.م`,
      tone: data.treasuryLiquidity >= 0 ? "brand" : "danger",
    },
    {
      label: "إجمالي ديون العملاء",
      value: `${fmt(data.totalCustomerDebt)} ج.م`,
      tone: "plain",
    },
    {
      label: `صافي الأرباح (${data.timeRangeLabel})`,
      value: `${fmt(data.netProfit)} ج.م`,
      tone: data.netProfit >= 0 ? "brand" : "danger",
    },
    {
      label: "تقييم المخزون (بالتكلفة)",
      value: `${fmt(data.inventoryCostValuation)} ج.م`,
      tone: "plain",
    },
  ];

  let body = "";

  // 1. قسم الأداء المالي والتشغيلي
  body += `
    <h2 class="sec">مؤشرات النشاط والتدفقات النقدية</h2>
    <div class="info">
      <div class="box">
        <b>المتحصلات النقدية:</b> <span class="num ok">${fmt(data.collectedAmount)} ج.م</span><br/>
        <b>إجمالي المصروفات:</b> <span class="num due">${fmt(data.expensesAmount)} ج.م</span><br/>
        <b>ديون الموردين (المستحقة):</b> <span class="num due">${fmt(data.totalSupplierDebt)} ج.م</span>
      </div>
      <div class="box">
        <b>شحنات COD المعلقة:</b> <span class="num">${fmt(data.pendingCodAmount)} ج.م (${data.unsettledShipmentsCount} شحنة)</span><br/>
        <b>حالة المخزون:</b> <span>${data.outOfStockCount} صنف نافد / ${data.lowStockCount} قارب على النفاد</span><br/>
        <b>سلامة القيود المحاسبية:</b> <span class="num ok">${data.healthScore}% (ملاحظات: ${data.auditFindingsCount})</span>
      </div>
    </div>
  `;

  // 2. جدول أكثر الأصناف مبيعاً
  if (data.topProducts.length > 0) {
    body += `
      <h2 class="sec">أعلى 5 أصناف مبيعاً وحركة</h2>
      <div class="t-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:40px;">#</th>
              <th>اسم الصنف</th>
              <th class="num">الكمية المباعة</th>
              <th class="num">إجمالي الإيراد</th>
              <th class="num">المساهمة في الربح</th>
            </tr>
          </thead>
          <tbody>
            ${data.topProducts
              .map(
                (p, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><b>${esc(p.name)}</b></td>
                  <td class="num">${p.quantity}</td>
                  <td class="num">${fmt(p.revenue)} ج.م</td>
                  <td class="num ok">+${fmt(p.profit)} ج.م</td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // 3. جدول التحصيلات المطلوبة والمتأخرات
  if (data.atRiskCustomers.length > 0) {
    body += `
      <h2 class="sec">أهم العملاء المتأخرين الواجب متابعتهم</h2>
      <div class="t-wrap">
        <table>
          <thead>
            <tr>
              <th>اسم العميل</th>
              <th>الهاتف</th>
              <th class="num">أيام التأخير</th>
              <th class="num">الرصيد المستحق</th>
            </tr>
          </thead>
          <tbody>
            ${data.atRiskCustomers
              .map(
                (c) => `
                <tr>
                  <td><b>${esc(c.customerName)}</b></td>
                  <td dir="ltr" style="text-align:right;">${esc(c.phone || "—")}</td>
                  <td class="num due">${c.daysLate} يوم</td>
                  <td class="num due">${fmt(c.balance)} ج.م</td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // 4. جدول أقساط اليوم
  if (data.dueTodayList.length > 0) {
    body += `
      <h2 class="sec">أقساط ومستحقات اليوم</h2>
      <div class="t-wrap">
        <table>
          <thead>
            <tr>
              <th>العميل</th>
              <th>الهاتف</th>
              <th class="num">المبلغ المستحق</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${data.dueTodayList
              .map(
                (d) => `
                <tr>
                  <td><b>${esc(d.customerName)}</b></td>
                  <td dir="ltr" style="text-align:right;">${esc(d.phone || "—")}</td>
                  <td class="num warn">${fmt(d.amount)} ج.م</td>
                  <td><span class="tag ${d.isLate ? "purchase" : "opening"}">${d.isLate ? "متأخر" : "مستحق اليوم"}</span></td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // ملخص ختامي
  body += `
    <div class="total-bar">
      <span>صافي المركز المالي المباشر (السيولة النقدية + ديون العملاء − ديون الموردين):</span>
      <span class="v">${fmt(data.treasuryLiquidity + data.totalCustomerDebt - data.totalSupplierDebt)} ج.م</span>
    </div>
    <div class="sig">
      <div>اعتماد المدير العام</div>
      <div>مراجعة الحسابات والتدقيق</div>
    </div>
  `;

  return pdfDocument({
    docTitle: `تقرير تنفيذي - ${data.timeRangeLabel} - سِجلّي`,
    badge: "موجز أداء تنفيذي",
    title: "موجز لوحة التحكم والمركز المالي",
    lede: "تقرير شامل ومكثف يلخص التدفقات النقدية، حركة المبيعات، تقييم المخزون، ونسب التحصيل.",
    meta,
    kpis,
    body: body + arabicDigitsScript,
    footerNote: "هذا التقرير مخصص للإدارة وأصحاب القرار ويعد وثيقة داخلية سريّة.",
    page: "A4",
  });
}

export function exportExecutiveReport(data: ExecutiveReportData) {
  const html = generateExecutiveReportPdf(data);
  return openPdfDocument(html, { autoPrint: true });
}
