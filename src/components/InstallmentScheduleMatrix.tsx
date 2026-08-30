import { useMemo, useState } from "react";
import { format, addMonths, parseISO, isPast, isToday, differenceInDays } from "date-fns";
import { type Invoice, type Customer, fmt } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, AlertTriangle, Wallet, Calendar, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InstallmentRow {
  index: number;
  dueDate: Date;
  dueAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "paid" | "partial" | "overdue" | "upcoming";
  daysLate: number;
}

export function calculateInstallmentSchedule(inv: Invoice, payments: { invoiceId: string; amount: number; paidAt: string }[]): InstallmentRow[] {
  if (!inv || inv.monthlyInstallment <= 0) return [];

  const totalCredit = Math.max(0, inv.total - inv.downPayment);
  if (totalCredit <= 0) return [];

  const installmentAmount = inv.monthlyInstallment;
  const count = Math.max(1, Math.ceil(totalCredit / installmentAmount));

  // Cumulative paid for installments (excluding downPayment if downPayment was recorded as initial paid)
  // In our system, inv.paid includes downPayment + subsequent payments.
  const paidForInstallments = Math.max(0, inv.paid - inv.downPayment);

  let remainingPool = paidForInstallments;
  let remainingCredit = totalCredit;
  const rows: InstallmentRow[] = [];

  let baseDate: Date;
  try {
    baseDate = inv.firstDueDate ? parseISO(inv.firstDueDate) : new Date(inv.createdAt);
  } catch {
    baseDate = new Date();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const dueDate = addMonths(baseDate, i);
    dueDate.setHours(0, 0, 0, 0);

    const dueAmount = Math.min(installmentAmount, remainingCredit);
    remainingCredit -= dueAmount;

    const paidAmount = Math.min(dueAmount, remainingPool);
    remainingPool = Math.max(0, remainingPool - paidAmount);

    const remainingAmount = Math.max(0, dueAmount - paidAmount);

    let status: "paid" | "partial" | "overdue" | "upcoming";
    let daysLate = 0;

    if (remainingAmount === 0) {
      status = "paid";
    } else if (paidAmount > 0) {
      status = "partial";
      if (dueDate < today) {
        daysLate = differenceInDays(today, dueDate);
      }
    } else if (dueDate < today) {
      status = "overdue";
      daysLate = differenceInDays(today, dueDate);
    } else {
      status = "upcoming";
    }

    rows.push({
      index: i + 1,
      dueDate,
      dueAmount,
      paidAmount,
      remainingAmount,
      status,
      daysLate,
    });
  }

  return rows;
}

