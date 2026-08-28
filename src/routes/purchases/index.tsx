import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDB, fmt, type Purchase } from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { Truck, Search, Plus, Wallet, Banknote, CalendarDays, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/router-compat";

export const Route = createFileRoute("/purchases/")({
  component: PurchasesPage,
});

function PurchasesPage() {
  const data = useDB();
  const { privacy } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const [q, setQ] = useState("");

  const suppliersMap = useMemo(() => 
    new Map(data.suppliers.map(s => [s.id, s.name])),
    [data.suppliers]
  );

  const list = useMemo(() => {
    return data.purchases
      .filter((p) => {
        const supplierName = suppliersMap.get(p.supplierId) || "";
        return q ? supplierName.includes(q) || p.notes?.includes(q) : true;
      })
      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  }, [data.purchases, q, suppliersMap]);

  return (
    <AppShell>
      <PageTransition>
        <PageHeader
          title="فواتير المشتريات"
          subtitle="سجل المشتريات والتعاملات مع الموردين."
          icon={<Truck className="w-7 h-7" />}
          action={
            <Button asChild size="sm" className="gap-1.5 rounded-full">
              <Link to="/purchases/new">
                <Plus className="w-4 h-4" /> فاتورة جديدة
              </Link>
            </Button>
          }
        />

        <Reveal className="sticky-search-bar mb-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="ابحث باسم المورد أو الملاحظات..." 
              className="pr-10 rounded-full h-12" 
            />
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="flex flex-col gap-3">
            {list.length === 0 ? (
              <div className="rounded-2xl border border-foreground/10 bg-card/70 px-6 py-20 text-center">
                <EmptyState
                  icon={Truck}
                  title="لا توجد فواتير مشتريات."
                  hint="سجل أول فاتورة شراء لتبدأ بمتابعة مخزونك."
                />
              </div>
            ) : (
              list.map((p, idx) => (
                <div
                  key={p.id}
                  className="group flex animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)] both rounded-2xl border border-foreground/10 bg-card/70 p-5"
                  style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                >
                  <div className="grid w-full grid-cols-1 items-center gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-6 text-right">
                    {/* المورد */}
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-foreground/[0.06] text-foreground ring-1 ring-foreground/10">
                        <Truck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-base">{suppliersMap.get(p.supplierId) || "مورد غير معروف"}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                          <CalendarDays className="w-3 h-3" />
                          <span>{new Date(p.purchaseDate).toLocaleDateString("en-US")}</span>
                        </div>
                      </div>
                    </div>

                    {/* القيمة */}
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-[0.12em] font-bold">إجمالي الفاتورة</div>
                      <div className={cn("text-numeric text-xl font-extrabold text-foreground", blurCls)}>
                        {fmt(p.total)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                      </div>
                    </div>

                    {/* الحالة */}
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-[0.12em] font-bold">طريقة الدفع</div>
                      <div>
                        {p.paymentType === "cash" ? (
                          <Badge variant="outline" className="gap-1.5 rounded-xl bg-success/10 text-success border-success/30 px-3 py-1">
                            <Banknote className="w-3 h-3" /> نقدي
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1.5 rounded-xl bg-warning/10 text-warning border-warning/30 px-3 py-1">
                            <Wallet className="w-3 h-3" /> آجل
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* ملاحظات/إجراءات */}
                    <div className="flex items-center justify-end gap-2">
                      {p.notes && (
                        <div className="hidden lg:block text-xs text-muted-foreground italic truncate max-w-[150px] ml-4">
                          "{p.notes}"
                        </div>
                      )}
                      <Button asChild size="icon" variant="ghost" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10">
                        <Link to="/suppliers">
                          <History className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Reveal>
      </PageTransition>
    </AppShell>
  );
}
