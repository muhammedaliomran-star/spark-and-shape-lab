import React from "react";
import { ComprehensiveReportData } from "@/lib/reports-engine";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Truck, DollarSign, Wallet, AlertCircle, ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";

interface SuppliersReportViewProps {
  data: ComprehensiveReportData;
  blurCls: string;
}

export const SuppliersReportView: React.FC<SuppliersReportViewProps> = ({ data, blurCls }) => {
  const sup = data.suppliersAnalytics;

  return (
    <div className="space-y-6">
      {/* Suppliers KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">إجمالي حجم المشتريات بالفترة</span>
          <div className={cn("text-2xl font-black tabular-nums text-foreground mt-1", blurCls)}>
            {fmt(sup.totalPurchases)} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            نقدي: {fmt(data.cashPurchases)} ج.م · آجل: {fmt(data.creditPurchases)} ج.م
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">المسدد للموردين بالفترة</span>
          <div className={cn("text-2xl font-black tabular-nums text-emerald-600 mt-1", blurCls)}>
            {fmt(sup.totalPaidToSuppliers)} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">مشتريات كاش + سندات سداد</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">إجمالي ديون الموردين (دائن)</span>
          <div className={cn("text-2xl font-black tabular-nums text-rose-600 mt-1", blurCls)}>
            {fmt(sup.totalDueToSuppliers)} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">مستحقات واجبة السداد للشركات والموردين</p>
        </div>
      </div>

      {/* Suppliers Summary Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="p-4 bg-muted/20 border-b border-border/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-foreground">بيان تعاملات وأرصدة الموردين</h3>
              <p className="text-xs text-muted-foreground">حجم التوريدات والمبالغ المسددة والأرصدة الدائنة لكل مورد</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{sup.topSuppliers.length} مورد</span>
        </div>

        {sup.topSuppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="لا توجد تعاملات أو مشتريات موردين في هذه الفترة"
            className="p-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="text-right p-3.5 font-semibold">المورد</th>
                  <th className="text-right p-3.5 font-semibold">الهاتف / التواصل</th>
                  <th className="text-right p-3.5 font-semibold">عدد فواتير الشراء</th>
                  <th className="text-right p-3.5 font-semibold">إجمالي المشتريات بالفترة</th>
                  <th className="text-right p-3.5 font-semibold">المسدد له بالفترة</th>
                  <th className="text-right p-3.5 font-semibold">المتبقي له (دائن)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sup.topSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-medium text-foreground">{s.name}</td>
                    <td className="p-3.5 text-muted-foreground font-mono">{s.contact || "-"}</td>
                    <td className="p-3.5">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {s.purchasesCount} فاتورة
                      </Badge>
                    </td>
                    <td className={cn("p-3.5 font-semibold tabular-nums", blurCls)}>
                      {fmt(s.totalPurchases)} ج.م
                    </td>
                    <td className={cn("p-3.5 text-emerald-600 font-medium tabular-nums", blurCls)}>
                      {fmt(s.totalPaid)} ج.م
                    </td>
                    <td className={cn("p-3.5 font-bold tabular-nums", s.outstandingDue > 0 ? "text-rose-600" : "text-muted-foreground", blurCls)}>
                      {fmt(s.outstandingDue)} ج.م
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
