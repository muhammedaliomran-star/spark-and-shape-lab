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
import { Plus, History, TrendingUp, X, Check, Trash2, Receipt, Package, Undo2, Search } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivacy } from "@/lib/privacy";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
    setIsDialogOpen(false);
    toast.success("تم تسجيل المرتجع بنجاح");
  };

  const addItem = () => {
    if (!newItem.name || newItem.quantity <= 0) return;
    setItems([...items, newItem]);
    setNewItem({ name: "", unitPrice: 0, quantity: 1 });
  };

  const filteredReturns = data.returns.filter(r => {
    const term = searchQuery.toLowerCase();
    return (
      r.invoiceId?.toLowerCase().includes(term) ||
      r.reason?.toLowerCase().includes(term) ||
      (r.type === 'sale' ? 'مرتجع بيع' : 'مرتجع مورد').includes(term)
    );
  });

  return (
    <>
      <PageHeader
        title="المرتجعات"
        subtitle="إدارة مرتجعات المبيعات والمشتريات والربط مع المخازن."
        icon={<Undo2 className="w-8 h-8" />}
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-2xl h-12 px-6 shadow-sm hover:scale-105 transition-transform">
                <Plus className="w-5 h-5" /> تسجيل مرتجع جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl overflow-hidden p-0 border-none bg-card/95 ">
              <DialogHeader className="p-6 pb-2 sticky top-0 bg-card z-20 border-b border-[var(--hairline)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-foreground/[0.06] flex items-center justify-center">
                      <Undo2 className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <DialogTitle className="text-right text-xl font-black">تسجيل مرتجع جديد</DialogTitle>
                      <p className="text-xs text-muted-foreground uppercase tracking-[0.12em] font-bold mt-0.5">Register New Return Entry</p>
                    </div>
                  </div>
                </div>
              </DialogHeader>
              
              <ScrollArea className="max-h-[80vh] p-6">
                <div className="space-y-6 text-right" dir="rtl">
                  {/* Type Selection */}
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">نوع المرتجع</Label>
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
                          "relative z-10 rounded-xl h-11 font-black transition-colors",
                          returnType === "sale" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setReturnType("sale")}
                      >
                        مرتجع بيع
                      </Button>
                      <Button 
                        variant="ghost"
                        className={cn(
                          "relative z-10 rounded-xl h-11 font-black transition-colors",
                          returnType === "supplier" ? "text-warning-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setReturnType("supplier")}
                      >
                        مرتجع مورد
                      </Button>
                    </div>
                  </div>

                  {/* Invoice ID */}
                  <div className="space-y-3 p-4 bg-muted/20 rounded-2xl ring-1 ring-inset ring-[var(--hairline)] transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:ring-primary/40 group/field">
                    <Label className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-primary transition-colors">رقم الفاتورة (اختياري)</Label>
                    <Input value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="مثال: #INV-001" className="text-right h-12 bg-background/50 border-none focus-visible:ring-2 focus-visible:ring-primary/30 font-bold" />
                  </div>

                  {/* Add Items Section */}
                  <div className="space-y-4 border-t border-[var(--hairline)] pt-6">
                    <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">إضافة أصناف المرتجع</Label>
                    <div className="space-y-4 p-5 bg-muted/10 rounded-2xl ring-1 ring-inset ring-[var(--hairline)]">
                      <div className="space-y-2 group/subfield">
                        <Label className="text-xs font-bold text-muted-foreground mr-2 group-focus-within/subfield:text-primary transition-colors">اسم الصنف</Label>
                        <Input placeholder="اسم الصنف" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="text-right h-11 bg-background/40 border-none focus-visible:ring-2 focus-visible:ring-primary/30 font-bold" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 group/subfield">
                          <Label className="text-xs font-bold text-muted-foreground mr-2 group-focus-within/subfield:text-primary transition-colors">السعر</Label>
                          <Input type="number" placeholder="0.00" value={newItem.unitPrice || ""} onChange={(e) => setNewItem({ ...newItem, unitPrice: Number(e.target.value) })} className="text-right h-11 bg-background/40 border-none focus-visible:ring-2 focus-visible:ring-primary/30 font-black" />
                        </div>
                        <div className="space-y-2 group/subfield">
                          <Label className="text-xs font-bold text-muted-foreground mr-2 group-focus-within/subfield:text-primary transition-colors">الكمية</Label>
                          <Input type="number" placeholder="1" value={newItem.quantity || ""} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} className="text-right h-11 bg-background/40 border-none focus-visible:ring-2 focus-visible:ring-primary/30 font-black" />
                        </div>
                      </div>
                      <Button onClick={addItem} className="w-full gap-2 rounded-xl h-12 bg-background/50 hover:bg-background border-[var(--hairline)] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:scale-[1.01]" variant="outline">
                        <Plus className="w-4 h-4" /> إضافة للمرتجع
                      </Button>
                    </div>
                    
                    {/* Selected Items Preview */}
                    <AnimatePresence>
                      {items.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-muted/20 rounded-2xl p-5 space-y-3 ring-1 ring-inset ring-[var(--hairline)]"
                        >
                          {items.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-[var(--hairline)]/50 pb-3 last:border-0">
                              <div className="flex items-center gap-3">
                                <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="w-8 h-8 flex items-center justify-center rounded-xl bg-danger/10 text-danger hover:scale-110 transition-transform"><X className="w-4 h-4" /></button>
                                <div className="text-left">
                                  <span className={cn("font-black text-numeric text-primary block", blurCls)}>{fmt(it.unitPrice * it.quantity)} <span className="text-xs">ج.م</span></span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-foreground font-black block">{it.name}</span>
                                <span className="text-xs text-muted-foreground uppercase font-bold">{it.quantity} قطعة × {fmt(it.unitPrice)}</span>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-between items-center font-black pt-4 border-t border-[var(--hairline)]">
                            <div className="text-left">
                              <span className={cn("text-primary text-2xl text-numeric", blurCls)}>{fmt(items.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0))} <span className="text-xs">ج.م</span></span>
                            </div>
                            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">الإجمالي النهائي للمرتجع</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Reason */}
                  <div className="space-y-3 p-4 bg-muted/20 rounded-2xl ring-1 ring-inset ring-[var(--hairline)] transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:ring-primary/40 group/field">
                    <Label className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-primary transition-colors">السبب / ملاحظات</Label>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تلف في المنتج أو خطأ في المقاس..." className="text-right h-12 bg-background/50 border-none focus-visible:ring-2 focus-visible:ring-primary/30" />
                  </div>

                  <Button 
                    className={cn(
                      "w-full gap-2 py-8 text-xl rounded-2xl shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-500 font-black relative overflow-hidden group",
                      returnType === 'sale' 
                        ? "bg-primary text-primary-foreground hover:shadow-primary/30" 
                        : "bg-warning text-warning-foreground hover:shadow-warning/30"
                    )} 
                    disabled={items.length === 0} 
                    onClick={handleAddReturn}
                  >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                    <Check className="w-6 h-6 relative z-10" /> <span className="relative z-10">تأكيد وتسجيل المرتجع</span>
                  </Button>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="إجمالي المرتجعات" value={data.returns.reduce((acc, r) => acc + r.totalAmount, 0)} icon={<Undo2 className="w-4 h-4 text-muted-foreground" />} color="muted" privacy={privacy} />
        <MetricCard label="مرتجعات مبيعات" value={data.returns.filter(r => r.type === "sale").reduce((acc, r) => acc + r.totalAmount, 0)} icon={<TrendingUp className="w-4 h-4 text-warning" />} color="warning" privacy={privacy} glow />
        <MetricCard label="مرتجعات موردين" value={data.returns.filter(r => r.type === "supplier").reduce((acc, r) => acc + r.totalAmount, 0)} icon={<Package className="w-4 h-4 text-muted-foreground" />} color="muted" privacy={privacy} />
        <MetricCard label="عدد العمليات" value={data.returns.length} icon={<History className="w-4 h-4 text-muted-foreground" />} color="muted" privacy={privacy} isCount glow />
      </div>

      {/* Full Width History Table/List */}
      <div className="space-y-4">
        <div className="sticky-search-bar mb-4">
          <div className="bg-card/50 rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col lg:flex-row gap-5 items-center justify-between">
            <div className="flex items-center gap-4 order-2 lg:order-1 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-80">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="بحث في المرتجعات (رقم الفاتورة، السبب...)" 
                  className="pr-10 h-11 glass border-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Badge variant="secondary" className="px-4 py-2 rounded-xl font-black text-xs tracking-[0.12em] uppercase bg-muted/50 hidden md:flex shrink-0">
                {filteredReturns.length} عملية مؤرشفة
              </Badge>
            </div>
            <h3 className="text-sm font-black flex items-center gap-3 text-right order-1 lg:order-2 w-full lg:w-auto justify-end uppercase tracking-tighter">
              سجل المرتجعات الشامل
              <div className="p-2 rounded-xl bg-foreground/[0.06] ring-1 ring-foreground/10">
                <History className="w-5 h-5 text-foreground" />
              </div>
            </h3>
          </div>
        </div>

        <Reveal delay={100}>
          <div className="flex flex-col gap-3">
            {filteredReturns.length === 0 ? (
              <div className="rounded-2xl border border-foreground/10 bg-card/70">
                <div className=" px-6 py-10">
                  <EmptyState
                    icon={History}
                    title="لا توجد سجلات مطابقة"
                    hint="لم نتمكن من العثور على أي عمليات مرتجعة مسجلة تطابق معايير البحث الحالية."
                  />
                </div>
              </div>
            ) : (
              filteredReturns.map((r: any, idx) => (
                <div
                  key={r.id}
                  className="group rounded-2xl border border-foreground/10 bg-card/70  animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)] both"
                  style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                >
                  <div className=" grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-6">
                    {/* الهوية */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={cn(
                        "grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1",
                        r.type === "sale" ? "bg-warning/12 text-warning ring-warning/25" : "bg-primary/12 text-primary ring-primary/25"
                      )}>
                        {r.type === "sale" ? <TrendingUp className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{r.type === "sale" ? "مرتجع مبيعات" : "مرتجع موردين"}</span>
                          {r.invoiceId && (
                            <Badge variant="secondary" className="text-xs font-mono bg-muted/50 ring-1 ring-inset ring-[var(--hairline)]">{r.invoiceId}</Badge>
                          )}
                        </div>
                        <div className="text-numeric mt-0.5 text-xs text-muted-foreground" dir="ltr">
                          {format(new Date(r.createdAt), "yyyy/MM/dd - hh:mm a")}
                        </div>
                      </div>
                    </div>

                    {/* القيمة والتفاصيل */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <div className="text-xs text-muted-foreground mb-0.5">قيمة المرتجع</div>
                          <div className={cn("text-numeric text-xl font-extrabold", r.type === "sale" ? "text-warning" : "text-primary", blurCls)}>
                            {fmt(r.totalAmount)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                          </div>
                        </div>
                        {r.items && r.items.length > 0 && (
                          <div className="flex flex-col">
                            <div className="text-xs text-muted-foreground mb-0.5">الأصناف</div>
                            <div className="mt-0.5 flex flex-wrap gap-1.5">
                              {r.items.slice(0, 3).map((item: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs py-0 px-2 bg-muted/20 border-none font-bold">
                                  {item.name} ({item.quantity})
                                </Badge>
                              ))}
                              {r.items.length > 3 && (
                                <Badge variant="outline" className="text-xs py-0 px-2 bg-muted/20 border-none font-bold">
                                  +{r.items.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {r.reason && <div className="mt-2 max-w-[300px] truncate text-xs text-muted-foreground">{r.reason}</div>}
                    </div>

                    {/* الإجراءات */}
                    <div className="flex items-center justify-end gap-1.5 md:opacity-70 md:transition-opacity md:group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="action-btn rounded-full text-muted-foreground hover:text-danger hover:bg-danger/10"
                        onClick={() => db.removeReturn(r.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Reveal>

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
    <div className={cn("rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col items-center justify-center text-center  group relative overflow-hidden", glowCls)}>
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
        <span className="text-xs font-black text-muted-foreground uppercase tracking-[0.12em]">{label}</span>
      </div>
      <div className={cn("text-2xl font-black tabular-nums tracking-tighter", colorCls, blurCls)}>
        {isCount ? <CountUp value={value} /> : <><CountUp value={value} format={(n: number) => fmt(n)} /> <span className="text-xs font-bold opacity-60">ج.م</span></>}
      </div>
    </div>
  );
}
