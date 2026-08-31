// Cashier shift management (POS Z-Report) — localStorage backed
export interface ShiftSummary {
  cashSales: number;
  installmentDownPayments: number;
  collectedInstallments: number;
  cashExpenses: number;
  totalCashIn: number;
  totalCashOut: number;
  ordersCount: number;
}

export interface ShiftCalculatedMetrics extends ShiftSummary {
  expectedCashInDrawer: number;
}

export interface CashierShift {
  id: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string | null;
  status: "open" | "closed";
  openingCash: number;
  expectedCash?: number | null;
  actualCash?: number | null;
  difference?: number | null;
  notes?: string | null;
  summary?: ShiftSummary;
}

const SHIFTS_KEY = "segilly:cashier_shifts_v1";

function read(): CashierShift[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SHIFTS_KEY);
    return raw ? (JSON.parse(raw) as CashierShift[]) : [];
  } catch {
    return [];
  }
}

function write(list: CashierShift[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("segilly:shift_changed"));
  } catch {
    /* ignore */
  }
}

export function getAllShifts(): CashierShift[] {
  return read().sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
  );
}

export function getActiveShift(): CashierShift | null {
  return read().find((s) => s.status === "open") || null;
}

export function startShift(openingCash: number, cashierName: string): CashierShift {
  const all = read();
  if (all.some((s) => s.status === "open")) {
    throw new Error("يوجد وردية مفتوحة بالفعل");
  }
  const shift: CashierShift = {
    id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    cashierName: cashierName || "الكاشير العام",
    openedAt: new Date().toISOString(),
    closedAt: null,
    status: "open",
    openingCash: Math.max(0, Number(openingCash) || 0),
    notes: null,
  };
  write([shift, ...all]);
  return shift;
}

interface MetricsInput {
  invoices?: any[];
  payments?: any[];
  expenses?: any[];
  returns?: any[];
}

export function calculateShiftMetrics(
  shift: CashierShift,
  db: MetricsInput,
): ShiftCalculatedMetrics {
  const start = new Date(shift.openedAt).getTime();
  const end = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();
  const inRange = (d?: string) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return !isNaN(t) && t >= start && t <= end;
  };

  let cashSales = 0;
  let installmentDownPayments = 0;
  let ordersCount = 0;

  (db.invoices || []).forEach((inv: any) => {
    if (!inRange(inv.createdAt)) return;
    if (inv.status === "cancelled") return;
    ordersCount++;
    const total = Number(inv.total || 0);
    const down = Number(inv.downPayment || 0);
    const paid = Number(inv.paid ?? down ?? 0);
    if (down > 0 && down < total) installmentDownPayments += down;
    else cashSales += paid || total;
  });

  let collectedInstallments = 0;
  (db.payments || []).forEach((p: any) => {
    if (inRange(p.paidAt || p.createdAt)) collectedInstallments += Number(p.amount || 0);
  });

  let cashExpenses = 0;
  (db.expenses || []).forEach((e: any) => {
    if (inRange(e.createdAt || e.expenseDate)) cashExpenses += Number(e.amount || 0);
  });
  (db.returns || []).forEach((r: any) => {
    if (inRange(r.createdAt)) cashExpenses += Number(r.totalAmount || r.amount || 0);
  });

  const totalCashIn = cashSales + installmentDownPayments + collectedInstallments;
  const totalCashOut = cashExpenses;

  return {
    cashSales,
    installmentDownPayments,
    collectedInstallments,
    cashExpenses,
    totalCashIn,
    totalCashOut,
    ordersCount,
    expectedCashInDrawer: shift.openingCash + totalCashIn - totalCashOut,
  };
}

export function closeShift(
  shiftId: string,
  actualCash: number,
  metrics: ShiftCalculatedMetrics,
  notes?: string,
): CashierShift {
  const all = read();
  const idx = all.findIndex((s) => s.id === shiftId);
  if (idx === -1) throw new Error("الوردية غير موجودة");

  const { expectedCashInDrawer, ...summary } = metrics;
  const closed: CashierShift = {
    ...all[idx],
    status: "closed",
    closedAt: new Date().toISOString(),
    expectedCash: expectedCashInDrawer,
    actualCash: Number(actualCash) || 0,
    difference: (Number(actualCash) || 0) - expectedCashInDrawer,
    notes: notes?.trim() ? notes.trim() : all[idx].notes ?? null,
    summary,
  };
  all[idx] = closed;
  write(all);
  return closed;
}
