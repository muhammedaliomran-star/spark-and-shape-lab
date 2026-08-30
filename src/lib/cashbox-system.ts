/**
 * منظومة الخزينة والسيولة النقدية المتعددة والحسابات البنكية (Segilly Cashbox & Treasury Engine)
 * يشمل:
 * 1. إدارة الخزن والمحافظ الإلكترونية والحسابات البنكية (Multi-Account)
 * 2. التحويلات الداخلية بين الحسابات مع العمولات (Internal Transfers)
 * 3. حاسبة الفئات النقدية وجرد الدرج (Cash Denomination & Auditing)
 * 4. الحركات اليدوية المباشرة (إيداعات وسحوبات)
 * 5. كشف حساب الصندوق وطباعة تقارير PDF الرسمية
 */

import { pdfDocument, openPdfDocument, esc } from "@/lib/pdf-doc";
import { fmt, Invoice, Expense, Payment } from "@/lib/store";

export type AccountType = "cash" | "ewallet" | "bank" | "pos" | "petty";

export interface TreasuryAccount {
  id: string;
  name: string;
  type: AccountType;
  accountNumber?: string;
  bankName?: string;
  initialBalance: number;
  isDefault?: boolean;
  color?: string;
  icon?: string;
  active: boolean;
  createdAt: string;
}

export interface InternalTransfer {
  id: string;
  transferNumber: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  fee: number;
  feeRecordedAsExpense: boolean;
  date: string;
  referenceNumber?: string;
  notes?: string;
  performedBy: string;
  createdAt: string;
}

export interface ManualCashTransaction {
  id: string;
  accountId: string;
  type: "in" | "out";
  category: string;
  amount: number;
  date: string;
  title: string;
  notes?: string;
  referenceNumber?: string;
  paymentMethod?: string;
  performedBy: string;
  createdAt: string;
}

export interface CashDenominationAudit {
  id: string;
  auditNumber: string;
  accountId: string;
  countedAt: string;
  countedBy: string;
  denominations: {
    d200: number; // ورقات 200
    d100: number; // ورقات 100
    d50: number;  // ورقات 50
    d20: number;  // ورقات 20
    d10: number;  // ورقات 10
    d5: number;   // ورقات 5
    coins: number; // فكة ونقود معدنية
  };
  totalActualCash: number;
  systemExpectedCash: number;
  variance: number; // actual - expected
  varianceReason?: string;
  notes?: string;
  status: "settled" | "flagged";
}

