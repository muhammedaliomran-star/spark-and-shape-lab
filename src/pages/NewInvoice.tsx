import { useEffect, useMemo, useState } from "react";
import { format, addMonths } from "date-fns";
import { Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { StockProductPicker, type ProductRow } from "@/pages/Invoices";
import { useDB, db, fmt, customerBalance, useShopSettings, uid } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";
import { findStockByBarcode } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivacy } from "@/lib/privacy";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus, AlertTriangle, ShieldAlert, Trash2, CalendarIcon, Package, ScanLine,
  Receipt, Banknote, ArrowRight, Eye, EyeOff, Truck, Undo2
} from "lucide-react";


export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <NewInvoicePage />
      </PageTransition>
    </AppShell>
  );
}

function NewInvoicePage() {
  const data = useDB();
  const { settings: shop } = useShopSettings();
  const { privacy, toggle } = usePrivacy();
  const navigate = useNavigate();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  const [customerId, setCustomerId] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([
    { id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" },
  ]);
  const [down, setDown] = useState("0");
  const [monthly, setMonthly] = useState("");
  const [count, setCount] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [saleType, setSaleType] = useState<"cash" | "installments">("installments");
  const [cashPaid, setCashPaid] = useState("");
  const [step, setStep] = useState(1);
  const [discountPct, setDiscountPct] = useState("");
  const [discountAmt, setDiscountAmt] = useState("");
  const [taxPct, setTaxPct] = useState("");
  const [status, setStatus] = useState<"paid" | "pending" | "cancelled">("pending");
  const [shippingCarrierId, setShippingCarrierId] = useState("");
  const [shippingZoneId, setShippingZoneId] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");



  const defaultFirstDue = () => {
    const day = Math.min(28, Math.max(1, shop.defaultDueDay || 1));
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, day);
  };

  useEffect(() => {
    setCount((c) => c || String(Math.max(1, shop.defaultInstallmentMonths || 6)));
    setDate((d) => d ?? defaultFirstDue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.defaultInstallmentMonths, shop.defaultDueDay]);

  const invoiceCode = `#${String((data.invoices?.length ?? 0) + 1).padStart(4, "0")}`;

  const handleScan = (code: string) => {
    setScanOpen(false);
    const found = findStockByBarcode(data.stockItems, code);
    if (!found) {
      toast.error(`لا يوجد منتج بالباركود: ${code}`, {
        description: "يمكنك إضافته كمنتج جديد للمخزن.",
        action: {
          label: "إضافة منتج جديد",
          onClick: async () => {
            try {
              await db.addStockItem({ name: `منتج ${code.slice(-4)}`, barcode: code });
              toast.success("تمت إضافة المنتج للمخزن — حدّث بياناته من صفحة المخزن");
            } catch (e: any) { toast.error(e?.message ?? "تعذر الإضافة"); }
          },
        },
      });
      return;
    }
    setProducts((prev) => {
      const existingIdx = prev.findIndex((r) => r.stockId === found.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], quantity: String((Number(next[existingIdx].quantity) || 0) + 1) };
        return next;
      }
      const emptyIdx = prev.findIndex((r) => !r.name && !r.stockId);
      const newRow: ProductRow = {
        id: crypto.randomUUID(),
        stockId: found.id,
        name: found.name,
        cost: String(found.lastUnitCost || 0),
        price: String(found.salePrice || 0),
        quantity: "1",
      };
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = { ...newRow, id: prev[emptyIdx].id };
        return next;
      }
      return [...prev, newRow];
    });
    toast.success(`تمت إضافة: ${found.name}`);
  };

  const customer = data.customers.find((c) => c.id === customerId);
  const blocked = customer && (customer.frozen || customer.status === "defaulter");

  const totalCost = products.reduce((s, p) => s + Number(p.cost || 0) * Number(p.quantity || 1), 0);
  const subtotal = products.reduce((s, p) => s + Number(p.price || 0) * Number(p.quantity || 1), 0);
  const discountValue = Math.min(subtotal, Math.max(0, Number(discountAmt || 0)));
  const afterDiscount = Math.max(0, subtotal - discountValue);
  const taxValue = Math.max(0, (afterDiscount * Number(taxPct || 0)) / 100);
  const totalPrice = afterDiscount + taxValue;
  const remaining = Math.max(0, totalPrice - Number(down || 0));
  const profit = afterDiscount - totalCost;
  const profitPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  const downNum = Number(down || 0);
  const countNum = Number(count || 0);
  const monthlyNum = Number(monthly || 0);
  const cashPaidNum = Number(cashPaid || 0);
  const change = Math.max(0, cashPaidNum - totalPrice);
  const cashShort = Math.max(0, totalPrice - cashPaidNum);
  const isCashMode = saleType === "cash" || (totalPrice > 0 && downNum >= totalPrice);
  const totalDue = downNum + monthlyNum * countNum;

  const schedule = useMemo(() => {
    if (isCashMode || !date || countNum <= 0 || monthlyNum <= 0) return [];
    const rows: { n: number; due: Date; amount: number }[] = [];
    let left = remaining;
    for (let i = 0; i < Math.min(countNum, 60); i++) {
      const amount = i === countNum - 1 ? Math.max(0, left) : Math.min(monthlyNum, Math.max(0, left));
      left -= amount;
      rows.push({ n: i + 1, due: addMonths(date, i), amount });
    }
    return rows;
  }, [isCashMode, date, countNum, monthlyNum, remaining]);

  const hasValidProduct = products.some((p) => p.name.trim() && Number(p.price) > 0 && Number(p.quantity) > 0);
  const blockReason = !customerId
    ? "اختر العميل أولًا"
    : blocked
      ? "العميل محظور من فتح فواتير جديدة"
      : !hasValidProduct
        ? "أضف منتج واحد على الأقل بسعر صحيح"
        : !isCashMode && (!monthlyNum || !date)
          ? "أكمل بيانات الأقساط (القسط الشهري وتاريخ أول قسط)"
          : !isCashMode && customer?.customerType === "cash"
            ? "العميل فوري (نقدي) — لا يسمح بالتقسيط"
            : null;

  useEffect(() => {
    const n = Number(count);
    if (n > 0 && remaining > 0) setMonthly(String(Math.ceil(remaining / n)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, totalPrice, down]);

  const customerInfo = useMemo(() => {
    if (!customer) return null;
    const balance = customerBalance(data.invoices, customer.id, customer.openingBalance);
    const limit = customer.creditLimit || 0;
    const wouldExceed = limit > 0 && (balance + remaining) > limit;
    return { balance, limit, wouldExceed };
  }, [customer, data.invoices, remaining]);

  const addProduct = () => setProducts((p) => [...p, { id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" }]);
  const removeProduct = (id: string) => setProducts((p) => p.length > 1 ? p.filter((x) => x.id !== id) : p);
  const updateProduct = (id: string, patch: Partial<ProductRow>) =>
    setProducts((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));

  const reset = () => {
    setCustomerId(""); setProducts([{ id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" }]);
    setDown("0"); setMonthly("");
    setCount(String(Math.max(1, shop.defaultInstallmentMonths || 6)));
    setDate(defaultFirstDue());
    setNotes("");
    setSaleType("installments");
    setCashPaid("");
    setDiscountPct(""); setDiscountAmt(""); setTaxPct(""); setStatus("pending");
    setShippingCarrierId(""); setShippingZoneId(""); setShippingAddress(""); setTrackingNumber("");
  };


  const submit = async (stay = false) => {
    if (!customerId) return toast.error("اختر عميل");
    if (blocked) return toast.error("هذا العميل محظور من فتح فواتير جديدة");
    const validProducts = products.filter((p) => p.name.trim() && Number(p.price) > 0 && Number(p.quantity) > 0);
    if (validProducts.length === 0) return toast.error("أضف منتج واحد على الأقل بسعر صحيح");
    for (const p of validProducts) {
      if (!p.stockId) continue;
      const stock = data.stockItems.find((s) => s.id === p.stockId);
      const qty = Number(p.quantity || 0);
      if (!stock) return toast.error(`المنتج "${p.name}" غير موجود في المخزون`);
      if (stock.quantity <= 0) return toast.error(`المنتج "${stock.name}" نفد من المخزون`);
      if (stock.quantity < qty) return toast.error(`الكمية المتاحة من "${stock.name}" هي ${stock.quantity} فقط`);
    }
    const t = totalPrice;
    const d = Number(down);
    const isCash = saleType === "cash" || (t > 0 && d >= t);
    const m = isCash ? 0 : Number(monthly);
    if (!isCash && (!m || !date)) return toast.error("املأ بيانات الأقساط");
    if (!isCash && customer?.customerType === "cash") {
      return toast.error("العميل مسجّل «فوري (نقدي)» — لازم تحصيل كامل المبلغ أو تغيّر نوعه لعميل قسط");
    }
    if (customerInfo?.wouldExceed && !isCash) {
      return toast.error(`تجاوز سقف المديونية (${fmt(customerInfo.limit)} ج.م) — عدّل المقدم أو ارفع السقف`);
    }
    const iso = isCash ? format(new Date(), "yyyy-MM-dd") : format(date as Date, "yyyy-MM-dd");
    const summary = validProducts.map((p) => `${p.name.trim()}${Number(p.quantity) > 1 ? ` ×${p.quantity}` : ""}`).join("، ");
    const productNotes = `${summary}${notes ? ` — ${notes}` : ""}`;
    try {
      const { data: invData, error: invErr } = await (supabase.from as any)("invoices").insert({
        user_id: await uid(),
        customer_id: customerId,
        total: t,
        down_payment: isCash ? t : d,
        monthly_installment: m,
        first_due_date: iso,
        notes: productNotes,
        paid: isCash ? t : d,
        discount_pct: Number(discountPct || 0),
        discount_amount: discountValue,
        tax_pct: Number(taxPct || 0),
        tax_amount: taxValue,
        status: isCash ? "paid" : status,
      }).select("id").single();

      if (invErr) throw invErr;

      // Add Invoice Items
      if (validProducts.length > 0 && invData?.id) {
        const itemRows = validProducts.flatMap((p) => {
          const qty = Math.max(1, Number(p.quantity || 1));
          return [{
            user_id: invData.user_id,
            invoice_id: invData.id,
            name: p.name.trim(),
            cost: Number(p.cost || 0),
            price: Number(p.price || 0),
            quantity: qty,
          }];
        });
        const { error: itemsErr } = await supabase.from("invoice_items").insert(itemRows);
        if (itemsErr) throw itemsErr;
      }

      // Add Shipment if carrier selected
      if (shippingCarrierId && invData?.id) {
        const { error: shipErr } = await (supabase.from as any)("shipments").insert({
          user_id: await uid(),
          invoice_id: invData.id,
          carrier_id: shippingCarrierId,
          zone_id: shippingZoneId || null,
          tracking_number: trackingNumber || null,
          status: 'pending',
          recipient_name: customer?.name,
          recipient_phone: customer?.phone,
          delivery_address: shippingAddress || customer?.address,
        });
        if (shipErr) throw shipErr;
      }

      const deductions = validProducts
        .filter((p) => p.stockId)
        .map((p) => ({ stockId: p.stockId!, quantity: Number(p.quantity || 0) }));
      if (deductions.length > 0) await db.deductStock(deductions);
      toast.success(isCash ? "تم إنشاء فاتورة بيع نقدي ✓ مسددة" : "تم إنشاء الفاتورة");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر إنشاء الفاتورة");
      return;
    }
    reset();
    if (!stay) navigate({ to: "/invoices" });
  };

  // اختصارات الكيبورد: Alt+N منتج جديد، Ctrl+S حفظ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "n" || e.key === "ن")) { e.preventDefault(); setStep(2); addProduct(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "س")) {
        e.preventDefault();
        if (!blockReason) submit(false);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "h" || e.key === "ا")) {
        e.preventDefault();
        toggle();
        toast.info(privacy ? "تم إظهار بيانات الربح" : "تم إخفاء بيانات الربح (وضع الخصوصية)");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (

    <>
      <PageHeader
        eyebrow="الفواتير"
        title="إنشاء فاتورة جديدة"
        subtitle="نفس بيانات النافذة السريعة، بمساحة كاملة للإدخال المريح."
        icon={<Receipt className="h-7 w-7" />}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className={cn(
                "h-10 w-10 rounded-full transition-colors",
                privacy ? "bg-warning/10 text-warning hover:bg-warning/20" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
              )}
              title={privacy ? "إظهار الأرباح (Ctrl+H)" : "إخفاء الأرباح (Ctrl+H)"}
            >
              {privacy ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            <span className="rounded-full border border-border/30 bg-foreground/[0.06] px-4 py-2 font-mono text-sm font-bold tracking-wider text-foreground">
              {invoiceCode}
            </span>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/invoices">
                <ArrowRight className="me-1.5 h-4 w-4" />
                رجوع للفواتير
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ===== العمود الرئيسي ===== */}
        <div className="order-2 space-y-4 text-right lg:order-1">
          {/* الخطوات */}
          <div className="plate flex items-center gap-1.5 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-1.5">
            {[
              { n: 1, label: "العميل والنوع" },
              { n: 2, label: `المنتجات (${products.length})` },
              { n: 3, label: "الشحن" },
              { n: 4, label: "الدفع والأقساط" },
            ].map((s) => (

              <button
                key={s.n}
                type="button"
                onClick={() => setStep(s.n)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  step === s.n ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/[0.05]",
                )}
              >
                <span className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black",
                  step === s.n ? "bg-foreground text-background" : "bg-foreground/10",
                )}>{s.n}</span>
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>

          {step === 1 && (
          <div className="space-y-4">
          {/* العميل */}

          <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">العميل</Label>
              <Select
                value={customerId}
                onValueChange={(v) => {
                  setCustomerId(v);
                  const c = data.customers.find((x) => x.id === v);
                  if (c?.customerType === "cash") {
                    setSaleType("cash");
                    setDown("0");
                    setMonthly(""); setCount("");
                  } else if (c) {
                    setSaleType("installments");
                    if (!date) setDate(addMonths(new Date(), 1));
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                <SelectContent>
                  {data.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {c.customerType === "cash" ? "فوري" : "قسط"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {customer && customerInfo && (
                <div className="flex flex-wrap items-center gap-2 animate-[fade-in_0.2s_ease-out]">
                  <CustomerTypeBadge type={customer.customerType} />
<Badge variant="outline" className={cn("gap-1 font-bold",
                      customerInfo.balance > 0 ? "bg-danger/10 text-danger border-danger/40" : "bg-foreground/[0.06] text-foreground ring-border")}>
                    مديونية حالية: {fmt(customerInfo.balance)} ج.م
                  </Badge>
                  <Badge variant="outline" className="bg-foreground/[0.06] text-muted-foreground ring-border font-bold">
                    سقف الائتمان: {customerInfo.limit > 0 ? `${fmt(customerInfo.limit)} ج.م` : "بدون حد"}
                  </Badge>
                  {customerInfo.wouldExceed && (
                    <Badge variant="outline" className="bg-warning/15 text-warning border-warning/40 gap-1">
                      <ShieldAlert className="w-3 h-3" /> سيتجاوز السقف الائتماني
                    </Badge>
                  )}
                </div>
              )}
            </div>

          {blocked && (
            <div className="rounded-2xl border-2 border-danger/40 bg-danger/10 p-3 text-sm text-danger flex items-start gap-2 animate-[scale-in_0.2s_ease-out]">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div>هذا العميل {customer?.frozen ? "مجمد" : "مماطل"}. النظام لا يسمح بفتح فاتورة جديدة قبل تسوية حسابه.</div>
            </div>
          )}

          {/* نوع الفاتورة */}
          <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-3">
              <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">نوع الفاتورة</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { key: "installments" as const, label: "أقساط", hint: "دفع على دفعات شهرية" },
                  { key: "cash" as const, label: "فوري (نقدي)", hint: "سداد كامل الآن" },
                ]).map((opt) => {
                  const active = saleType === opt.key;
                  const locked = opt.key === "installments" && customer?.customerType === "cash";
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        if (locked) {
                          toast.error("هذا عميل فوري (نقدي) — غيّر نوع العميل لقسط أولًا لو عايز تقسيط");
                          return;
                        }
                        setSaleType(opt.key);
                        if (opt.key === "installments" && !date) setDate(addMonths(new Date(), 1));
                        if (opt.key === "cash") setDown("0");
                      }}
                      aria-pressed={active}
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-2xl p-4 transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                        active
                          ? "bg-foreground text-background"
                          : "bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
                        locked && "cursor-not-allowed opacity-40 hover:bg-transparent",
                      )}
                    >
                      <span className="text-lg font-black mb-1">{opt.label}</span>
                      <span className="text-[10px] font-medium opacity-60 leading-tight">{locked ? "غير متاح لعميل فوري" : opt.hint}</span>
                    </button>
                  );
                })}
              </div>
              {customer && (
                <p className="text-[11px] text-muted-foreground">
                  {customer.customerType === "cash"
                    ? "تم ضبط النوع تلقائيًا: العميل مسجّل «فوري (نقدي)» — التحصيل كامل عند البيع."
                    : "تم ضبط النوع تلقائيًا حسب تسجيل العميل «قسط» — تقدر تحوّله لبيع فوري لو سدّد كامل المبلغ."}
                </p>
              )}
          </div>
          </div>
          )}

          {step === 2 && (
          <div className="space-y-3">

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={addProduct} className="gap-1.5 rounded-full border border-border/30 px-4 text-muted-foreground transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.05] active:scale-[0.98]">
                  <Plus className="w-4 h-4" /> إضافة منتج آخر
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setScanOpen(true)} className="gap-1.5 rounded-full border border-border/30 px-4 text-muted-foreground transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.05] active:scale-[0.98]">
                  <ScanLine className="w-4 h-4" /> مسح باركود
                </Button>
              </div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">المنتجات ({products.length})</Label>
            </div>
            <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-[1.75rem] border border-border/30 p-5 custom-scrollbar">
              <AnimatePresence initial={false}>
                {products.map((p, idx) => {
                  const s = p.stockId ? data.stockItems.find((x) => x.id === p.stockId) : undefined;
                  const qty = Number(p.quantity || 0);
                  const lineTotal = Number(p.price || 0) * Number(p.quantity || 1);
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                      className="divide-y divide-border/30 px-3 py-2.5"
                    >
                      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_76px_96px_96px_32px]">
                        <div className="min-w-0">
                          {idx === 0 && <Label className="mb-1 block text-[10px] text-muted-foreground">اسم المنتج</Label>}
                          <StockProductPicker
                            value={p.stockId}
                            name={p.name}
                            stockItems={data.stockItems}
                            onPick={(item) => updateProduct(p.id, {
                              stockId: item.id,
                              name: item.name,
                              cost: String(item.lastUnitCost || 0),
                              price: p.price || (item.salePrice ? String(item.salePrice) : ""),
                            })}
                            onClear={() => updateProduct(p.id, { stockId: undefined, name: "" })}
                          />
                        </div>
                        <div>
                          {idx === 0 && <Label className="mb-1 block text-[10px] text-muted-foreground">الكمية</Label>}
                          <Input type="number" min="1" value={p.quantity} onChange={(e) => updateProduct(p.id, { quantity: e.target.value })} className="h-9 bg-white/5 border-white/10 text-center" />
                        </div>
                        <div>
                          {idx === 0 && <Label className="mb-1 block text-[10px] text-muted-foreground">التكلفة</Label>}
                          <Input type="number" value={p.cost} onChange={(e) => updateProduct(p.id, { cost: e.target.value })} className={cn(privacy && "privacy-blur", "h-9 bg-white/5 border-white/10 text-center")} />
                        </div>
                        <div>
                          {idx === 0 && <Label className="mb-1 block text-[10px] text-muted-foreground">سعر البيع</Label>}
                          <Input type="number" value={p.price} onChange={(e) => updateProduct(p.id, { price: e.target.value })} className="h-9 bg-white/5 border-white/10 text-center" />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button" size="icon" variant="ghost"
                            onClick={() => removeProduct(p.id)}
                            disabled={products.length === 1}
                            className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold text-muted-foreground">
                          الإجمالي: {fmt(lineTotal)} ج.م
                        </span>
                        {s && (
                          <span className={cn("flex items-center gap-1", s.quantity >= qty && qty > 0 ? "text-success" : "text-danger")}>
                            <Package className="h-3 w-3" /> المتوفر: {s.quantity}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* الخصم والضريبة */}
            <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs font-bold", discountValue > 0 ? "text-foreground" : "text-muted-foreground/50")}>
                    − {fmt(discountValue)} ج.م
                  </span>
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">الخصم</Label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">بالنسبة %</Label>
                    <Input
                      type="number" min="0" max="100" placeholder="0"
                      value={discountPct}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDiscountPct(v);
                        const pct = Math.min(100, Math.max(0, Number(v || 0)));
                        setDiscountAmt(v === "" ? "" : String(Math.round((subtotal * pct) / 100)));
                      }}
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-center"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">بالمبلغ (ج.م)</Label>
                    <Input
                      type="number" min="0" placeholder="0"
                      value={discountAmt}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDiscountAmt(v);
                        const amt = Math.max(0, Number(v || 0));
                        setDiscountPct(v === "" || subtotal <= 0 ? "" : ((amt / subtotal) * 100).toFixed(1));
                      }}
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-center"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setDiscountPct(String(n)); setDiscountAmt(String(Math.round((subtotal * n) / 100))); }}
                      className="rounded-xl bg-white/[0.05] px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground/80 transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.06] hover:text-foreground active:scale-95"
                    >
                      {n}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setDiscountPct(""); setDiscountAmt(""); }}
                    className="rounded-xl bg-white/[0.05] px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground/80 transition-all hover:bg-danger/10 hover:text-danger active:scale-95"
                  >
                    مسح
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-white/5 pt-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">معدل الضريبة %</Label>
                    <Input
                      type="number" min="0" placeholder="0"
                      value={taxPct}
                      onChange={(e) => setTaxPct(e.target.value)}
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-center"
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[0, 14].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setTaxPct(n === 0 ? "" : String(n))}
                          className="rounded-xl bg-white/[0.05] px-3 py-1.5 text-[10px] font-black text-muted-foreground/80 transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.08] hover:text-foreground active:scale-95"
                        >
                          {n === 0 ? "بدون ضريبة" : `${n}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col justify-end gap-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{fmt(subtotal)} ج.م</span>
                      <span className="text-muted-foreground">الإجمالي قبل الخصم</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{fmt(taxValue)} ج.م</span>
                      <span className="text-muted-foreground">قيمة الضريبة</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/5 pt-2">
                      <span className="text-base font-black text-foreground">{fmt(totalPrice)} ج.م</span>
                      <span className="text-muted-foreground">الإجمالي النهائي</span>
                    </div>
                  </div>
                </div>
            </div>

          </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-6">
                  <div className="flex items-center justify-between gap-3">
                    <Badge className="gap-1.5 border border-border/30 bg-foreground/[0.06] px-3 py-1 text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" /> تفاصيل الشحن
                    </Badge>
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">اختياري</Label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs">شركة الشحن</Label>
                      <Select value={shippingCarrierId} onValueChange={setShippingCarrierId}>
                        <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-white/[0.04]">
                          <SelectValue placeholder="اختر الشركة" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.carriers.filter((c: any) => c.active).map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">المنطقة / المحافظة</Label>
                      <Select value={shippingZoneId} onValueChange={setShippingZoneId} disabled={!shippingCarrierId}>
                        <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-white/[0.04]">
                          <SelectValue placeholder="اختر المنطقة" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.zones.filter((z: any) => z.carrierId === shippingCarrierId).map((z: any) => (
                            <SelectItem key={z.id} value={z.id}>{z.name} ({z.deliveryCost} ج.م)</SelectItem>
                          ))}
                        </SelectContent>

                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">عنوان التوصيل</Label>
                    <Input 
                      value={shippingAddress} 
                      onChange={(e) => setShippingAddress(e.target.value)} 
                      placeholder={customer?.address || "اكتب العنوان هنا..."}
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">رقم التتبع (إن وجد)</Label>
                    <Input 
                      value={trackingNumber} 
                      onChange={(e) => setTrackingNumber(e.target.value)} 
                      placeholder="رقم البوليصة"
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04]"
                    />
                  </div>
              </div>
            </div>
           )}

          {step === 4 && (
            <div className="space-y-4">

          <div className="rounded-[1.75rem] border border-border/30 p-5">
              <AnimatePresence mode="wait" initial={false}>
                {isCashMode ? (
                  <motion.div
                    key="pay-cash"
                    initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                    transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Badge className="gap-1.5 border border-border/30 bg-foreground/[0.06] px-3 py-1 text-muted-foreground">
                        <Banknote className="h-3.5 w-3.5" /> بيع نقدي
                      </Badge>
                      <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">تفاصيل السداد</Label>
                    </div>

<div className="flex items-baseline justify-between gap-3 rounded-2xl bg-foreground/[0.06] px-4 py-3">
                        <span className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold leading-none tracking-tight text-foreground">{fmt(totalPrice)} ج.م</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">المطلوب دفعه الآن</span>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">المبلغ المستلم من العميل (ج.م)</Label>
                      <Input type="number" value={cashPaid} onChange={(e) => setCashPaid(e.target.value)} placeholder={`${totalPrice || 0}`} />
                      <div className="flex flex-wrap gap-1.5">
                        {[totalPrice, 50, 100, 200, 500].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v, i) => (
                          <button
                            key={`${v}-${i}`}
                            type="button"
                            onClick={() => setCashPaid(String(i === 0 ? v : (Number(cashPaid || 0) + v)))}
                            className="rounded-full bg-foreground/[0.05] px-3 py-1 text-[11px] font-bold text-muted-foreground transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.08] hover:text-foreground active:scale-[0.96]"
                          >
                            {i === 0 ? "المبلغ بالظبط" : `+ ${fmt(v)}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {cashPaidNum > 0 && (
                      <div className={cn(
                        "flex items-baseline justify-between gap-3 rounded-2xl px-4 py-3",
                        cashShort > 0 ? "bg-warning/10" : "bg-success/10",
                      )}>
                        <span className={cn("text-[clamp(1.1rem,3.5vw,1.5rem)] font-extrabold leading-none tracking-tight", cashShort > 0 ? "text-warning" : "text-success")}>
                          {fmt(cashShort > 0 ? cashShort : change)} ج.م
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          {cashShort > 0 ? "ناقص من المبلغ" : "الفكّة للعميل"}
                        </span>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="pay-inst"
                    initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                    transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">المقدم (ج.م)</Label>
                      <Input type="number" value={down} onChange={(e) => setDown(e.target.value)} />
                      <div className="flex flex-wrap gap-2 mt-2">
                        {([
                          { pct: 0, label: "بدون مقدم" },
                          { pct: 10, label: "10%" },
                          { pct: 25, label: "25%" },
                          { pct: 50, label: "50%" },
                        ]).map((btn) => (
                          <button
                            key={btn.pct}
                            type="button"
                            onClick={() => setDown(String(Math.round((totalPrice * btn.pct) / 100)))}
                            className="rounded-xl bg-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.08] hover:text-foreground active:scale-95"
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

<div className="flex items-baseline justify-between gap-3 rounded-2xl bg-foreground/[0.06] px-4 py-3">
                        <span className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold leading-none tracking-tight text-foreground">{fmt(remaining)} ج.م</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">المتبقي للتقسيط</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs">عدد الأقساط</Label>
                        <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} placeholder="مثال: 6" />
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[3, 6, 9, 12].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setCount(String(n))}
                              className={cn(
                                "flex-1 rounded-xl py-2.5 text-xs font-black transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95",
                                countNum === n
                                  ? "bg-foreground text-background"
                                  : "bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/[0.08]"
                              )}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">القسط الشهري (ج.م)</Label>
                        <Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} className={cn(countNum > 0 && "border-border/30")} />
                      </div>
                      <div>
                        <Label className="text-xs">تاريخ أول قسط</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-between font-normal text-right", !date && "text-muted-foreground")}>
                              {date ? <span dir="ltr">{format(date, "dd/MM/yyyy")}</span> : <span>DD/MM/YYYY</span>}
                              <CalendarIcon className="h-4 w-4 opacity-60" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDate(addMonths(new Date(), 1))}
                            className="rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.08] hover:text-foreground active:scale-[0.96]"
                          >
                            بعد شهر
                          </button>
                          <button
                            type="button"
                            onClick={() => { const n = addMonths(new Date(), 1); setDate(new Date(n.getFullYear(), n.getMonth(), 1)); }}
                            className="rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.08] hover:text-foreground active:scale-[0.96]"
                          >
                            أول الشهر الجاي
                          </button>
                        </div>
                      </div>
                    </div>

                    {schedule.length > 0 && (
                      <div className="space-y-2 rounded-2xl border border-border/30 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-muted-foreground">
                            إجمالي المستحق: <span className="text-foreground">{fmt(totalDue)} ج.م</span>
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">معاينة جدول الأقساط</span>
                        </div>
                        <div className="max-h-52 space-y-1 overflow-y-auto pl-1 custom-scrollbar">
                          {schedule.map((row) => (
                            <div key={row.n} className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-1.5 text-xs">
                              <span className="font-extrabold text-foreground">{fmt(row.amount)} ج.م</span>
                              <span className="text-muted-foreground">
                                قسط {row.n} — <span dir="ltr">{format(row.due, "dd/MM/yyyy")}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                        {Math.abs(totalDue - totalPrice) > 1 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-warning">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            إجمالي المقدم والأقساط لا يساوي إجمالي الفاتورة ({fmt(totalPrice)} ج.م)
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
          </div>

          {/* حالة الفاتورة */}
          <div className="rounded-[1.75rem] border border-border/30 p-5">
            <Label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">حالة الفاتورة</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "paid", label: "مدفوعة", cls: "bg-foreground text-background", ring: "" },
                { v: "pending", label: "معلقة", cls: "bg-foreground text-background", ring: "" },
                { v: "cancelled", label: "ملغية", cls: "bg-foreground text-background", ring: "" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setStatus(o.v)}
                  className={cn(
                    "rounded-2xl py-3 text-xs font-black transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95",
                    status === o.v ? o.cls : "bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/[0.08]",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* ملاحظات */}
          <div className="rounded-[1.75rem] border border-border/30 p-5">
            <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2 block">ملاحظات إضافية</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات..." maxLength={200} className="bg-transparent border-white/10" />
          </div>

          {/* تتبع الربح */}
          <div className="rounded-[2rem] border border-border/30 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-y-6 gap-x-4 divide-y divide-border/30">
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">إجمالي التكلفة</span>
                  <div className="flex items-baseline gap-1">
                    <span className={cn("text-xl font-bold tracking-tight", blurCls)}>{fmt(totalCost)}</span>
                    <span className="text-[10px] font-bold text-muted-foreground/40">ج.م</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">إجمالي سعر البيع</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold tracking-tight">{fmt(totalPrice)}</span>
                    <span className="text-[10px] font-bold text-muted-foreground/40">ج.م</span>
                  </div>
                </div>
                <div className="space-y-1 pt-4 border-t border-border/30">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">صافي الربح</span>
                  <div className="flex items-baseline gap-1">
                    <span className={cn("text-3xl font-black tracking-tighter", blurCls, profit > 0 ? "text-success" : profit < 0 ? "text-danger" : "text-muted-foreground")}>{fmt(profit)}</span>
                    <span className="text-xs font-bold text-muted-foreground/40">ج.م</span>
                  </div>
                </div>
                <div className="space-y-1 pt-4 border-t border-border/30">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">نسبة الربح</span>
                  <span className={cn("block text-3xl font-black tracking-tighter", blurCls, profit > 0 ? "text-success" : profit < 0 ? "text-danger" : "text-muted-foreground")}>{profitPct.toFixed(1)}%</span>
                </div>
                </div>
          </div>
            </div>
          )}


          {/* تنقل الخطوات */}
          <div className="hidden items-center justify-between gap-3 lg:flex">
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-6"
              disabled={step === 4}
              onClick={() => setStep((s) => Math.min(4, s + 1))}
            >
              الخطوة التالية
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              الخطوة السابقة
            </Button>

          </div>
        </div>



        {/* ===== العمود الجانبي ===== */}
        <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          {/* ملخص الفاتورة */}
          <div className="rounded-[2rem] border border-border/30 p-5 space-y-4 text-right">
              <div className="flex items-center justify-between">
                <span className={cn("rounded-full border px-3 py-1 text-[10px] font-bold",
                  blockReason ? "border-warning/40 bg-warning/10 text-warning" : "border border-border/30 bg-foreground/[0.06] text-foreground")}>
                  {blockReason ? "غير مكتملة" : "جاهزة للحفظ"}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">ملخص الفاتورة</span>
              </div>

              <div className="space-y-2 text-sm">
                <Row label="عدد المنتجات" value={String(products.filter((p) => p.name.trim()).length)} />
                <Row label="الإجمالي قبل الخصم" value={`${fmt(subtotal)} ج.م`} />
                {discountValue > 0 && <Row label="الخصم" value={`− ${fmt(discountValue)} ج.م`} />}
                {taxValue > 0 && <Row label={`الضريبة (${Number(taxPct || 0)}%)`} value={`${fmt(taxValue)} ج.م`} />}
                <Row label="إجمالي الفاتورة" value={`${fmt(totalPrice)} ج.م`} />
                <Row label={isCashMode ? "المدفوع الآن" : "المقدم"} value={`${fmt(isCashMode ? totalPrice : downNum)} ج.م`} />
                {!isCashMode && <Row label="المتبقي للتقسيط" value={`${fmt(remaining)} ج.م`} />}
                {!isCashMode && countNum > 0 && <Row label="عدد الأقساط" value={String(countNum)} />}
              </div>

              <div className="rounded-2xl bg-foreground/[0.06] px-4 py-4">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {isCashMode ? "إجمالي الفاتورة" : "المقدم الآن"}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black leading-none tracking-tighter text-foreground">
                    {fmt(isCashMode ? totalPrice : downNum)}
                  </span>
                  <span className="text-xs font-bold text-foreground">ج.م</span>
                </div>
              </div>
          </div>

          {/* الإجراءات */}
          <div className="rounded-[2rem] border border-border/30 p-5 space-y-3 text-right">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">الإجراءات</span>
              {blockReason && (
                <div className="text-[11px] font-bold text-warning">{blockReason}</div>
              )}
              <Button
                onClick={() => submit(false)}
                disabled={!!blockReason}
                className="group relative h-16 w-full overflow-hidden rounded-2xl bg-primary text-lg font-black transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
              >
                <div className="relative z-10 flex items-center justify-center gap-3 text-black">
                  <span>حفظ الفاتورة</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:bg-black/30">
                    <Plus className="h-5 w-5" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary-foreground/10 to-primary opacity-0 transition-opacity group-hover:opacity-20" />
              </Button>
              <Button
                variant="outline"
                onClick={() => submit(true)}
                disabled={!!blockReason}
                className="h-12 w-full rounded-2xl font-bold"
              >
                حفظ وإنشاء فاتورة أخرى
              </Button>
              <Button asChild variant="ghost" className="h-11 w-full rounded-2xl text-muted-foreground">
                <Link to="/invoices">إلغاء</Link>
              </Button>
          </div>
        </aside>
      </div>

      {/* شريط الإجراءات السفلي — للشاشات الصغيرة */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => (step < 3 ? setStep(step + 1) : submit(false))}
            disabled={step === 3 && !!blockReason}
            className="h-12 flex-1 rounded-2xl font-black"
          >
            {step < 3 ? "التالي" : "حفظ الفاتورة"}
          </Button>
          <div className="text-right">
            <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">الإجمالي</span>
            <span className="text-lg font-black leading-none text-foreground">{fmt(totalPrice)}</span>
          </div>
        </div>
      </div>
      <div className="h-20 lg:hidden" />

      <BarcodeScanner

        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={handleScan}
        title="مسح باركود — إضافة منتج للفاتورة"
      />
    </>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-foreground/5 pb-2 last:border-0 last:pb-0">
      <span className={cn("font-extrabold text-foreground", valueClass)}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
