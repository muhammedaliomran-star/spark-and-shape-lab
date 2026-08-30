import React from "react";
import { ComprehensiveReportData } from "@/lib/reports-engine";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Building,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface CashFlowViewProps {
  data: ComprehensiveReportData;
  blurCls: string;
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({ data, blurCls }) => {
  const cf = data.cashFlow;

  const hasSeriesData = data.timelineSeries.some((r) => r.cashIn > 0 || r.cashOut > 0);

  return (
    <div className="space-y-6">
      {/* Cash Flow Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">إجمالي المقبوضات النقدية (Inflow)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className={cn("text-2xl font-black text-emerald-600 tabular-nums", blurCls)}>
              +{fmt(cf.totalInflow)} ج.م
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            مقدمات فواتير ({fmt(cf.inflowBreakdown.downPayments)} ج.م) + أقساط ({fmt(cf.inflowBreakdown.installments)} ج.م)
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">إجمالي المدفوعات النقدية (Outflow)</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className={cn("text-2xl font-black text-rose-600 tabular-nums", blurCls)}>
              -{fmt(cf.totalOutflow)} ج.م
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            مصروفات ومشتريات كاش وسداد موردين
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">صافي التدفق النقدي للفترة</span>
            <div
              className={cn(
                "p-2 rounded-xl",
                cf.netCashFlow >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
              )}
            >
              {cf.netCashFlow >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="my-2">
            <span
              className={cn(
                "text-2xl font-black tabular-nums",
                cf.netCashFlow >= 0 ? "text-emerald-600" : "text-rose-600",
                blurCls
              )}
            >
              {cf.netCashFlow >= 0 ? `+${fmt(cf.netCashFlow)}` : fmt(cf.netCashFlow)} ج.م
            </span>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {cf.netCashFlow >= 0 ? "فائض سيولة إيجابي في الخزينة" : "عجز سيولة مؤقت خلال الفترة"}
          </span>
        </div>
      </div>

      {/* Cash Flow Detailed Inflow & Outflow Breakdown */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Inflows breakdown */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/80">
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-foreground">مصادر السيولة النقدية الداخلة (Inflow)</h4>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
              <span className="font-medium text-foreground">مقدمات الفواتير والمبيعات النقدية:</span>
              <span className={cn("font-bold text-emerald-600 tabular-nums", blurCls)}>
                +{fmt(cf.inflowBreakdown.downPayments)} ج.م
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
              <span className="font-medium text-foreground">تحصيلات الأقساط والديون من العملاء:</span>
              <span className={cn("font-bold text-emerald-600 tabular-nums", blurCls)}>
                +{fmt(cf.inflowBreakdown.installments)} ج.م
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 font-bold text-emerald-950 dark:text-emerald-300">
              <span>إجمالي المقبوضات النقدية:</span>
              <span className={cn("tabular-nums text-emerald-700 dark:text-emerald-400 text-sm", blurCls)}>
                +{fmt(cf.totalInflow)} ج.م
              </span>
            </div>
          </div>
        </div>

        {/* Outflows breakdown */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/80">
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
            <h4 className="text-sm font-bold text-foreground">المصارف والسيولة النقدية الخارجة (Outflow)</h4>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
              <span className="font-medium text-foreground">المصروفات التشغيلية والإيجارات:</span>
              <span className={cn("font-bold text-rose-600 tabular-nums", blurCls)}>
                -{fmt(cf.outflowBreakdown.expenses)} ج.م
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
              <span className="font-medium text-foreground">مشتريات بضاعة نقدية كاش:</span>
              <span className={cn("font-bold text-rose-600 tabular-nums", blurCls)}>
                -{fmt(cf.outflowBreakdown.cashPurchases)} ج.م
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
              <span className="font-medium text-foreground">سداد ديون ودفعات للموردين:</span>
              <span className={cn("font-bold text-rose-600 tabular-nums", blurCls)}>
                -{fmt(cf.outflowBreakdown.supplierPayments)} ج.م
              </span>
            </div>

            {cf.outflowBreakdown.salesReturnsRefunds > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
                <span className="font-medium text-foreground">رد مبالغ مرتجعات مبيعات:</span>
                <span className={cn("font-bold text-rose-600 tabular-nums", blurCls)}>
                  -{fmt(cf.outflowBreakdown.salesReturnsRefunds)} ج.م
                </span>
              </div>
            )}

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 font-bold text-rose-950 dark:text-rose-300">
              <span>إجمالي المدفوعات النقدية:</span>
              <span className={cn("tabular-nums text-rose-700 dark:text-rose-400 text-sm", blurCls)}>
                -{fmt(cf.totalOutflow)} ج.م
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow Timeline Chart */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">حركة التدفق النقدي وصافي الخزينة</h3>
            <p className="text-xs text-muted-foreground">تتبع السيولة الداخلة والخارجة عبر الفترات</p>
          </div>
        </div>

        {!hasSeriesData ? (
          <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
            لا توجد حركات نقدية خلال هذه الفترة
          </div>
        ) : (
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.timelineSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(val: number) => [`${fmt(Number(val))} ج.م`, ""]}
                  labelFormatter={(label) => `الفترة: ${label}`}
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="cashIn" name="نقد داخل (مقبوضات)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cashOut" name="نقد خارج (مدفوعات)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
