import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AlertCircle, Calendar, Handshake, AlertTriangle, ShieldAlert, Package, TrendingUp } from "lucide-react";

interface AlertsKpiStripProps {
  totalOverdueAmount: number;
  overdueCount: number;
  dueSoonAmount: number;
  dueSoonCount: number;
  promisesCount: number;
  promisesAmount: number;
  criticalCount: number;
  criticalAmount: number;
  lowStockCount: number;
  blurCls: string;
  onSelectTab: (tab: string) => void;
  activeTab: string;
}

export function AlertsKpiStrip({
  totalOverdueAmount,
  overdueCount,
  dueSoonAmount,
  dueSoonCount,
  promisesCount,
  promisesAmount,
  criticalCount,
  criticalAmount,
  lowStockCount,
  blurCls,
  onSelectTab,
  activeTab,
}: AlertsKpiStripProps) {
  const cards = [
    {
      id: "all",
      title: "إجمالي ديون السوق المتأخرة",
      sub: `${overdueCount} فاتورة / قسط متأخر`,
      amount: totalOverdueAmount,
      icon: <AlertCircle className="w-5 h-5 text-rose-500" />,
      border: "border-rose-500/30 hover:border-rose-500/60 bg-rose-500/[0.03]",
      textCol: "text-rose-600 dark:text-rose-400",
      activeBg: "ring-2 ring-rose-500/40 bg-rose-500/10",
    },
    {
      id: "due_today",
      title: "مستحق اليوم وقريباً",
      sub: `${dueSoonCount} عميل مطلوب تحصيله`,
      amount: dueSoonAmount,
      icon: <Calendar className="w-5 h-5 text-emerald-500" />,
      border: "border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/[0.03]",
      textCol: "text-emerald-600 dark:text-emerald-400",
      activeBg: "ring-2 ring-emerald-500/40 bg-emerald-500/10",
    },
    {
      id: "promises",
      title: "وعود سداد مجدولة",
      sub: `${promisesCount} عميل موعود بسداده`,
      amount: promisesAmount,
      icon: <Handshake className="w-5 h-5 text-sky-500" />,
      border: "border-sky-500/30 hover:border-sky-500/60 bg-sky-500/[0.03]",
      textCol: "text-sky-600 dark:text-sky-400",
      activeBg: "ring-2 ring-sky-500/40 bg-sky-500/10",
    },
    {
      id: "critical",
      title: "ديون حرجة ومتعثرة (>30 يوم)",
      sub: `${criticalCount} حالة تحتاج إجراء قانوني`,
      amount: criticalAmount,
      icon: <ShieldAlert className="w-5 h-5 text-amber-500" />,
      border: "border-amber-500/30 hover:border-amber-500/60 bg-amber-500/[0.03]",
      textCol: "text-amber-600 dark:text-amber-400",
      activeBg: "ring-2 ring-amber-500/40 bg-amber-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((c) => {
        const isActive = activeTab === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelectTab(c.id)}
            className={cn(
              "text-right rounded-2xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between group",
              c.border,
              isActive ? c.activeBg : "bg-card/70 hover:shadow-sm"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                {c.title}
              </span>
              <div className="p-2 rounded-xl bg-background/80 shadow-xs shrink-0">
                {c.icon}
              </div>
            </div>

            <div className="space-y-1">
              <div className={cn("text-2xl font-black tabular-nums tracking-tight", c.textCol, blurCls)}>
                {fmt(c.amount)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
              </div>
              <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
                <span>{c.sub}</span>
                <span className="text-[10px] text-primary underline underline-offset-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  عرض القائمة ←
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
