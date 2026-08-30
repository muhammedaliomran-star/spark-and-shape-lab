import { useMemo, useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDB, db, fmt, type Purchase, type PurchasePaymentType } from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { 
  Truck, Search, Plus, Wallet, Banknote, CalendarDays, Eye, EyeOff, 
  Pencil, Trash2, Printer, FileText, X, ArrowUpDown, Filter, Package,
  Info, CheckCircle2, DollarSign, Receipt, Clock, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/router-compat";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type FilterTab = "all" | "month" | "cash" | "credit";

export function PurchasesPage() {
  const data = useDB();
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");

  // Dialog states
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [deletePurchaseId, setDeletePurchaseId] = useState<string | null>(null);
  const [printPurchase, setPrintPurchase] = useState<Purchase | null>(null);

  const suppliersMap = useMemo(() => 
    new Map(data.suppliers.map(s => [s.id, s.name])),
    [data.suppliers]
  );

  // Group purchase items by purchaseId
  const itemsByPurchase = useMemo(() => {
    const map = new Map<string, typeof data.purchaseItems>();
    data.purchaseItems.forEach(it => {
      const arr = map.get(it.purchaseId) || [];
      arr.push(it);
      map.set(it.purchaseId, arr);
    });
    return map;
  }, [data.purchaseItems]);

  // Top Statistics calculations
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalAll = 0;
    let monthTotal = 0;
    let cashMonth = 0;
    let creditMonth = 0;

    data.purchases.forEach(p => {
      totalAll += p.total;
      const d = new Date(p.purchaseDate);
      const isThisMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;

      if (isThisMonth) {
        monthTotal += p.total;
        if (p.paymentType === "cash") {
          cashMonth += p.total;
        } else {
          creditMonth += p.total;
        }
      }
    });

    return {
      totalInvoicesCount: data.purchases.length,
      monthTotal,
      cashMonth,
      creditMonth,
      totalAll,
    };
  }, [data.purchases]);

  // Filtered list
  const filteredPurchases = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const query = q.trim().toLowerCase();

    return data.purchases
      .filter((p) => {
        // Tab filter
        if (tab === "month") {
          const d = new Date(p.purchaseDate);
          if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return false;
        } else if (tab === "cash") {
          if (p.paymentType !== "cash") return false;
        } else if (tab === "credit") {
          if (p.paymentType !== "credit") return false;
        }

        // Supplier filter
        if (selectedSupplierId !== "all" && p.supplierId !== selectedSupplierId) {
          return false;
        }

        // Search filter (supplier name, notes, or item name)
        if (query) {
          const supplierName = (suppliersMap.get(p.supplierId) || "").toLowerCase();
          const notesText = (p.notes || "").toLowerCase();
          const items = itemsByPurchase.get(p.id) || [];
          const hasMatchingItem = items.some(it => it.name.toLowerCase().includes(query));

          return supplierName.includes(query) || notesText.includes(query) || hasMatchingItem;
        }

        return true;
      })
      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  }, [data.purchases, q, tab, selectedSupplierId, suppliersMap, itemsByPurchase]);

  return (
    <AppShell>
      <PageTransition>
        <div className="space-y-6">
          <PageHeader
            title="فواتير المشتريات"
            subtitle="سجل فواتير توريد البضاعة من الموردين، تفاصيل التكلفة والمخزون."
            icon={<Truck className="w-7 h-7 text-primary" />}
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
                <Button asChild size="sm" className="gap-1.5 rounded-full h-9 bg-primary text-primary-foreground font-bold shadow-sm">
                  <Link to="/purchases/new">
                    <Plus className="w-4 h-4" /> فاتورة شراء جديدة
                  </Link>
                </Button>
              </div>
            }
          />

          {/* Top Statistics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="مشتريات الشهر الحالي"
              value={`${fmt(stats.monthTotal)} ج.م`}
              sub="إجمالي البضاعة الموردة هذا الشهر"
              icon={<Receipt className="w-5 h-5 text-primary" />}
              blurCls={blurCls}
              color="primary"
            />
            <StatCard
              title="مشتريات نقدية (خزينة)"
              value={`${fmt(stats.cashMonth)} ج.م`}
              sub="سُددت نقداً من الخزينة هذا الشهر"
              icon={<Banknote className="w-5 h-5 text-success" />}
              blurCls={blurCls}
              color="success"
            />
            <StatCard
              title="مشتريات آجلة (مديونية)"
              value={`${fmt(stats.creditMonth)} ج.م`}
              sub="أضيفت لحسابات الموردين هذا الشهر"
              icon={<Wallet className="w-5 h-5 text-warning" />}
              blurCls={blurCls}
              color="warning"
            />
            <StatCard
              title="إجمالي عدد الفواتير"
              value={String(stats.totalInvoicesCount)}
              sub="كل فواتير الشراء المسجلة"
              icon={<Package className="w-5 h-5 text-foreground/70" />}
              blurCls="privacy-clear"
              color="neutral"
            />
          </div>

          {/* Filter, Search & Supplier selector bar */}
          <Reveal>
            <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3 shadow-sm">
              <div className="flex flex-col md:flex-row items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 w-full">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    value={q} 
                    onChange={(e) => setQ(e.target.value)} 
                    placeholder="ابحث باسم المورد، الصنف، أو ملاحظات الفاتورة..." 
                    className="pr-10 rounded-xl h-11 bg-background text-right" 
                  />
                  {q && (
                    <button 
                      onClick={() => setQ("")}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Supplier Filter Select */}
                <div className="w-full md:w-60">
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger className="h-11 rounded-xl bg-background text-right">
                      <SelectValue placeholder="كل الموردين" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="all">كل الموردين ({data.suppliers.length})</SelectItem>
                      {data.suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quick Tab Filters */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/30">
                <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
                  <TabsList className="bg-foreground/[0.04] p-1 rounded-xl h-auto">
                    <TabsTrigger value="all" className="rounded-lg text-xs font-semibold px-3 py-1.5">
                      الكل ({data.purchases.length})
                    </TabsTrigger>
                    <TabsTrigger value="month" className="rounded-lg text-xs font-semibold px-3 py-1.5">
                      هذا الشهر
                    </TabsTrigger>
                    <TabsTrigger value="cash" className="rounded-lg text-xs font-semibold px-3 py-1.5 gap-1">
                      <Banknote className="w-3.5 h-3.5 text-success" /> نقدي
                    </TabsTrigger>
                    <TabsTrigger value="credit" className="rounded-lg text-xs font-semibold px-3 py-1.5 gap-1">
                      <Wallet className="w-3.5 h-3.5 text-warning" /> آجل
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="text-xs text-muted-foreground font-medium">
                  عرض <span className="font-bold text-foreground">{filteredPurchases.length}</span> فاتورة
                </div>
              </div>
            </div>
          </Reveal>

          {/* Purchases List */}
          <Reveal delay={100}>
            <div className="space-y-3">
              {filteredPurchases.length === 0 ? (
                <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center shadow-sm">
                  <EmptyState
                    icon={Truck}
                    title="لا توجد فواتير مطابقة للبحث أو الفلتر."
                    hint={q || tab !== "all" || selectedSupplierId !== "all" 
                      ? "جرّب تغيير خيارات البحث أو الفلترة." 
                      : "سجل أول فاتورة شراء لتبدأ بمتابعة المخزون ومديونيات الموردين."}
                  />
                  {(q || tab !== "all" || selectedSupplierId !== "all") && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { setQ(""); setTab("all"); setSelectedSupplierId("all"); }}
                      className="mt-4 rounded-full"
                    >
                      إلغاء الفلترة
                    </Button>
                  )}
                </div>
              ) : (
                filteredPurchases.map((p, idx) => {
                  const items = itemsByPurchase.get(p.id) || [];
                  const supplierName = suppliersMap.get(p.supplierId) || "مورد غير معروف";
                  const totalUnits = items.reduce((s, it) => s + (it.quantity || 0), 0);

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                      className="group rounded-2xl border border-border/50 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 p-4 sm:p-5"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-4 text-right">
                        {/* Supplier and Date */}
                        <div 
                          className="flex items-center gap-3.5 cursor-pointer min-w-0"
                          onClick={() => setDetailPurchase(p)}
                        >
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                            <Truck className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-base text-foreground group-hover:text-primary transition-colors truncate">
                              {supplierName}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="w-3.5 h-3.5" />
                                <span dir="ltr">{p.purchaseDate}</span>
                              </span>
                              <span className="text-border">•</span>
                              <span className="text-primary/90 font-medium">
                                {items.length} أصناف ({totalUnits} قطعة)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Invoice Total */}
                        <div 
                          className="cursor-pointer min-w-0"
                          onClick={() => setDetailPurchase(p)}
                        >
                          <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">
                            إجمالي الفاتورة
                          </div>
                          <div className={cn("text-xl font-extrabold text-foreground tabular-nums", blurCls)}>
                            {fmt(p.total)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                          </div>
                        </div>

                        {/* Payment Type & Notes snippet */}
                        <div 
                          className="cursor-pointer min-w-0"
                          onClick={() => setDetailPurchase(p)}
                        >
                          <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">
                            طريقة السداد
                          </div>
                          <div className="flex items-center gap-2">
                            {p.paymentType === "cash" ? (
                              <Badge variant="outline" className="gap-1 rounded-xl bg-success/10 text-success border-success/30 px-2.5 py-1 text-xs font-bold">
                                <Banknote className="w-3.5 h-3.5" /> نقدي (خزينة)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 rounded-xl bg-warning/10 text-warning border-warning/30 px-2.5 py-1 text-xs font-bold">
                                <Wallet className="w-3.5 h-3.5" /> آجل (مديونية)
                              </Badge>
                            )}
                          </div>
                          {p.notes && (
                            <div className="text-xs text-muted-foreground truncate mt-1 max-w-[200px]" title={p.notes}>
                              «{p.notes}»
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-border/30">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  onClick={() => setDetailPurchase(p)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>عرض الأصناف والتفاصيل</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                                  onClick={() => setPrintPurchase(p)}
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>طباعة إيصال الفاتورة</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-warning hover:bg-warning/10"
                                  onClick={() => setEditPurchase(p)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>تعديل الفاتورة</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-danger hover:bg-danger/10"
                                  onClick={() => setDeletePurchaseId(p.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>حذف الفاتورة</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </Reveal>
        </div>

        {/* Purchase Details Modal */}
        <PurchaseDetailModal
          purchase={detailPurchase}
          supplierName={detailPurchase ? (suppliersMap.get(detailPurchase.supplierId) || "مورد غير معروف") : ""}
          items={detailPurchase ? (itemsByPurchase.get(detailPurchase.id) || []) : []}
          onClose={() => setDetailPurchase(null)}
          onEdit={(p) => { setDetailPurchase(null); setEditPurchase(p); }}
          onPrint={(p) => setPrintPurchase(p)}
          onDelete={(id) => { setDetailPurchase(null); setDeletePurchaseId(id); }}
          privacy={privacy}
        />

        {/* Edit Purchase Dialog */}
        <EditPurchaseDialog
          purchase={editPurchase}
          open={!!editPurchase}
          onClose={() => setEditPurchase(null)}
        />

        {/* Print / Export Receipt Modal */}
        <PrintPurchaseModal
          purchase={printPurchase}
          supplierName={printPurchase ? (suppliersMap.get(printPurchase.supplierId) || "مورد غير معروف") : ""}
          items={printPurchase ? (itemsByPurchase.get(printPurchase.id) || []) : []}
          onClose={() => setPrintPurchase(null)}
        />

        {/* Delete Confirmation Alert Dialog */}
        <AlertDialog open={!!deletePurchaseId} onOpenChange={(v) => !v && setDeletePurchaseId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-right">حذف فاتورة الشراء؟</AlertDialogTitle>
              <AlertDialogDescription className="text-right leading-relaxed">
                سيتم حذف الفاتورة وخصم كميات الأصناف المشتراة من المخزون تلقائياً، وعكس حركة الخزينة أو المديونية. لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!deletePurchaseId) return;
                  try {
                    await db.removePurchase(deletePurchaseId);
                    toast.success("تم حذف فاتورة الشراء وتحديث المخزون بنجاح");
                  } catch (e: any) {
                    toast.error(e.message || "حدث خطأ أثناء حذف الفاتورة");
                  }
                  setDeletePurchaseId(null);
                }}
                className="bg-danger text-danger-foreground hover:bg-danger/90 font-bold"
              >
                حذف الفاتورة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </PageTransition>
    </AppShell>
  );
}

/* Stat Box component */
function StatCard({ 
  title, value, sub, icon, blurCls, color 
}: { 
  title: string; value: string; sub: string; icon: React.ReactNode; blurCls: string; color: "primary" | "success" | "warning" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-2 shadow-sm transition-all hover:border-border/80">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <div className="p-2 rounded-xl bg-foreground/[0.04] border border-border/30">
          {icon}
        </div>
      </div>
      <div className={cn("text-2xl font-black text-foreground tabular-nums", blurCls)}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground font-medium truncate">
        {sub}
      </div>
    </div>
  );
}

/* Detailed modal for viewing invoice items and costs */
function PurchaseDetailModal({
  purchase, supplierName, items, onClose, onEdit, onPrint, onDelete, privacy
}: {
  purchase: Purchase | null;
  supplierName: string;
  items: Array<{ id: string; name: string; unitCost: number; quantity: number }>;
  onClose: () => void;
  onEdit: (p: Purchase) => void;
  onPrint: (p: Purchase) => void;
  onDelete: (id: string) => void;
  privacy: boolean;
}) {
  if (!purchase) return null;
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const totalUnits = items.reduce((s, it) => s + it.quantity, 0);

  return (
    <Dialog open={!!purchase} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-right">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={cn(
              "px-3 py-1 text-xs font-bold rounded-xl",
              purchase.paymentType === "cash" 
                ? "bg-success/10 text-success border-success/30" 
                : "bg-warning/10 text-warning border-warning/30"
            )}>
              {purchase.paymentType === "cash" ? "مسددة نقداً (خزينة)" : "آجلة (مديونية مورد)"}
            </Badge>
            <DialogTitle className="text-lg font-bold text-foreground">
              فاتورة شراء بضاعة
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            المورد: <span className="font-bold text-foreground">{supplierName}</span> — تاريخ الفاتورة: <span dir="ltr" className="font-mono">{purchase.purchaseDate}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-right mt-2">
          {/* Summary Box */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-foreground/[0.03] border border-border/40 text-center">
            <div>
              <div className="text-[11px] text-muted-foreground font-semibold">إجمالي الفاتورة</div>
              <div className={cn("text-lg font-black text-primary mt-0.5", blurCls)}>
                {fmt(purchase.total)} ج.م
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-semibold">عدد الأصناف</div>
              <div className="text-lg font-black text-foreground mt-0.5">
                {items.length}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-semibold">إجمالي القطع</div>
              <div className="text-lg font-black text-foreground mt-0.5">
                {totalUnits}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              بيان الأصناف المشتراة وتكلفة الوحدة
            </Label>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-foreground/[0.04] text-muted-foreground font-bold border-b border-border/40">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">اسم الصنف</th>
                    <th className="p-3 text-center">سعر التكلفة</th>
                    <th className="p-3 text-center">الكمية</th>
                    <th className="p-3 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        لا توجد تفاصيل أصناف محفوظة لهذه الفاتورة
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-foreground/[0.02]">
                        <td className="p-3 text-muted-foreground">{idx + 1}</td>
                        <td className="p-3 font-semibold text-foreground">{it.name}</td>
                        <td className={cn("p-3 text-center font-mono tabular-nums", blurCls)}>
                          {fmt(it.unitCost)} ج.م
                        </td>
                        <td className="p-3 text-center font-mono font-bold">
                          {it.quantity}
                        </td>
                        <td className={cn("p-3 text-left font-bold font-mono tabular-nums text-foreground", blurCls)}>
                          {fmt(it.unitCost * it.quantity)} ج.م
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-foreground/[0.03] border-t border-border/40 font-bold">
                  <tr>
                    <td colSpan={4} className="p-3 text-left">الإجمالي الكلي:</td>
                    <td className={cn("p-3 text-left font-mono font-black text-sm text-primary", blurCls)}>
                      {fmt(purchase.total)} ج.م
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes if any */}
          {purchase.notes && (
            <div className="p-3 rounded-xl bg-foreground/[0.02] border border-border/40 text-xs">
              <span className="font-bold text-foreground">ملاحظات / مرجع: </span>
              <span className="text-muted-foreground">{purchase.notes}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 pt-3 border-t border-border/40 mt-3">
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onPrint(purchase)}
              className="rounded-xl gap-1 text-xs"
            >
              <Printer className="w-3.5 h-3.5" /> طباعة إيصال
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onEdit(purchase)}
              className="rounded-xl gap-1 text-xs text-warning hover:bg-warning/10 hover:text-warning"
            >
              <Pencil className="w-3.5 h-3.5" /> تعديل
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onDelete(purchase.id)}
              className="rounded-xl gap-1 text-xs text-danger hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="w-3.5 h-3.5" /> حذف
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="rounded-xl text-xs">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Edit Purchase Dialog */
function EditPurchaseDialog({
  purchase, open, onClose
}: {
  purchase: Purchase | null;
  open: boolean;
  onClose: () => void;
}) {
  const data = useDB();
  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState("");
  const [paymentType, setPaymentType] = useState<PurchasePaymentType>("cash");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Array<{ id: string; name: string; unitCost: string; quantity: string }>>([]);
  const [busy, setBusy] = useState(false);

  // Initialize form on open
  useMemo(() => {
    if (purchase && open) {
      setSupplierId(purchase.supplierId);
      setDate(purchase.purchaseDate);
      setPaymentType(purchase.paymentType);
      setNotes(purchase.notes || "");

      const existingItems = data.purchaseItems
        .filter(it => it.purchaseId === purchase.id)
        .map(it => ({
          id: crypto.randomUUID(),
          name: it.name,
          unitCost: String(it.unitCost),
          quantity: String(it.quantity)
        }));

      setItems(existingItems.length > 0 ? existingItems : [{
        id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1"
      }]);
    }
  }, [purchase, open, data.purchaseItems]);

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

  const updateItem = (id: string, patch: Partial<{ name: string; unitCost: string; quantity: string }>) => {
    setItems(items.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const handleSave = async () => {
    if (!purchase) return;
    if (!supplierId) {
      toast.error("يرجى اختيار المورد");
      return;
    }
    const validItems = items.filter(it => it.name.trim() && Number(it.unitCost) > 0 && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      toast.error("أضف صنفاً واحداً على الأقل بسعر وكمية صحيحة");
      return;
    }

    setBusy(true);
    try {
      await db.updatePurchase(purchase.id, {
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

      toast.success("تم تحديث فاتورة الشراء والمخزون بنجاح");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ أثناء تعديل الفاتورة");
    } finally {
      setBusy(false);
    }
  };

  if (!purchase) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-lg font-bold">تعديل فاتورة الشراء</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            تعديل الأصناف يحدّث أرصدة المخزون تلقائياً ويضبط التكلفة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-right">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">المورد</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="اختر المورد..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {data.suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">تاريخ الفاتورة</Label>
              <Input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                className="h-10 rounded-xl font-mono text-right" 
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold">طريقة الدفع</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType("cash")}
                className={cn(
                  "py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  paymentType === "cash" 
                    ? "border-success bg-success/10 text-success" 
                    : "border-border text-muted-foreground hover:bg-foreground/[0.04]"
                )}
              >
                <Banknote className="w-3.5 h-3.5" /> نقدي (خزينة)
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("credit")}
                className={cn(
                  "py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  paymentType === "credit" 
                    ? "border-warning bg-warning/10 text-warning" 
                    : "border-border text-muted-foreground hover:bg-foreground/[0.04]"
                )}
              >
                <Wallet className="w-3.5 h-3.5" /> آجل (مديونية)
              </button>
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-8 rounded-full text-xs">
                <Plus className="w-3.5 h-3.5 me-1" /> إضافة صنف
              </Button>
              <Label className="text-xs font-bold">الأصناف ({items.length})</Label>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={it.id} className="p-3 rounded-xl border border-border/50 bg-foreground/[0.02] space-y-2">
                  <div className="flex items-center justify-between">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeItem(it.id)}
                      disabled={items.length === 1}
                      className="h-6 w-6 text-muted-foreground hover:text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <span className="text-[11px] font-bold text-muted-foreground">صنف #{idx + 1}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-1">
                      <Label className="text-[11px] text-muted-foreground">اسم الصنف</Label>
                      <Input 
                        value={it.name} 
                        onChange={(e) => updateItem(it.id, { name: e.target.value })} 
                        className="h-9 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">سعر التكلفة</Label>
                      <Input 
                        type="number" 
                        value={it.unitCost} 
                        onChange={(e) => updateItem(it.id, { unitCost: e.target.value })} 
                        className="h-9 rounded-lg text-xs font-mono text-right"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">الكمية</Label>
                      <Input 
                        type="number" 
                        value={it.quantity} 
                        onChange={(e) => updateItem(it.id, { quantity: e.target.value })} 
                        className="h-9 rounded-lg text-xs font-mono text-right"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold">ملاحظات</Label>
            <Input 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <div className="p-3 rounded-xl bg-foreground/[0.04] flex items-center justify-between text-xs font-bold">
            <span className="text-primary text-base font-black font-mono">{fmt(total)} ج.م</span>
            <span>إجمالي الفاتورة الجديد:</span>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/40">
          <Button onClick={handleSave} disabled={busy} className="w-full rounded-xl font-bold bg-primary">
            حفظ التعديلات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Printable Purchase Invoice Voucher Modal */
function PrintPurchaseModal({
  purchase, supplierName, items, onClose
}: {
  purchase: Purchase | null;
  supplierName: string;
  items: Array<{ id: string; name: string; unitCost: number; quantity: number }>;
  onClose: () => void;
}) {
  if (!purchase) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={!!purchase} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-lg font-bold">معاينة وطباعة إيصال الشراء</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            إيصال رسمي لاستلام بضاعة ومطابقة الفاتورة الورقية للمورد.
          </DialogDescription>
        </DialogHeader>

        {/* Printable Area */}
        <div id="printable-purchase-voucher" className="p-6 rounded-2xl border border-border/80 bg-card text-foreground space-y-4 text-right print:m-0 print:border-none print:shadow-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <div className="text-xl font-black tracking-tight text-primary">سِجلّي</div>
              <div className="text-[11px] text-muted-foreground font-medium">سند توريد واستلام بضاعة</div>
            </div>
            <div className="text-left text-xs font-mono">
              <div className="font-bold">رقم الفاتورة: #{purchase.id.slice(0, 8)}</div>
              <div className="text-muted-foreground">{purchase.purchaseDate}</div>
            </div>
          </div>

          {/* Supplier Info */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-foreground/[0.02] p-3 rounded-xl border border-border/40">
            <div>
              <span className="text-muted-foreground">المورد: </span>
              <span className="font-bold text-foreground">{supplierName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">طريقة السداد: </span>
              <span className="font-bold text-foreground">
                {purchase.paymentType === "cash" ? "نقدي (من الخزينة)" : "آجل (حساب مديونية)"}
              </span>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-xs text-right border border-border/60 rounded-xl overflow-hidden">
            <thead className="bg-foreground/[0.05] font-bold text-muted-foreground">
              <tr>
                <th className="p-2 border-b border-border/40">#</th>
                <th className="p-2 border-b border-border/40">الصنف</th>
                <th className="p-2 border-b border-border/40 text-center">سعر الوحدة</th>
                <th className="p-2 border-b border-border/40 text-center">الكمية</th>
                <th className="p-2 border-b border-border/40 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {items.map((it, i) => (
                <tr key={it.id || i}>
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 font-semibold">{it.name}</td>
                  <td className="p-2 text-center font-mono">{fmt(it.unitCost)} ج.م</td>
                  <td className="p-2 text-center font-mono font-bold">{it.quantity}</td>
                  <td className="p-2 text-left font-mono font-bold">{fmt(it.unitCost * it.quantity)} ج.م</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-foreground/[0.04] border-t-2 border-border font-bold">
              <tr>
                <td colSpan={4} className="p-2.5 text-left">الإجمالي المستحق:</td>
                <td className="p-2.5 text-left font-mono text-sm text-primary">{fmt(purchase.total)} ج.م</td>
              </tr>
            </tfoot>
          </table>

          {purchase.notes && (
            <div className="text-xs text-muted-foreground pt-1">
              <span className="font-semibold text-foreground">ملاحظات: </span>
              {purchase.notes}
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border/40 text-xs text-center">
            <div className="space-y-6">
              <div className="text-muted-foreground font-semibold">توقيع المستلم (المحل)</div>
              <div className="border-b border-dashed border-border/80 w-3/4 mx-auto" />
            </div>
            <div className="space-y-6">
              <div className="text-muted-foreground font-semibold">توقيع المورد / المندوب</div>
              <div className="border-b border-dashed border-border/80 w-3/4 mx-auto" />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 pt-3 border-t border-border/40">
          <Button onClick={handlePrint} className="rounded-xl font-bold gap-2 bg-primary text-primary-foreground">
            <Printer className="w-4 h-4" /> طباعة الآن
          </Button>
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PurchasesPage;
