import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDB, db, fmt, findStockByBarcode, type PurchasePaymentType } from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { useNavigate, Link } from "@/lib/router-compat";
import { 
  ShoppingCart, Save, X, Plus, Trash2, Banknote, Wallet, 
  Search, Info, Eye, EyeOff, ScanLine, Tag, ArrowRight, CheckCircle2
} from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export interface PurchaseLineItem {
  id: string;
  name: string;
  unitCost: string;
  quantity: string;
  salePrice?: string;
  barcode?: string;
}

export function NewPurchasePage() {
  const data = useDB();
  const navigate = useNavigate();
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<PurchasePaymentType>("cash");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseLineItem[]>([
    { id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1", salePrice: "" }
  ]);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const total = useMemo(() => 
    items.reduce((sum, it) => sum + (Number(it.unitCost) || 0) * (Number(it.quantity) || 0), 0),
    [items]
  );

  const totalUnits = useMemo(() =>
    items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
    [items]
  );

  const addItem = () => {
    setItems(prev => [
      ...prev, 
      { id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1", salePrice: "" }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) {
      setItems([{ id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1", salePrice: "" }]);
      return;
    }
    setItems(items.filter(it => it.id !== id));
  };

  const updateItem = (id: string, patch: Partial<PurchaseLineItem>) => {
    setItems(items.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const handleBarcodeDetected = (code: string) => {
    setScanOpen(false);
    const found = findStockByBarcode(data.stockItems, code);
    
    setItems(prev => {
      // Check if an existing row already matches this stock item or barcode
      const existingIdx = prev.findIndex(r => 
        (found && r.name.trim().toLowerCase() === found.name.trim().toLowerCase()) || 
        r.barcode === code
      );

      if (existingIdx >= 0) {
        const next = [...prev];
        const currentQty = Number(next[existingIdx].quantity) || 0;
        next[existingIdx] = { 
          ...next[existingIdx], 
          quantity: String(currentQty + 1) 
        };
        return next;
      }

      const newRow: PurchaseLineItem = found
        ? {
            id: crypto.randomUUID(),
            name: found.name,
            unitCost: String(found.lastUnitCost || ""),
            quantity: "1",
            salePrice: found.salePrice ? String(found.salePrice) : "",
            barcode: code
          }
        : {
            id: crypto.randomUUID(),
            name: "",
            unitCost: "",
            quantity: "1",
            salePrice: "",
            barcode: code
          };

      // Replace the first empty row if there's one
      const emptyIdx = prev.findIndex(r => !r.name.trim() && !r.unitCost && !r.barcode);
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = { ...newRow, id: prev[emptyIdx].id };
        return next;
      }

      return [...prev, newRow];
    });

    if (found) {
      toast.success(`تم التعرف على الصنف: ${found.name}`);
    } else {
      toast.info(`باركود جديد: ${code} — يرجى كتابة اسم الصنف وسعر الشراء`);
    }
  };

  // Suggestions from stock catalog and purchase history
  const suggestions = useMemo(() => {
    const map = new Map<string, { cost: number; salePrice?: number; barcode?: string | null }>();
    data.stockItems.forEach(s => {
      map.set(s.name, { cost: s.lastUnitCost, salePrice: s.salePrice, barcode: s.barcode });
    });
    data.purchaseItems.forEach(pi => {
      if (!map.has(pi.name)) {
        map.set(pi.name, { cost: pi.unitCost });
      }
    });
    return Array.from(map.entries()).map(([name, val]) => ({ 
      name, 
      cost: val.cost, 
      salePrice: val.salePrice, 
      barcode: val.barcode 
    }));
  }, [data.stockItems, data.purchaseItems]);

  const submit = async () => {
    if (!supplierId) {
      toast.error("يرجى اختيار المورد أولاً");
      return;
    }
    const validItems = items.filter(it => 
      it.name.trim() && Number(it.unitCost) > 0 && Number(it.quantity) > 0
    );

    if (validItems.length === 0) {
      toast.error("أضف صنفاً واحداً على الأقل بسعر تكلفة وكمية صحيحة أكبر من الصفر");
      return;
    }

    setBusy(true);
    try {
      // 1. Add purchase atomically via PostgreSQL RPC (which updates stock quantities and last cost safely once)
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

      // 2. If selling price or barcode is provided for newly entered items, update catalog properties without duplicating quantity
      for (const item of validItems) {
        const trimmedName = item.name.trim();
        const salePriceNum = Number(item.salePrice);
        const barcodeVal = item.barcode?.trim() || null;

        if ((salePriceNum && salePriceNum > 0) || barcodeVal) {
          const matchedStock = data.stockItems.find(s => 
            s.name.trim().toLowerCase() === trimmedName.toLowerCase()
          );
          if (matchedStock) {
            const patch: any = {};
            if (salePriceNum > 0) patch.salePrice = salePriceNum;
            if (barcodeVal) patch.barcode = barcodeVal;
            try {
              await db.updateStockItem(matchedStock.id, patch);
            } catch {
              // Non-critical background catalog update
            }
          }
        }
      }

      toast.success(paymentType === "cash" 
        ? "تم تسجيل الفاتورة وخصمها من الخزينة وتحديث المخزون بنجاح" 
        : "تم تسجيل الفاتورة وإضافتها لمديونية المورد وتحديث المخزون بنجاح");
      
      navigate("/purchases");
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ أثناء حفظ الفاتورة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="mx-auto max-w-5xl">
          <PageHeader
            title="فاتورة شراء جديدة"
            subtitle="تسجيل مشتريات بضاعة وتحديث المخزون وأسعار التكلفة تلقائياً."
            icon={<ShoppingCart className="w-7 h-7 text-primary" />}
            action={
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggle} 
                  title="خصوصية الأرقام" 
                  className="rounded-full h-9 w-9 p-0"
                >
                  {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </Button>
                <Button variant="outline" size="sm" asChild className="rounded-full h-9">
                  <Link to="/purchases">
                    <X className="w-4 h-4 me-1.5" /> إلغاء
                  </Link>
                </Button>
                <Button 
                  size="sm" 
                  onClick={submit} 
                  disabled={busy} 
                  className="rounded-full h-9 shadow-sm bg-primary text-primary-foreground font-bold"
                >
                  <Save className="w-4 h-4 me-1.5" /> حفظ الفاتورة
                </Button>
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mt-6">
            <div className="space-y-6">
              <Reveal>
                <div className="space-y-6 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
                  {/* Supplier & Date selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
                    <div className="space-y-2">
                      <Label className="font-bold text-sm">المورد <span className="text-danger">*</span></Label>
                      <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue placeholder="اختر المورد..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {data.suppliers.length === 0 ? (
                            <div className="p-3 text-xs text-muted-foreground text-center">
                              لا يوجد موردين مسجلين. <Link to="/suppliers" className="text-primary underline">إضافة مورد</Link>
                            </div>
                          ) : (
                            data.suppliers.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-sm">تاريخ الفاتورة</Label>
                      <Input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)} 
                        className="h-12 rounded-xl text-right font-mono" 
                      />
                    </div>
                  </div>

                  {/* Purchased Items section */}
                  <div className="space-y-3 text-right pt-2 border-t border-border/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="outline" 
                          onClick={addItem} 
                          className="rounded-full border-border bg-foreground/[0.04] text-foreground font-semibold hover:bg-foreground/[0.08]"
                        >
                          <Plus className="w-4 h-4 me-1.5" /> إضافة صنف
                        </Button>
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setScanOpen(true)} 
                          className="rounded-full border-primary/30 bg-primary/10 text-primary font-semibold hover:bg-primary/20"
                        >
                          <ScanLine className="w-4 h-4 me-1.5" /> قارئ الباركود
                        </Button>
                      </div>
                      <Label className="text-base font-bold text-foreground">
                        الأصناف المشتراة ({items.length})
                      </Label>
                    </div>

                    <div className="space-y-3">
                      <AnimatePresence initial={false}>
                        {items.map((it, idx) => (
                          <motion.div
                            key={it.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            className="rounded-2xl border border-border/60 bg-foreground/[0.02] p-4 space-y-3 relative group"
                          >
                            <div className="flex items-center justify-between border-b border-border/30 pb-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeItem(it.id)}
                                disabled={items.length === 1 && !it.name && !it.unitCost}
                                className="h-7 w-7 rounded-full text-muted-foreground hover:text-danger hover:bg-danger/10"
                                title="حذف الصنف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                              <div className="flex items-center gap-2">
                                {it.barcode && (
                                  <span className="text-[11px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <ScanLine className="w-3 h-3" /> {it.barcode}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-muted-foreground">صنف #{idx + 1}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              {/* Product Name */}
                              <div className="space-y-1 text-right sm:col-span-2 lg:col-span-1">
                                <Label className="text-xs text-muted-foreground font-semibold">اسم المنتج <span className="text-danger">*</span></Label>
                                <Input 
                                  list="stock-suggestions"
                                  value={it.name} 
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const match = suggestions.find(s => s.name.toLowerCase() === v.trim().toLowerCase());
                                    updateItem(it.id, match 
                                      ? { 
                                          name: v, 
                                          unitCost: String(match.cost || ""), 
                                          salePrice: match.salePrice ? String(match.salePrice) : it.salePrice,
                                          barcode: match.barcode || it.barcode
                                        } 
                                      : { name: v }
                                    );
                                  }}
                                  placeholder="ابحث أو اكتب اسم الصنف..."
                                  className="rounded-xl font-medium"
                                />
                              </div>

                              {/* Unit Cost */}
                              <div className="space-y-1 text-right">
                                <Label className="text-xs text-muted-foreground font-semibold">سعر التكلفة (ج.م) <span className="text-danger">*</span></Label>
                                <Input 
                                  type="number" 
                                  step="any"
                                  value={it.unitCost} 
                                  onChange={(e) => updateItem(it.id, { unitCost: e.target.value })} 
                                  placeholder="0.00"
                                  className={cn("rounded-xl font-mono text-right font-bold", blurCls)}
                                />
                              </div>

                              {/* Quantity */}
                              <div className="space-y-1 text-right">
                                <Label className="text-xs text-muted-foreground font-semibold">الكمية <span className="text-danger">*</span></Label>
                                <Input 
                                  type="number" 
                                  min="1"
                                  value={it.quantity} 
                                  onChange={(e) => updateItem(it.id, { quantity: e.target.value })} 
                                  placeholder="1"
                                  className="rounded-xl font-mono text-right font-bold"
                                />
                              </div>

                              {/* Proposed Retail Sale Price */}
                              <div className="space-y-1 text-right">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-primary/80 font-bold bg-primary/10 px-1.5 py-0.2 rounded">اختياري</span>
                                  <Label className="text-xs text-muted-foreground font-semibold">سعر البيع المقترح</Label>
                                </div>
                                <Input 
                                  type="number" 
                                  step="any"
                                  value={it.salePrice || ""} 
                                  onChange={(e) => updateItem(it.id, { salePrice: e.target.value })} 
                                  placeholder="سعر البيع بالمحل"
                                  className={cn("rounded-xl font-mono text-right", blurCls)}
                                />
                              </div>
                            </div>

                            {/* Subtotal of line item */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/20 text-xs">
                              <span className={cn("font-extrabold text-foreground tabular-nums", blurCls)}>
                                الإجمالي: {fmt((Number(it.unitCost) || 0) * (Number(it.quantity) || 0))} ج.م
                              </span>
                              {Number(it.salePrice) > 0 && Number(it.unitCost) > 0 && (
                                <span className="text-success text-[11px] font-semibold">
                                  هامش الربح المتوقع: +{fmt(Number(it.salePrice) - Number(it.unitCost))} ج.م (
                                  {Math.round(((Number(it.salePrice) - Number(it.unitCost)) / Number(it.unitCost)) * 100)}%)
                                </span>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    <datalist id="stock-suggestions">
                      {suggestions.map(s => <option key={s.name} value={s.name} />)}
                    </datalist>
                  </div>

                  {/* Notes / Reference */}
                  <div className="space-y-2 text-right pt-2 border-t border-border/40">
                    <Label className="font-bold text-sm">ملاحظات الفاتورة / رقم الإذن الورقي</Label>
                    <Input 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="رقم الفاتورة الورقية عند المورد، بيانات الشحن، إلخ..."
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Sidebar Summary */}
            <aside className="space-y-4">
              <Reveal delay={100}>
                <div className="space-y-5 sticky top-24 rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
                  <div className="text-right">
                    <Label className="text-muted-foreground text-xs uppercase tracking-widest font-bold">
                      إجمالي الفاتورة
                    </Label>
                    <div className={cn("text-3xl font-black mt-2 text-primary tabular-nums", blurCls)}>
                      {fmt(total)} <span className="text-sm font-bold text-muted-foreground">ج.م</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">
                      إجمالي {items.length} صنف / {totalUnits} قطعة
                    </div>
                  </div>

                  {/* Payment Type Toggle */}
                  <div className="space-y-3 pt-4 border-t border-border/40 text-right">
                    <Label className="text-xs font-bold text-foreground">طريقة الدفع للمورد</Label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentType("cash")}
                        className={cn(
                          "flex items-center justify-between w-full px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold text-right",
                          paymentType === "cash" 
                            ? "border-success bg-success/10 text-success" 
                            : "border-border/60 bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/[0.05]"
                        )}
                      >
                        <Banknote className="w-4 h-4 shrink-0" />
                        <div>
                          <div>نقدي (خزينة)</div>
                          <div className="text-[11px] font-normal opacity-80">يُخصم من رصيد الدرج كاش</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType("credit")}
                        className={cn(
                          "flex items-center justify-between w-full px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold text-right",
                          paymentType === "credit" 
                            ? "border-warning bg-warning/10 text-warning" 
                            : "border-border/60 bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/[0.05]"
                        )}
                      >
                        <Wallet className="w-4 h-4 shrink-0" />
                        <div>
                          <div>آجل (مديونية)</div>
                          <div className="text-[11px] font-normal opacity-80">يُضاف لحساب المورد المعلق</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="bg-primary/5 rounded-xl p-3.5 flex gap-2.5 text-right border border-primary/20">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      يتم تحديث رصيد المخزون فورياً وتعديل آخر تكلفة شراء، وإذا تم تحديد سعر بيع سيتم تثبيته في شاشات البيع.
                    </p>
                  </div>

                  <Button 
                    onClick={submit} 
                    disabled={busy} 
                    className="w-full h-12 rounded-xl text-base font-bold shadow bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Save className="w-5 h-5 me-2" /> حفظ الفاتورة والمخزون
                  </Button>
                </div>
              </Reveal>
            </aside>
          </div>
        </div>

        {/* Barcode scanner dialog */}
        <BarcodeScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={handleBarcodeDetected}
          title="مسح باركود صنف للشراء"
        />
      </PageTransition>
    </AppShell>
  );
}

export default NewPurchasePage;
