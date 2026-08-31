import { useState, useEffect, useCallback } from "react";
import { getShopSettings, fmt, money, type ShopSettings } from "./store";
import { openPdfDocument, esc } from "./pdf-doc";

export interface CashShift {
  id: string;
  shiftNumber: number;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number; // الرصيد الافتتاحي بالدرج
  closingCashCount: number | null; // النقدية الفعلية بعد العد
  expectedCash: number; // المحسوب = الافتتاحي + مبيعات كاش + دفعات كاش - مصاريف - مشتريات كاش
  totalCashSales: number;
  totalSplitCash: number;
  totalInstallmentCash: number;
  totalElectronicSales: number;
  totalExpenses: number;
  totalPurchases: number;
  totalReturns: number;
  variance: number | null; // الفارق = الفعلي - المحسوب
  status: "open" | "closed";
  notes: string | null;
}

export interface ShiftStats {
  shiftNumber: number;
  cashierName: string;
  openedAt: string;
  closedAt?: string | null;
  openingBalance: number;
  cashSalesCount: number;
  cashSalesAmount: number;
  electronicSalesAmount: number;
  splitCashAmount: number;
  installmentCashAmount: number;
  expensesAmount: number;
  purchasesAmount: number;
  returnsAmount: number;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  expectedCashInDrawer: number;
  actualCount?: number | null;
  variance?: number | null;
}

const SHIFTS_KEY = "segilly:cash_shifts";
const ACTIVE_SHIFT_KEY = "segilly:active_shift";

const shiftListeners = new Set<() => void>();

function notifyShifts() {
  shiftListeners.forEach((l) => l());
}

export function loadAllShifts(): CashShift[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SHIFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAllShifts(shifts: CashShift[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts));
    notifyShifts();
  } catch (e) {
    console.error("Failed to save shifts:", e);
  }
}

export function getActiveShift(): CashShift | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SHIFT_KEY);
    if (!raw) return null;
    const shift: CashShift = JSON.parse(raw);
    return shift.status === "open" ? shift : null;
  } catch {
    return null;
  }
}

export function setActiveShift(shift: CashShift | null) {
  if (typeof localStorage === "undefined") return;
  try {
    if (shift && shift.status === "open") {
      localStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
    } else {
      localStorage.removeItem(ACTIVE_SHIFT_KEY);
    }
    notifyShifts();
  } catch (e) {
    console.error("Failed to set active shift:", e);
  }
}

export function openNewShift(params: {
  cashierName: string;
  openingBalance: number;
  notes?: string;
}): CashShift {
  const existing = getActiveShift();
  if (existing) {
    throw new Error("يوجد وردية مفتوحة بالفعل. يرجى تقفيلها أولاً.");
  }

  const all = loadAllShifts();
  const nextNum = all.length > 0 ? Math.max(...all.map((s) => s.shiftNumber || 0)) + 1 : 1;

  const newShift: CashShift = {
    id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    shiftNumber: nextNum,
    cashierName: params.cashierName.trim() || "الكاشير",
    openedAt: new Date().toISOString(),
    closedAt: null,
    openingBalance: Math.max(0, Number(params.openingBalance) || 0),
    closingCashCount: null,
    expectedCash: Math.max(0, Number(params.openingBalance) || 0),
    totalCashSales: 0,
    totalSplitCash: 0,
    totalInstallmentCash: 0,
    totalElectronicSales: 0,
    totalExpenses: 0,
    totalPurchases: 0,
    totalReturns: 0,
    variance: null,
    status: "open",
    notes: params.notes || null,
  };

  setActiveShift(newShift);
  saveAllShifts([newShift, ...all]);
  return newShift;
}

/**
 * Calculates current real-time stats for a shift using the database state
 */