const STORAGE_KEYS = {
  TREASURY_ACCOUNTS: "segilly_treasury_accounts_v1",
  INTERNAL_TRANSFERS: "segilly_internal_transfers_v1",
  MANUAL_TRANSACTIONS: "segilly_manual_cash_transactions_v1",
  DENOMINATION_AUDITS: "segilly_denomination_audits_v1",
  ACTIVE_ACCOUNT_ID: "segilly_active_cash_account_v1",
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Error reading ${key}:`, e);
    return fallback;
  }
}

function writeStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("segilly_cashbox_data_updated", { detail: { key } }));
  } catch (e) {
    console.error(`Error writing ${key}:`, e);
  }
}

// ==================== 1. الحسابات والخزن الافتراضية ====================

export function getDefaultTreasuryAccounts(): TreasuryAccount[] {
  return [
    {
      id: "acc-cash-main",
      name: "الدرج الرئيسي (كاش)",
      type: "cash",
      initialBalance: 0,
      isDefault: true,
      color: "emerald",
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "acc-vodafone-cash",
      name: "فودافون كاش / محافظ",
      type: "ewallet",
      accountNumber: "01000000000",
      initialBalance: 0,
      color: "red",
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "acc-instapay",
      name: "إنستاباي InstaPay",
      type: "ewallet",
      accountNumber: "username@instapay",
      initialBalance: 0,
      color: "purple",
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "acc-bank-main",
      name: "الحساب البنكي (البنك الأهلي)",
      type: "bank",
      bankName: "البنك الأهلي المصري",
      accountNumber: "1234567890",
      initialBalance: 0,
      color: "blue",
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function getTreasuryAccounts(): TreasuryAccount[] {
  const accounts = readStorage<TreasuryAccount[]>(STORAGE_KEYS.TREASURY_ACCOUNTS, []);
  if (accounts.length === 0) {
    const defaults = getDefaultTreasuryAccounts();
    writeStorage(STORAGE_KEYS.TREASURY_ACCOUNTS, defaults);
    return defaults;
  }
  return accounts;
}

export function saveTreasuryAccounts(accounts: TreasuryAccount[]): void {
  writeStorage(STORAGE_KEYS.TREASURY_ACCOUNTS, accounts);
}

export function addTreasuryAccount(acc: Omit<TreasuryAccount, "id" | "createdAt">): TreasuryAccount {
  const accounts = getTreasuryAccounts();
  const newAccount: TreasuryAccount = {
    ...acc,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  accounts.push(newAccount);
  saveTreasuryAccounts(accounts);
  return newAccount;
}

export function updateTreasuryAccount(id: string, patch: Partial<TreasuryAccount>): void {
  const accounts = getTreasuryAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...patch };
    saveTreasuryAccounts(accounts);
  }
}

export function deleteTreasuryAccount(id: string): boolean {
  const accounts = getTreasuryAccounts();
  if (accounts.length <= 1) return false; // keep at least one
  const filtered = accounts.filter((a) => a.id !== id);
  saveTreasuryAccounts(filtered);
  return true;
}

// ==================== 2. المعاملات اليدوية (Manual Transactions) ====================

export function getManualTransactions(): ManualCashTransaction[] {
  return readStorage<ManualCashTransaction[]>(STORAGE_KEYS.MANUAL_TRANSACTIONS, []);
}

export function saveManualTransactions(txs: ManualCashTransaction[]): void {
  writeStorage(STORAGE_KEYS.MANUAL_TRANSACTIONS, txs);
}

export function addManualTransaction(tx: Omit<ManualCashTransaction, "id" | "createdAt">): ManualCashTransaction {
  const txs = getManualTransactions();
  const newTx: ManualCashTransaction = {
    ...tx,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  txs.unshift(newTx);
  saveManualTransactions(txs);
  return newTx;
}

export function deleteManualTransaction(id: string): void {
  const txs = getManualTransactions().filter((t) => t.id !== id);
  saveManualTransactions(txs);
}

// ==================== 3. التحويلات الداخلية بين الحسابات ====================

export function getInternalTransfers(): InternalTransfer[] {
  return readStorage<InternalTransfer[]>(STORAGE_KEYS.INTERNAL_TRANSFERS, []);
}

export function saveInternalTransfers(transfers: InternalTransfer[]): void {
  writeStorage(STORAGE_KEYS.INTERNAL_TRANSFERS, transfers);
}

export function createInternalTransfer(params: Omit<InternalTransfer, "id" | "transferNumber" | "createdAt">): InternalTransfer {
  const transfers = getInternalTransfers();
  const nextNum = `#TR-${String(transfers.length + 1).padStart(4, "0")}`;

  const newTransfer: InternalTransfer = {
    ...params,
    id: crypto.randomUUID(),
    transferNumber: nextNum,
    createdAt: new Date().toISOString(),
  };

  transfers.unshift(newTransfer);
  saveInternalTransfers(transfers);
  return newTransfer;
}

export function deleteInternalTransfer(id: string): void {
  const transfers = getInternalTransfers().filter((t) => t.id !== id);
  saveInternalTransfers(transfers);
}

// ==================== 4. جرد الفئات النقدية (Denomination Audits) ====================

export function getDenominationAudits(): CashDenominationAudit[] {
  return readStorage<CashDenominationAudit[]>(STORAGE_KEYS.DENOMINATION_AUDITS, []);
}

export function saveDenominationAudits(audits: CashDenominationAudit[]): void {
  writeStorage(STORAGE_KEYS.DENOMINATION_AUDITS, audits);
}

export function calculateDenominationTotal(denoms: CashDenominationAudit["denominations"]): number {
  return (
    (denoms.d200 || 0) * 200 +
    (denoms.d100 || 0) * 100 +
    (denoms.d50 || 0) * 50 +
    (denoms.d20 || 0) * 20 +
    (denoms.d10 || 0) * 10 +
    (denoms.d5 || 0) * 5 +
    (denoms.coins || 0) * 1
  );
}

