import React from "react";
import { ComprehensiveReportData } from "@/lib/reports-engine";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Package, AlertTriangle, TrendingUp, Archive, DollarSign, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";

interface InventoryReportViewProps {
  data: ComprehensiveReportData;
  blurCls: string;
}

export const InventoryReportView: React.FC<InventoryReportViewProps> = ({ data, blurCls }) => {
  const inv = data.inventory;

  return (
    <div className="space-y-6">
      {/* Inventory Valuation Header Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">قيمة المخزون بسعر التكلفة</span>
          <div className={cn("text-xl font-black tabular-nums text-foreground mt-1", blurCls)}>
            {fmt(inv.totalStockCost)} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">رأس المال المجمد في البضاعة</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">قيمة المخزون بسعر البيع</span>
          <div className={cn("text-xl font-black tabular-nums text-blue-600 mt-1", blurCls)}>
            {fmt(inv.totalStockSaleValue)} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">القيمة السوقية الإجمالية</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">الأرباح المتوقعة في المخزن</span>
          <div className={cn("text-xl font-black tabular-nums text-emerald-600 mt-1", blurCls)}>
            +{fmt(inv.potentialStockProfit)} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">عند بيع كامل البضاعة المتوفرة</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">حالة النواقص والأصناف</span>
          <div className="text-xl font-black tabular-nums text-foreground mt-1 flex items-center gap-2">
            <span>{inv.itemCount} صنف</span>
            {inv.lowStockCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {inv.lowStockCount} ناقص
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {inv.outOfStockCount > 0 ? `${inv.outOfStockCount} صنف نفد رصيده` : "المخزون متوفر"}
          </p>
        </div>
      </div>

      {/* Top Profitable and Sold Items */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="p-4 bg-muted/20 border-b border-border/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-foreground">الأصناف الأكثر مساهمة في الأرباح والمبيعات</h3>
              <p className="text-xs text-muted-foreground">مرتبة حسب حجم الإيرادات وهامش الربح المحقق في الفترة</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{inv.topSellingItems.length} صنف</span>
        </div>

        {inv.topSellingItems.length === 0 ? (
          <EmptyState
            icon={Package}
            title="لا توجد مبيعات أصناف مسجلة في هذه الفترة"
            className="p-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="text-right p-3.5 font-semibold">الصنف</th>
                  <th className="text-right p-3.5 font-semibold">الكمية المباعة</th>
                  <th className="text-right p-3.5 font-semibold">إجمالي الإيراد</th>
                  <th className="text-right p-3.5 font-semibold">إجمالي التكلفة</th>
                  <th className="text-right p-3.5 font-semibold">صافي الربح</th>
                  <th className="text-right p-3.5 font-semibold">هامش الربح %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {inv.topSellingItems.map((item, idx) => (
                  <tr key={item.name} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-medium text-foreground flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-mono">
                        {idx + 1}
                      </span>
                      {item.name}
                    </td>
                    <td className="p-3.5">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {item.soldQuantity}
                      </Badge>
                    </td>
                    <td className={cn("p-3.5 font-semibold tabular-nums", blurCls)}>{fmt(item.revenue)} ج.م</td>
                    <td className={cn("p-3.5 text-muted-foreground tabular-nums", blurCls)}>{fmt(item.cost)} ج.م</td>
                    <td className={cn("p-3.5 text-emerald-600 font-bold tabular-nums", blurCls)}>
                      +{fmt(item.profit)} ج.م
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 font-semibold text-[11px]">
                        {item.marginPercent.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dead Stock & Slow Moving Items Report */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="p-4 bg-muted/20 border-b border-border/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-foreground">تقرير الأصناف الراكدة / البطيئة (Dead Stock)</h3>
              <p className="text-xs text-muted-foreground">أصناف متوفرة في المخزن ولم تُبَع خلال الفترة المحددة</p>
            </div>
          </div>
          <span className="text-xs text-amber-700 bg-amber-500/10 px-2.5 py-1 rounded-full font-medium">
            {inv.slowMovingItems.length} صنف راكد
          </span>
        </div>

        {inv.slowMovingItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-emerald-500" />
            <p className="font-semibold text-sm text-foreground">ممتاز! لا يوجد مخزون راكد غير مباع في هذه الفترة.</p>
            <p>جميع الأصناف المتوفرة تدور وتباع بشكل مستمر.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="text-right p-3.5 font-semibold">الصنف الراكد</th>
                  <th className="text-right p-3.5 font-semibold">الكمية المتوفرة</th>
                  <th className="text-right p-3.5 font-semibold">تكلفة الوحدة</th>
                  <th className="text-right p-3.5 font-semibold">سعر البيع المعروض</th>
                  <th className="text-right p-3.5 font-semibold">رأس المال المجمد</th>
                  <th className="text-right p-3.5 font-semibold">حالة التنبيه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {inv.slowMovingItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-medium text-foreground">{item.name}</td>
                    <td className="p-3.5 font-mono text-xs font-semibold">{item.currentQuantity} قطعة</td>
                    <td className={cn("p-3.5 text-muted-foreground tabular-nums", blurCls)}>
                      {fmt(item.unitCost)} ج.م
                    </td>
                    <td className={cn("p-3.5 tabular-nums font-medium", blurCls)}>{fmt(item.salePrice)} ج.م</td>
                    <td className={cn("p-3.5 font-bold text-amber-600 tabular-nums", blurCls)}>
                      {fmt(item.totalValue)} ج.م
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 text-[11px]">
                        <AlertTriangle className="w-3 h-3" />
                        يحتاج عروض أو تصفية
                      </span>
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