export function calculateShiftStats(
  shift: CashShift,
  dbState: {
    invoices?: Array<{
      id: string;
      createdAt: string;
      total: number;
      downPayment: number;
      paid: number;
      status?: string;
      splitPayment?: { cash: number; electronic: number };
    }>;
    payments?: Array<{ id: string; amount: number; paidAt: string }>;
    expenses?: Array<{ id: string; amount: number; expenseDate: string; createdAt?: string }>;
    purchases?: Array<{
      id: string;
      total: number;
      paymentType: string;
      purchaseDate: string;
      createdAt?: string;
    }>;
    returns?: Array<{ id: string; totalAmount: number; createdAt: string }>;
  },
): ShiftStats {
  const startTime = new Date(shift.openedAt).getTime();
  const endTime = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();

  let cashSalesCount = 0;
  let cashSalesAmount = 0;
  let electronicSalesAmount = 0;
  let splitCashAmount = 0;

  (dbState.invoices || []).forEach((inv) => {
    const invTime = new Date(inv.createdAt).getTime();
    if (invTime >= startTime && invTime <= endTime) {
      if (inv.status === "cancelled") return;

      if (inv.splitPayment) {
        splitCashAmount += Number(inv.splitPayment.cash || 0);
        electronicSalesAmount += Number(inv.splitPayment.electronic || 0);
        cashSalesCount++;
      } else if (inv.downPayment >= inv.total && inv.total > 0) {
        // Pure cash sale
        cashSalesAmount += Number(inv.total);
        cashSalesCount++;
      } else if (inv.downPayment > 0) {
        // Installment with down payment
        cashSalesAmount += Number(inv.downPayment);
        cashSalesCount++;
      }
    }
  });

  let installmentCashAmount = 0;
  (dbState.payments || []).forEach((p) => {
    const pTime = new Date(p.paidAt).getTime();
    if (pTime >= startTime && pTime <= endTime) {
      installmentCashAmount += Number(p.amount || 0);
    }
  });

  let expensesAmount = 0;
  (dbState.expenses || []).forEach((e) => {
    const eTime = e.createdAt
      ? new Date(e.createdAt).getTime()
      : new Date(e.expenseDate).getTime();
    if (eTime >= startTime && eTime <= endTime) {
      expensesAmount += Number(e.amount || 0);
    }
  });

  let purchasesAmount = 0;
  (dbState.purchases || []).forEach((pur) => {
    if (pur.paymentType === "cash") {
      const purTime = pur.createdAt
        ? new Date(pur.createdAt).getTime()
        : new Date(pur.purchaseDate).getTime();
      if (purTime >= startTime && purTime <= endTime) {
        purchasesAmount += Number(pur.total || 0);
      }
    }
  });

  let returnsAmount = 0;
  (dbState.returns || []).forEach((ret) => {
    const retTime = new Date(ret.createdAt).getTime();
    if (retTime >= startTime && retTime <= endTime) {
      returnsAmount += Number(ret.totalAmount || 0);
    }
  });

  const totalInflow =
    shift.openingBalance +
    cashSalesAmount +
    splitCashAmount +
    installmentCashAmount;
  const totalOutflow = expensesAmount + purchasesAmount + returnsAmount;
  const netCashFlow = totalInflow - shift.openingBalance - totalOutflow;
  const expectedCashInDrawer = totalInflow - totalOutflow;

  const actualCount = shift.closingCashCount;
  const variance =
    actualCount !== null && actualCount !== undefined
      ? actualCount - expectedCashInDrawer
      : null;

  return {
    shiftNumber: shift.shiftNumber,
    cashierName: shift.cashierName,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    openingBalance: shift.openingBalance,
    cashSalesCount,
    cashSalesAmount,
    electronicSalesAmount,
    splitCashAmount,
    installmentCashAmount,
    expensesAmount,
    purchasesAmount,
    returnsAmount,
    totalInflow,
    totalOutflow,
    netCashFlow,
    expectedCashInDrawer,
    actualCount,
    variance,
  };
}