export function createDenominationAudit(
  audit: Omit<CashDenominationAudit, "id" | "auditNumber">
): CashDenominationAudit {
  const list = getDenominationAudits();
  const nextNum = `#AUDIT-${String(list.length + 1).padStart(4, "0")}`;
  const newAudit: CashDenominationAudit = {
    ...audit,
    id: crypto.randomUUID(),
    auditNumber: nextNum,
  };
  list.unshift(newAudit);
  saveDenominationAudits(list);
  return newAudit;
}

// ==================== 5. محرك الأرصدة وكشف الحساب المجمع ====================

export interface CashTransactionUnified {
  id: string;
  date: string;
  type: "in" | "out";
  category: string;
  title: string;
  amount: number;
  source: "invoice_downpayment" | "payment_installment" | "expense" | "manual" | "transfer_in" | "transfer_out" | "transfer_fee";
  accountId?: string;
  referenceId?: string;
  runningBalance?: number;
}

function getExpenseAccountId(exp: Expense): string {
  if (exp.notes) {
    const match = exp.notes.match(/<!--seg_meta:(.*?)-->/s);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.accountId) return parsed.accountId;
      } catch {
        // ignore
      }
    }
  }
  try {
    const raw = localStorage.getItem("segilly_expense_meta_map_v1");
    if (raw) {
      const map = JSON.parse(raw);
      if (map[exp.id]?.accountId) return map[exp.id].accountId;
    }
  } catch {
    // ignore
  }
  return "acc-cash-main";
}

/**
 * حساب رصيد كل حساب بدقة متكاملة
 */
export function calculateAccountBalance(
  account: TreasuryAccount,
  invoices: Invoice[],
  payments: Payment[],
  expenses: Expense[],
  manualTxs: ManualCashTransaction[],
  transfers: InternalTransfer[]
): {
  initial: number;
  inflows: number;
  outflows: number;
  currentBalance: number;
} {
  let inflows = 0;
  let outflows = 0;

  const isMainCash = account.id === "acc-cash-main" || account.isDefault;

  // Invoices downpayments (default to main cash if not tagged)
  if (isMainCash) {
    invoices.forEach((inv) => {
      inflows += inv.downPayment || 0;
    });
    payments.forEach((pay) => {
      inflows += pay.amount || 0;
    });
  }

  // Expenses deducted from specific treasury account
  expenses.forEach((exp) => {
    const expAccId = getExpenseAccountId(exp);
    if (expAccId === account.id || (!expAccId && isMainCash)) {
      outflows += exp.amount || 0;
    }
  });

  // Manual transactions
  manualTxs
    .filter((tx) => tx.accountId === account.id || (!tx.accountId && isMainCash))
    .forEach((tx) => {
      if (tx.type === "in") inflows += tx.amount;
      else outflows += tx.amount;
    });

  // Internal transfers
  transfers.forEach((trf) => {
    if (trf.fromAccountId === account.id) {
      outflows += trf.amount + (trf.fee || 0);
    }
    if (trf.toAccountId === account.id) {
      inflows += trf.amount;
    }
  });

  const currentBalance = (account.initialBalance || 0) + inflows - outflows;

  return {
    initial: account.initialBalance || 0,
    inflows: Math.round(inflows * 100) / 100,
    outflows: Math.round(outflows * 100) / 100,
    currentBalance: Math.round(currentBalance * 100) / 100,
  };
}

/**
 * تجهيز سجل الحركات الموحد والمصنف مع حساب الرصيد التراكمي
 */
