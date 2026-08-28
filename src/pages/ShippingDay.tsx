import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { useDB } from "@/lib/store";
import { Link } from "@/lib/router-compat";
import { CalendarDays, ChevronLeft, PackageCheck, RefreshCw, Truck } from "lucide-react";

const money = (value: number) => new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(Math.round(value));
const dayKey = (value: string) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const dayLabel = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const todayKey = dayKey(new Date().toISOString());

type DaySummary = { key: string; total: number; paid: number; due: number; count: number; active: number; invoiceIds: string[] };

export default function ShippingDay() {
  const { shipments, invoices, refresh, loading } = useDB();
  const invoiceMap = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);
  const days = useMemo(() => {
    const grouped = new Map<string, DaySummary>();
    for (const shipment of shipments) {
      const key = dayKey(shipment.shippedAt ?? shipment.processingAt ?? shipment.createdAt);
      const invoice = shipment.invoiceId ? invoiceMap.get(shipment.invoiceId) : undefined;
      const row = grouped.get(key) ?? { key, total: 0, paid: 0, due: 0, count: 0, active: 0, invoiceIds: [] };
      const total = invoice?.total ?? 0;
      const paid = Math.min(total, invoice?.paid ?? 0);
      row.total += total; row.paid += paid; row.due += Math.max(0, total - paid); row.count += 1;
      if (["pending", "processing", "shipped"].includes(shipment.status)) row.active += 1;
      if (shipment.invoiceId) row.invoiceIds.push(shipment.invoiceId);
      grouped.set(key, row);
    }
    return [...grouped.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [shipments, invoiceMap]);
  const totals = useMemo(() => days.reduce((sum, day) => ({ total: sum.total + day.total, paid: sum.paid + day.paid, due: sum.due + day.due, count: sum.count + day.count }), { total: 0, paid: 0, due: 0, count: 0 }), [days]);

  return <AppShell><div dir="rtl" className="space-y-6 pb-20"><PageHeader title="يوم الشحن" subtitle="راجع قيمة كل يوم شحن، المدفوع، والمبالغ المعلقة بسرعة." icon={<CalendarDays className="h-7 w-7" />} action={<div className="flex gap-2"><Button variant="outline" asChild><Link to="/shipping"><ChevronLeft className="h-4 w-4" /> قسم الشحن</Link></Button><Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تحديث</Button></div>} /><div className="overflow-hidden rounded-2xl border border-foreground/10 bg-card/70"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4"><div className="flex items-center gap-2"><Truck className="h-5 w-5 text-muted-foreground" /><h2 className="font-bold">ملخص أيام الشحن</h2></div><p className="text-sm text-muted-foreground">{totals.count} شحنة · {money(totals.total)} ج.م إجمالي</p></div>{days.length === 0 ? <div className="p-12 text-center text-muted-foreground"><PackageCheck className="mx-auto mb-3 h-8 w-8" /><p className="font-bold">لسه مفيش أيام شحن مسجلة</p><p className="mt-1 text-sm">أول ما تضيف شحنة هتظهر هنا في يومها.</p></div> : <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{days.map((day) => <DayCard key={day.key} day={day} />)}</div>}</div></div></AppShell>;
}

function DayCard({ day }: { day: DaySummary }) { const isToday = day.key === todayKey; return <div className={`relative overflow-hidden rounded-2xl border bg-card/70 p-4 transition-[border-color,background-color] ${isToday ? "border-foreground/20 bg-foreground/[0.04]" : "border-foreground/10"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-bold">{dayLabel(day.key)}</span>{isToday && <span className="rounded-full bg-foreground/[0.06] px-2 py-1 text-xs font-black text-foreground">النهارده</span>}</div><p className="mt-4 text-3xl font-black tabular-nums">{money(day.total)} <span className="text-xs font-bold text-muted-foreground">ج.م</span></p><div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs"><div><p className="text-success">مدفوع</p><p className="mt-1 font-black tabular-nums">{money(day.paid)}</p></div><div><p className="text-warning">معلّق</p><p className="mt-1 font-black tabular-nums">{money(day.due)}</p></div></div><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{day.count} شحنة</span><span>{day.active ? `${day.active} نشطة` : "مكتملة"}</span></div>{day.invoiceIds[0] && <Link to={`/shipping?invoice=${day.invoiceIds[0]}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-foreground hover:underline">عرض الشحنات <ChevronLeft className="h-3 w-3" /></Link>}</div>; }
