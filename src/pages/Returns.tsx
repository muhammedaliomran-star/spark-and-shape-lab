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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Registration Form */}
        <div className="lg:col-span-1">
          <BezelCard className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-right">
              <Receipt className="w-5 h-5 text-primary" />
              تسجيل مرتجع جديد
            </h3>
            
            <div className="space-y-4 text-right">
              <div className="space-y-2">
                <Label>نوع المرتجع</Label>
                <div className="flex gap-2">
                  <Button 
                    variant={returnType === "sale" ? "default" : "outline"} 
                    className="flex-1"
                    onClick={() => setReturnType("sale")}
                  >
                    مرتجع بيع
                  </Button>
                  <Button 
                    variant={returnType === "supplier" ? "default" : "outline"} 
                    className="flex-1"
                    onClick={() => setReturnType("supplier")}
                  >
                    مرتجع مورد
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>رقم الفاتورة (اختياري)</Label>
                <Input value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="مثال: #INV-001" className="text-right" />
              </div>

              <div className="space-y-4 border-t pt-4">
                <Label className="font-bold">إضافة أصناف المرتجع</Label>
                <div className="space-y-2">
                  <Input placeholder="اسم الصنف" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="text-right" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="السعر" value={newItem.unitPrice || ""} onChange={(e) => setNewItem({ ...newItem, unitPrice: Number(e.target.value) })} className="text-right" />
                    <Input type="number" placeholder="الكمية" value={newItem.quantity || ""} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} className="text-right" />
                  </div>
                  <Button onClick={addItem} className="w-full gap-2" variant="outline">
                    <Plus className="w-4 h-4" /> إضافة للمرتجع
                  </Button>
                </div>
                
                <AnimatePresence>
                  {items.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-muted/50 rounded-xl p-3 space-y-2"
                    >
                      {items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm border-b border-white/5 pb-1">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-danger hover:scale-110 transition-transform"><X className="w-3 h-3" /></button>
                            <span className="font-bold">{fmt(it.unitPrice * it.quantity)} ج.م</span>
                          </div>
                          <span>{it.name} ({it.quantity} × {fmt(it.unitPrice)})</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center font-bold pt-2 border-t border-white/10">
                        <span>{fmt(items.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0))} ج.م</span>
                        <span>الإجمالي</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <Label>السبب / ملاحظات</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تلف في المنتج..." className="text-right" />
              </div>

              <Button className="w-full gap-2 py-6 text-lg" disabled={items.length === 0} onClick={handleAddReturn}>
                <Check className="w-5 h-5" /> تسجيل المرتجع
              </Button>
            </div>
          </BezelCard>
        </div>

        {/* Returns History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="secondary" className="px-3 py-1 rounded-full">{data.returns.length} عملية</Badge>
            <h3 className="text-lg font-bold flex items-center gap-2 text-right">
              <History className="w-5 h-5 text-muted-foreground" />
              سجل المرتجعات التاريخي
            </h3>
          </div>

          <Reveal delay={100}>
            <div className="flex flex-col gap-3">
              {data.returns.length === 0 ? (
                <BezelCard className="p-20 text-center">
                  <EmptyState icon={History} title="لا توجد مرتجعات مسجلة بعد." hint="سيتم إدراج أي عمليات مرتجعة هنا للرجوع إليها." />
                </BezelCard>
              ) : (
                data.returns.map((r: any) => (
                  <BezelCard key={r.id} className="p-4 group border-transparent hover:border-primary/20 transition-all duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 order-2 md:order-1">
                        <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => db.removeReturn(r.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground uppercase">القيمة الإجمالية</div>
                          <div className={cn("text-lg font-bold", blurCls)}>{fmt(r.totalAmount)} ج.م</div>
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
                      <div className="mt-3 text-sm text-muted-foreground bg-white/5 p-2 rounded-lg italic text-right">
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