export function getUnifiedCashLedger(
  invoices: Invoice[],
  payments: Payment[],
  expenses: Expense[],
  manualTxs: ManualCashTransaction[],
  transfers: InternalTransfer[],
  filterAccountId?: string
): CashTransactionUnified[] {
  const ledger: CashTransactionUnified[] = [];

  // Invoices
  invoices.forEach((inv) => {
    if (inv.downPayment > 0) {
      ledger.push({
        id: `inv-${inv.id}`,
        date: inv.createdAt,
        type: "in",
        category: "مقدم فاتورة / مبيعات كاش",
        title: `مقدم فاتورة رقم #${inv.id.slice(0, 6)}`,
        amount: inv.downPayment,
        source: "invoice_downpayment",
        accountId: "acc-cash-main",
        referenceId: inv.id,
      });
    }
  });

  // Payments
  payments.forEach((pay) => {
    ledger.push({
      id: `pay-${pay.id}`,
      date: pay.paidAt,
      type: "in",
      category: "تحصيل قسط",
      title: `قسط مستحق #${pay.id.slice(0, 6)}`,
      amount: pay.amount,
      source: "payment_installment",
      accountId: "acc-cash-main",
      referenceId: pay.invoiceId,
    });
  });

  // Expenses
  expenses.forEach((exp) => {
    const expAccId = getExpenseAccountId(exp);
    const cleanNotes = (exp.notes || "").replace(/<!--seg_meta:.*?-->/gs, "").trim();
    ledger.push({
      id: `exp-${exp.id}`,
      date: exp.expenseDate || exp.createdAt,
      type: "out",
      category: exp.category || "مصروف عام",
      title: cleanNotes || "مصروف عام",
      amount: exp.amount,
      source: "expense",
      accountId: expAccId,
      referenceId: exp.id,
    });
  });

  // Manual Transactions
  manualTxs.forEach((tx) => {
    ledger.push({
      id: `man-${tx.id}`,
      date: tx.date || tx.createdAt,
      type: tx.type,
      category: tx.category || (tx.type === "in" ? "إيداع يدوي" : "سحب يدوي"),
      title: tx.title,
      amount: tx.amount,
      source: "manual",
      accountId: tx.accountId || "acc-cash-main",
      referenceId: tx.id,
    });
  });

  // Transfers
  transfers.forEach((trf) => {
    // Out from source
    ledger.push({
      id: `trf-out-${trf.id}`,
      date: trf.date || trf.createdAt,
      type: "out",
      category: "تحويل مالي بين الحسابات",
      title: `تحويل صادر (${trf.transferNumber})`,
      amount: trf.amount,
      source: "transfer_out",
      accountId: trf.fromAccountId,
      referenceId: trf.id,
    });

    if (trf.fee > 0) {
      ledger.push({
        id: `trf-fee-${trf.id}`,
        date: trf.date || trf.createdAt,
        type: "out",
        category: "عمولة تحويل وسحب",
        title: `عمولة تحويل (${trf.transferNumber})`,
        amount: trf.fee,
        source: "transfer_fee",
        accountId: trf.fromAccountId,
        referenceId: trf.id,
      });
    }

    // In to destination
    ledger.push({
      id: `trf-in-${trf.id}`,
      date: trf.date || trf.createdAt,
      type: "in",
      category: "تحويل مالي بين الحسابات",
      title: `تحويل وارد (${trf.transferNumber})`,
      amount: trf.amount,
      source: "transfer_in",
      accountId: trf.toAccountId,
      referenceId: trf.id,
    });
  });

  // Filter if needed
  let filtered = ledger;
  if (filterAccountId && filterAccountId !== "all") {
    filtered = ledger.filter((t) => t.accountId === filterAccountId);
  }

  // Sort ascending for accurate running balance
  filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = 0;
  filtered.forEach((tx) => {
    if (tx.type === "in") running += tx.amount;
    else running -= tx.amount;
    tx.runningBalance = Math.round(running * 100) / 100;
  });

  // Return descending for display
  return filtered.reverse();
}

// ==================== 6. طباعة وتصدير كشف حساب الصندوق (PDF) ====================