export function closeActiveShift(params: {
  shiftId: string;
  closingCashCount: number;
  stats: ShiftStats;
  notes?: string;
}): CashShift {
  const active = getActiveShift();
  if (!active || active.id !== params.shiftId) {
    throw new Error("الوردية غير موجودة أو تم إغلاقها بالفعل.");
  }

  const closedShift: CashShift = {
    ...active,
    closedAt: new Date().toISOString(),
    closingCashCount: Number(params.closingCashCount),
    expectedCash: params.stats.expectedCashInDrawer,
    totalCashSales: params.stats.cashSalesAmount,
    totalSplitCash: params.stats.splitCashAmount,
    totalInstallmentCash: params.stats.installmentCashAmount,
    totalElectronicSales: params.stats.electronicSalesAmount,
    totalExpenses: params.stats.expensesAmount,
    totalPurchases: params.stats.purchasesAmount,
    totalReturns: params.stats.returnsAmount,
    variance: Number(params.closingCashCount) - params.stats.expectedCashInDrawer,
    status: "closed",
    notes: params.notes ? `${active.notes ? `${active.notes}\n` : ""}${params.notes}` : active.notes,
  };

  const all = loadAllShifts();
  const updatedAll = all.map((s) => (s.id === closedShift.id ? closedShift : s));
  saveAllShifts(updatedAll);
  setActiveShift(null);

  return closedShift;
}

export function useShifts() {
  const [activeShift, setActive] = useState<CashShift | null>(getActiveShift());
  const [history, setHistory] = useState<CashShift[]>(loadAllShifts());

  useEffect(() => {
    const listener = () => {
      setActive(getActiveShift());
      setHistory(loadAllShifts());
    };
    shiftListeners.add(listener);
    return () => {
      shiftListeners.delete(listener);
    };
  }, []);

  return {
    activeShift,
    history,
    openShift: openNewShift,
    closeShift: closeActiveShift,
    hasOpenShift: !!activeShift,
  };
}

/**
 * Builds and opens a high-contrast 80mm / 58mm thermal Z-Report / X-Report
 */
