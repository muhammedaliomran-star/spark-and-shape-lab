import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { db, fmt, PRODUCT_TYPES } from "@/lib/store";
import {
  AlertTriangle, Boxes, Wallet, ScanLine, Plus, Sparkles, Scale, Loader2,
  Check, Wand2, Tag, Calculator,
} from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { motion, AnimatePresence } from "framer-motion";
import { openPdfDocument, esc } from "@/lib/pdf-doc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { generateBarcode } from "@/lib/barcode";

/** رقم موجب فقط — يمنع السالب والحروف قبل ما توصل للـ state. */
export const posNum = (v: string) => v.replace(/[^\d.]/g, "");

export const NUM_CLS =
  "text-numeric text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** eyebrow tag صغير لفصل مجموعات الفورم. */
export function GroupLabel({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{children}</span>
      <span className="h-px flex-1 bg-[var(--hairline)]" />
    </div>
  );
}

/** ملصق باركود للطباعة المباشرة بعد الحفظ. */
export function printBarcodeLabel(opts: { name: string; code: string; price: number; size?: string }) {
  const bars = Array.from(opts.code)
    .map((d) => {
      const w = 1 + (Number(d) % 4);
      return `<i style="width:${w}px"></i><b style="width:${1 + ((Number(d) + 2) % 3)}px"></b>`;
    })
    .join("");
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>ملصق باركود — ${esc(opts.name)}</title>
<style>
@page { size: 50mm 30mm; margin: 2mm; }
body { margin:0; font-family: 'Tahoma', sans-serif; color:#0b1220; }
.label { width:46mm; text-align:center; }
.name { font-size:9pt; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.price { font-size:11pt; font-weight:800; margin-top:1mm; }
.bars { height:11mm; display:flex; align-items:stretch; justify-content:center; gap:1px; margin:1.5mm 0 0.5mm; }
.bars i { background:#0b1220; display:block; }
.bars b { background:#fff; display:block; }
.code { font-family: ui-monospace, monospace; font-size:8pt; letter-spacing:1px; direction:ltr; }
</style></head><body>
<div class="label">
  <div class="name">${esc(opts.name)}${opts.size ? ` — ${esc(opts.size)}` : ""}</div>
  <div class="price">${esc(opts.price)} ج.م</div>
  <div class="bars">${bars}</div>
  <div class="code">${esc(opts.code)}</div>
</div></body></html>`;
  if (!openPdfDocument(html, { autoPrint: true })) toast.error("المتصفح منع فتح نافذة الطباعة");
}

/**
 * فورم إضافة منتج مشترك بين الديالوج/الشيت والصفحة الكاملة.
 * الحقول في منطقة قابلة للتمرير، والحساب + أزرار الحفظ في شريط sticky أسفل.
 */
export function ProductForm({
  existingBarcodes,
  prefillBarcode,
  onSaved,
  onCancel,
  cancelLabel = "إلغاء",
}: {
  existingBarcodes: Array<string | null>;
  prefillBarcode?: string;
  onSaved?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [itemType, setItemType] = useState<string>(PRODUCT_TYPES[0]);
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [barcode, setBarcode] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [prefix, setPrefix] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmZeroPrice, setConfirmZeroPrice] = useState(false);

  const reset = () => {
    setName(""); setSize(""); setItemType(PRODUCT_TYPES[0]);
    setQty("1"); setCost(""); setPrice("");
    setPrefix(""); setMinStock("0"); setConfirmZeroPrice(false);
    setBarcode("");
  };

  useEffect(() => {
    reset();
    if (prefillBarcode) { setMode("manual"); setBarcode(prefillBarcode); }
    else setMode("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillBarcode]);

  const nQty = Math.max(0, Number(qty) || 0);
  const nCost = Math.max(0, Number(cost) || 0);
  const nPrice = Math.max(0, Number(price) || 0);
  const totalCost = nQty * nCost;
  const totalSale = nQty * nPrice;
  const hasPrice = nPrice > 0;
  const netProfit = totalSale - totalCost;
  const marginPct = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const lossy = hasPrice && nPrice < nCost;

  const taken = useMemo(
    () => new Set(existingBarcodes.filter(Boolean).map((b) => String(b).trim())),
    [existingBarcodes],
  );

  // الكود التلقائي = البادئة + ضعف سعر الشراء (+ لاحقة لو متكرر)
  const autoCode = useMemo(() => {
    const head = prefix.trim().replace(/\D/g, "");
    const base = `${head}${Math.round(nCost * 2)}`;
    if (!head && nCost <= 0) return "";
    if (!taken.has(base)) return base;
    for (let i = 1; i < 1000; i++) {
      const candidate = `${base}${String(i).padStart(2, "0")}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${base}${Date.now().toString().slice(-4)}`;
  }, [prefix, nCost, taken]);

  useEffect(() => {
    if (mode === "auto") setBarcode(autoCode);
  }, [mode, autoCode]);

  const code = barcode.trim();
  const codeLen = code.replace(/\D/g, "").length;
  const codeDuplicate = !!code && taken.has(code);
  const codeStandard = codeLen === 13 || codeLen === 8;

  const submit = async (keepOpen = false) => {
    if (!name.trim()) { toast.error("اكتب اسم المنتج"); return; }
    if (codeDuplicate) { toast.error("الباركود مستخدم بالفعل مع منتج آخر"); return; }
    if (!hasPrice && !confirmZeroPrice) {
      setConfirmZeroPrice(true);
      toast.warning("سعر البيع فاضي — اضغط «إضافة» مرة أخرى للتأكيد بدون سعر");
      return;
    }
    setBusy(true);
    try {
      await db.addStockItem({
        name: name.trim(),
        quantity: nQty,
        lastUnitCost: nCost,
        salePrice: nPrice,
        barcode: code || null,
        size: size.trim() || null,
        itemType,
        minStock: Math.max(0, Number(minStock) || 0),
      });
      const savedName = name.trim();
      const savedSize = size.trim();
      const savedCode = code;
      const savedPrice = nPrice;
      toast.success("تمت إضافة المنتج", {
        action: savedCode
          ? {
              label: "طباعة ملصق",
              onClick: () => printBarcodeLabel({ name: savedName, code: savedCode, price: savedPrice, size: savedSize || undefined }),
            }
          : undefined,
      });
      if (keepOpen) { reset(); setMode("auto"); }
      else onSaved?.();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الحفظ");
    } finally { setBusy(false); }
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(false); }}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {/* ١ — هوية المنتج */}
        <div className="space-y-4">
          <GroupLabel icon={Tag}>هوية المنتج</GroupLabel>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-[13px] font-bold">
                اسم المنتج <span className="text-danger">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="مثال: قميص رجالي قطن..."
                className="h-12 rounded-xl text-right text-base font-semibold"
                autoFocus
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>المقاس (اختياري)</Label>
                <Input value={size} onChange={(e) => setSize(e.target.value)} maxLength={30} placeholder="مثال: L / ٤٢ / XXL" className="rounded-xl text-right" />
              </div>
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-muted-foreground" /> نوع المنتج
                </Label>
                <Select value={itemType} onValueChange={setItemType}>
                  <SelectTrigger className="rounded-xl text-right"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="h-px bg-[var(--hairline)]" />
        </div>

        {/* ٢ — التسعير والكمية */}
        <div className="space-y-4">
          <GroupLabel icon={Wallet}>التسعير والكمية</GroupLabel>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>الكمية</Label>
              <Input inputMode="decimal" value={qty} onChange={(e) => setQty(posNum(e.target.value))} onFocus={(e) => e.currentTarget.select()} className={cn("rounded-xl", NUM_CLS)} />
            </div>
            <div className="grid gap-1.5">
              <Label>سعر الشراء</Label>
              <Input inputMode="decimal" value={cost} onChange={(e) => setCost(posNum(e.target.value))} onFocus={(e) => e.currentTarget.select()} placeholder="0" className={cn("rounded-xl", NUM_CLS)} />
            </div>
            <div className="grid gap-1.5">
              <Label>سعر البيع</Label>
              <Input inputMode="decimal" value={price} onChange={(e) => { setPrice(posNum(e.target.value)); setConfirmZeroPrice(false); }} onFocus={(e) => e.currentTarget.select()} placeholder="0" className={cn("rounded-xl", NUM_CLS)} />
            </div>
          </div>

          {nCost > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => { setPrice(String(Math.round(nCost * 2))); setConfirmZeroPrice(false); }}
              >
                <Wand2 className="me-1.5 h-3.5 w-3.5 text-muted-foreground" />
                اقترح سعر بيع = ضعف الشراء ({fmt(Math.round(nCost * 2))})
              </Button>
            </div>
          )}

          <AnimatePresence initial={false}>
            {lossy && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                className="mt-3 flex items-center gap-1.5 text-xs text-danger"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> سعر البيع أقل من سعر الشراء — الربح سالب.
              </motion.div>
            )}
          </AnimatePresence>
          <div className="h-px bg-[var(--hairline)]" />
        </div>

        {/* ٣ — الباركود والمخزون */}
        <div className="space-y-4">
          <GroupLabel icon={ScanLine}>الباركود والمخزون</GroupLabel>

          <div className="mb-3 flex w-max items-center gap-1">
            {([
              { value: "auto", label: "توليد تلقائي" },
              { value: "manual", label: "مسح / كتابة" },
            ] as const).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => { setMode(m.value); if (m.value === "manual") setBarcode(""); }}
                className={cn(
                  "press rounded-full border px-4 py-1.5 text-xs transition-[background-color,color,border-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  mode === m.value
                    ? "border-foreground bg-transparent font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "auto" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>بادئة الكود (اختياري)</Label>
                <Input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  dir="ltr"
                  data-latin-digits=""
                  className="rounded-xl font-mono tabular-nums"
                  placeholder="040770"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>الكود الناتج</Label>
                <div
                  dir="ltr"
                  data-latin-digits=""
                  className="flex h-10 items-center rounded-xl border border-border/60 bg-muted/30 px-3 font-mono text-sm tabular-nums"
                >
                  {code || "—"}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="امسح أو اكتب الكود..."
                dir="ltr"
                data-latin-digits=""
                className="rounded-xl font-mono tabular-nums"
                maxLength={64}
              />
                  <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 rounded-full"
                onClick={() => { setBarcode(generateBarcode(existingBarcodes)); toast.success("تم توليد كود فريد"); }}
                title="توليد كود فريد ١٣ رقمًا"
              >
                <Sparkles className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="shrink-0 rounded-full" onClick={() => setScanOpen(true)} title="مسح بالكاميرا">
                <ScanLine className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          )}

          <div className="mt-2 text-xs">
            {codeDuplicate ? (
              <span className="flex items-center gap-1.5 text-danger">
                <AlertTriangle className="w-3.5 h-3.5" /> الكود ده مستخدم مع منتج آخر.
              </span>
            ) : code ? (
              <span className={cn("flex items-center gap-1.5", codeStandard ? "text-success" : "text-muted-foreground")}>
                {codeStandard ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {fmt(codeLen)} رقم — {codeStandard ? "طول قياسي (EAN)" : "كود داخلي، مش بطول EAN‑8/13 القياسي"}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {mode === "auto"
                  ? "الكود = البادئة + ضعف سعر الشراء، ويتحدّث تلقائيًا."
                  : "امسح كود المنتج أو ولّد كودًا فريدًا للطباعة واللصق."}
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-1.5">
            <Label>الحد الأدنى للمخزون</Label>
            <Input inputMode="decimal" value={minStock} onChange={(e) => setMinStock(posNum(e.target.value))} onFocus={(e) => e.currentTarget.select()} placeholder="5" className={cn("rounded-xl", NUM_CLS)} />
            <div className="text-xs text-muted-foreground">يعتبر المنتج منخفضًا إذا كانت الكمية أقل من هذا الرقم.</div>
          </div>
        </div>
      </div>

      {/* شريط sticky: الحساب + أزرار الحفظ — ظاهر دائمًا بدون تمرير */}
      <div className="sticky bottom-0 z-10 -mx-1 mt-auto px-1 pb-1 pt-3 supports-[padding:env(safe-area-inset-bottom)]:pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center gap-2 px-1">
          <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">حساب الصفقة</span>
          <span className="h-px flex-1 bg-[var(--hairline)]" />
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CalcCell label="إجمالي التكلفة">
            <CountUp value={totalCost} duration={700} format={(n) => fmt(Math.round(n))} /> ج.م
          </CalcCell>
          <CalcCell label="إجمالي سعر البيع">
            {hasPrice ? <><CountUp value={totalSale} duration={700} format={(n) => fmt(Math.round(n))} /> ج.م</> : <span className="text-muted-foreground">—</span>}
          </CalcCell>
          <CalcCell label="صافي الربح" className={netProfit >= 0 ? "text-success" : "text-danger"}>
            {hasPrice ? <><CountUp value={netProfit} duration={700} format={(n) => fmt(Math.round(n))} /> ج.م</> : <span className="text-muted-foreground">—</span>}
          </CalcCell>
          <CalcCell label="نسبة الربح" className={marginPct >= 0 ? "text-success" : "text-danger"}>
            {hasPrice && totalCost > 0 ? `${fmt(Number(marginPct.toFixed(1)))}%` : <span className="text-muted-foreground">—</span>}
          </CalcCell>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            disabled={busy || !name.trim() || codeDuplicate}
            className="group rounded-full ps-5 pe-1.5"
          >
            {confirmZeroPrice && !hasPrice ? "تأكيد الإضافة بدون سعر" : "إضافة"}
            <span className="ms-3 grid h-8 w-8 place-items-center rounded-full bg-foreground/10 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={busy || !name.trim() || codeDuplicate}
            onClick={() => void submit(true)}
          >
            <Boxes className="me-1.5 h-4 w-4" />
            حفظ وإضافة منتج آخر
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" className="rounded-full" onClick={onCancel}>{cancelLabel}</Button>
          )}
        </div>
      </div>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(c) => { setMode("manual"); setBarcode(c); setScanOpen(false); toast.success("تم التقاط الكود"); }}
        title="مسح باركود المنتج الجديد"
      />
    </form>
  );
}

function CalcCell({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="px-3 py-2 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-numeric mt-0.5 text-base font-extrabold", className)}>{children}</div>
    </div>
  );
}
