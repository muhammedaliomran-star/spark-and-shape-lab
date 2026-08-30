import { Invoice, InvoiceItem, Payment, Expense, Purchase, PurchaseItem, SupplierPayment, Supplier, ReturnRecord, ReturnItem, Customer, StockItem } from "./store";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, parseISO, isWithinInterval } from "date-fns";

export type ReportDatePreset =
  | "today"
  | "this_week"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "last_6_months"
  | "this_year"
  | "custom";

export interface DateFilterRange {
  preset: ReportDatePreset;
  startDate: Date;
  endDate: Date;
}

export function getDateRangeFromPreset(preset: ReportDatePreset, customStart?: Date, customEnd?: Date): { startDate: Date; endDate: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { startDate: startOfDay(now), endDate: endOfDay(now) };
    case "this_week":
      return { startDate: startOfWeek(now, { weekStartsOn: 6 }), endDate: endOfWeek(now, { weekStartsOn: 6 }) };
    case "this_month":
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    case "last_month": {
      const prev = subMonths(now, 1);
      return { startDate: startOfMonth(prev), endDate: endOfMonth(prev) };
    }
    case "last_3_months": {
      const prev3 = subMonths(now, 3);
      return { startDate: startOfMonth(prev3), endDate: endOfDay(now) };
    }
    case "last_6_months": {
      const prev6 = subMonths(now, 6);
      return { startDate: startOfMonth(prev6), endDate: endOfDay(now) };
    }
    case "this_year":
      return { startDate: startOfYear(now), endDate: endOfYear(now) };
    case "custom":
      return {
        startDate: customStart ? startOfDay(customStart) : startOfMonth(now),
        endDate: customEnd ? endOfDay(customEnd) : endOfDay(now),
      };
  }
}

export interface ComprehensiveReportData {
  range: { startDate: Date; endDate: Date; label: string };
  // Overall KPIs
  totalSales: number;
  salesCount: number;
  totalCollected: number;
  totalDownPayments: number;
  totalInstallmentsCollected: number;
  totalExpenses: number;
  totalPurchases: number;
  cashPurchases: number;
  creditPurchases: number;
  supplierPaymentsPaid: number;
  totalSalesReturns: number;
  cogs: number; // Cost of Goods Sold
  grossProfit: number;
  grossMarginPercent: number;
  netProfit: number;
  netMarginPercent: number;
  collectionRate: number;
  averageOrderValue: number;
  outstandingReceivables: number;

  // Monthly / Daily Series for Charts
  timelineSeries: Array<{
    periodKey: string;
    label: string;
    sales: number;
    collected: number;
    expenses: number;
    cogs: number;
    grossProfit: number;
    netProfit: number;
    cashIn: number;
    cashOut: number;
    netCash: number;
  }>;

  // P&L Statement breakdown
  incomeStatement: {
    grossSales: number;
    salesReturns: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    expensesByCategory: Array<{ category: string; label: string; amount: number; percentage: number }>;
    totalOperatingExpenses: number;
    netOperatingProfit: number;
    netMargin: number;
  };

  // Inventory analytics
  inventory: {
    totalStockCost: number;
    totalStockSaleValue: number;
    potentialStockProfit: number;
    itemCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    topSellingItems: Array<{
      id?: string;
      name: string;
      soldQuantity: number;
      revenue: number;
      cost: number;
      profit: number;
      marginPercent: number;
    }>;
    slowMovingItems: Array<{
      id: string;
      name: string;
      currentQuantity: number;
      unitCost: number;
      salePrice: number;
      totalValue: number;
      daysSinceCreatedOrSold: number;
    }>;
  };

  // Suppliers & Purchases
  suppliersAnalytics: {
    totalPurchases: number;
    totalPaidToSuppliers: number;
    totalDueToSuppliers: number;
    topSuppliers: Array<{
      id: string;
      name: string;
      contact: string;
      purchasesCount: number;
      totalPurchases: number;
      totalPaid: number;
      outstandingDue: number;
    }>;
  };

