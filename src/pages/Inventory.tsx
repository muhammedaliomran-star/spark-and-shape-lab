import { EmptyState } from "@/components/EmptyState";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Reveal } from "@/components/Reveal";
import { db, useDB, fmt, fetchStockHistory, findStockByBarcode, lowStockThreshold, useShopSettings, PRODUCT_TYPES, WAREHOUSE_SEASONS, WAREHOUSE_CATEGORIES, type WarehouseSeason, type StockItem, type StockHistoryEntry } from "@/lib/store";
import {
  Package, Search, Eye, EyeOff, AlertTriangle, Boxes, Wallet, Pencil, Trash2,
  History, Download, FileSpreadsheet, FileText, ArrowUp, ArrowDown, TrendingUp, TrendingDown,
  ScanLine, Plus, Sparkles, PackagePlus, Scale, Loader2, Check, Wand2, Tag, Calculator,
} from "lucide-react";
import { BezelCard } from "@/components/BezelCard";
import { CountUp } from "@/components/CountUp";
import { motion, AnimatePresence } from "framer-motion";
import { pdfDocument, openPdfDocument, esc } from "@/lib/pdf-doc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/lib/privacy";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { generateBarcode } from "@/lib/barcode";
import { AddProductDialog } from "@/components/AddProductDialog";
import { posNum, NUM_CLS, GroupLabel } from "@/components/ProductForm";



const LOW_STOCK = lowStockThreshold;

const REASONS = [
  { value: "damage", label: "تلف / كسر" },
  { value: "correction", label: "تصحيح جرد" },
  { value: "gift", label: "هدية / عينة" },
  { value: "return", label: "مرتجع" },
  { value: "loss", label: "فقدان" },
  { value: "other", label: "أخرى" },
];

export default function Page() {
  return (
    <AppShell>
        <PageTransition>
          <InventoryPage />
        </PageTransition>
      </AppShell>
  );
}

type Tab = "all" | "out" | "low";

