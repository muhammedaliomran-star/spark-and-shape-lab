import { useMemo } from "react";
import { fmt, useDB } from "@/lib/store";
import { analyzeExpensePeriods, getCategoryInfo } from "@/lib/expenses-system";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Receipt,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["#059669", "#2563eb", "#d97706", "#9333ea", "#e11d48", "#0891b2", "#ea580c", "#475569"];

export function ExpenseAnalyticsTab() {
  const { expenses } = useDB();

  const analytics = useMemo(() => {
    return analyzeExpensePeriods(expenses);
  }, [expenses]);

  // Category breakdown for Pie Chart
  const categoryPieData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).map(([k, v]) => ({
      name: getCategoryInfo(k).label,
      value: Math.round(v),
    })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  return (
    <div className="space-y-6">
      {/* Top Period-over-Period Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border bg-card/80 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground">مصروفات الشهر الحالي</span>
          <div className="text-2xl font-extrabold text-danger mt-1 tabular-nums">
            {fmt(analytics.currentMonthTotal)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
            {analytics.isIncrease ? (
              <span className="text-rose-600 flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +{analytics.percentageChange}% مقارنة بالشهر السابق
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> {analytics.percentageChange}% انخفاض إيجابي
              </span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-card/80 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground">مصروفات الشهر السابق</span>
          <div className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
            {fmt(analytics.lastMonthTotal)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-2">الشهر الماضي للمقارنة</span>
        </div>

        <div className="p-4 rounded-2xl border bg-card/80 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground">متوسط القيد الواحد</span>
          <div className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
            {fmt(analytics.averageExpensePerEntry)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-2">لكل عملية صرف هذا الشهر</span>
        </div>

        <div className="p-4 rounded-2xl border bg-card/80 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground">أعلى بند استهلاكاً</span>
          <div className="text-lg font-bold text-foreground mt-1 truncate">
            {analytics.topCategoryThisMonth?.label || "—"}
          </div>
          <span className="text-xs font-semibold text-danger mt-2 tabular-nums">
            {analytics.topCategoryThisMonth ? `${fmt(analytics.topCategoryThisMonth.amount)} ج.م (${analytics.topCategoryThisMonth.pct}%)` : "—"}
          </span>
        </div>
      </div>

      {/* Spikes / Anomaly Alerts */}
      {analytics.spikes.length > 0 ? (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            تنبيه البنود غير المعتادة (Spike & Anomaly Alerts)
          </div>
          <p className="text-xs text-muted-foreground">
            تم رصد {analytics.spikes.length} قيد مصرفي بمبالغ أعلى بكثير من المعدل الطبيعي لهذا الشهر:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {analytics.spikes.map((spk, idx) => (
              <div key={idx} className="p-3 bg-background/80 rounded-xl border border-amber-500/20 text-xs flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-foreground">{getCategoryInfo(spk.expense.category).label}</div>
                  <div className="text-muted-foreground mt-0.5">{spk.reason}</div>
                  <div className="text-[10px] text-muted-foreground mt-1" dir="ltr">{spk.expense.expenseDate}</div>
                </div>
                <div className="text-sm font-extrabold text-danger tabular-nums shrink-0">
                  {fmt(spk.expense.amount)} ج.م
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground">معدلات الإنفاق مستقرة وطبيعية</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              لا توجد قفزات مفاجئة أو مبالغ شاذة مسجلة في مصروفات هذا الشهر مقارنة بالمتوسطات.
            </p>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Bar Chart */}
        <div className="p-5 rounded-2xl border bg-card/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                تطور المصروفات عبر الأشهر
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">مقارنة إجمالي المصروفات لآخر 6 أشهر.</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${fmt(Number(val))} ج.م`, "المصروفات"]}
                  labelFormatter={(label) => `شهر: ${label}`}
                  contentStyle={{ direction: "rtl", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="total" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Pie Chart */}
        <div className="p-5 rounded-2xl border bg-card/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-primary" />
                توزيع المصروفات حسب التصنيف
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">نسبة كل بند من إجمالي المصروفات الكلية.</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {categoryPieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                لا توجد بيانات مصروفات كافية للرسم البياني
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {categoryPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${fmt(Number(val))} ج.م`, "المبلغ"]}
                    contentStyle={{ direction: "rtl", borderRadius: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", direction: "rtl" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
