/**
 * محرك الحسابات المالية الموحد (Unified Financial Engine) - سِجلّي
 * 
 * المبدأ: "الحساب قبل الشكل" — أي رقم في الواجهة لازم يكون صحيح للمليم.
 * يمنع منعاً باتاً استخدام أي نسب تقديرية (مثل 25%) في حساب الأرباح.
 */

export interface InvoiceFinancialSummary {
  subtotal: number;
  discountAmount: number;
  discountPct: number;
  taxAmount: number;
  taxPct: number;
  netTotal: number;
  downPayment: number;
  remainingAmount: number;
  monthlyInstallment: number;
  installmentCount: number;
}

export interface InstallmentScheduleRow {
  n: number;
  due: Date;
  amount: number;
}

export interface ProfitMetrics {
  totalRevenue: number;
  totalCollected: number;
  netSales: number;
  totalCogs: number;
  grossProfit: number;
  totalExpenses: number;
  cashPurchases: number;
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
}

/**
 * تقريب المبالغ لأقرب قرش (منزلتين عشريتين) لمنع أخطاء الفاصلة العائمة في جافاسكريبت
 */
export function roundCurrency(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * حساب تفاصيل الفاتورة المالية بالكامل (المجموع، الخصم، الضريبة، الصافي، والمتبقي)
 */
export function calculateInvoiceFinancials(params: {
  items: Array<{ price: number; quantity?: number; cost?: number }>;
  discountPct?: number;
  discountAmount?: number;
  taxPct?: number;
  downPayment?: number;
  installmentCount?: number;
}): InvoiceFinancialSummary {
  const subtotal = roundCurrency(
    params.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
  );

  let discountAmount = 0;
  let discountPct = Number(params.discountPct) || 0;

  if (params.discountAmount && Number(params.discountAmount) > 0) {
    discountAmount = roundCurrency(Math.min(Number(params.discountAmount), subtotal));
    discountPct = subtotal > 0 ? roundCurrency((discountAmount / subtotal) * 100) : 0;
  } else if (discountPct > 0) {
    discountPct = Math.min(discountPct, 100);
    discountAmount = roundCurrency((subtotal * discountPct) / 100);
  }

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxPct = Number(params.taxPct) || 0;
  const taxAmount = taxPct > 0 ? roundCurrency((afterDiscount * taxPct) / 100) : 0;
  const netTotal = roundCurrency(afterDiscount + taxAmount);

  const downPayment = roundCurrency(Math.min(Number(params.downPayment) || 0, netTotal));
  const remainingAmount = roundCurrency(Math.max(0, netTotal - downPayment));

  const installmentCount = Math.max(1, Number(params.installmentCount) || 1);
  const monthlyInstallment = remainingAmount > 0 ? roundCurrency(remainingAmount / installmentCount) : 0;

  return {
    subtotal,
    discountAmount,
    discountPct,
    taxAmount,
    taxPct,
    netTotal,
    downPayment,
    remainingAmount,
    monthlyInstallment,
    installmentCount,
  };
}

/**
 * حساب جدول الأقساط بدقة وتوزيع الفروق المتبقية على القسط الأخير لضمان مطابقة المجموع 100%
 */
export function generateInstallmentSchedule(
  remainingAmount: number,
  installmentCount: number,
  firstDueDate: Date,
  monthlyInstallmentOverride?: number
): InstallmentScheduleRow[] {
  if (remainingAmount <= 0 || installmentCount <= 0) return [];

  const rows: InstallmentScheduleRow[] = [];
  const baseMonthly = monthlyInstallmentOverride && monthlyInstallmentOverride > 0
    ? roundCurrency(monthlyInstallmentOverride)
    : roundCurrency(remainingAmount / installmentCount);

  let accumulated = 0;

  for (let i = 0; i < installmentCount; i++) {
    const due = new Date(firstDueDate);
    due.setMonth(due.getMonth() + i);

    let amount = baseMonthly;
    if (i === installmentCount - 1) {
      // القسط الأخير يحصل على باقي المبلغ بدقة
      amount = roundCurrency(Math.max(0, remainingAmount - accumulated));
    } else {
      amount = roundCurrency(Math.min(baseMonthly, remainingAmount - accumulated));
    }

    accumulated = roundCurrency(accumulated + amount);
    rows.push({
      n: i + 1,
      due,
      amount,
    });
  }

  return rows;
}

/**
 * حساب تكلفة البضاعة المباعة (COGS) الحقيقية
 */
export function calculateRealCOGS(
  invoiceItems: Array<{ cost?: number; price?: number; quantity?: number; name?: string }>,
  _stockCatalog?: Array<{ id?: string; name: string; costPrice?: number; cost?: number }>
): number {
  let totalCost = 0;

  for (const item of invoiceItems) {
    const qty = Number(item.quantity) || 1;
    const directCost = Number(item.cost);

    if (Number.isFinite(directCost) && directCost >= 0) {
      totalCost += directCost * qty;
    }
  }

  return roundCurrency(totalCost);
}

/**
 * حساب الأرباح الحقيقية الصافية والمجملة بدون أي نسب تقديرية
 */
export function calculateRealProfitMetrics(params: {
  salesTotal: number;
  taxTotal: number;
  returnsTotal: number;
  cogsTotal: number;
  expensesTotal: number;
  cashPurchasesTotal?: number;
  collectedAmount?: number;
}): ProfitMetrics {
  const totalRevenue = roundCurrency(params.salesTotal);
  const totalTax = roundCurrency(params.taxTotal);
  const returnsTotal = roundCurrency(params.returnsTotal);
  const netSales = roundCurrency(Math.max(0, totalRevenue - totalTax - returnsTotal));
  
  const totalCogs = roundCurrency(params.cogsTotal);
  const grossProfit = roundCurrency(netSales - totalCogs);
  
  const totalExpenses = roundCurrency(params.expensesTotal);
  const cashPurchases = roundCurrency(params.cashPurchasesTotal || 0);
  const netProfit = roundCurrency(grossProfit - totalExpenses - cashPurchases);

  const grossMarginPct = netSales > 0 ? roundCurrency((grossProfit / netSales) * 100) : 0;
  const netMarginPct = netSales > 0 ? roundCurrency((netProfit / netSales) * 100) : 0;
  const totalCollected = roundCurrency(params.collectedAmount || 0);

  return {
    totalRevenue,
    totalCollected,
    netSales,
    totalCogs,
    grossProfit,
    totalExpenses,
    cashPurchases,
    netProfit,
    grossMarginPct,
    netMarginPct,
  };
}

/**
 * حساب حالة تأخر القسط وتصنيف العميل
 */
export function calculateDueStatus(params: {
  dueDate: string | Date;
  paidAmount: number;
  totalDue: number;
  today?: Date;
}): {
  isOverdue: boolean;
  daysLate: number;
  remainingDue: number;
} {
  const today = params.today || new Date();
  const due = typeof params.dueDate === "string" ? new Date(params.dueDate) : params.dueDate;
  const remainingDue = roundCurrency(Math.max(0, params.totalDue - params.paidAmount));

  if (remainingDue <= 0) {
    return { isOverdue: false, daysLate: 0, remainingDue: 0 };
  }

  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays > 0;

  return {
    isOverdue,
    daysLate: isOverdue ? diffDays : 0,
    remainingDue,
  };
}
