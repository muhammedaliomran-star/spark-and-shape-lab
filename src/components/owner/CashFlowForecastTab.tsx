import React, { useState, useMemo } from "react";
import { fmt, type Invoice, type Purchase, type SupplierPayment, type Expense } from "@/lib/store";
import { roundCurrency } from "@/lib/financial-engine";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  DollarSign,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

interface CashFlowForecastTabProps {
  invoices: Invoice[];
  purchases: Purchase[];
  supplierPayments: SupplierPayment[];
  expenses: Expense[];
}

export function CashFlowForecastTab({
  invoices,
  purchases,
  supplierPayments,
  expenses,
}: CashFlowForecastTabProps) {
  const [collectionRatePercent, setCollectionRatePercent] = useState<number>(85); // 85% default realistic rate
  const [customMonthlyExpenseEstimate, setCustomMonthlyExpenseEstimate] = useState<number>(0);

  // Calculate past average monthly expense
  const avgMonthlyExpense = useMemo(() => {
    if (expenses.length === 0) return 3000;
    const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    return Math.max(1000, Math.round(totalExp / 3)); // approx 3 months
  }, [expenses]);

  const effectiveMonthlyExpense = customMonthlyExpenseEstimate > 0 ? customMonthlyExpenseEstimate : avgMonthlyExpense;

  // Build future 6 months
  const forecastData = useMemo(() => {
    const months: Array<{
      monthKey: string;
      label: string;
      inboundInstallments: number;
      effectiveInbound: number;
      outboundSuppliers: number;
      outboundExpenses: number;
      totalOutbound: number;
      netCashflow: number;
      status: "surplus" | "tight" | "deficit";
    }> = [];

    const now = new Date();

    for (let i = 0; i < 6; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = targetDate.getFullYear();
      const monthNum = targetDate.getMonth() + 1;
      const monthKey = `${year}-${String(monthNum).padStart(2, "0")}`;

      const monthLabel = targetDate.toLocaleDateString("ar-EG", {
        month: "long",
        year: "numeric",
      });

      // Calculate scheduled installments falling in this month
      let scheduledInstallments = 0;

      invoices.forEach((inv) => {
        if (inv.monthlyInstallment && inv.monthlyInstallment > 0) {
          const remaining = inv.total - inv.paid;
          if (remaining > 0) {
            // Count monthly installment if contract covers this month
            scheduledInstallments += Math.min(inv.monthlyInstallment, remaining);
          }
        }
      });

      // Adjust with sensitivity factor
      const effectiveInbound = roundCurrency(scheduledInstallments * (collectionRatePercent / 100));

      // Calculate supplier obligations roughly spread
      const unpaidSuppliers = purchases
        .filter((p) => p.paymentType === "credit")
        .reduce((sum, p) => sum + (p.total || 0), 0);
      const outboundSuppliers = Math.round(unpaidSuppliers / 6); // spread across 6 months

      const totalOutbound = outboundSuppliers + effectiveMonthlyExpense;
      const netCashflow = effectiveInbound - totalOutbound;

      let status: "surplus" | "tight" | "deficit" = "surplus";
      if (netCashflow < 0) {
        status = "deficit";
      } else if (netCashflow < 5000) {
        status = "tight";
      }

      months.push({
        monthKey,
        label: monthLabel,
        inboundInstallments: scheduledInstallments,
        effectiveInbound,
        outboundSuppliers,
        outboundExpenses: effectiveMonthlyExpense,
        totalOutbound,
        netCashflow,
        status,
      });
    }

    return months;
  }, [invoices, purchases, collectionRatePercent, effectiveMonthlyExpense]);

  const totalProjectedInbound = forecastData.reduce((s, m) => s + m.effectiveInbound, 0);
  const totalProjectedOutbound = forecastData.reduce((s, m) => s + m.totalOutbound, 0);
  const totalNetProjected = totalProjectedInbound - totalProjectedOutbound;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>محاكي التدفق النقدي والتنبؤ بالأشهر القادمة (Cash Flow Horizon)</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              توقع السيولة القادمة من الأقساط المجدولة ومقارنتها بالتزامات الموردين والمصروفات لتفادي أي عجز نقدي مسبقاً.
            </p>
          </div>

          {/* Collection Sensitivity Slider */}
          <div className="rounded-2xl border border-border/80 bg-card/90 p-3 flex flex-col gap-2 min-w-[260px]">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-muted-foreground flex items-center gap-1">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                <span>نسبة التحصيل المتوقعة:</span>
              </span>
              <span className="font-black text-primary text-sm">{collectionRatePercent}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={collectionRatePercent}
              onChange={(e) => setCollectionRatePercent(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>متحفظ (50%)</span>
              <span>واقعي (85%)</span>
              <span>مثالي (100%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Overview Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي التحصيلات المتوقعة (6 أشهر)</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {fmt(totalProjectedInbound)} ج.م
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            بناءً على نسبة تحصيل {collectionRatePercent}% من الأقساط
          </div>
        </div>

        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي الالتزامات والمصروفات (6 أشهر)</span>
            <ArrowDownRight className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {fmt(totalProjectedOutbound)} ج.م
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            دفعات موردين ومصاريف تشغيل تقديرية
          </div>
        </div>

        <div
          className={cn(
            "rounded-3xl border p-5",
            totalNetProjected >= 0
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-danger/30 bg-danger/5 text-danger"
          )}
        >
          <div className="flex items-center justify-between text-xs opacity-80">
            <span>صافي الفائض النقدي المتوقع</span>
            {totalNetProjected >= 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-danger" />
            )}
          </div>
          <div className="text-2xl font-black mt-2">
            {totalNetProjected >= 0 ? `+${fmt(totalNetProjected)}` : fmt(totalNetProjected)} ج.م
          </div>
          <div className="text-[11px] opacity-80 mt-1">
            {totalNetProjected >= 0 ? "السيولة في وضع آمن ومريح" : "تنبيه: يلزم تكثيف التحصيل لتغطية الالتزامات"}
          </div>
        </div>
      </div>

      {/* Chart Visualization */}
      <div className="rounded-3xl border border-border/80 bg-card/60 p-6 space-y-4">
        <h4 className="text-base font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span>مقارنة التدفقات الشهرية (الداخل مقابل الخارج)</span>
        </h4>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={forecastData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} />
              <YAxis stroke="#888888" fontSize={11} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                formatter={(value: any, name: any) => [
                  `${fmt(Number(value))} ج.م`,
                  name === "effectiveInbound"
                    ? "التحصيل المتوقع (داخل)"
                    : name === "totalOutbound"
                    ? "الالتزامات والمصروفات (خارج)"
                    : "صافي السيولة",
                ]}
                contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "1rem", color: "#fff" }}
              />
              <Legend
                formatter={(value) =>
                  value === "effectiveInbound"
                    ? "التحصيل المتوقع (داخل)"
                    : value === "totalOutbound"
                    ? "الالتزامات (خارج)"
                    : "صافي السيولة"
                }
              />
              <Bar dataKey="effectiveInbound" fill="#10b981" radius={[6, 6, 0, 0]} name="effectiveInbound" />
              <Bar dataKey="totalOutbound" fill="#f43f5e" radius={[6, 6, 0, 0]} name="totalOutbound" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Month-by-Month Detailed Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {forecastData.map((m) => (
          <div
            key={m.monthKey}
            className={cn(
              "rounded-3xl border p-5 space-y-3 shadow-sm",
              m.status === "deficit"
                ? "border-danger/40 bg-danger/5"
                : m.status === "tight"
                ? "border-warning/40 bg-warning/5"
                : "border-border/80 bg-card/60"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-foreground">{m.label}</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-extrabold",
                  m.status === "deficit"
                    ? "bg-danger text-danger-foreground"
                    : m.status === "tight"
                    ? "bg-warning text-black"
                    : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                )}
              >
                {m.status === "deficit" ? "عجز محتمل" : m.status === "tight" ? "سيولة متوازنة" : "فائض سيولة"}
              </span>
            </div>

            <div className="space-y-1.5 rounded-2xl border border-border/40 bg-card/80 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">أقساط مجدولة:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+{fmt(m.effectiveInbound)} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">دفعات موردين ومصاريف:</span>
                <span className="font-bold text-rose-500">-{fmt(m.totalOutbound)} ج.م</span>
              </div>
              <div className="border-t border-border/40 pt-1.5 flex justify-between font-black">
                <span className="text-foreground">صافي الشهر:</span>
                <span className={m.netCashflow >= 0 ? "text-emerald-500" : "text-danger"}>
                  {m.netCashflow >= 0 ? `+${fmt(m.netCashflow)}` : fmt(m.netCashflow)} ج.م
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