export function printCashStatementPdf(params: {
  transactions: CashTransactionUnified[];
  accountName: string;
  totalInflow: number;
  totalOutflow: number;
  netBalance: number;
  dateRangeLabel: string;
  shopSettings?: any;
}): void {
  const cur = params.shopSettings?.currency || "ج.م";

  const rows = params.transactions
    .slice(0, 100) // top 100 records
    .map((tx, idx) => {
      const isPositive = tx.type === "in";
      const sign = isPositive ? "+" : "-";
      const color = isPositive ? "#16a34a" : "#dc2626";
      const formattedDate = new Date(tx.date).toLocaleDateString("ar-EG");

      return `
        <tr>
          <td style="text-align:center; padding:7px; border-bottom:1px solid #e2e8f0; font-size:11px;">${idx + 1}</td>
          <td style="padding:7px; border-bottom:1px solid #e2e8f0; font-size:11px; color:#64748b;">${formattedDate}</td>
          <td style="padding:7px; border-bottom:1px solid #e2e8f0; font-size:12px; font-weight:bold;">${esc(tx.title)}</td>
          <td style="padding:7px; border-bottom:1px solid #e2e8f0; font-size:11px; color:#475569;">${esc(tx.category)}</td>
          <td style="text-align:left; padding:7px; border-bottom:1px solid #e2e8f0; font-weight:bold; font-size:12px; color:${color};" dir="ltr">
            ${sign}${fmt(tx.amount)} ${cur}
          </td>
          <td style="text-align:left; padding:7px; border-bottom:1px solid #e2e8f0; font-weight:bold; font-size:12px; color:#0f172a;" dir="ltr">
            ${fmt(tx.runningBalance || 0)} ${cur}
          </td>
        </tr>
      `;
    })
    .join("");

  const body = `
    <div style="margin-bottom:16px; padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; font-size:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-weight:bold; font-size:14px;">كشف الحساب المالي: ${esc(params.accountName)}</span>
        <span style="color:#64748b;">الفترة: ${esc(params.dateRangeLabel)}</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-top:8px;">
        <div style="padding:8px; background:#f0fdf4; border-radius:6px; border:1px solid #bbf7d0;">
          <span style="color:#166534; display:block; font-size:11px;">إجمالي الوارد (المقبوضات)</span>
          <strong style="font-size:15px; color:#15803d;">+${fmt(params.totalInflow)} ${cur}</strong>
        </div>
        <div style="padding:8px; background:#fef2f2; border-radius:6px; border:1px solid #fecaca;">
          <span style="color:#991b1b; display:block; font-size:11px;">إجمالي المنصرف (المدفوعات)</span>
          <strong style="font-size:15px; color:#b91c1c;">-${fmt(params.totalOutflow)} ${cur}</strong>
        </div>
        <div style="padding:8px; background:#f0f9ff; border-radius:6px; border:1px solid #bae6fd;">
          <span style="color:#075985; display:block; font-size:11px;">صافي رصيد الصندوق</span>
          <strong style="font-size:15px; color:#0284c7;">${fmt(params.netBalance)} ${cur}</strong>
        </div>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; text-align:right; font-size:12px; margin-bottom:20px;">
      <thead>
        <tr style="background:#f1f5f9; color:#334155; font-weight:bold;">
          <th style="padding:8px; border-bottom:2px solid #cbd5e1; width:30px; text-align:center;">#</th>
          <th style="padding:8px; border-bottom:2px solid #cbd5e1; width:80px;">التاريخ</th>
          <th style="padding:8px; border-bottom:2px solid #cbd5e1;">البيان / المعاملة</th>
          <th style="padding:8px; border-bottom:2px solid #cbd5e1;">التصنيف</th>
          <th style="padding:8px; border-bottom:2px solid #cbd5e1; text-align:left;">المبلغ</th>
          <th style="padding:8px; border-bottom:2px solid #cbd5e1; text-align:left;">الرصيد التراكمي</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div style="margin-top:30px; display:flex; justify-content:space-between; font-size:12px; color:#475569; text-align:center;">
      <div>المسؤول المالي<br/><br/>...................</div>
      <div>مدير الحسابات<br/><br/>...................</div>
      <div>اعتماد الإدارة<br/><br/>...................</div>
    </div>
  `;

  const html = pdfDocument({
    docTitle: `كشف حساب ${params.accountName}`,
    title: `كشف حساب الصندوق (${params.accountName})`,
    badge: "إدارة الخزينة والسيولة",
    meta: [
      { label: "الحساب", value: params.accountName },
      { label: "الفترة", value: params.dateRangeLabel },
      { label: "تاريخ الاستخراج", value: new Date().toLocaleDateString("ar-EG") },
    ],
    kpis: [
      { label: "إجمالي المقبوضات", value: `+${fmt(params.totalInflow)} ${cur}`, tone: "brand" },
      { label: "إجمالي المدفوعات", value: `-${fmt(params.totalOutflow)} ${cur}`, tone: "danger" },
      { label: "صافي الرصيد", value: `${fmt(params.netBalance)} ${cur}`, tone: "brand" },
    ],
    body,
    footerNote: "تم استخراج كشف الحساب المالي إلكترونياً من منظومة سِجلّي لإدارة الأنشطة التجارية.",
    page: "A4",
    paper: "a4",
  });

  openPdfDocument(html, { autoPrint: true });
}
