import React from "react";
import { ComprehensiveReportData } from "@/lib/reports-engine";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Users, UserCheck, AlertCircle, ShoppingBag, ArrowUpRight, Phone } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";

interface CustomerInsightsViewProps {
  data: ComprehensiveReportData;
  blurCls: string;
}

export const CustomerInsightsView: React.FC<CustomerInsightsViewProps> = ({ data, blurCls }) => {
  const cust = data.customerAnalytics;

  return (
    <div className="space-y-6">
      {/* Customer Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">العملاء النشطين بالفترة</span>
          <div className="text-xl font-black tabular-nums text-foreground mt-1">
            {cust.topCustomers.length} عميل
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">قاموا بعمليات شراء أو سداد</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">متوسط مشتريات العميل</span>
          <div className={cn("text-xl font-black tabular-nums text-foreground mt-1", blurCls)}>
            {fmt(cust.topCustomers.length > 0 ? data.totalSales / cust.topCustomers.length : 0)} ج.م
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">خلال الفترة المحددة</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">إجمالي ديون السوق (مدين)</span>
          <div className={cn("text-xl font-black tabular-nums text-amber-600 mt-1", blurCls)}>
            {fmt(data.outstandingReceivables)} ج.م
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">أقساط ومتبقيات غير مسددة</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">معدل تحصيل المبيعات</span>
          <div className={cn("text-xl font-black tabular-nums text-emerald-600 mt-1", blurCls)}>
            {data.collectionRate.toFixed(1)}%
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">نسبة المسدد من إجمالي المبيعات</p>
        </div>
      </div>

      {/* Customer Analytics Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="p-4 bg-muted/20 border-b border-border/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-foreground">جدول تحليل سلوك العملاء والمديونيات</h3>
              <p className="text-xs text-muted-foreground">حجم التعاملات الإجمالية ونسب الالتزام بالسداد ورصيد الحساب</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{cust.topCustomers.length} عميل</span>
        </div>

        {cust.topCustomers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="لا توجد حركات لعملاء خلال هذه الفترة"
            className="p-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="text-right p-3.5 font-semibold">العميل</th>
                  <th className="text-right p-3.5 font-semibold">الهاتف</th>
                  <th className="text-right p-3.5 font-semibold">عدد الفواتير</th>
                  <th className="text-right p-3.5 font-semibold">إجمالي المشتريات</th>
                  <th className="text-right p-3.5 font-semibold">المسدد</th>
                  <th className="text-right p-3.5 font-semibold">الرصيد المتبقي (مدين)</th>
                  <th className="text-right p-3.5 font-semibold">معدل السداد %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {cust.topCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-medium text-foreground">{c.name}</td>
                    <td className="p-3.5 text-muted-foreground font-mono">
                      {c.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground/70" />
                          {c.phone}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3.5">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {c.invoicesCount}
                      </Badge>
                    </td>
                    <td className={cn("p-3.5 font-semibold tabular-nums", blurCls)}>
                      {fmt(c.totalPurchases)} ج.م
                    </td>
                    <td className={cn("p-3.5 text-emerald-600 font-medium tabular-nums", blurCls)}>
                      {fmt(c.totalPaid)} ج.م
                    </td>
                    <td className={cn("p-3.5 font-bold tabular-nums", c.currentBalance > 0 ? "text-amber-600" : "text-muted-foreground", blurCls)}>
                      {fmt(c.currentBalance)} ج.م
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              c.collectionPercentage >= 80
                                ? "bg-emerald-500"
                                : c.collectionPercentage >= 40
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            )}
                            style={{ width: `${Math.min(100, c.collectionPercentage)}%` }}
                          ></div>
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {c.collectionPercentage.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
