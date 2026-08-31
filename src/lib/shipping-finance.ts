/**
 * ربط تسويات المناديب بالدورة المالية:
 * 1. تسجيل المبلغ المورّد كحركة وارد في الخزنة (Cashbox).
 * 2. تسجيل أجرة/عمولة الشحن كمصروف نقل في المصروفات.
 */
import { addManualTransaction, getTreasuryAccounts, type AccountType } from "@/lib/cashbox-system";
import { db } from "@/lib/store";

const METHOD_TO_ACCOUNT: Record<string, AccountType> = {
  cash: "cash",
  bank_transfer: "bank",
  instapay: "ewallet",
  vodafone_cash: "ewallet",
  other: "cash",
};

export function pickTreasuryAccountId(paymentMethod: string): string | null {
  const accounts = getTreasuryAccounts().filter((a) => a.active);
  if (!accounts.length) return null;
  const wanted = METHOD_TO_ACCOUNT[paymentMethod] ?? "cash";
  return (
    accounts.find((a) => a.type === wanted && a.isDefault)?.id ??
    accounts.find((a) => a.type === wanted)?.id ??
    accounts.find((a) => a.isDefault)?.id ??
    accounts[0].id
  );
}

/** يسجل توريد المندوب كحركة وارد في الخزنة ويرجع اسم الحساب أو null لو مفيش حسابات. */
export function recordCarrierSettlementInTreasury(params: {
  carrierName: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  date?: string;
}): string | null {
  const accountId = pickTreasuryAccountId(params.paymentMethod);
  if (!accountId) return null;
  addManualTransaction({
    accountId,
    type: "in",
    category: "تحصيل شحن",
    amount: Math.abs(params.amount),
    date: params.date ?? new Date().toISOString(),
    title: `توريد تحصيلات من ${params.carrierName}`,
    notes: params.notes,
    referenceNumber: params.referenceNumber,
    paymentMethod: params.paymentMethod,
    performedBy: "نظام الشحن",
  });
  const account = getTreasuryAccounts().find((a) => a.id === accountId);
  return account?.name ?? "الخزنة";
}

/** يسجل عمولة/أجرة المندوب كمصروف نقل في سجل المصروفات. */
export async function recordCarrierFeesAsExpense(params: {
  carrierName: string;
  amount: number;
  date?: string;
}): Promise<void> {
  if (!params.amount || params.amount <= 0) return;
  await db.addExpense({
    amount: Math.abs(params.amount),
    category: "transport",
    expenseDate: (params.date ?? new Date().toISOString()).slice(0, 10),
    notes: `عمولة توصيل — ${params.carrierName}`,
  } as never);
}
