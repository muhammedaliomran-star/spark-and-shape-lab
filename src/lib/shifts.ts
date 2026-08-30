// Cashier Shift Management (Z-Report, Cash Drawer Balancing)
// Persisted in localStorage per user/device

export interface CashierShift {
  id: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number; // العهدة الافتتاحية
  status: "open" | "closed";
  expectedCash?: number;
  actualCash?: number;
  difference?: number; // actual - expected (+ زيادة / - عجز)
  notes?: string;
  summary?: {
    cashSales: number;
    installmentDownPayments: number;
    collectedInstallments: number;
    cashExpenses: number;
    totalCashIn: number;
    totalCashOut: number;
    ordersCount: number;
  };
}

const SHIFT_STORAGE_KEY = "segilly:cashier_shifts";
const ACTIVE_SHIFT_KEY = "segilly:active_shift_id";

export function getAllShifts(): CashierShift[] {
  try {
    const raw = localStorage.getItem(SHIFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAllShifts(shifts: CashierShift[]) {
  try {
    localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(shifts));
  } catch {
    /* noop */
  }
}

export function getActiveShift(): CashierShift | null {
  const shifts = getAllShifts();
  const activeId = localStorage.getItem(ACTIVE_SHIFT_KEY);
  if (!activeId) {
    // Check if there's any shift with status === 'open'
    const openShift = shifts.find((s) => s.status === "open");
    if (openShift) {
      localStorage.setItem(ACTIVE_SHIFT_KEY, openShift.id);
      return openShift;
    }
    return null;
  }
  return shifts.find((s) => s.id === activeId && s.status === "open") || null;
}

export function startShift(openingCash: number, cashierName = "الكاشير العام"): CashierShift {
  const newShift: CashierShift = {
    id: "shift_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    cashierName,
    openedAt: new Date().toISOString(),
    openingCash: Math.max(0, openingCash),
    status: "open",
  };

  const shifts = getAllShifts();
  shifts.unshift(newShift);
  saveAllShifts(shifts);
  localStorage.setItem(ACTIVE_SHIFT_KEY, newShift.id);
  window.dispatchEvent(new CustomEvent("segilly:shift_changed"));
  return newShift;
}

export interface ShiftCalculatedMetrics {
  openingCash: number;
  cashSales: number;
  installmentDownPayments: number;
  collectedInstallments: number;
  cashExpenses: number;
  returnsRefunds: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedCashInDrawer: number;
  ordersCount: number;
}

export function calculateShiftMetrics(
  shift: CashierShift,
  dbData: {
    invoices: Array<{ createdAt: string; paid: number; total: number; downPayment: number; notes?: string | null }>;
    payments: Array<{ paidAt: string; amount: number }>;
    expenses: Array<{ expenseDate: string; createdAt?: string; amount: number }>;
    returns?: Array<{ createdAt: string; totalAmount: number; type: string }>;
  }
): ShiftCalculatedMetrics {
  const openTime = new Date(shift.openedAt).getTime();
  const closeTime = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();

  let cashSales = 0;
  let installmentDownPayments = 0;
  let ordersCount = 0;

  dbData.invoices.forEach((inv) => {
    const t = new Date(inv.createdAt).getTime();
    if (t >= openTime && t <= closeTime) {
      ordersCount++;
      const isCash = inv.paid >= inv.total;
      if (isCash) {
        cashSales += inv.paid;
      } else {
        installmentDownPayments += inv.downPayment || 0;
      }
    }
  });

  let collectedInstallments = 0;
  dbData.payments.forEach((p) => {
    const t = new Date(p.paidAt).getTime();
    if (t >= openTime && t <= closeTime) {
      collectedInstallments += p.amount;
    }
  });

  let cashExpenses = 0;
  dbData.expenses.forEach((e) => {
    const t = new Date(e.createdAt || e.expenseDate).getTime();
    if (t >= openTime && t <= closeTime) {
      cashExpenses += e.amount;
    }
  });

  let returnsRefunds = 0;
  (dbData.returns || []).forEach((r) => {
    const t = new Date(r.createdAt).getTime();
    if (t >= openTime && t <= closeTime && r.type === "sale") {
      returnsRefunds += r.totalAmount;
    }
  });

  const totalCashIn = cashSales + installmentDownPayments + collectedInstallments;
  const totalCashOut = cashExpenses + returnsRefunds;
  const expectedCashInDrawer = shift.openingCash + totalCashIn - totalCashOut;

  return {
    openingCash: shift.openingCash,
    cashSales,
    installmentDownPayments,
    collectedInstallments,
    cashExpenses,
    returnsRefunds,
    totalCashIn,
    totalCashOut,
    expectedCashInDrawer,
    ordersCount,
  };
}

export function closeShift(
  shiftId: string,
  actualCash: number,
  metrics: ShiftCalculatedMetrics,
  notes?: string
): CashierShift {
  const shifts = getAllShifts();
  const idx = shifts.findIndex((s) => s.id === shiftId);
  if (idx < 0) throw new Error("الوردية غير موجودة");

  const diff = actualCash - metrics.expectedCashInDrawer;

  shifts[idx] = {
    ...shifts[idx],
    status: "closed",
    closedAt: new Date().toISOString(),
    expectedCash: metrics.expectedCashInDrawer,
    actualCash,
    difference: diff,
    notes,
    summary: {
      cashSales: metrics.cashSales,
      installmentDownPayments: metrics.installmentDownPayments,
      collectedInstallments: metrics.collectedInstallments,
      cashExpenses: metrics.cashExpenses,
      totalCashIn: metrics.totalCashIn,
      totalCashOut: metrics.totalCashOut,
      ordersCount: metrics.ordersCount,
    },
  };

  saveAllShifts(shifts);
  localStorage.removeItem(ACTIVE_SHIFT_KEY);
  window.dispatchEvent(new CustomEvent("segilly:shift_changed"));
  return shifts[idx];
}
