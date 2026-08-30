import { ComprehensiveReportData } from "./reports-engine";
import { fmt, ShopSettings } from "./store";
import { pdfDocument, openPdfDocument } from "./pdf-doc";
import { toast } from "sonner";

function escapeHtml(s: string): string {
  return (s || "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export async function exportComprehensiveExcel(data: ComprehensiveReportData, shopName = "سِجلّي") {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // 1. Executive Summary Sheet
    const summaryRows = [
      { المؤشر: "الفترة الزمنية المحددة", القيمة: data.range.label },
      { المؤشر: "إجمالي المبيعات الإجمالية", القيمة: Math.round(data.totalSales) },
      { المؤشر: "مرتجعات المبيعات", القيمة: Math.round(data.totalSalesReturns) },
      { المؤشر: "صافي المبيعات", القيمة: Math.round(data.incomeStatement.netSales) },
      { المؤشر: "تكلفة البضاعة المباعة (COGS)", القيمة: Math.round(data.cogs) },
      { المؤشر: "مجمل الربح التجاري", القيمة: Math.round(data.grossProfit) },
      { المؤشر: "نسبة مجمل الربح %", القيمة: `${data.grossMarginPercent.toFixed(1)}%` },
      { المؤشر: "إجمالي المصروفات التشغيلية", القيمة: Math.round(data.totalExpenses) },
      { المؤشر: "صافي الربح النهائي", القيمة: Math.round(data.netProfit) },
      { المؤشر: "نسبة صافي الربح %", القيمة: `${data.netMarginPercent.toFixed(1)}%` },
      { المؤشر: "إجمالي التحصيلات النقدية", القيمة: Math.round(data.totalCollected) },
      { المؤشر: "نسبة التحصيل من المبيعات %", القيمة: `${data.collectionRate.toFixed(1)}%` },
      { المؤشر: "متوسط قيمة الفاتورة", القيمة: Math.round(data.averageOrderValue) },
      { المؤشر: "إجمالي المشتريات خلال الفترة", القيمة: Math.round(data.totalPurchases) },
      { المؤشر: "مستحقات السوق طرف العملاء", القيمة: Math.round(data.outstandingReceivables) },
      { المؤشر: "صافي التدفق النقدي للخزينة", القيمة: Math.round(data.cashFlow.netCashFlow) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "الملخص العام");

    // 2. Timeline Series Sheet
    const timelineRows = data.timelineSeries.map((row) => ({
      الفترة: row.label,
      المبيعات: Math.round(row.sales),
      التحصيلات: Math.round(row.collected),
      المصروفات: Math.round(row.expenses),
      "تكلفة البضاعة": Math.round(row.cogs),
      "مجمل الربح": Math.round(row.grossProfit),
      "صافي الربح": Math.round(row.netProfit),
      "التدفق النقدي الداخل": Math.round(row.cashIn),
      "التدفق النقدي الخارج": Math.round(row.cashOut),
      "صافي السيولة": Math.round(row.netCash),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(timelineRows), "حركة الفترات");

    // 3. Income Statement Sheet (P&L)
    const plRows = [
      { البند: "إجمالي المبيعات", القيمة: Math.round(data.incomeStatement.grossSales) },
      { البند: "(-) مردودات المبيعات", القيمة: Math.round(data.incomeStatement.salesReturns) },
      { البند: "(=) صافي المبيعات", القيمة: Math.round(data.incomeStatement.netSales) },
      { البند: "(-) تكلفة المبيعات (COGS)", القيمة: Math.round(data.incomeStatement.cogs) },
      { البند: "(=) مجمل الربح", القيمة: Math.round(data.incomeStatement.grossProfit) },
      ...data.incomeStatement.expensesByCategory.map((e) => ({
        البند: `مصروفات: ${e.label}`,
        القيمة: Math.round(e.amount),
      })),
      { البند: "إجمالي المصروفات", القيمة: Math.round(data.incomeStatement.totalOperatingExpenses) },
      { البند: "(=) صافي أرباح الفترة", القيمة: Math.round(data.incomeStatement.netOperatingProfit) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plRows), "قائمة الدخل P&L");

    // 4. Inventory Sheet
    if (data.inventory.topSellingItems.length > 0) {
      const topItemsRows = data.inventory.topSellingItems.map((item) => ({
        الصنف: item.name,
        "الكمية المباعة": item.soldQuantity,
        "إجمالي الإيراد": Math.round(item.revenue),
        "إجمالي التكلفة": Math.round(item.cost),
        "صافي الربح": Math.round(item.profit),
        "هامش الربح %": `${item.marginPercent.toFixed(1)}%`,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topItemsRows), "الأصناف الأكثر ربحا");
    }

    if (data.inventory.slowMovingItems.length > 0) {
      const slowItemsRows = data.inventory.slowMovingItems.map((item) => ({
        الصنف: item.name,
        "الكمية المتوفرة بالمخزن": item.currentQuantity,
        "تكلفة الوحدة": Math.round(item.unitCost),
        "سعر البيع": Math.round(item.salePrice),
        "إجمالي قيمة المخزون الراكد": Math.round(item.totalValue),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(slowItemsRows), "المخزون الراكد");
    }

    // 5. Customers Sheet
    if (data.customerAnalytics.topCustomers.length > 0) {
      const custRows = data.customerAnalytics.topCustomers.map((c) => ({
        العميل: c.name,
        "الهاتف": c.phone || "-",
        "عدد الفواتير": c.invoicesCount,
        "إجمالي المشتريات": Math.round(c.totalPurchases),
        "المسدد": Math.round(c.totalPaid),
        "المتبقي (الرصيد المدين)": Math.round(c.currentBalance),
        "نسبة السداد %": `${c.collectionPercentage.toFixed(1)}%`,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custRows), "تحليل العملاء");
    }

    // 6. Suppliers Sheet
    if (data.suppliersAnalytics.topSuppliers.length > 0) {
      const supRows = data.suppliersAnalytics.topSuppliers.map((s) => ({
        المورد: s.name,
        "الهاتف": s.contact || "-",
        "عدد عمليات الشراء": s.purchasesCount,
        "إجمالي المشتريات": Math.round(s.totalPurchases),
        "المدفوع له": Math.round(s.totalPaid),
        "المستحق للمورد (الدائن)": Math.round(s.outstandingDue),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supRows), "الموردين والمشتريات");
    }

    const fileName = `financial-report-${shopName.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("تم تصدير ملف Excel الشامل بنجاح");
  } catch (error) {
    console.error(error);
    toast.error("حدث خطأ أثناء تصدير ملف Excel");
  }
}

export function printFinancialReportPDF(
  data: ComprehensiveReportData,
  settings: ShopSettings,
  activeTab = "summary"
) {
  const shopName = settings.shopName || "سِجلّي";
  const meta = [
    { label: "المحل / المنشأة", value: escapeHtml(shopName) },
    ...(settings.phone ? [{ label: "الهاتف", value: escapeHtml(settings.phone) }] : []),
    { label: "الفترة الزمنية", value: escapeHtml(data.range.label) },
    { label: "تاريخ إصدار التقرير", value: new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) },
  ];

  let bodyHtml = "";

  if (activeTab === "income_statement" || activeTab === "all") {
    bodyHtml += `
      <h2 class="sec">قائمة الدخل والأرباح (Income Statement)</h2>
      <div class="t-wrap">
        <table>
          <thead>
            <tr>
              <th>البند المالي المحاسبي</th>
              <th class="num">المبلغ (ج.م)</th>
              <th class="num">النسبة المئوية</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>إجمالي إيرادات المبيعات</strong></td>
              <td class="num font-bold">${fmt(data.incomeStatement.grossSales)}</td>
              <td class="num">100.0%</td>
            </tr>
            <tr>
              <td>(-) مردودات ومرتجعات المبيعات</td>
              <td class="num due">${fmt(data.incomeStatement.salesReturns)}</td>
              <td class="num due">${data.incomeStatement.grossSales > 0 ? ((data.incomeStatement.salesReturns / data.incomeStatement.grossSales) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr style="background:#f8fafc; font-weight:bold;">
              <td>(=) صافي المبيعات التشغيلية</td>
              <td class="num ok">${fmt(data.incomeStatement.netSales)}</td>
              <td class="num">100.0%</td>
            </tr>
            <tr>
              <td>(-) تكلفة البضاعة المباعة (COGS)</td>
              <td class="num due">${fmt(data.incomeStatement.cogs)}</td>
              <td class="num">${data.incomeStatement.netSales > 0 ? ((data.incomeStatement.cogs / data.incomeStatement.netSales) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr style="background:#f1f5f9; font-weight:bold;">
              <td>(=) مجمل الربح التجاري (Gross Profit)</td>
              <td class="num ok">${fmt(data.incomeStatement.grossProfit)}</td>
              <td class="num ok">${data.incomeStatement.grossMargin.toFixed(1)}%</td>
            </tr>
            ${data.incomeStatement.expensesByCategory.map((e) => `
              <tr>
                <td style="padding-right:24px;">• مصروفات: ${escapeHtml(e.label)}</td>
                <td class="num">${fmt(e.amount)}</td>
                <td class="num">${e.percentage.toFixed(1)}%</td>
              </tr>
            `).join("")}
            <tr style="background:#fff1f2; font-weight:bold;">
              <td>(-) إجمالي المصروفات التشغيلية</td>
              <td class="num due">${fmt(data.incomeStatement.totalOperatingExpenses)}</td>
              <td class="num due">${data.incomeStatement.netSales > 0 ? ((data.incomeStatement.totalOperatingExpenses / data.incomeStatement.netSales) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr style="background:#ecfdf5; font-size:1.1em; font-weight:bold; border-top:2px solid #059669;">
              <td>(=) صافي الأرباح التشغيلية النهائية (Net Profit)</td>
              <td class="num ${data.incomeStatement.netOperatingProfit >= 0 ? "ok" : "due"}">${fmt(data.incomeStatement.netOperatingProfit)}</td>
              <td class="num ${data.incomeStatement.netOperatingProfit >= 0 ? "ok" : "due"}">${data.incomeStatement.netMargin.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  if (activeTab === "summary" || activeTab === "all") {
    bodyHtml += `
      <h2 class="sec">حركة الأداء المالي للفترات</h2>
      <div class="t-wrap">
        <table>
          <thead>
            <tr>
              <th>الفترة</th>
              <th class="num">المبيعات</th>
              <th class="num">التحصيلات</th>
              <th class="num">المصروفات</th>
              <th class="num">مجمل الربح</th>
              <th class="num">صافي الربح</th>
            </tr>
          </thead>
          <tbody>
            ${data.timelineSeries.map((r) => `
              <tr>
                <td>${escapeHtml(r.label)}</td>
                <td class="num">${fmt(r.sales)}</td>
                <td class="num ok">${fmt(r.collected)}</td>
                <td class="num due">${fmt(r.expenses)}</td>
                <td class="num">${fmt(r.grossProfit)}</td>
                <td class="num ${r.netProfit >= 0 ? "ok" : "due"} font-bold">${fmt(r.netProfit)}</td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr style="font-weight:bold; background:#f8fafc;">
              <td>الإجمالي</td>
              <td class="num">${fmt(data.totalSales)}</td>
              <td class="num ok">${fmt(data.totalCollected)}</td>
              <td class="num due">${fmt(data.totalExpenses)}</td>
              <td class="num">${fmt(data.grossProfit)}</td>
              <td class="num ${data.netProfit >= 0 ? "ok" : "due"}">${fmt(data.netProfit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  if (activeTab === "inventory" || activeTab === "all") {
    bodyHtml += `
      <h2 class="sec">تحليل أصناف المخزون والأكثر ربحية</h2>
      <div class="t-wrap">
        <table>
          <thead>
            <tr>
              <th>الصنف</th>
              <th class="num">الكمية المباعة</th>
              <th class="num">إجمالي الإيراد</th>
              <th class="num">التكلفة</th>
              <th class="num">صافي الربح</th>
              <th class="num">الهامش %</th>
            </tr>
          </thead>
          <tbody>
            ${data.inventory.topSellingItems.map((it) => `
              <tr>
                <td>${escapeHtml(it.name)}</td>
                <td class="num">${fmt(it.soldQuantity)}</td>
                <td class="num">${fmt(it.revenue)}</td>
                <td class="num">${fmt(it.cost)}</td>
                <td class="num ok font-bold">${fmt(it.profit)}</td>
                <td class="num ok">${it.marginPercent.toFixed(1)}%</td>
              </tr>
            `).join("") || `<tr><td colspan="6" class="empty">لا توجد أصناف مباعة في هذه الفترة</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  if (activeTab === "customers" || activeTab === "all") {
    bodyHtml += `
      <h2 class="sec">أعلى العملاء تعاملاً ورصيدًا</h2>
      <div class="t-wrap">
        <table>
          <thead>
            <tr>
              <th>العميل</th>
              <th class="num">الفواتير</th>
              <th class="num">إجمالي المشتريات</th>
              <th class="num">المسدد</th>
              <th class="num">الرصيد المتبقي</th>
              <th class="num">نسبة السداد</th>
            </tr>
          </thead>
          <tbody>
            ${data.customerAnalytics.topCustomers.slice(0, 10).map((c) => `
              <tr>
                <td>${escapeHtml(c.name)}</td>
                <td class="num">${c.invoicesCount}</td>
                <td class="num">${fmt(c.totalPurchases)}</td>
                <td class="num ok">${fmt(c.totalPaid)}</td>
                <td class="num ${c.currentBalance > 0 ? "due" : ""}">${fmt(c.currentBalance)}</td>
                <td class="num">${c.collectionPercentage.toFixed(0)}%</td>
              </tr>
            `).join("") || `<tr><td colspan="6" class="empty">لا توجد حركات عملاء</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  if (activeTab === "suppliers" || activeTab === "all") {
    bodyHtml += `
      <h2 class="sec">أرصدة ومشتريات الموردين</h2>
      <div class="t-wrap">
        <table>
          <thead>
            <tr>
              <th>المورد</th>
              <th class="num">عدد المشتريات</th>
              <th class="num">إجمالي المشتريات</th>
              <th class="num">المدفوع</th>
              <th class="num">المتبقي له (دائن)</th>
            </tr>
          </thead>
          <tbody>
            ${data.suppliersAnalytics.topSuppliers.map((s) => `
              <tr>
                <td>${escapeHtml(s.name)}</td>
                <td class="num">${s.purchasesCount}</td>
                <td class="num">${fmt(s.totalPurchases)}</td>
                <td class="num ok">${fmt(s.totalPaid)}</td>
                <td class="num due font-bold">${fmt(s.outstandingDue)}</td>
              </tr>
            `).join("") || `<tr><td colspan="5" class="empty">لا توجد حركات موردين</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  const html = pdfDocument({
    docTitle: `تقرير مالي — ${escapeHtml(shopName)}`,
    badge: `تقرير مالي محاسبي شامل · ${escapeHtml(data.range.label)}`,
    title: "التقرير المالي والحسابات الختامية",
    lede: `بيان تحليلي شامل للإيرادات والمصروفات والأرباح والمخزون وحركة الخزينة والعملاء.`,
    meta,
    kpis: [
      { label: "صافي المبيعات", value: `${fmt(data.incomeStatement.netSales)} ج.م`, tone: "brand" },
      { label: "مجمل الربح", value: `${fmt(data.grossProfit)} ج.م (${data.grossMarginPercent.toFixed(1)}%)`, tone: "brand" },
      { label: "المصروفات", value: `${fmt(data.totalExpenses)} ج.م`, tone: "danger" },
      { label: "صافي الربح", value: `${fmt(data.netProfit)} ج.م (${data.netMarginPercent.toFixed(1)}%)`, tone: data.netProfit >= 0 ? "brand" : "danger" },
    ],
    body: bodyHtml,
    footerNote: settings.footerNote ? escapeHtml(settings.footerNote) : undefined,
    page: "A4",
  });

  if (!openPdfDocument(html, { autoPrint: true })) {
    toast.error("يرجى السماح بفتح النوافذ المنبثقة لطباعة التقرير");
  }
}
