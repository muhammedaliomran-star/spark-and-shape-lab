import React from "react";
import { ComprehensiveReportData } from "@/lib/reports-engine";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Users,
  Package,
  ShoppingBag,
  Percent,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";

interface ExecutiveSummaryViewProps {
  data: ComprehensiveReportData;
  blurCls: string;
}

export const ExecutiveSummaryView: React.FC<ExecutiveSummaryViewProps> = ({ data, blurCls }) => {
  const hasSeriesData = data.timelineSeries.some(
    (r) => r.sales > 0 || r.collected > 0 || r.expenses > 0
  );

  return (
    <div className="space-y-6">
      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <KpiCard
          label="إجمالي المبيعات"
          value={data.totalSales}
          subLabel={`${data.salesCount} فاتورة بيع`}
          icon={<ShoppingBag className="w-4 h-4" />}
          tone="primary"
          blurCls={blurCls}
        />

        <KpiCard
          label="التحصيلات النقدية"
          value={data.totalCollected}
          subLabel={`معدل التحصيل: ${data.collectionRate.toFixed(1)}%`}
          icon={<Wallet className="w-4 h-4" />}
          tone="success"
          blurCls={blurCls}
        />

        <KpiCard
          label="المصروفات التشغيلية"
          value={data.totalExpenses}
          subLabel={`تكلفة البضاعة: ${fmt(data.cogs)} ج.م`}
          icon={<Receipt className="w-4 h-4" />}
          tone="danger"
          blurCls={blurCls}
        />

        <KpiCard
          label="صافي الربح"
          value={data.netProfit}
          subLabel={`هامش الربح: ${data.netMarginPercent.toFixed(1)}%`}
          icon={data.netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          tone={data.netProfit >= 0 ? "success" : "danger"}
          blurCls={blurCls}
        />
      </div>

      {/* Secondary Quick Ratios */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-2xl border border-border/70 text-xs">
        <div className="flex flex-col gap-0.5 p-2">
          <span className="text-muted-foreground font-medium">مجمل الربح التجاري</span>
          <span className={cn("text-sm font-bold text-foreground", blurCls)}>
            {fmt(data.grossProfit)} ج.م
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold">
            {data.grossMarginPercent.toFixed(1)}% هامش مجمل
          </span>
        </div>

        <div className="flex flex-col gap-0.5 p-2 border-r border-border/50">
          <span className="text-muted-foreground font-medium">متوسط قيمة الفاتورة</span>
          <span className={cn("text-sm font-bold text-foreground", blurCls)}>
            {fmt(data.averageOrderValue)} ج.م
          </span>
          <span className="text-[10px] text-muted-foreground">للفاتورة الواحدة</span>
        </div>

        <div className="flex flex-col gap-0.5 p-2 border-r border-border/50">
          <span className="text-muted-foreground font-medium">مستحقات السوق طرف العملاء</span>
          <span className={cn("text-sm font-bold text-amber-600", blurCls)}>
            {fmt(data.outstandingReceivables)} ج.م
          </span>
          <span className="text-[10px] text-muted-foreground">إجمالي ديون غير مسددة</span>
        </div>

        <div className="flex flex-col gap-0.5 p-2 border-r border-border/50">
          <span className="text-muted-foreground font-medium">صافي السيولة النقدية</span>
          <span
            className={cn(
              "text-sm font-bold",
              data.cashFlow.netCashFlow >= 0 ? "text-emerald-600" : "text-rose-600",
              blurCls
            )}
          >
            {fmt(data.cashFlow.netCashFlow)} ج.م
          </span>
          <span className="text-[10px] text-muted-foreground">مقبوضات - مدفوعات</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Chart 1: Sales vs Collections vs Expenses */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">المبيعات والتحصيلات والمصروفات</h3>
              <p className="text-xs text-muted-foreground">مقارنة تدفق الإيرادات بالمبالغ المحصلة والمصروفات</p>
            </div>
          </div>

          {!hasSeriesData ? (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
              لا توجد بيانات كافية خلال هذه الفترة
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
                  <Bar dataKey="sales" name="المبيعات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collected" name="التحصيلات" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="المصروفات" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Net Profit & Gross Profit Trend */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">منحنى الأرباح الصافية والمجملة</h3>
              <p className="text-xs text-muted-foreground">متابعة نمو الأرباح الحقيقية عبر الفترات</p>
            </div>
          </div>

          {!hasSeriesData ? (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
              لا توجد بيانات كافية خلال هذه الفترة
            </div>
          ) : (
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timelineSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <Line
                    type="monotone"
                    dataKey="grossProfit"
                    name="مجمل الربح"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netProfit"
                    name="صافي الربح"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Top Tables Preview */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Top Customers Box */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="flex items-center justify-between p-4 border-b border-border/80 bg-muted/20">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">أفضل العملاء خلال الفترة</h3>
            </div>
            <span className="text-xs text-muted-foreground">أعلى {data.customerAnalytics.topCustomers.length} عملاء</span>
          </div>

          {data.customerAnalytics.topCustomers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="لا توجد تعاملات عملاء في هذه الفترة"
              className="p-8"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="text-right p-3 font-semibold">العميل</th>
                    <th className="text-right p-3 font-semibold">المشتريات</th>
                    <th className="text-right p-3 font-semibold">المسدد</th>
                    <th className="text-right p-3 font-semibold">المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.customerAnalytics.topCustomers.slice(0, 6).map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium text-foreground">{c.name}</td>
                      <td className={cn("p-3 font-semibold tabular-nums", blurCls)}>{fmt(c.totalPurchases)} ج.م</td>
                      <td className={cn("p-3 text-emerald-600 font-medium tabular-nums", blurCls)}>{fmt(c.totalPaid)} ج.م</td>
                      <td className={cn("p-3 tabular-nums font-semibold", c.currentBalance > 0 ? "text-amber-600" : "text-muted-foreground", blurCls)}>
                        {fmt(c.currentBalance)} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Selling Items Box */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="flex items-center justify-between p-4 border-b border-border/80 bg-muted/20">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">أكثر الأصناف ربحية ومبيعاً</h3>
            </div>
            <span className="text-xs text-muted-foreground">أعلى {data.inventory.topSellingItems.length} صنف</span>
          </div>

          {data.inventory.topSellingItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title="لا توجد أصناف مباعة في هذه الفترة"
              className="p-8"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="text-right p-3 font-semibold">الصنف</th>
                    <th className="text-right p-3 font-semibold">الكمية</th>
                    <th className="text-right p-3 font-semibold">الإيراد</th>
                    <th className="text-right p-3 font-semibold">صافي الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.inventory.topSellingItems.slice(0, 6).map((item) => (
                    <tr key={item.name} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium text-foreground">{item.name}</td>
                      <td className="p-3">
                        <Badge variant="secondary" className="rounded-md font-mono text-[11px]">
                          {item.soldQuantity}
                        </Badge>
                      </td>
                      <td className={cn("p-3 tabular-nums font-semibold", blurCls)}>{fmt(item.revenue)} ج.م</td>
                      <td className={cn("p-3 text-emerald-600 font-bold tabular-nums", blurCls)}>
                        +{fmt(item.profit)} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function KpiCard({
  label,
  value,
  subLabel,
  icon,
  tone,
  blurCls,
}: {
  label: string;
  value: number;
  subLabel: string;
  icon: React.ReactNode;
  tone: "primary" | "success" | "danger";
  blurCls: string;
}) {
  const toneColor =
    tone === "success"
      ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
      : tone === "danger"
      ? "text-rose-600 bg-rose-500/10 border-rose-500/20"
      : "text-blue-600 bg-blue-500/10 border-blue-500/20";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={cn("p-2 rounded-xl border", toneColor)}>{icon}</div>
      </div>
      <div>
        <div className={cn("text-xl sm:text-2xl font-black tabular-nums text-foreground tracking-tight", blurCls)}>
          {fmt(value)} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 font-medium">{subLabel}</p>
      </div>
    </div>
  );
}
