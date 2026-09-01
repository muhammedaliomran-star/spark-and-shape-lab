/**
 * مزامنة منظومة الخزينة (Cashbox) مع قاعدة البيانات السحابية.
 * الاستراتيجية: التخزين المحلي يظل الكاش السريع للواجهة،
 * وكل عملية كتابة تُدفع للسحابة، وعند فتح الصفحة تُسحب البيانات من السحابة وتحل محل الكاش.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  TreasuryAccount,
  InternalTransfer,
  ManualCashTransaction,
  CashDenominationAudit,
} from "@/lib/cashbox-system";

const table = (name: string) => (supabase.from as any)(name);

async function uid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/* ==================== Mappers ==================== */

const accountToRow = (a: TreasuryAccount, user_id: string) => ({
  user_id,
  local_key: a.id,
  name: a.name,
  type: a.type,
  initial_balance: a.initialBalance ?? 0,
  account_number: a.accountNumber ?? null,
  bank_name: a.bankName ?? null,
  color: a.color ?? "emerald",
  active: a.active !== false,
});

const rowToAccount = (r: any): TreasuryAccount => ({
  id: r.local_key || r.id,
  name: r.name,
  type: r.type,
  accountNumber: r.account_number ?? undefined,
  bankName: r.bank_name ?? undefined,
  initialBalance: Number(r.initial_balance || 0),
  color: r.color ?? undefined,
  active: r.active !== false,
  createdAt: r.created_at,
});

const manualToRow = (t: ManualCashTransaction, user_id: string) => ({
  id: t.id,
  user_id,
  account_key: t.accountId,
  type: t.type,
  category: t.category || "عام",
  amount: t.amount ?? 0,
  tx_date: t.date,
  title: t.title,
  notes: t.notes ?? null,
  reference_number: t.referenceNumber ?? null,
  payment_method: t.paymentMethod ?? null,
  performed_by: t.performedBy ?? null,
});

const rowToManual = (r: any): ManualCashTransaction => ({
  id: r.id,
  accountId: r.account_key,
  type: r.type,
  category: r.category,
  amount: Number(r.amount || 0),
  date: r.tx_date,
  title: r.title,
  notes: r.notes ?? undefined,
  referenceNumber: r.reference_number ?? undefined,
  paymentMethod: r.payment_method ?? undefined,
  performedBy: r.performed_by ?? "",
  createdAt: r.created_at,
});

const transferToRow = (t: InternalTransfer, user_id: string) => ({
  id: t.id,
  user_id,
  transfer_number: t.transferNumber,
  from_account_key: t.fromAccountId,
  to_account_key: t.toAccountId,
  amount: t.amount ?? 0,
  fee: t.fee ?? 0,
  fee_recorded_as_expense: !!t.feeRecordedAsExpense,
  transfer_date: t.date,
  reference_number: t.referenceNumber ?? null,
  notes: t.notes ?? null,
  performed_by: t.performedBy ?? null,
});

const rowToTransfer = (r: any): InternalTransfer => ({
  id: r.id,
  transferNumber: r.transfer_number,
  fromAccountId: r.from_account_key,
  toAccountId: r.to_account_key,
  amount: Number(r.amount || 0),
  fee: Number(r.fee || 0),
  feeRecordedAsExpense: !!r.fee_recorded_as_expense,
  date: r.transfer_date,
  referenceNumber: r.reference_number ?? undefined,
  notes: r.notes ?? undefined,
  performedBy: r.performed_by ?? "",
  createdAt: r.created_at,
});

const auditToRow = (a: CashDenominationAudit, user_id: string) => ({
  id: a.id,
  user_id,
  audit_number: a.auditNumber,
  account_key: a.accountId,
  counted_at: a.countedAt,
  counted_by: a.countedBy ?? null,
  denominations: a.denominations,
  total_actual_cash: a.totalActualCash ?? 0,
  system_expected_cash: a.systemExpectedCash ?? 0,
  variance: a.variance ?? 0,
  variance_reason: a.varianceReason ?? null,
  notes: a.notes ?? null,
  status: a.status || "settled",
});

const rowToAudit = (r: any): CashDenominationAudit => ({
  id: r.id,
  auditNumber: r.audit_number,
  accountId: r.account_key,
  countedAt: r.counted_at,
  countedBy: r.counted_by ?? "",
  denominations: r.denominations || { d200: 0, d100: 0, d50: 0, d20: 0, d10: 0, d5: 0, coins: 0 },
  totalActualCash: Number(r.total_actual_cash || 0),
  systemExpectedCash: Number(r.system_expected_cash || 0),
  variance: Number(r.variance || 0),
  varianceReason: r.variance_reason ?? undefined,
  notes: r.notes ?? undefined,
  status: r.status === "flagged" ? "flagged" : "settled",
});

/* ==================== Push (كتابة للسحابة) ==================== */

export async function pushAccount(acc: TreasuryAccount): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_accounts").upsert(accountToRow(acc, user_id), { onConflict: "user_id,local_key" });
}

export async function removeAccount(localKey: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_accounts").delete().eq("user_id", user_id).eq("local_key", localKey);
}

export async function pushManualTransaction(tx: ManualCashTransaction): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_manual_transactions").upsert(manualToRow(tx, user_id));
}

export async function removeManualTransaction(id: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_manual_transactions").delete().eq("user_id", user_id).eq("id", id);
}

export async function pushTransfer(tr: InternalTransfer): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_transfers").upsert(transferToRow(tr, user_id));
}

export async function removeTransfer(id: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_transfers").delete().eq("user_id", user_id).eq("id", id);
}

export async function pushAudit(audit: CashDenominationAudit): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_denomination_audits").upsert(auditToRow(audit, user_id));
}

/* ==================== Pull (سحب من السحابة) ==================== */

export async function pullCashboxFromCloud(): Promise<boolean> {
  const user_id = await uid();
  if (!user_id) return false;

  const [accounts, manual, transfers, audits] = await Promise.all([
    table("treasury_accounts").select("*").eq("user_id", user_id).order("created_at", { ascending: true }),
    table("treasury_manual_transactions").select("*").eq("user_id", user_id).order("created_at", { ascending: false }),
    table("treasury_transfers").select("*").eq("user_id", user_id).order("created_at", { ascending: false }),
    table("treasury_denomination_audits").select("*").eq("user_id", user_id).order("counted_at", { ascending: false }),
  ]);

  const mod = await import("@/lib/cashbox-system");

  if (!accounts.error && Array.isArray(accounts.data)) {
    if (accounts.data.length > 0) {
      mod.saveTreasuryAccounts(accounts.data.map(rowToAccount));
    } else {
      // أول مرة: ارفع الخزن المحلية (أو الافتراضية) للسحابة
      const local = mod.getTreasuryAccounts();
      await table("treasury_accounts").upsert(
        local.map((a) => accountToRow(a, user_id)),
        { onConflict: "user_id,local_key" }
      );
    }
  }

  if (!manual.error && Array.isArray(manual.data)) mod.saveManualTransactions(manual.data.map(rowToManual));
  if (!transfers.error && Array.isArray(transfers.data)) mod.saveInternalTransfers(transfers.data.map(rowToTransfer));
  if (!audits.error && Array.isArray(audits.data)) mod.saveDenominationAudits(audits.data.map(rowToAudit));

  return true;
}
