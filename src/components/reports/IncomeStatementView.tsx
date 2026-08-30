import React from "react";
import { ComprehensiveReportData } from "@/lib/reports-engine";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  PieChart as PieChartIcon,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

interface IncomeStatementViewProps {
  data: ComprehensiveReportData;
  blurCls: string;
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#64748b"];

export const IncomeStatementView: React.FC<IncomeStatementViewProps> = ({ data, blurCls }) => {
  const pl = data.incomeStatement;

  const expensePieData = pl.expensesByCategory.map((e) => ({
    name: e.label,
    value: e.amount,
  }));

  return (
    <div className="space-y-6">
      {/* P&L Statement Header & Quick Visual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground">صافي المبيعات التشغيلية</span>
          <div className="my-2">
            <span className={cn("text-2xl font-black text-foreground tabular-nums", blurCls)}>
              {fmt(pl.netSales)} ج.م
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            بعد خصم المرتجعات ({fmt(pl.salesReturns)} ج.م)
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground">مجمل الربح (Gross Profit)</span>
          <div className="my-2">
            <span className={cn("text-2xl font-black text-emerald-600 tabular-nums", blurCls)}>
              {fmt(pl.grossProfit)} ج.م
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">
            هامش مجمل الربح: {pl.grossMargin.toFixed(1)}%
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground">صافي الربح النهائي (Net Income)</span>
          <div className="my-2">
            <span
              className={cn(
                "text-2xl font-black tabular-nums",
                pl.netOperatingProfit >= 0 ? "text-emerald-600" : "text-rose-600",
                blurCls
              )}
            >
              {fmt(pl.netOperatingProfit)} ج.م
            </span>
          </div>
          <span
            className={cn(
              "text-[11px] font-semibold",
              pl.netOperatingProfit >= 0 ? "text-emerald-700" : "text-rose-700"
            )}
          >
            هامش صافي الربح: {pl.netMargin.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Main Income Statement Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="p-4 bg-muted/30 border-b border-border/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">قائمة الدخل والأرباح المحاسبية (P&L)</h3>
            <p className="text-xs text-muted-foreground">تحليل تفصيلي للإيرادات وتكلفة البضاعة والمصروفات وصافي العائد</p>
          </div>
          <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
            {data.range.label}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
              <tr>
                <th className="text-right p-3.5 font-semibold w-1/2">البند المالي المحاسبي</th>
                <th className="text-left p-3.5 font-semibold w-1/4">المبلغ (ج.م)</th>
                <th className="text-left p-3.5 font-semibold w-1/4">نسبة من المبيعات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {/* Gross Revenue */}
              <tr className="bg-background">
                <td className="p-3.5 font-bold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  إجمالي إيرادات المبيعات (Gross Sales)
                </td>
                <td className={cn("p-3.5 font-bold text-foreground text-left tabular-nums", blurCls)}>
                  {fmt(pl.grossSales)}
                </td>
                <td className="p-3.5 text-left text-muted-foreground tabular-nums">100.0%</td>
              </tr>

              {/* Sales Returns */}
              <tr className="bg-background text-muted-foreground">
                <td className="p-3.5 pr-8">(-) مردودات ومرتجعات المبيعات</td>
                <td className={cn("p-3.5 text-rose-600 font-medium text-left tabular-nums", blurCls)}>
                  -{fmt(pl.salesReturns)}
                </td>
                <td className="p-3.5 text-left text-rose-600 tabular-nums">
                  {pl.grossSales > 0 ? ((pl.salesReturns / pl.grossSales) * 100).toFixed(1) : 0}%
                </td>
              </tr>

              {/* Net Revenue */}
              <tr className="bg-muted/20 font-semibold text-foreground border-y border-border/60">
                <td className="p-3.5">(=) صافي المبيعات (Net Revenue)</td>
                <td className={cn("p-3.5 text-foreground font-bold text-left tabular-nums", blurCls)}>
                  {fmt(pl.netSales)}
                </td>
                <td className="p-3.5 text-left font-semibold text-muted-foreground tabular-nums">100.0%</td>
              </tr>

              {/* Cost of Goods Sold */}
              <tr className="bg-background">
                <td className="p-3.5 pr-8 text-muted-foreground">(-) تكلفة البضاعة المباعة (COGS)</td>
                <td className={cn("p-3.5 text-rose-600 font-medium text-left tabular-nums", blurCls)}>
                  -{fmt(pl.cogs)}
                </td>
                <td className="p-3.5 text-left text-muted-foreground tabular-nums">
                  {pl.netSales > 0 ? ((pl.cogs / pl.netSales) * 100).toFixed(1) : 0}%
                </td>
              </tr>

              {/* Gross Profit */}
              <tr className="bg-emerald-500/5 font-bold text-emerald-950 dark:text-emerald-300 border-y border-emerald-500/20">
                <td className="p-3.5 text-emerald-700 dark:text-emerald-400">
                  (=) مجمل الربح التجاري (Gross Profit)
                </td>
                <td className={cn("p-3.5 text-emerald-700 dark:text-emerald-400 text-left tabular-nums", blurCls)}>
                  {fmt(pl.grossProfit)}
                </td>
                <td className="p-3.5 text-left text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {pl.grossMargin.toFixed(1)}%
                </td>
              </tr>

              {/* Operating Expenses Section Header */}
              <tr className="bg-muted/30">
                <td colSpan={3} className="p-2.5 font-bold text-xs text-muted-foreground">
                  المصروفات التشغيلية والإدارية:
                </td>
              </tr>

              {/* Itemized expenses */}
              {pl.expensesByCategory.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-3 text-center text-muted-foreground italic">
                    لا توجد مصروفات مسجلة في هذه الفترة
                  </td>
                </tr>
              ) : (
                pl.expensesByCategory.map((e) => (
                  <tr key={e.category} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 pr-8 text-foreground font-medium">• {e.label}</td>
                    <td className={cn("p-3 text-rose-600 font-medium text-left tabular-nums", blurCls)}>
                      -{fmt(e.amount)}
                    </td>
                    <td className="p-3 text-left text-muted-foreground tabular-nums">
                      {pl.netSales > 0 ? ((e.amount / pl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))
              )}

              {/* Total Operating Expenses */}
              <tr className="bg-rose-500/5 font-semibold text-rose-950 dark:text-rose-300 border-y border-rose-500/20">
                <td className="p-3.5 text-rose-700 dark:text-rose-400">
                  (-) إجمالي المصروفات التشغيلية
                </td>
                <td className={cn("p-3.5 text-rose-700 dark:text-rose-400 text-left font-bold tabular-nums", blurCls)}>
                  -{fmt(pl.totalOperatingExpenses)}
                </td>
                <td className="p-3.5 text-left text-rose-700 dark:text-rose-400 tabular-nums">
                  {pl.netSales > 0 ? ((pl.totalOperatingExpenses / pl.netSales) * 100).toFixed(1) : 0}%
                </td>
              </tr>

              {/* Final Net Operating Profit */}
              <tr className="bg-primary/10 text-primary font-black text-sm border-t-2 border-primary">
                <td className="p-4">(=) صافي الأرباح التشغيلية النهائية (Net Profit)</td>
                <td className={cn("p-4 text-left tabular-nums text-base", blurCls)}>
                  {fmt(pl.netOperatingProfit)} ج.م
                </td>
                <td className="p-4 text-left tabular-nums">{pl.netMargin.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Expenses Distribution Visual */}
      {expensePieData.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-bold text-foreground">توزيع المصروفات حسب الأقسام</h4>
            </div>

            <div className="h-56 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensePieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {expensePieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => [`${fmt(val)} ج.م`, "المبلغ"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
            <h4 className="text-sm font-bold text-foreground mb-3">ملخص هيكل التكاليف</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>تكلفة البضاعة المباعة (COGS)</span>
                  <span className="tabular-nums">
                    {pl.netSales > 0 ? ((pl.cogs / pl.netSales) * 100).toFixed(1) : 0}% من المبيعات
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{
                      width: `${Math.min(100, pl.netSales > 0 ? (pl.cogs / pl.netSales) * 100 : 0)}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>المصروفات التشغيلية والإيجارات</span>
                  <span className="tabular-nums">
                    {pl.netSales > 0 ? ((pl.totalOperatingExpenses / pl.netSales) * 100).toFixed(1) : 0}% من المبيعات
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full"
                    style={{
                      width: `${Math.min(100, pl.netSales > 0 ? (pl.totalOperatingExpenses / pl.netSales) * 100 : 0)}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>صافي الربح المتبقي للنشاط</span>
                  <span className="tabular-nums font-bold text-emerald-600">
                    {pl.netMargin.toFixed(1)}% صافي ربحية
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, pl.netMargin))}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl text-[11px] text-muted-foreground flex items-center gap-2 mt-4">
              <Layers className="w-4 h-4 text-primary shrink-0" />
              <span>
                كل 100 جنيه مبيعات يتبقى منها{" "}
                <strong className="text-foreground">
                  {Math.max(0, pl.netMargin).toFixed(1)} ج.م
                </strong>{" "}
                ربحاً صافياً بعد دفع تكلفة البضاعة والمصاريف.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
