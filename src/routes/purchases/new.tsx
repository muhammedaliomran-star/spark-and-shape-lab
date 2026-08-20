import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDB, db, fmt, type PurchasePaymentType } from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { useNavigate, Link } from "@/lib/router-compat";
import { 
  Truck, Save, X, Plus, Trash2, Banknote, Wallet, 
  ShoppingCart, Search, Info, Eye, EyeOff 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/purchases/new")({
  component: NewPurchasePage,
});

interface LineItem {
  id: string;
  name: string;
  unitCost: string;
  quantity: string;
}

function NewPurchasePage() {
  const data = useDB();
  const navigate = useNavigate();
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "";

  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<PurchasePaymentType>("cash");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1" }
  ]);
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => 
    items.reduce((sum, it) => sum + (Number(it.unitCost) || 0) * (Number(it.quantity) || 0), 0),
    [items]
  );

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1" }]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter(it => it.id !== id));
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems(items.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const submit = async () => {
    if (!supplierId) { toast.error("اختر المورد أولاً"); return; }
    const validItems = items.filter(it => it.name.trim() && Number(it.unitCost) >= 0 && Number(it.quantity) > 0);
    if (validItems.length === 0) { toast.error("أضف صنفاً واحداً على الأقل ببيانات صحيحة"); return; }

    setBusy(true);
    try {
      await db.addPurchase({
        supplierId,
        total,
        paymentType,
        purchaseDate: date,
        notes: notes.trim() || null,
        items: validItems.map(it => ({
          name: it.name.trim(),
          unitCost: Number(it.unitCost),
          quantity: Number(it.quantity)
        }))
      });

      // Automatically try to update stock
      await db.upsertStockDeltas(validItems.map(it => ({
        name: it.name.trim(),
        unitCost: Number(it.unitCost),
        quantity: Number(it.quantity)
      })));

      toast.success(paymentType === "cash" 
        ? "تم حفظ الفاتورة وخصمها من الخزينة وتحديث المخزون" 
        : "تم حفظ الفاتورة وإضافتها للمديونية وتحديث المخزون");
      
      navigate("/purchases");
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ أثناء حفظ الفاتورة");
    } finally {
      setBusy(false);
    }
  };

  const suggestions = useMemo(() => {
    const map = new Map<string, number>();
    data.stockItems.forEach(s => map.set(s.name, s.lastUnitCost));
    return Array.from(map.entries()).map(([name, cost]) => ({ name, cost }));
  }, [data.stockItems]);

  return (
    <AppShell>
      <PageTransition>
        <div className="mx-auto max-w-5xl">
          <PageHeader
            title="فاتورة شراء جديدة"
            subtitle="تسجيل مشتريات بضاعة وتحديث المخزون تلقائياً."
            icon={<ShoppingCart className="w-7 h-7" />}
            action={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggle} title="خصوصية الأرقام">
                  {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm" asChild className="rounded-full">
                  <Link to="/purchases">
                    <X className="w-4 h-4 me-2" /> إلغاء
                  </Link>
                </Button>
                <Button size="sm" onClick={submit} disabled={busy} className="rounded-full shadow-lg shadow-primary/20">
                  <Save className="w-4 h-4 me-2" /> حفظ الفاتورة
                </Button>
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mt-6">
            <div className="space-y-6">
              <Reveal>
                <BezelCard innerClassName="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
                    <div className="space-y-2">
                      <Label>المورد</Label>
                      <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger className="h-12 rounded-2xl">
                          <SelectValue placeholder="اختر المورد..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {data.suppliers.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>تاريخ الفاتورة</Label>
                      <Input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)} 
                        className="h-12 rounded-2xl text-right font-mono" 
                      />
                    </div>
                  </div>

                  <div className="space-y-3 text-right">
                    <div className="flex items-center justify-between mb-2">
                      <Button type="button" size="sm" variant="outline" onClick={addItem} className="rounded-full border-primary/30 text-primary">
                        <Plus className="w-4 h-4 me-2" /> إضافة صنف
                      </Button>
                      <Label className="text-lg font-bold">الأصناف المشتراة</Label>
                    </div>

                    <div className="space-y-3">
                      <AnimatePresence initial={false}>
                        {items.map((it, idx) => (
                          <motion.div
                            key={it.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative group grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 p-4 rounded-2xl hairline bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors"
                          >
                            <div className="space-y-1 text-right">
                              <Label className="text-[10px] uppercase text-muted-foreground">اسم المنتج</Label>
                              <Input 
                                list="stock-suggestions"
                                value={it.name} 
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const match = suggestions.find(s => s.name === v);
                                  updateItem(it.id, match ? { name: v, unitCost: String(match.cost) } : { name: v });
                                }}
                                placeholder="ابحث عن منتج..."
                                className="rounded-xl"
                              />
                            </div>
                            <div className="space-y-1 text-right">
                              <Label className="text-[10px] uppercase text-muted-foreground">سعر التكلفة</Label>
                              <Input 
                                type="number" 
                                value={it.unitCost} 
                                onChange={(e) => updateItem(it.id, { unitCost: e.target.value })} 
                                placeholder="0.00"
                                className={cn("rounded-xl font-mono", blurCls)}
                              />
                            </div>
                            <div className="space-y-1 text-right">
                              <Label className="text-[10px] uppercase text-muted-foreground">الكمية</Label>
                              <Input 
                                type="number" 
                                value={it.quantity} 
                                onChange={(e) => updateItem(it.id, { quantity: e.target.value })} 
                                placeholder="1"
                                className="rounded-xl font-mono"
                              />
                            </div>
                            <div className="flex items-end pb-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeItem(it.id)}
                                disabled={items.length === 1}
                                className="rounded-full text-muted-foreground hover:text-danger hover:bg-danger/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                    <datalist id="stock-suggestions">
                      {suggestions.map(s => <option key={s.name} value={s.name} />)}
                    </datalist>
                  </div>

                  <div className="space-y-2 text-right">
                    <Label>ملاحظات إضافية</Label>
                    <Input 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="رقم الفاتورة الورقية، ملاحظات عن التسليم..."
                      className="rounded-2xl"
                    />
                  </div>
                </BezelCard>
              </Reveal>
            </div>

            <aside className="space-y-4">
              <Reveal delay={100}>
                <BezelCard innerClassName="p-5 space-y-5 sticky top-24">
                  <div className="text-right">
                    <Label className="text-muted-foreground text-xs uppercase tracking-widest font-bold">ملخص الفاتورة</Label>
                    <div className={cn("text-4xl font-black mt-2 text-primary tabular-nums", blurCls)}>
                      {fmt(total)} <span className="text-sm font-bold text-muted-foreground">ج.م</span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-[var(--hairline)] text-right">
                    <Label className="text-xs">طريقة الدفع</Label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentType("cash")}
                        className={cn(
                          "flex items-center justify-between w-full px-4 py-3 rounded-2xl border-2 transition-all text-sm font-bold",
                          paymentType === "cash" 
                            ? "border-success bg-success/5 text-success" 
                            : "border-transparent bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.05]"
                        )}
                      >
                        <Banknote className="w-4 h-4" />
                        <span>نقدي (خزينة)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType("credit")}
                        className={cn(
                          "flex items-center justify-between w-full px-4 py-3 rounded-2xl border-2 transition-all text-sm font-bold",
                          paymentType === "credit" 
                            ? "border-warning bg-warning/5 text-warning" 
                            : "border-transparent bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.05]"
                        )}
                      >
                        <Wallet className="w-4 h-4" />
                        <span>آجل (مديونية)</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-primary/5 rounded-2xl p-4 flex gap-3 text-right border border-primary/10">
                    <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      عند حفظ الفاتورة، سيتم تحديث الكميات في المخازن تلقائياً وتعديل آخر سعر تكلفة لكل منتج.
                    </p>
                  </div>

                  <Button 
                    onClick={submit} 
                    disabled={busy} 
                    className="w-full h-12 rounded-2xl text-base font-bold shadow-xl shadow-primary/20"
                  >
                    حفظ الفاتورة
                  </Button>
                </BezelCard>
              </Reveal>
            </aside>
          </div>
        </div>
      </PageTransition>
    </AppShell>
  );
}