function InventoryPage() {
  useShopSettings(); // re-render when the low-stock threshold changes
  const data = useDB();
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [moveItem, setMoveItem] = useState<StockItem | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addPrefillBarcode, setAddPrefillBarcode] = useState<string | undefined>(undefined);

  const onScanned = (code: string) => {
    setScanOpen(false);
    const found = findStockByBarcode(data.stockItems, code);
    if (found) {
      setQ(found.name);
      toast.success(`تم العثور على: ${found.name}`);
    } else {
      toast.error("الكود غير موجود في المخزن", {
        description: `الباركود: ${code}`,
        action: {
          label: "إضافة منتج جديد",
          onClick: () => { setAddPrefillBarcode(code); setAddOpen(true); },
        },
      });
    }
  };

  const totals = useMemo(() => {
    const totalItems = data.stockItems.length;
    const value = data.stockItems.reduce((s, it) => s + it.quantity * it.lastUnitCost, 0);
    const avgCost = totalItems > 0
      ? data.stockItems.reduce((s, it) => s + it.lastUnitCost, 0) / totalItems
      : 0;
    const low = data.stockItems.filter((it) => it.quantity < LOW_STOCK()).length;
    return { totalItems, value, low, avgCost };
  }, [data.stockItems]);

  const list = useMemo(() => {
    return data.stockItems
      .filter((it) => {
        if (tab === "out") return it.quantity <= 0;
        if (tab === "low") return it.quantity > 0 && it.quantity < LOW_STOCK();
        return true;
      })
      .filter((it) => (q ? (it.name.includes(q) || (it.barcode ?? "").includes(q)) : true))
      .sort((a, b) => a.quantity - b.quantity);
  }, [data.stockItems, q, tab]);

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = list.map((it) => ({
        "اسم المنتج": it.name,
        "الكمية": it.quantity,
        "سعر الشراء": it.lastUnitCost,
        "سعر البيع": it.salePrice,
        "قيمة المخزن": it.quantity * it.lastUnitCost,
        "هامش الربح": it.salePrice - it.lastUnitCost,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "المخزن");
      XLSX.writeFile(wb, `inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("تم تصدير ملف Excel");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر التصدير");
    }
  };

  const exportPDF = () => {
    const totalValue = list.reduce((s, it) => s + it.quantity * it.lastUnitCost, 0);
    const lowCount = list.filter((it) => it.quantity > 0 && it.quantity < LOW_STOCK()).length;
    const outCount = list.filter((it) => it.quantity <= 0).length;
    const body = `
<h2 class="sec">قائمة الأصناف</h2>
<div class="t-wrap"><table><thead><tr>
  <th>اسم المنتج</th><th class="num">الكمية النظامية</th><th class="num">سعر الشراء</th><th class="num">سعر البيع</th>
  <th class="num">قيمة المخزن</th><th>جرد فعلي</th><th>فرق</th>
</tr></thead><tbody>
${list.map((it) => {
  const cls = it.quantity <= 0 ? "out" : it.quantity < LOW_STOCK() ? "low" : "";
  return `<tr class="${cls}">
    <td>${esc(it.name)}</td>
    <td class="num">${fmt(it.quantity)}</td>
    <td class="num">${fmt(it.lastUnitCost)}</td>
    <td class="num">${fmt(it.salePrice)}</td>
    <td class="num">${fmt(it.quantity * it.lastUnitCost)}</td>
    <td style="min-width:70px"></td><td style="min-width:70px"></td>
  </tr>`;
}).join("") || `<tr><td colspan="7" class="empty">لا توجد أصناف</td></tr>`}
</tbody></table></div>
<div class="sig"><div>توقيع القائم بالجرد</div><div>توقيع المراجع</div></div>`;
    const html = pdfDocument({
      docTitle: "تقرير المخزن — سِجلّي",
      badge: "كشف جرد",
      title: "تقرير المخزن — جرد فعلي",
      lede: "قائمة الأصناف مع الكميات النظامية وخانات فارغة لتسجيل الجرد الفعلي والفروقات.",
      meta: [
        { label: "تاريخ التقرير", value: new Date().toLocaleDateString("en-US") },
        { label: "عدد الأصناف", value: String(list.length) },
      ],
      kpis: [
        { label: "عدد الأصناف", value: String(list.length) },
        { label: "قيمة المخزن", value: `${fmt(totalValue)} ج.م`, tone: "brand" },
        { label: "أصناف قاربت النفاد", value: String(lowCount), tone: "warn" },
        { label: "أصناف منتهية", value: String(outCount), tone: "danger" },
      ],
      body,
      page: "A4 landscape",
    });
    if (!openPdfDocument(html, { autoPrint: true })) toast.error("اسمح بفتح النوافذ المنبثقة");
  };


  return (
    <>
      <PageHeader
        title="المنتجات"
        subtitle="إدارة الأصناف والكميات وأسعار الشراء والبيع."
        icon={<Package className="w-7 h-7" />}
        action={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">تصدير</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportExcel} className="gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-foreground" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF} className="gap-2">
                  <FileText className="w-4 h-4 text-foreground" /> PDF (للجرد)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant={privacy ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={toggle}
              title="إخفاء الأرقام"
            >
              {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">إخفاء الأرقام</span>
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { setAddPrefillBarcode(undefined); setAddOpen(true); }}>
              <PackagePlus className="w-4 h-4" />
              <span className="hidden sm:inline">إضافة منتج</span>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <StatBox label="إجمالي الأصناف" value={String(totals.totalItems)} icon={<Boxes className="w-5 h-5" />} tone="neutral" sub="عدد الأصناف الفريدة" />
        <StatBox label="قيمة المخزن" value={`${fmt(totals.value)} ج.م`} icon={<Wallet className="w-5 h-5" />} tone="neutral" valueClassName={blurCls} sub="الكمية × سعر الشراء" />
        <StatBox label="متوسط سعر الشراء" value={`${fmt(totals.avgCost)} ج.م`} icon={<TrendingUp className="w-5 h-5" />} tone="neutral" valueClassName={blurCls} sub="متوسط على كل الأصناف" />
        <StatBox label="نواقص" value={String(totals.low)} icon={<AlertTriangle className="w-5 w-5" />} tone={totals.low > 0 ? "danger" : "neutral"} sub={`أقل من ${LOW_STOCK()} وحدات • مرتبط بالمنبه`} />
      </div>

      <div className="sticky-search-bar">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
          <TabsList className="grid grid-cols-3 w-full h-auto">
            <TabsTrigger value="all" className="gap-1.5 data-[state=active]:bg-foreground/[0.06] data-[state=active]:text-foreground">
              الكل <Badge variant="secondary" className="rounded-full">{data.stockItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="low" className="gap-1.5 data-[state=active]:bg-foreground/[0.06] data-[state=active]:text-foreground">
              ناقص <Badge variant="secondary" className="rounded-full">{data.stockItems.filter((it) => it.quantity > 0 && it.quantity < LOW_STOCK()).length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="out" className="gap-1.5 data-[state=active]:bg-foreground/[0.06] data-[state=active]:text-foreground">
              نفذ <Badge variant="secondary" className="rounded-full">{data.stockItems.filter((it) => it.quantity <= 0).length}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mb-5">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المنتج أو الباركود..." className="pr-10 pl-10" />
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08] transition-[color,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              title="مسح باركود"
            >
              <ScanLine className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <Reveal delay={140}>
        <div className="mb-3 flex items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-1.5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{list.length} صنف</div>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="bezel-shell">
            <div className="bezel-core px-6 py-10">
              <EmptyState
                icon={Package}
                title="المخزن فاضي."
                hint="أضف فاتورة شراء وهيتعبّى المخزن تلقائيًا بأصنافها."
                action={<Button size="sm" onClick={() => { setAddPrefillBarcode(undefined); setAddOpen(true); }} className="gap-2"><Plus className="w-4 h-4" /> إضافة أول منتج</Button>}
              />
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[64vh]">
            <div className="flex flex-col gap-3 pl-1">
              {list.map((it, idx) => {
                const out = it.quantity <= 0;
                const low = !out && it.quantity < LOW_STOCK();
                const profit = it.salePrice - it.lastUnitCost;
                const margin = it.salePrice > 0 ? (profit / it.salePrice) * 100 : 0;
                
                return (
                  <div
                    key={it.id}
                    className="group bezel-shell bezel-lift animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)] both"
                    style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                  >
                    <div className="bezel-core grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-6">
                      {/* الهوية */}
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn(
                          "text-display grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-bold",
                          "bg-foreground/[0.06] text-muted-foreground ring-1 ring-border"
                        )}>
                          <Package className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-bold leading-tight">{it.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            {(it.itemType || it.size) && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Scale className="h-3 w-3" />
                                {it.itemType || "غير محدد"}{it.size ? ` — ${it.size}` : ""}
                              </span>
                            )}
                            {it.barcode && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                                <ScanLine className="h-3 w-3" /> {it.barcode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* المقاييس */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <div className="text-[10px] text-muted-foreground mb-0.5">الكمية</div>
                            <div className={cn("text-numeric text-xl font-extrabold leading-none", out ? "text-danger" : low ? "text-warning" : "text-foreground", privacy && "privacy-blur")}>
                              {fmt(it.quantity)}
                            </div>
                          </div>
                          
                          <div className="flex flex-col">
                            <div className="text-[10px] text-muted-foreground mb-0.5">الربح المتوقع</div>
                            <div className={cn("text-numeric font-bold leading-none flex items-center gap-1", profit >= 0 ? "text-success" : "text-danger", privacy && "privacy-blur")}>
                              {profit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              {fmt(profit)} <span className="text-[10px]">ج.م</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className={cn("rounded-lg bg-foreground/[0.03] p-1.5 text-center", privacy && "privacy-blur")}>
                            <div className="text-[9px] text-muted-foreground uppercase">التكلفة</div>
                            <div className="text-xs font-bold">{fmt(it.lastUnitCost)}</div>
                          </div>
                          <div className={cn("rounded-lg bg-primary/5 p-1.5 text-center", privacy && "privacy-blur")}>
                            <div className="text-[9px] text-primary/70 uppercase">البيع</div>
                            <div className="text-xs font-bold text-primary">{fmt(it.salePrice)}</div>
                          </div>
                        </div>
                      </div>

                      {/* الإجراءات */}
                      <div className="flex flex-wrap items-center justify-end gap-1.5 md:opacity-70 md:transition-opacity md:duration-500 md:ease-[cubic-bezier(0.32,0.72,0,1)] md:group-hover:opacity-100 md:focus-within:opacity-100">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]" onClick={() => setAdjustItem(it)}>
                                <Scale className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">تسوية كمية</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]" onClick={() => setHistoryItem(it)}>
                                <History className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">سجل الحركة</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]" onClick={() => setEditing(it)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">تعديل الصنف</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]" onClick={() => setMoveItem(it)}>
                                <Boxes className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">نقل للمخازن</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="action-btn danger rounded-full text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setDeleteId(it.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">حذف</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Reveal>
      <AdjustDialog item={adjustItem} onClose={() => setAdjustItem(null)} />
      <MoveToWarehouseDialog item={moveItem} onClose={() => setMoveItem(null)} />
      <EditDialog item={editing} onClose={() => setEditing(null)} existingBarcodes={data.stockItems.map((s) => s.barcode)} />

      <AdjustDialog item={adjustItem} onClose={() => setAdjustItem(null)} />
      <MoveToWarehouseDialog item={moveItem} onClose={() => setMoveItem(null)} />
      <EditDialog item={editing} onClose={() => setEditing(null)} existingBarcodes={data.stockItems.map((s) => s.barcode)} />

      <AddProductDialog
        open={addOpen}
        onOpenChange={(v: boolean) => { setAddOpen(v); if (!v) setAddPrefillBarcode(undefined); }}
        prefillBarcode={addPrefillBarcode}
        existingBarcodes={data.stockItems.map((s) => s.barcode)}
      />
      <HistoryDialog item={historyItem} onClose={() => setHistoryItem(null)} />
      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetected={onScanned} title="مسح باركود — بحث في المخزن" />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">حذف المنتج؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف المنتج من المخزن. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteId) return;
                try { await db.removeStockItem(deleteId); toast.success("تم حذف المنتج"); }
                catch (e: any) { toast.error(e?.message ?? "تعذر الحذف"); }
                finally { setDeleteId(null); }
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Quick manual reconciliation: signed delta + required reason, logged in stock_adjustments. */
function AdjustDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const [mode, setMode] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("correction");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) { setMode("out"); setAmount("1"); setReason("correction"); setNotes(""); }
  }, [item]);

  const qty = Math.abs(Number(amount) || 0);
  const delta = mode === "in" ? qty : -qty;
  const next = item ? Math.max(0, item.quantity + delta) : 0;

  const submit = async () => {
    if (!item) return;
    if (qty <= 0) { toast.error("أدخل كمية أكبر من صفر"); return; }
    setBusy(true);
    try {
      await db.adjustStock(
        item.id,
        delta,
        REASONS.find((r) => r.value === reason)?.label ?? reason,
        notes.trim() || undefined,
      );
      toast.success("تمت تسوية الكمية");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر حفظ التسوية");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">تسوية كمية — {item?.name}</DialogTitle>
          <DialogDescription className="text-right">
            زوّد أو نقّص الكمية بسبب واضح، والحركة هتتسجل في سجل المنتج.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "in" ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setMode("in")}
            >
              <ArrowUp className="w-4 h-4" /> إضافة
            </Button>
            <Button
              type="button"
              variant={mode === "out" ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setMode("out")}
            >
              <ArrowDown className="w-4 h-4" /> خصم
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label>الكمية</Label>
            <Input type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>سبب التسوية <span className="text-danger">*</span></Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تفاصيل إضافية..." maxLength={200} />
          </div>
          <div className="rounded-2xl border-2 border-border bg-foreground/[0.03] p-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">الكمية بعد التسوية</span>
            <span className="font-extrabold tabular-nums">
              {fmt(item?.quantity ?? 0)} ← {fmt(next)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={busy}>حفظ التسوية</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** نقل جزء من كمية منتج إلى المخزن (warehouse_items) مع خصمها من المنتجات. */
function MoveToWarehouseDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const [qty, setQty] = useState("1");
  const [season, setSeason] = useState<WarehouseSeason>("all");
  const [category, setCategory] = useState("other");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) {
      setQty(String(Math.max(1, item.quantity)));
      setSeason("all");
      setCategory("other");
      setNotes("");
    }
  }, [item]);

  const nQty = Math.max(0, Number(qty) || 0);
  const over = !!item && nQty > item.quantity;

  const submit = async () => {
    if (!item) return;
    if (nQty <= 0) { toast.error("اكتب كمية أكبر من صفر"); return; }
    if (over) { toast.error("الكمية أكبر من المتاح في المنتجات"); return; }
    setBusy(true);
    try {
      await db.addWarehouseItem({
        name: item.name,
        quantity: nQty,
        unitCost: item.lastUnitCost,
        salePrice: item.salePrice,
        season,
        category,
        notes: notes.trim() || null,
      });
      const remaining = item.quantity - nQty;
      if (remaining <= 0) {
        // نقل كل الكمية → المنتج يختفي من قسم المنتجات
        await db.removeStockItem(item.id);
        toast.success("تم نقل المنتج للمخزن وحذفه من المنتجات");
      } else {
        await db.updateStockItem(
          item.id,
          { quantity: remaining },
          { delta: -nQty, reason: "نقل للمخزن", notes: notes.trim() || undefined },
        );
        toast.success(`تم نقل ${fmt(nQty)} وحدة للمخزن`);
      }

      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر النقل");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">نقل للمخزن</DialogTitle>
          <DialogDescription className="text-right">
            {item?.name} — المتاح: {fmt(item?.quantity ?? 0)} وحدة. الكمية المنقولة تُخصم من المنتجات.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>الكمية المنقولة</Label>
            <Input inputMode="decimal" value={qty} onChange={(e) => setQty(posNum(e.target.value))} onFocus={(e) => e.currentTarget.select()} className={cn("rounded-2xl", NUM_CLS)} />
            {over && (
              <div className="flex items-center gap-1.5 text-[11px] text-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> الكمية أكبر من المتاح.
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>الموسم</Label>
              <Select value={season} onValueChange={(v) => setSeason(v as WarehouseSeason)}>
                <SelectTrigger className="rounded-2xl text-right"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_SEASONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>التصنيف</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-2xl text-right"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder="سبب النقل أو مكان التخزين..." className="rounded-2xl text-right" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={onClose}>إلغاء</Button>
          <Button className="rounded-full" onClick={submit} disabled={busy || nQty <= 0 || over}>
            {busy ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <PackagePlus className="me-1.5 h-4 w-4" />}
            نقل للمخزن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ item, onClose, existingBarcodes }: { item: StockItem | null; onClose: () => void; existingBarcodes: Array<string | null> }) {
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [itemType, setItemType] = useState<string>(PRODUCT_TYPES[0]);
  const [qty, setQty] = useState("0");
  const [cost, setCost] = useState("0");
  const [price, setPrice] = useState("0");
  const [barcode, setBarcode] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [reason, setReason] = useState<string>("correction");
  const [reasonNotes, setReasonNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setSize(item.size ?? "");
      setItemType(item.itemType || PRODUCT_TYPES[0]);
      setQty(String(item.quantity));
      setCost(String(item.lastUnitCost));
      setPrice(String(item.salePrice));
      setBarcode(item.barcode ?? "");
      setMinStock(String(item.minStock ?? 0));
      setReason("correction");
      setReasonNotes("");
    }
  }, [item]);

  const newQty = Math.max(0, Number(qty) || 0);
  const newCost = Math.max(0, Number(cost) || 0);
  const newPrice = Math.max(0, Number(price) || 0);
  const delta = item ? newQty - item.quantity : 0;
  const profit = newPrice - newCost;
  const margin = newPrice > 0 ? (profit / newPrice) * 100 : 0;
  const reasonRequired = delta !== 0;

  const code = barcode.trim();
  const codeDuplicate = useMemo(() => {
    if (!code) return false;
    const taken = new Set(
      existingBarcodes.filter(Boolean).map((b) => String(b).trim()),
    );
    if (item?.barcode) taken.delete(item.barcode.trim());
    return taken.has(code);
  }, [code, existingBarcodes, item]);

  const submit = async () => {
    if (!item) return;
    if (!name.trim()) { toast.error("اكتب اسم المنتج"); return; }
    if (codeDuplicate) { toast.error("الباركود مستخدم بالفعل مع منتج آخر"); return; }
    if (reasonRequired && !reason) { toast.error("اختر سبب التعديل"); return; }
    setBusy(true);
    try {
      await db.updateStockItem(
        item.id,
        {
          name: name.trim(),
          size: size.trim() || null,
          itemType,
          quantity: newQty,
          lastUnitCost: newCost,
          salePrice: newPrice,
          barcode: code || null,
          minStock: Math.max(0, Number(minStock) || 0),
        },
        reasonRequired ? {
          delta,
          reason: REASONS.find((r) => r.value === reason)?.label ?? reason,
          notes: reasonNotes.trim() || undefined,
        } : undefined,
      );
      toast.success("تم تحديث المنتج");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الحفظ");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">تعديل المنتج</DialogTitle>
          <DialogDescription className="text-right">عدّل كل تفاصيل المنتج. أي تغيير في الكمية يحتاج سبب.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <BezelCard innerClassName="p-4">
            <GroupLabel icon={Tag}>هوية المنتج</GroupLabel>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>اسم المنتج <span className="text-danger">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="rounded-2xl text-right" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>المقاس (اختياري)</Label>
                  <Input value={size} onChange={(e) => setSize(e.target.value)} maxLength={30} placeholder="مثال: L / ٤٢" className="rounded-2xl text-right" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-1.5"><Scale className="h-3.5 w-3.5 text-primary" /> نوع المنتج</Label>
                  <Select value={itemType} onValueChange={setItemType}>
                    <SelectTrigger className="rounded-2xl text-right"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </BezelCard>

          <BezelCard innerClassName="p-4">
            <GroupLabel icon={Wallet}>التسعير والكمية</GroupLabel>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>الكمية</Label>
                <Input inputMode="decimal" value={qty} onChange={(e) => setQty(posNum(e.target.value))} onFocus={(e) => e.currentTarget.select()} className={cn("rounded-2xl", NUM_CLS)} />
              </div>
              <div className="grid gap-1.5">
                <Label>سعر الشراء</Label>
                <Input inputMode="decimal" value={cost} onChange={(e) => setCost(posNum(e.target.value))} onFocus={(e) => e.currentTarget.select()} className={cn("rounded-2xl", NUM_CLS)} />
              </div>
              <div className="grid gap-1.5">
                <Label>سعر البيع</Label>
                <Input inputMode="decimal" value={price} onChange={(e) => setPrice(posNum(e.target.value))} onFocus={(e) => e.currentTarget.select()} className={cn("rounded-2xl", NUM_CLS)} />
              </div>
            </div>

            <div className={cn(
              "mt-3 flex items-center justify-between gap-3 rounded-2xl border-2 p-3",
              profit >= 0 ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5",
            )}>
              <div className="flex items-center gap-2">
                {profit >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-danger" />}
                <span className="text-xs text-muted-foreground">الربح المتوقع للوحدة</span>
              </div>
              <div className={cn("font-extrabold tabular-nums", profit >= 0 ? "text-success" : "text-danger")}>
                {newPrice > 0 ? <>{fmt(profit)} ج.م</> : <span className="text-muted-foreground">—</span>}
                {newPrice > 0 && (
                  <span className="me-2 text-xs font-normal text-muted-foreground">(هامش {fmt(Number(margin.toFixed(1)))}%)</span>
                )}
              </div>
            </div>
          </BezelCard>

          <BezelCard innerClassName="p-4">
            <GroupLabel icon={ScanLine}>الباركود والمخزون</GroupLabel>
            <div className="grid gap-1.5">
              <Label>الباركود (اختياري)</Label>
              <div className="flex gap-2">
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="امسح أو اكتب الكود..."
                  dir="ltr"
                  data-latin-digits=""
                  className="rounded-2xl font-mono tabular-nums"
                  maxLength={64}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-full"
                  onClick={() => { setBarcode(generateBarcode(existingBarcodes)); toast.success("تم توليد كود فريد"); }}
                  title="توليد كود فريد"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="shrink-0 rounded-full" onClick={() => setScanOpen(true)} title="مسح بالكاميرا">
                  <ScanLine className="h-4 w-4" />
                </Button>
              </div>
              {codeDuplicate && (
                <div className="flex items-center gap-1.5 text-[11px] text-danger">
                  <AlertTriangle className="h-3.5 w-3.5" /> الكود ده مستخدم مع منتج آخر.
                </div>
              )}
            </div>
            <div className="mt-3 grid gap-1.5">
              <Label>الحد الأدنى للمخزون</Label>
              <Input inputMode="decimal" value={minStock} onChange={(e) => setMinStock(posNum(e.target.value))} onFocus={(e) => e.currentTarget.select()} className={cn("rounded-2xl", NUM_CLS)} />
              <div className="text-[11px] text-muted-foreground">يعتبر المنتج منخفضًا إذا كانت الكمية أقل من هذا الرقم.</div>
            </div>
          </BezelCard>

          {reasonRequired && (
            <div className="grid gap-2.5 rounded-2xl border-2 border-warning/30 bg-warning/5 p-3 animate-[fade-in_0.2s_ease-out]">
              <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                <AlertTriangle className="h-4 w-4" />
                تعديل كمية: {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                <span className="tabular-nums">{fmt(Math.abs(delta))} وحدة</span>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">سبب التعديل <span className="text-danger">*</span></Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="rounded-2xl text-right"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">ملاحظات (اختياري)</Label>
                <Input value={reasonNotes} onChange={(e) => setReasonNotes(e.target.value)} placeholder="تفاصيل إضافية..." maxLength={200} className="rounded-2xl text-right" />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={onClose}>إلغاء</Button>
          <Button className="rounded-full" onClick={submit} disabled={busy || !name.trim() || codeDuplicate}>
            {busy && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
        <BarcodeScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={(code) => { setBarcode(code); setScanOpen(false); toast.success("تم التقاط الكود"); }}
          title="مسح باركود المنتج"
        />
      </DialogContent>
    </Dialog>
  );
}


function HistoryDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const [entries, setEntries] = useState<StockHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    fetchStockHistory(item.id, item.name)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [item]);

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            سجل حركة المنتج
          </DialogTitle>
          <DialogDescription className="text-right">
            {item?.name} — كل زيادة (شراء) ونقص (بيع/تعديل).
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2 -mx-2 px-2">
          {loading && <div className="text-center text-muted-foreground py-8 text-sm">جاري التحميل...</div>}
          {!loading && entries.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              لا يوجد حركة مسجلة لهذا المنتج.
            </div>
          )}
          {entries.map((e) => {
            const positive = e.qty > 0;
            const cls = e.type === "purchase"
              ? "border-success/30 bg-success/5"
              : e.type === "sale"
              ? "border-primary/30 bg-primary/5"
              : positive ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5";
            const Icon = positive ? ArrowUp : ArrowDown;
            const iconCls = positive ? "text-success" : e.type === "sale" ? "text-primary" : "text-warning";
            const label = e.type === "purchase" ? "شراء" : e.type === "sale" ? "بيع" : "تعديل";
            return (
              <div key={e.id} className={cn("flex items-center justify-between gap-3 rounded-2xl border-2 p-3", cls)}>
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={cn("w-5 h-5 shrink-0", iconCls)} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold flex items-center gap-2">
                      {label}
                      {e.reason && <span className="text-xs font-normal text-muted-foreground">— {e.reason}</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {new Date(e.date).toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}
                      {e.notes ? ` • ${e.notes}` : e.ref ? ` • ${e.ref}` : ""}
                    </div>
                  </div>
                </div>
                <div className={cn("font-extrabold tabular-nums shrink-0", iconCls)}>
                  {positive ? "+" : ""}{fmt(e.qty)}
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({
  label, value, icon, tone, valueClassName, sub,
}: { label: string; value: string; icon: React.ReactNode; tone: "primary" | "success" | "danger" | "neutral"; valueClassName?: string; sub?: string }) {
  const toneCls = tone === "success"
    ? { border: "border-success/30 hover:border-success/60", chip: "bg-success/10 border-success/30 text-success", text: "text-success", grad: "bg-linear-to-bl from-success to-transparent" }
    : tone === "danger"
    ? { border: "border-danger/30 hover:border-danger/60", chip: "bg-danger/10 border-danger/30 text-danger", text: "text-danger", grad: "bg-linear-to-bl from-danger to-transparent" }
    : tone === "neutral"
    ? { border: "border-border/30 hover:border-border/40", chip: "bg-foreground/[0.06] text-muted-foreground ring-1 ring-border", text: "text-foreground", grad: "bg-linear-to-bl from-transparent to-transparent" }
    : { border: "border-border/30 hover:border-border/40", chip: "bg-foreground/[0.06] text-muted-foreground ring-1 ring-border", text: "text-foreground", grad: "bg-linear-to-bl from-transparent to-transparent" };
  return (
    <div className={cn("relative overflow-hidden bg-card plate p-5 transition-[transform,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5", toneCls.border)}>
      <div className={cn("absolute inset-0 opacity-[0.06] pointer-events-none", toneCls.grad)} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className={cn("w-10 h-10 rounded-2xl border flex items-center justify-center", "bg-foreground/[0.06] border-border/30 text-muted-foreground ring-1 ring-border")}>{icon}</div>
          <div className="text-xs text-muted-foreground text-left max-w-[55%]">{label}</div>
        </div>
        <div className={cn("text-2xl lg:text-3xl font-extrabold mt-4 tabular-nums text-right", toneCls.text, valueClassName)}>{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-1.5 text-right">{sub}</div>}
      </div>
    </div>
  );
}