export function printShiftReport(
  shift: CashShift,
  stats: ShiftStats,
  shop: ShopSettings,
  isZReport = true,
) {
  const cur = shop.currency || "ج.م";
  const reportType = isZReport ? "تقرير تقفيل الوردية (Z-Report)" : "تقرير جرد مؤقت (X-Report)";
  const now = new Date().toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const openTimeFormatted = new Date(shift.openedAt).toLocaleString("ar-EG", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const closeTimeFormatted = shift.closedAt
    ? new Date(shift.closedAt).toLocaleString("ar-EG", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "مستمرة حتى الآن";

  const variance = stats.variance ?? 0;
  const varianceStatus =
    variance === 0
      ? "مطابق تماماً (لا عجز ولا زيادة)"
      : variance > 0
        ? `زيادة بالدرج: +${fmt(variance)} ${cur}`
        : `عجز بالدرج: ${fmt(variance)} ${cur}`;

  const varianceClass =
    variance === 0 ? "color:#059669;" : variance > 0 ? "color:#0284c7;" : "color:#dc2626; font-weight:bold;";

  const paperWidth = shop.thermalPaperWidth === "58mm" ? "58mm" : "80mm";
  const maxW = shop.thermalPaperWidth === "58mm" ? "48mm" : "72mm";

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>${reportType} — وردية #${shift.shiftNumber}</title>
  <style>
    @page { size: ${paperWidth} auto; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      margin: 0; padding: 6px; font-family: 'Tahoma', 'Segoe UI', sans-serif;
      color: #000; background: #fff; font-size: 11px; line-height: 1.35;
      width: ${maxW}; margin: 0 auto;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .shop-title { font-size: 14px; font-weight: 900; margin-bottom: 2px; }
    .sub { font-size: 9.5px; color: #444; margin-bottom: 4px; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .badge {
      display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: bold;
      border: 1px solid #000; border-radius: 4px; margin: 3px 0;
    }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    td, th { padding: 2.5px 0; text-align: right; vertical-align: top; }
    td.num { text-align: left; direction: ltr; font-weight: bold; font-family: monospace; font-size: 11px; }
    .summary-box { border: 1.5px solid #000; padding: 6px; margin: 6px 0; background: #fdfdfd; }
    .big-num { font-size: 13px; font-weight: 900; }
    .sig-block { margin-top: 14px; text-align: center; }
    .sig-line { border-top: 1px dotted #000; width: 80%; margin: 18px auto 3px; }
    .footer { font-size: 8.5px; text-align: center; color: #555; margin-top: 10px; }
    @media print {
      body { width: 100%; padding: 2mm; }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="shop-title">${esc(shop.shopName || "سِجلّي ERP")}</div>
    ${shop.phone ? `<div class="sub">هاتف: ${esc(shop.phone)}</div>` : ""}
    ${shop.address ? `<div class="sub">${esc(shop.address)}</div>` : ""}
    <div class="badge">${reportType}</div>
    <div class="bold" style="font-size: 12px; margin-top: 2px;">وردية رقم: #${shift.shiftNumber}</div>
  </div>

  <div class="divider"></div>

  <table>
    <tr><td>الكاشير المسؤول:</td><td class="bold">${esc(shift.cashierName)}</td></tr>
    <tr><td>تاريخ الفتح:</td><td dir="ltr">${esc(openTimeFormatted)}</td></tr>
    <tr><td>تاريخ الإغلاق:</td><td dir="ltr">${esc(closeTimeFormatted)}</td></tr>
    <tr><td>وقت الطباعة:</td><td dir="ltr">${esc(now)}</td></tr>
  </table>

  <div class="divider"></div>

  <div class="bold center" style="margin-bottom: 3px;">حركة الخزينة والدرج</div>
  <table>
    <tr><td>( + ) رصيد الدرج الافتتاحي:</td><td class="num">${fmt(shift.openingBalance)} ${cur}</td></tr>
    <tr><td>( + ) مبيعات نقدية (كاش):</td><td class="num">${fmt(stats.cashSalesAmount)} ${cur}</td></tr>
    <tr><td>( + ) جزء كاش من دفع مختلط:</td><td class="num">${fmt(stats.splitCashAmount)} ${cur}</td></tr>
    <tr><td>( + ) أقساط محصلة نقداً:</td><td class="num">${fmt(stats.installmentCashAmount)} ${cur}</td></tr>
    <tr><td>( - ) مصاريف ونثريات:</td><td class="num">${fmt(stats.expensesAmount)} ${cur}</td></tr>
    <tr><td>( - ) مشتريات نقدية:</td><td class="num">${fmt(stats.purchasesAmount)} ${cur}</td></tr>
    <tr><td>( - ) مرتجعات نقدية:</td><td class="num">${fmt(stats.returnsAmount)} ${cur}</td></tr>
  </table>

  <div class="divider"></div>

  <table>
    <tr class="bold"><td>إجمالي مبيعات إلكترونية (فيزا/محافظ):</td><td class="num">${fmt(stats.electronicSalesAmount)} ${cur}</td></tr>
    <tr><td>عدد الفواتير الصادرة:</td><td class="num">${stats.cashSalesCount}</td></tr>
  </table>

  <div class="summary-box">
    <table>
      <tr class="big-num">
        <td>النقدية المفترضة بالدرج:</td>
        <td class="num">${fmt(stats.expectedCashInDrawer)} ${cur}</td>
      </tr>
      ${
        stats.actualCount !== null && stats.actualCount !== undefined
          ? `
      <tr class="big-num" style="border-top: 1px dashed #aaa; padding-top: 4px;">
        <td>النقدية الفعلية بعد العد:</td>
        <td class="num">${fmt(stats.actualCount)} ${cur}</td>
      </tr>
      <tr style="${varianceClass} border-top: 1px solid #000; font-size: 11.5px;">
        <td>حالة المطابقة:</td>
        <td class="bold" style="text-align:left;">${varianceStatus}</td>
      </tr>`
          : ""
      }
    </table>
  </div>

  ${shift.notes ? `<div style="font-size:9.5px; margin: 4px 0;"><b>ملاحظات الوردية:</b> ${esc(shift.notes)}</div>` : ""}

  <div class="sig-block">
    <div class="sig-line"></div>
    <div class="sub">توقيع مسؤول الوردية (${esc(shift.cashierName)})</div>
  </div>

  <div class="footer">
    نظام سِجلّي لإدارة التجزئة والمبيعات<br/>
    === نهاية التقرير ===
  </div>
</body>
</html>`;

  openPdfDocument(html, {
    autoPrint: true,
    features: "width=420,height=750",
  });
}