export function InstallmentScheduleMatrix({
  inv,
  customer,
  payments,
  onPayInstallment,
  blurCls = "",
}: {
  inv: Invoice;
  customer?: Customer | null;
  payments: { invoiceId: string; amount: number; paidAt: string }[];
  onPayInstallment?: (amount: number, installmentIndex: number) => void;
  blurCls?: string;
}) {
  const schedule = useMemo(() => calculateInstallmentSchedule(inv, payments), [inv, payments]);

  if (inv.monthlyInstallment <= 0 || schedule.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-foreground/[0.03] border border-border/60 text-center text-xs text-muted-foreground">
        هذه الفاتورة تم سدادها نقداً وفورياً (لا يوجد جدول تقسيط دوري).
      </div>
    );
  }

  const paidCount = schedule.filter((s) => s.status === "paid").length;
  const overdueCount = schedule.filter((s) => s.status === "overdue").length;
  const progressPct = Math.round((paidCount / schedule.length) * 100);

  return (
    <div className="space-y-3 text-right" dir="rtl">
      {/* ملخص التقسيط */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-foreground/[0.025] border border-border/60">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-bold bg-success/10 text-success border-success/30">
            {paidCount} من {schedule.length} قسط مسدد ({progressPct}%)
          </Badge>
          {overdueCount > 0 && (
            <Badge variant="outline" className="text-xs font-bold bg-danger/10 text-danger border-danger/30 animate-pulse">
              {overdueCount} قسط متأخر
            </Badge>
          )}
        </div>
        <div className="text-xs font-bold text-foreground">
          جدول الأقساط الشهرية ({schedule.length} شهر)
        </div>
      </div>

      {/* شريط التقدم */}
      <div className="h-2 w-full rounded-full bg-foreground/[0.08] overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500 rounded-full", overdueCount > 0 ? "bg-amber-500" : "bg-success")}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* جدول الأقساط */}
      <div className="border border-border/60 rounded-2xl overflow-hidden shadow-xs">
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-foreground/[0.04] text-muted-foreground border-b border-border/60 sticky top-0 backdrop-blur-xs">
              <tr>
                <th className="text-center p-2 font-bold w-12">#</th>
                <th className="text-right p-2 font-bold">تاريخ الاستحقاق</th>
                <th className="text-right p-2 font-bold">قيمة القسط</th>
                <th className="text-right p-2 font-bold">المسدد</th>
                <th className="text-right p-2 font-bold">المتبقي</th>
                <th className="text-center p-2 font-bold">الحالة</th>
                {onPayInstallment && <th className="text-center p-2 font-bold w-20">إجراء</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {schedule.map((row) => (
                <tr
                  key={row.index}
                  className={cn(
                    "hover:bg-foreground/[0.02] transition-colors",
                    row.status === "paid" ? "bg-success/[0.02]" :
                    row.status === "overdue" ? "bg-danger/[0.04]" :
                    row.status === "partial" ? "bg-amber-500/[0.04]" : ""
                  )}
                >
                  <td className="p-2 text-center font-bold text-muted-foreground">{row.index}</td>
                  <td className="p-2 tabular-nums font-medium" dir="ltr">
                    {format(row.dueDate, "dd/MM/yyyy")}
                  </td>
                  <td className={cn("p-2 font-bold tabular-nums", blurCls)}>
                    {fmt(row.dueAmount)} ج.م
                  </td>
                  <td className={cn("p-2 tabular-nums text-success font-medium", blurCls)}>
                    {fmt(row.paidAmount)} ج.م
                  </td>
                  <td className={cn("p-2 tabular-nums font-bold", row.remainingAmount > 0 ? "text-danger" : "text-muted-foreground", blurCls)}>
                    {fmt(row.remainingAmount)} ج.م
                  </td>
                  <td className="p-2 text-center">
                    {row.status === "paid" && (
                      <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px] gap-1 py-0.5">
                        <CheckCircle2 className="w-3 h-3" /> مسدد بالكامل
                      </Badge>
                    )}
                    {row.status === "partial" && (
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1 py-0.5">
                        <Clock className="w-3 h-3" /> مسدد جزئياً
                      </Badge>
                    )}
                    {row.status === "overdue" && (
                      <Badge variant="outline" className="bg-danger/15 text-danger border-danger/30 text-[10px] gap-1 py-0.5 font-bold">
                        <AlertTriangle className="w-3 h-3" /> متأخر {row.daysLate} يوم
                      </Badge>
                    )}
                    {row.status === "upcoming" && (
                      <Badge variant="outline" className="bg-foreground/[0.06] text-muted-foreground border-border text-[10px] gap-1 py-0.5">
                        <Calendar className="w-3 h-3" /> قادم في موعده
                      </Badge>
                    )}
                  </td>
                  {onPayInstallment && (
                    <td className="p-2 text-center">
                      {row.remainingAmount > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onPayInstallment(row.remainingAmount, row.index)}
                          className="h-6 px-2 text-[10px] gap-1 border-success/40 text-success hover:bg-success/10 font-bold"
                        >
                          <Wallet className="w-2.5 h-2.5" /> سداد
                        </Button>
                      ) : (
                        <span className="text-[10px] text-success font-bold">✓ تم</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
