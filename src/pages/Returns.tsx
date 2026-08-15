import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useDB, db, fmt } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Plus, History, TrendingUp, X, Check, Trash2, Receipt, Package, Undo2 } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivacy } from "@/lib/privacy";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <ReturnsPage />
      </PageTransition>
    </AppShell>
  );
}

function ReturnsPage() {
  const data = useDB();
  const { privacy } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  
  const [returnType, setReturnType] = useState<"sale" | "supplier">("sale");
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<Array<{ name: string; unitPrice: number; quantity: number }>>([]);
  const [newItem, setNewItem] = useState({ name: "", unitPrice: 0, quantity: 1 });

  const handleAddReturn = async () => {
    if (items.length === 0) return;
    const total = items.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
    await db.addReturn({
      invoiceId: invoiceId || null,
      type: returnType,
      totalAmount: total,
      reason,
      notes: null,
      items
    });
    setInvoiceId("");
    setReason("");
    setItems([]);
    toast.success("تم تسجيل المرتجع بنجاح");
  };

  const addItem = () => {
    if (!newItem.name || newItem.quantity <= 0) return;
    setItems([...items, newItem]);
    setNewItem({ name: "", unitPrice: 0, quantity: 1 });
  };

  return (
    <>
      <PageHeader
        title="المرتجعات"
        subtitle="إدارة مرتجعات المبيعات والمشتريات والربط مع المخازن."
        icon={<Undo2 className="w-8 h-8 text-primary" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="إجمالي المرتجعات" value={data.returns.reduce((acc, r) => acc + r.totalAmount, 0)} icon={<Undo2 className="w-4 h-4 text-primary" />} color="primary" privacy={privacy} glow />
        <MetricCard label="مرتجعات مبيعات" value={data.returns.filter(r => r.type === "sale").reduce((acc, r) => acc + r.totalAmount, 0)} icon={<TrendingUp className="w-4 h-4 text-warning" />} color="warning" privacy={privacy} glow />
        <MetricCard label="مرتجعات موردين" value={data.returns.filter(r => r.type === "supplier").reduce((acc, r) => acc + r.totalAmount, 0)} icon={<Package className="w-4 h-4 text-primary" />} color="primary" privacy={privacy} glow />
        <MetricCard label="عدد العمليات" value={data.returns.length} icon={<History className="w-4 h-4 text-muted-foreground" />} color="muted" privacy={privacy} isCount glow />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Registration Form */}
        <div className="lg:col-span-1">
          <BezelCard className="p-0 overflow-hidden bezel-lift">
            <div className="p-4 border-b border-[var(--hairline)] flex items-center justify-between">
              <span className="font-bold text-sm">تسجيل مرتجع جديد</span>
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            
            <div className="p-5 space-y-4 text-right">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">نوع المرتجع</Label>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-muted/20 rounded-2xl ring-1 ring-inset ring-[var(--hairline)] relative overflow-hidden">
                  <motion.div 
                    layoutId="active-tab"
                    className={cn(
                      "absolute inset-y-1 w-[calc(50%-6px)] rounded-xl shadow-lg z-0",
                      returnType === "sale" ? "bg-primary left-1.5" : "bg-warning right-1.5"
                    )}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                  <Button 
                    variant="ghost"
                    className={cn(
                      "relative z-10 rounded-xl h-10 font-bold transition-colors",
                      returnType === "sale" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setReturnType("sale")}
                  >
                    مرتجع بيع
                  </Button>
                  <Button 
                    variant="ghost"
                    className={cn(
                      "relative z-10 rounded-xl h-10 font-bold transition-colors",
                      returnType === "supplier" ? "text-warning-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setReturnType("supplier")}
                  >
                    مرتجع مورد
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">رقم الفاتورة (اختياري)</Label>
                <Input value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="مثال: #INV-001" className="text-right h-11 glass" />
              </div>

              <div className="space-y-4 border-t border-[var(--hairline)] pt-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">إضافة أصناف المرتجع</Label>
                <div className="space-y-2 p-3 bg-muted/10 rounded-2xl ring-1 ring-inset ring-[var(--hairline)]">
                  <Input placeholder="اسم الصنف" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="text-right h-10 glass border-none focus-visible:ring-1 focus-visible:ring-primary/30" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="السعر" value={newItem.unitPrice || ""} onChange={(e) => setNewItem({ ...newItem, unitPrice: Number(e.target.value) })} className="text-right h-10 glass border-none focus-visible:ring-1 focus-visible:ring-primary/30" />
                    <Input type="number" placeholder="الكمية" value={newItem.quantity || ""} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} className="text-right h-10 glass border-none focus-visible:ring-1 focus-visible:ring-primary/30" />
                  </div>
                  <Button onClick={addItem} className="w-full gap-2 rounded-xl h-10 bg-background/50 hover:bg-background border-[var(--hairline)]" variant="outline">
                    <Plus className="w-4 h-4" /> إضافة للمرتجع
                  </Button>
                </div>
                
                <AnimatePresence>
                  {items.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-muted/20 rounded-2xl p-4 space-y-2 ring-1 ring-inset ring-[var(--hairline)]"
                    >
                      {items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm border-b border-[var(--hairline)]/50 pb-2 last:border-0">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="w-6 h-6 flex items-center justify-center rounded-full bg-danger/10 text-danger hover:scale-110 transition-transform"><X className="w-3.5 h-3.5" /></button>
                            <span className={cn("font-bold text-numeric text-primary", blurCls)}>{fmt(it.unitPrice * it.quantity)} <span className="text-[10px]">ج.م</span></span>
                          </div>
                          <span className="text-muted-foreground font-medium">{it.name} <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md mx-1">{it.quantity} × {fmt(it.unitPrice)}</span></span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center font-black pt-2 border-t border-[var(--hairline)]">
                        <span className={cn("text-primary text-xl text-numeric", blurCls)}>{fmt(items.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0))} <span className="text-xs">ج.م</span></span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">الإجمالي المستحق</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">السبب / ملاحظات</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تلف في المنتج..." className="text-right h-12 glass" />
              </div>

              <Button 
                className={cn(
                  "w-full gap-2 py-7 text-lg rounded-2xl shadow-2xl transition-all duration-500 font-black",
                  returnType === 'sale' 
                    ? "bg-primary text-primary-foreground hover:shadow-primary/30" 
                    : "bg-warning text-warning-foreground hover:shadow-warning/30"
                )} 
                disabled={items.length === 0} 
                onClick={handleAddReturn}
              >
                <Check className="w-6 h-6" /> تسجيل المرتجع
              </Button>
            </div>
          </BezelCard>
        </div>

        {/* Returns History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="sticky-search-bar mb-4">
            <div className="bg-card plate p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-2 order-2 md:order-1">
                <Badge variant="secondary" className="px-3 py-1 rounded-full">{data.returns.length} عملية</Badge>
              </div>
              <h3 className="text-sm font-bold flex items-center gap-2 text-right order-1 md:order-2">
                سجل المرتجعات التاريخي
                <History className="w-4 h-4 text-muted-foreground" />
              </h3>
            </div>
          </div>

          <Reveal delay={100}>
            <div className="flex flex-col gap-3">
              {data.returns.length === 0 ? (
                <BezelCard className="p-20 text-center bezel-lift group relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                   <div className="relative z-10 flex flex-col items-center">
                     <div className="w-24 h-24 mb-6 relative">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                        <div className="relative w-full h-full rounded-3xl bg-card plate flex items-center justify-center ring-1 ring-primary/20">
                          <History className="w-10 h-10 text-primary animate-float-soft" />
                        </div>
                     </div>
                     <h3 className="text-xl font-black mb-2">لا توجد مرتجعات مسجلة</h3>
                     <p className="text-muted-foreground text-sm max-w-[280px] leading-relaxed">بانتظار تسجيل أول عملية مرتجع للنظام لبدء الأرشفة والتحليل المالي.</p>
                   </div>
                </BezelCard>
              ) : (
                data.returns.map((r: any) => (
                  <BezelCard key={r.id} className="p-0 overflow-hidden group bezel-lift border-transparent hover:border-primary/20 transition-all duration-500">
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 order-2 md:order-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-danger hover:bg-danger/10 md:opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => db.removeReturn(r.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">القيمة الإجمالية</div>
                          <div className={cn("text-lg font-black text-numeric", blurCls)}>{fmt(r.totalAmount)} <span className="text-[10px] font-bold">ج.م</span></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 order-1 md:order-2 text-right">
                        <div>
                          <div className="flex items-center justify-end gap-2">
                            {r.invoiceId && <Badge variant="secondary" className="text-[10px] font-mono">{r.invoiceId}</Badge>}
                            <span className="font-bold">{r.type === "sale" ? "مرتجع مبيعات" : "مرتجع موردين"}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">{format(new Date(r.createdAt), "yyyy/MM/dd - hh:mm a")}</div>
                        </div>
                        <div className={cn("p-2 rounded-xl", r.type === "sale" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary")}>
                          {r.type === "sale" ? <TrendingUp className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>
                    {r.reason && (
                      <div className="mx-4 mb-4 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-[var(--hairline)] italic text-right">
                        {r.reason}
                      </div>
                    )}
                  </BezelCard>
                ))
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </>
  );
}

function MetricCard({ label, value, icon, color, privacy, isCount, glow }: { label: string, value: number, icon: React.ReactNode, color: string, privacy: boolean, isCount?: boolean, glow?: boolean }) {
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const colorCls = {
    success: "text-success",
    danger: "text-danger",
    primary: "text-primary",
    warning: "text-warning",
    muted: "text-muted-foreground"
  }[color as "success" | "danger" | "primary" | "warning" | "muted"] || "text-foreground";

  const glowCls = glow ? {
    success: "shadow-[0_0_30px_-10px_hsl(var(--success)/0.3)]",
    danger: "shadow-[0_0_30px_-10px_hsl(var(--danger)/0.3)]",
    primary: "shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]",
    warning: "shadow-[0_0_30px_-10px_hsl(var(--warning)/0.3)]",
    muted: "shadow-none"
  }[color as "success" | "danger" | "primary" | "warning" | "muted"] : "";

  return (
    <div className={cn("plate p-5 flex flex-col items-center justify-center text-center bezel-lift group relative overflow-hidden", glowCls)}>
      {glow && (
        <div className={cn(
          "absolute -right-4 -top-4 w-12 h-12 blur-2xl opacity-20 transition-opacity group-hover:opacity-40",
          color === 'primary' ? "bg-primary" : color === 'warning' ? "bg-warning" : "bg-muted"
        )} />
      )}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1.5 rounded-lg bg-muted/20 ring-1 ring-inset ring-[var(--hairline)]">
          {icon}
        </div>
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">{label}</span>
      </div>
      <div className={cn("text-2xl font-black tabular-nums tracking-tighter", colorCls, blurCls)}>
        {isCount ? <CountUp value={value} /> : <><CountUp value={value} format={(n: number) => fmt(n)} /> <span className="text-xs font-bold opacity-60">ج.م</span></>}
      </div>
    </div>
  );
}