  // Cash Flow
  cashFlow: {
    totalInflow: number;
    totalOutflow: number;
    netCashFlow: number;
    inflowBreakdown: { downPayments: number; installments: number };
    outflowBreakdown: { expenses: number; cashPurchases: number; supplierPayments: number; salesReturnsRefunds: number };
  };

  // Customer Analytics
  customerAnalytics: {
    totalActiveCustomers: number;
    topCustomers: Array<{
      id: string;
      name: string;
      phone?: string | null;
      invoicesCount: number;
      totalPurchases: number;
      totalPaid: number;
      currentBalance: number;
      collectionPercentage: number;
      lastPurchaseDate?: string;
    }>;
  };
}

export function computeComprehensiveReports(
  db: {
    customers: Customer[];
    invoices: Invoice[];
    invoiceItems: InvoiceItem[];
    payments: Payment[];
    expenses: Expense[];
    purchases: Purchase[];
    purchaseItems: PurchaseItem[];
    supplierPayments: SupplierPayment[];
    suppliers: Supplier[];
    returns: ReturnRecord[];
    returnItems: ReturnItem[];
    stockItems: StockItem[];
  },
  startDate: Date,
  endDate: Date,
  rangeLabel: string
): ComprehensiveReportData {
  const inRange = (dateStr: string | number | Date | null | undefined) => {
    if (!dateStr) return false;
    const d = typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return isWithinInterval(d, { start: startDate, end: endDate });
  };

  // Filter Data within Range
  const filteredInvoices = db.invoices.filter((i) => i.status !== "cancelled" && inRange(i.createdAt));
  const filteredPayments = db.payments.filter((p) => inRange(p.paidAt));
  const filteredExpenses = db.expenses.filter((e) => inRange(e.expenseDate));
  const filteredPurchases = db.purchases.filter((p) => inRange(p.purchaseDate));
  const filteredSupplierPayments = db.supplierPayments.filter((sp) => inRange(sp.paidAt));
  const filteredReturns = db.returns.filter((r) => inRange(r.createdAt));

  // 1. Invoices Profit & COGS mapping
  const invoiceProfitMap = new Map<string, { cogs: number; profit: number }>();
  const invoiceItemsMap = new Map<string, InvoiceItem[]>();
  for (const it of db.invoiceItems) {
    const list = invoiceItemsMap.get(it.invoiceId) || [];
    list.push(it);
    invoiceItemsMap.set(it.invoiceId, list);
  }

  let totalPeriodCogs = 0;
  for (const inv of filteredInvoices) {
    const items = invoiceItemsMap.get(inv.id) || [];
    let invCogs = 0;
    for (const item of items) {
      const unitCost = Number.isFinite(item.cost) && item.cost > 0 ? item.cost : item.price * 0.7; // default 70% cost if missing
      invCogs += unitCost * (item.quantity || 1);
    }
    const invProfit = inv.total - invCogs;
    invoiceProfitMap.set(inv.id, { cogs: invCogs, profit: invProfit });
    totalPeriodCogs += invCogs;
  }

  // 2. Sales & Collections
  const totalSales = filteredInvoices.reduce((sum, i) => sum + i.total, 0);
  const totalDownPayments = filteredInvoices.reduce((sum, i) => sum + (i.downPayment || 0), 0);
  const totalInstallmentsCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalCollected = totalDownPayments + totalInstallmentsCollected;

  const totalSalesReturns = filteredReturns
    .filter((r) => r.type === "sale")
    .reduce((sum, r) => sum + r.totalAmount, 0);

  const netSales = Math.max(0, totalSales - totalSalesReturns);
  const grossProfit = Math.max(0, netSales - totalPeriodCogs);
  const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // 3. Expenses
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // 4. Purchases & Supplier Payments
  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + p.total, 0);
  const cashPurchases = filteredPurchases
    .filter((p) => p.paymentType === "cash")
    .reduce((sum, p) => sum + p.total, 0);
  const creditPurchases = filteredPurchases
    .filter((p) => p.paymentType === "credit")
    .reduce((sum, p) => sum + p.total, 0);
  const supplierPaymentsPaid = filteredSupplierPayments.reduce((sum, sp) => sum + sp.amount, 0);

  // Net Profit
  const netProfit = grossProfit - totalExpenses;
  const netMarginPercent = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  // Collections & AOV
  const collectionRate = totalSales > 0 ? (totalCollected / totalSales) * 100 : 0;
  const averageOrderValue = filteredInvoices.length > 0 ? totalSales / filteredInvoices.length : 0;
  const outstandingReceivables = db.invoices.reduce((sum, i) => sum + Math.max(0, i.total - i.paid), 0);

  // 5. Timeline grouping (Monthly or Daily if short range)
  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const isDaily = diffDays <= 35;

  const timelineMap = new Map<
    string,
    {
      periodKey: string;
      label: string;
      sales: number;
      collected: number;
      expenses: number;
      cogs: number;
      grossProfit: number;
      netProfit: number;
      cashIn: number;
      cashOut: number;
      netCash: number;
    }
  >();

  const getTimelineKey = (d: Date) => {
    if (isDaily) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const getTimelineLabel = (d: Date) => {
    if (isDaily) {
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }
    const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    return `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  };

  // Seed timeline slots
  let cur = new Date(startDate);
  while (cur <= endDate) {
    const k = getTimelineKey(cur);
    if (!timelineMap.has(k)) {
      timelineMap.set(k, {
        periodKey: k,
        label: getTimelineLabel(cur),
        sales: 0,
        collected: 0,
        expenses: 0,
        cogs: 0,
        grossProfit: 0,
        netProfit: 0,
        cashIn: 0,
        cashOut: 0,
        netCash: 0,
      });
    }
    cur = isDaily ? new Date(cur.setDate(cur.getDate() + 1)) : new Date(cur.setMonth(cur.getMonth() + 1));
  }

  for (const inv of filteredInvoices) {
    const k = getTimelineKey(new Date(inv.createdAt));
    const slot = timelineMap.get(k);
    if (slot) {
      const invData = invoiceProfitMap.get(inv.id) || { cogs: 0, profit: 0 };
      slot.sales += inv.total;
      slot.collected += inv.downPayment || 0;
      slot.cogs += invData.cogs;
      slot.grossProfit += invData.profit;
      slot.cashIn += inv.downPayment || 0;
    }
  }

  for (const p of filteredPayments) {
    const k = getTimelineKey(new Date(p.paidAt));
    const slot = timelineMap.get(k);
    if (slot) {
      slot.collected += p.amount;
      slot.cashIn += p.amount;
    }
  }

  for (const e of filteredExpenses) {
    const k = getTimelineKey(new Date(e.expenseDate));
    const slot = timelineMap.get(k);
    if (slot) {
      slot.expenses += e.amount;
      slot.cashOut += e.amount;
    }
  }

  for (const pu of filteredPurchases) {
    const k = getTimelineKey(new Date(pu.purchaseDate));
    const slot = timelineMap.get(k);
    if (slot && pu.paymentType === "cash") {
      slot.cashOut += pu.total;
    }
  }

  for (const sp of filteredSupplierPayments) {
    const k = getTimelineKey(new Date(sp.paidAt));
    const slot = timelineMap.get(k);
    if (slot) {
      slot.cashOut += sp.amount;
    }
  }

  const timelineSeries = Array.from(timelineMap.values()).map((row) => {
    const netProfit = row.grossProfit - row.expenses;
    const netCash = row.cashIn - row.cashOut;
    return { ...row, netProfit, netCash };
  });

  // 6. Expenses by Category
  const expenseCatMap = new Map<string, number>();
  for (const e of filteredExpenses) {
    expenseCatMap.set(e.category, (expenseCatMap.get(e.category) || 0) + e.amount);
  }

  const EXPENSE_LABELS: Record<string, string> = {
    rent: "إيجار المحل / المخزن",
    salaries: "رواتب ومستحقات الموظفين",
    electricity: "كهرباء ومرافق وفواتير",
    transport: "نقل ومواصلات وبنزين",
    other: "نثريات ومصروفات أخرى",
  };

  const expensesByCategory = Array.from(expenseCatMap.entries())
    .map(([cat, amount]) => ({
      category: cat,
      label: EXPENSE_LABELS[cat] || cat,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // 7. Inventory Analytics
  let totalStockCost = 0;
  let totalStockSaleValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const st of db.stockItems) {
    const cost = st.lastUnitCost || 0;
    const price = st.salePrice || 0;
    const qty = st.quantity || 0;
    totalStockCost += cost * qty;
    totalStockSaleValue += price * qty;
    if (qty <= 0) outOfStockCount++;
    else if (qty <= (st.minStock || 5)) lowStockCount++;
  }

  // Top Selling items from invoice items in period
  const itemSalesMap = new Map<string, { name: string; soldQuantity: number; revenue: number; cost: number }>();
  for (const inv of filteredInvoices) {
    const items = invoiceItemsMap.get(inv.id) || [];
    for (const it of items) {
      const entry = itemSalesMap.get(it.name) || { name: it.name, soldQuantity: 0, revenue: 0, cost: 0 };
      entry.soldQuantity += it.quantity || 1;
      entry.revenue += it.price * (it.quantity || 1);
      entry.cost += (Number.isFinite(it.cost) ? it.cost : it.price * 0.7) * (it.quantity || 1);
      itemSalesMap.set(it.name, entry);
    }
  }

  const topSellingItems = Array.from(itemSalesMap.values())
    .map((it) => {
      const profit = it.revenue - it.cost;
      const marginPercent = it.revenue > 0 ? (profit / it.revenue) * 100 : 0;
      return { ...it, profit, marginPercent };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  // Slow moving items (stock items with zero sales in period)
  const soldNamesSet = new Set(itemSalesMap.keys());
  const slowMovingItems = db.stockItems
    .filter((st) => st.quantity > 0 && !soldNamesSet.has(st.name))
    .map((st) => ({
      id: st.id,
      name: st.name,
      currentQuantity: st.quantity,
      unitCost: st.lastUnitCost || 0,
      salePrice: st.salePrice || 0,
      totalValue: (st.lastUnitCost || 0) * st.quantity,
      daysSinceCreatedOrSold: Math.floor((Date.now() - new Date(st.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 15);

  // 8. Suppliers Analytics
  const supplierPurchaseMap = new Map<string, { purchasesCount: number; totalPurchases: number }>();
  for (const pu of filteredPurchases) {
    const entry = supplierPurchaseMap.get(pu.supplierId) || { purchasesCount: 0, totalPurchases: 0 };
    entry.purchasesCount++;
    entry.totalPurchases += pu.total;
    supplierPurchaseMap.set(pu.supplierId, entry);
  }

  const supplierPaidMap = new Map<string, number>();
  for (const sp of filteredSupplierPayments) {
    supplierPaidMap.set(sp.supplierId, (supplierPaidMap.get(sp.supplierId) || 0) + sp.amount);
  }

  const topSuppliers = db.suppliers
    .map((sup) => {
      const pData = supplierPurchaseMap.get(sup.id) || { purchasesCount: 0, totalPurchases: 0 };
      const paid = supplierPaidMap.get(sup.id) || 0;
      // calculate total historical due
      const allSupPurchases = db.purchases.filter((p) => p.supplierId === sup.id);
      const allSupPayments = db.supplierPayments.filter((sp) => sp.supplierId === sup.id);
      const histPurchases = allSupPurchases.reduce((s, p) => s + p.total, 0);
      const histPaid = allSupPayments.reduce((s, p) => s + p.amount, 0);
      const outstandingDue = (sup.openingBalance || 0) + histPurchases - histPaid;

      return {
        id: sup.id,
        name: sup.name,
        contact: sup.contact,
        purchasesCount: pData.purchasesCount,
        totalPurchases: pData.totalPurchases,
        totalPaid: paid,
        outstandingDue: Math.max(0, outstandingDue),
      };
    })
    .filter((sup) => sup.totalPurchases > 0 || sup.outstandingDue > 0)
    .sort((a, b) => b.totalPurchases - a.totalPurchases);

  // 9. Cash Flow Calculations
  const cashInflowTotal = totalCollected;
  const cashOutflowTotal = totalExpenses + cashPurchases + supplierPaymentsPaid + totalSalesReturns;
  const netCashFlow = cashInflowTotal - cashOutflowTotal;

  // 10. Customer Analytics
  const customerSalesMap = new Map<
    string,
    { invoicesCount: number; totalPurchases: number; totalPaid: number; lastDate: string }
  >();

  for (const inv of filteredInvoices) {
    const entry = customerSalesMap.get(inv.customerId) || {
      invoicesCount: 0,
      totalPurchases: 0,
      totalPaid: 0,
      lastDate: inv.createdAt,
    };
    entry.invoicesCount++;
    entry.totalPurchases += inv.total;
    entry.totalPaid += inv.paid;
    if (new Date(inv.createdAt) > new Date(entry.lastDate)) {
      entry.lastDate = inv.createdAt;
    }
    customerSalesMap.set(inv.customerId, entry);
  }

  const topCustomers = db.customers
    .map((cust) => {
      const cData = customerSalesMap.get(cust.id) || {
        invoicesCount: 0,
        totalPurchases: 0,
        totalPaid: 0,
        lastDate: cust.createdAt,
      };
      // calculate overall customer balance
      const custInvoices = db.invoices.filter((i) => i.customerId === cust.id);
      const totalDue = custInvoices.reduce((s, i) => s + Math.max(0, i.total - i.paid), 0) + (cust.openingBalance || 0);
      const collectionPercent = cData.totalPurchases > 0 ? (cData.totalPaid / cData.totalPurchases) * 100 : 100;

      return {
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        invoicesCount: cData.invoicesCount,
        totalPurchases: cData.totalPurchases,
        totalPaid: cData.totalPaid,
        currentBalance: totalDue,
        collectionPercentage: Math.min(100, collectionPercent),
        lastPurchaseDate: cData.lastDate,
      };
    })
    .filter((c) => c.totalPurchases > 0 || c.currentBalance > 0)
    .sort((a, b) => b.totalPurchases - a.totalPurchases);

  return {
    range: { startDate, endDate, label: rangeLabel },
    totalSales,
    salesCount: filteredInvoices.length,
    totalCollected,
    totalDownPayments,
    totalInstallmentsCollected,
    totalExpenses,
    totalPurchases,
    cashPurchases,
    creditPurchases,
    supplierPaymentsPaid,
    totalSalesReturns,
    cogs: totalPeriodCogs,
    grossProfit,
    grossMarginPercent,
    netProfit,
    netMarginPercent,
    collectionRate,
    averageOrderValue,
    outstandingReceivables,

    timelineSeries,

    incomeStatement: {
      grossSales: totalSales,
      salesReturns: totalSalesReturns,
      netSales,
      cogs: totalPeriodCogs,
      grossProfit,
      grossMargin: grossMarginPercent,
      expensesByCategory,
      totalOperatingExpenses: totalExpenses,
      netOperatingProfit: netProfit,
      netMargin: netMarginPercent,
    },

    inventory: {
      totalStockCost,
      totalStockSaleValue,
      potentialStockProfit: totalStockSaleValue - totalStockCost,
      itemCount: db.stockItems.length,
      lowStockCount,
      outOfStockCount,
      topSellingItems,
      slowMovingItems,
    },

    suppliersAnalytics: {
      totalPurchases,
      totalPaidToSuppliers: supplierPaymentsPaid + cashPurchases,
      totalDueToSuppliers: topSuppliers.reduce((s, x) => s + x.outstandingDue, 0),
      topSuppliers,
    },

    cashFlow: {
      totalInflow: cashInflowTotal,
      totalOutflow: cashOutflowTotal,
      netCashFlow,
      inflowBreakdown: {
        downPayments: totalDownPayments,
        installments: totalInstallmentsCollected,
      },
      outflowBreakdown: {
        expenses: totalExpenses,
        cashPurchases,
        supplierPayments: supplierPaymentsPaid,
        salesReturnsRefunds: totalSalesReturns,
      },
    },

    customerAnalytics: {
      totalActiveCustomers: topCustomers.length,
      topCustomers,
    },
  };
}
