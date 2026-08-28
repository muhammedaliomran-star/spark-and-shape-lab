import { EmptyState } from "@/components/EmptyState";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  db, useDB, fmt, supplierBalance, findStockByBarcode,
  type Supplier, type Purchase, type PurchasePaymentType, type SupplierPayment,
} from "@/lib/store";
import {
  Plus, Search, Truck, Eye, EyeOff, Pencil, Trash2, Wallet, Banknote,
  History, Phone, Receipt, X, ShoppingCart, ScanLine, Info, CreditCard,
  CalendarDays,
} from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/lib/privacy";

export default function Page() {
  return (
    <AppShell>
        <PageTransition>
          <SuppliersPage />
        </PageTransition>
      </AppShell>
  );
}

type Tab = "all" | "owing" | "settled" | "purchases";

function SuppliersPage() {
  const data = useDB();
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [profileFor, setProfileFor] = useState<Supplier | null>(null);
  const [openSupplier, setOpenSupplier] = useState(false);

  const enriched = useMemo(
    () => data.suppliers.map((s) => ({
      s,
      balance: supplierBalance(data.purchases, data.supplierPayments, s.id, s.openingBalance),
    })),
    [data.suppliers, data.purchases, data.supplierPayments],
  );

  const totals = useMemo(() => {
    const totalDebt = enriched.reduce((sum, x) => sum + Math.max(0, x.balance), 0);
    const owing = enriched.filter((x) => x.balance > 0).length;
    const monthCash = data.purchases
      .filter((p) => {
        const d = new Date(p.purchaseDate);
        const now = new Date();
        return p.paymentType === "cash" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, p) => s + p.total, 0);
    return { totalDebt, owing, monthCash };
  }, [enriched, data.purchases]);

  const list = useMemo(() => {
    return enriched
      .filter(({ s, balance }) => {
        if (tab === "owing") return balance > 0;
        if (tab === "settled") return balance <= 0;
        return true;
      })
      .filter(({ s }) => (q ? s.name.includes(q) || s.contact.includes(q) : true))
      .sort((a, b) => b.balance - a.balance);
  }, [enriched, q, tab]);

  return (
    <>
      <PageHeader
        title="الموردين والمشتريات"
        subtitle="إدارة الموردين، فواتير الشراء، ومديونية المحل."
        icon={<Truck className="w-7 h-7" />}
        action={
          <div className="flex items-center gap-2">
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
            <NewPurchaseDialog
              trigger={<Button size="sm" variant="outline" className="gap-1.5"><ShoppingCart className="w-4 h-4" /> فاتورة شراء</Button>}
            />
            <Button size="sm" className="gap-1.5" onClick={() => { setEditing(null); setOpenSupplier(true); }}>
              <Plus className="w-4 h-4" /> إضافة مورد
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
<StatBox
          label="إجمالي ديون الموردين"
          value={`${fmt(totals.totalDebt)} ج.م`}
          icon={<Wallet className="w-5 w-5" />}
          tone="neutral"
          valueClassName={blurCls}
          sub={`${totals.owing} مورد له مديونية`}
        />
        <StatBox
          label="مشتريات نقدية (الشهر)"
          value={`${fmt(totals.monthCash)} ج.م`}
          icon={<Banknote className="w-5 w-5" />}
          tone="neutral"
          valueClassName={blurCls}
          sub="مخصومة من صافي الربح"
        />
        <StatBox
          label="إجمالي الموردين"
          value={String(data.suppliers.length)}
          icon={<Truck className="w-5 w-5" />}
          tone="neutral"
          sub={`${data.purchases.length} فاتورة شراء`}
        />
      </div>

      <div className="sticky-search-bar">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList className="grid grid-cols-4 w-full h-auto">
          <TabsTrigger value="all" className="gap-1.5 data-[state=active]:bg-foreground/[0.06] data-[state=active]:text-foreground">
            الكل <Badge variant="secondary" className="rounded-full">{enriched.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="owing" className="gap-1.5 data-[state=active]:bg-foreground/[0.06] data-[state=active]:text-foreground">
            عليهم مديونية <Badge variant="secondary" className="rounded-full">{enriched.filter((x) => x.balance > 0).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="settled" className="gap-1.5 data-[state=active]:bg-foreground/[0.06] data-[state=active]:text-foreground">
            مسدد <Badge variant="secondary" className="rounded-full">{enriched.filter((x) => x.balance <= 0).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5 data-[state=active]:bg-foreground/[0.06] data-[state=active]:text-foreground">
            كل المشتريات <Badge variant="secondary" className="rounded-full">{data.purchases.length}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab !== "purchases" && (
        <div className="mb-5">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المورد أو رقم الهاتف..." className="pr-10" />
          </div>
        </div>
      )}
    </div>

      {tab === "purchases" ? (
        <PurchasesTable privacy={privacy} />
      ) : (
      <Reveal delay={140}>
        <div className="flex flex-col gap-3">
          {list.length === 0 ? (
            <BezelCard variant="flat" className="px-6 py-10">
              <EmptyState
                icon={Truck}
                title="لا يوجد موردين."
                hint="أضف مورد وابدأ تسجيل فواتير الشراء ومتابعة المستحق عليه."
              />
            </BezelCard>
          ) : (
            list.map(({ s, balance }, idx) => (
              <BezelCard
                variant="flat"
                className="group animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)]"
                style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                innerClassName="grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-6"
              >
                  {/* الهوية */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="text-display grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-foreground/[0.06] text-muted-foreground ring-1 ring-border">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold">{s.name}</div>
                      <div className="text-numeric text-xs text-muted-foreground mt-0.5" dir="ltr">{s.contact || "لا يوجد رقم"}</div>
                    </div>
                  </div>

                  {/* المديونية */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <div className="text-xs text-muted-foreground mb-0.5">المديونية</div>
                        <div className={cn("text-numeric text-xl font-extrabold", balance > 0 ? "text-danger" : "text-success", blurCls)}>
                          {fmt(Math.abs(balance))} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <div className="text-xs text-muted-foreground mb-0.5">الحالة</div>
                        <div className="mt-0.5">
                          {balance > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-bold border border-border/30 bg-foreground/[0.06] text-muted-foreground">عليه مديونية</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-bold border border-border/30 bg-foreground/[0.06] text-muted-foreground">مسدد</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {s.notes && <div className="mt-2 text-xs text-muted-foreground truncate max-w-[300px]">{s.notes}</div>}
                  </div>

                  {/* الإجراءات */}
                  <div className="flex items-center justify-end gap-1.5 md:opacity-70 md:transition-opacity md:group-hover:opacity-100">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => setProfileFor(s)}>
                            <History className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>السجل</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-block">
                            <PaymentDialog supplier={s} balance={balance} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>إضافة دفعة</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-warning hover:bg-warning/10" onClick={() => { setEditing(s); setOpenSupplier(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>تعديل</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="action-btn danger rounded-full text-danger hover:bg-danger/10" onClick={() => setDeleteId(s.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>حذف</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
              </BezelCard>
            ))
          )}
        </div>
      </Reveal>
      )}

      <SupplierFormDialog
        open={openSupplier}
        onOpenChange={(v) => { setOpenSupplier(v); if (!v) setEditing(null); }}
        editing={editing}
      />

      <SupplierProfileDialog
        supplier={profileFor}
        onClose={() => setProfileFor(null)}
        privacy={privacy}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">حذف المورد؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف المورد وكل فواتير الشراء والمدفوعات المرتبطة به. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteId) return;
                try { await db.removeSupplier(deleteId); toast.success("تم حذف المورد"); }
                catch (e: any) { toast.error(e.message || "خطأ"); }
                setDeleteId(null);
              }}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatBox({
  label, value, icon, tone, valueClassName, sub,
}: { label: string; value: string; icon: React.ReactNode; tone: "primary" | "success" | "neutral" | "danger"; valueClassName?: string; sub?: string }) {
  const isSuccess = tone === "success";
  const isPrimary = tone === "primary";
  return (
    <div className={cn(
      "relative overflow-hidden bg-card plate p-5 transition-[transform,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5",
      tone === "danger" ? "border-danger/30 hover:border-danger/60" : "border-border/30 hover:border-border/40",
    )}>
      <div className={cn(
        "absolute inset-0 opacity-[0.06] pointer-events-none",
        "bg-gradient-to-bl from-transparent to-transparent",
      )} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className={cn(
            "w-10 h-10 rounded-2xl border flex items-center justify-center",
            "bg-foreground/[0.06] border-border/30 text-muted-foreground",
          )}>{icon}</div>
          <div className="text-xs text-muted-foreground text-left max-w-[55%]">{label}</div>
        </div>
        <div className={cn(
          "text-2xl lg:text-3xl font-extrabold mt-4 tabular-nums text-right",
          "text-foreground",
          valueClassName,
        )}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1.5 text-right">{sub}</div>}
      </div>
    </div>
  );
}

function SupplierFormDialog({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: Supplier | null }) {
  const data = useDB();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [opening, setOpening] = useState("0");
  const [joinDate, setJoinDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const supplierCode = useMemo(() => {
    if (editing) {
      const idx = (data.suppliers ?? []).findIndex((s) => s.id === editing.id);
      return `S-${String((idx < 0 ? 0 : idx) + 1).padStart(4, "0")}`;
    }
    return `S-${String((data.suppliers?.length ?? 0) + 1).padStart(4, "0")}`;
  }, [data.suppliers, editing]);

  // Reset on open
  useMemoOnOpen(open, () => {
    setName(editing?.name ?? "");
    setContact(editing?.contact ?? "");
    setNotes(editing?.notes ?? "");
    setOpening(String(editing?.openingBalance ?? 0));
    setJoinDate((editing?.createdAt ?? new Date().toISOString()).slice(0, 10));
  });

  const submit = async () => {
    if (!name.trim()) { toast.error("اكتب اسم المورد"); return; }
    setBusy(true);
    try {
      if (editing) {
        await db.updateSupplier(editing.id, {
          name: name.trim(), contact: contact.trim(),
          notes: notes.trim() || null, openingBalance: Number(opening) || 0,
        });
        toast.success("تم تحديث المورد");
      } else {
        await db.addSupplier({
          name: name.trim(), contact: contact.trim(),
          notes: notes.trim() || null, openingBalance: Number(opening) || 0,
        });
        toast.success("تمت إضافة المورد");
      }
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message || "خطأ"); }
    finally { setBusy(false); }
  };

  const firstOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{editing ? "تعديل المورد" : "إضافة مورد جديد"}</DialogTitle>
          <DialogDescription className="text-right">بيانات المورد ومديونيته الافتتاحية.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-right">
          <div>
            <Label>كود المورد</Label>
            <Input value={supplierCode} readOnly dir="ltr" className="font-mono tracking-wider text-muted-foreground" />
          </div>
          <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></div>
          <div><Label>رقم الهاتف</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} dir="ltr" maxLength={30} /></div>
          <div>
            <Label>تاريخ انضمام المورد</Label>
            <div className="relative">
              <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="pr-9 text-left"
                dir="ltr"
              />
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <Button type="button" variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs"
                onClick={() => setJoinDate(firstOfMonth())}>أول الشهر</Button>
              <Button type="button" variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs"
                onClick={() => setJoinDate(new Date().toISOString().slice(0, 10))}>النهارده</Button>
            </div>
          </div>
          <div>
            <Label>مديونية افتتاحية (ج.م)</Label>
            <Input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
            <div className="text-xs text-muted-foreground mt-1">المبلغ المستحق للمورد قبل بداية تسجيل الفواتير في النظام.</div>
          </div>
          <div><Label>ملاحظات</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} /></div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="w-full">{editing ? "حفظ التعديلات" : "إضافة"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// Tiny helper: run effect when dialog transitions to open.
function useMemoOnOpen(open: boolean, fn: () => void) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useMemo(() => { if (open) fn(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
}

type ItemRow = { id: string; name: string; unitCost: string; quantity: string; barcode?: string };

export function NewPurchaseDialog({
  trigger, defaultOpen, editing, open: openProp, onOpenChange,
}: {
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  /** When set, the dialog edits this purchase instead of creating a new one. */
  editing?: Purchase | null;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const data = useDB();
  const { privacy } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const [uncontrolledOpen, setUncontrolledOpen] = useState(!!defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setUncontrolledOpen(v); };
  const isEdit = !!editing;
  const [supplierId, setSupplierId] = useState("");
  const [paymentType, setPaymentType] = useState<PurchasePaymentType>("credit");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([
    { id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1" },
  ]);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  // Prefill when opening in edit mode.
  useEffect(() => {
    if (!editing || !open) return;
    setSupplierId(editing.supplierId);
    setPaymentType(editing.paymentType);
    setDate(editing.purchaseDate);
    setNotes(editing.notes ?? "");
    const rows = data.purchaseItems
      .filter((i) => i.purchaseId === editing.id)
      .map((i) => ({
        id: crypto.randomUUID(), name: i.name,
        unitCost: String(i.unitCost), quantity: String(i.quantity),
      }));
    setItems(rows.length ? rows : [{ id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, open]);


  const handleScan = (code: string) => {
    setScanOpen(false);
    const found = findStockByBarcode(data.stockItems, code);
    setItems((prev) => {
      // If row with same barcode/stock name exists, bump qty
      const idx = prev.findIndex((r) => (found && r.name === found.name) || r.barcode === code);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: String((Number(next[idx].quantity) || 0) + 1) };
        return next;
      }
      const newRow: ItemRow = found
        ? { id: crypto.randomUUID(), name: found.name, unitCost: String(found.lastUnitCost || 0), quantity: "1", barcode: code }
        : { id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1", barcode: code };
      // Replace first empty row if exists
      const empty = prev.findIndex((r) => !r.name && !r.unitCost && !r.barcode);
      if (empty >= 0) {
        const next = [...prev];
        next[empty] = { ...newRow, id: prev[empty].id };
        return next;
      }
      return [...prev, newRow];
    });
    if (found) toast.success(`تمت زيادة كمية: ${found.name}`);
    else toast.info(`صنف جديد بالكود: ${code} — أكمل بياناته`);
  };

  // Suggestions: union of past purchase items + sales invoice items
  const suggestions = useMemo(() => {
    const set = new Map<string, number>();
    for (const pi of data.purchaseItems) {
      const k = pi.name.trim();
      if (k) set.set(k, pi.unitCost);
    }
    for (const ii of data.invoiceItems) {
      const k = ii.name.trim();
      if (k && !set.has(k)) set.set(k, ii.cost);
    }
    return Array.from(set.entries()).map(([name, cost]) => ({ name, cost }));
  }, [data.purchaseItems, data.invoiceItems]);

  const total = items.reduce((s, it) => s + (Number(it.unitCost) || 0) * (Number(it.quantity) || 0), 0);

  const addItem = () => setItems((p) => [...p, { id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1" }]);
  const removeItem = (id: string) => setItems((p) => p.length > 1 ? p.filter((x) => x.id !== id) : p);
  const updateItem = (id: string, patch: Partial<ItemRow>) =>
    setItems((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));

  const reset = () => {
    setSupplierId(""); setPaymentType("credit"); setDate(new Date().toISOString().slice(0, 10));
    setNotes(""); setItems([{ id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1" }]);
  };

  const submit = async () => {
    if (!supplierId) { toast.error("اختر المورد"); return; }
    const valid = items.filter((it) => it.name.trim() && Number(it.unitCost) > 0 && Number(it.quantity) > 0);
    if (valid.length === 0) { toast.error("أضف صنف واحد على الأقل"); return; }
    setBusy(true);
    try {
      const validItems = valid.map((it) => ({
        name: it.name.trim(),
        unitCost: Number(it.unitCost),
        quantity: Number(it.quantity),
        barcode: it.barcode?.trim() || null,
      }));
      const plainItems = validItems.map(({ barcode: _b, ...rest }) => rest);
      if (isEdit && editing) {
        await db.updatePurchase(editing.id, {
          supplierId, total, paymentType, purchaseDate: date,
          notes: notes.trim() || null, items: plainItems,
        });
        toast.success("تم تعديل فاتورة الشراء");
        setOpen(false);
        reset();
      } else {
        await db.addPurchase({
          supplierId, total, paymentType, purchaseDate: date,
          notes: notes.trim() || null,
          items: plainItems,
        });
        toast.success(paymentType === "cash"
          ? "تم تسجيل الفاتورة وخصم المبلغ من الخزينة"
          : "تم تسجيل الفاتورة وإضافتها لمديونية المورد");
        setOpen(false);
        reset();
      }
    } catch (e: any) { toast.error(e.message || "خطأ"); }
    finally { setBusy(false); }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-right">{isEdit ? "تعديل فاتورة الشراء" : "فاتورة شراء جديدة"}</DialogTitle>
          <DialogDescription className="text-right">
            {isEdit ? "التعديل بيغيّر بيانات الفاتورة والأصناف ويحدّث المخزون تلقائيًا." : "تسجيل عملية شراء من مورد وتحديث المخزون تلقائيًا."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-right">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>المورد</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>
                  {data.suppliers.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">أضف مورد أولاً</div>
                  )}
                  {data.suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>تاريخ الفاتورة</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
            </div>
          </div>

          {/* Payment type toggle */}
          <div>
            <Label>طريقة الدفع</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setPaymentType("cash")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-sm font-bold transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  paymentType === "cash"
                    ? "border-border bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-foreground/[0.04]",
                )}
              >
                <Banknote className="w-4 h-4" /> نقدي (خصم من الخزينة)
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("credit")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-sm font-bold transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  paymentType === "credit"
                    ? "border-border bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-foreground/[0.04]",
                )}
              >
                <Wallet className="w-4 h-4" /> آجل (يضاف للمديونية)
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1.5 rounded-full border border-border/30 bg-foreground/[0.06] px-4 py-2 text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground">
                  <Plus className="w-4 h-4" /> إضافة صنف
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setScanOpen(true)} className="gap-1.5 rounded-full border border-border/30 bg-foreground/[0.06] px-4 py-2 text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground">
                  <ScanLine className="w-4 w-4" /> مسح باركود
                </Button>
              </div>
              <Label className="text-base font-bold">الأصناف ({items.length})</Label>
            </div>
            <AnimatePresence initial={false}>
              {items.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.98, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                  className="origin-top"
                >
                  <div className="rounded-2xl border border-foreground/10 bg-card/50/[0.03] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(p.id)} disabled={items.length === 1} className="h-7 w-7 text-muted-foreground hover:text-danger hover:bg-danger/10" title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground font-bold">صنف #{idx + 1}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2">
                        <Label className="text-xs">اسم الصنف</Label>
                        <Input
                          list="purchase-item-suggestions"
                          value={p.name}
                          onChange={(e) => {
                            const v = e.target.value;
                            const match = suggestions.find((s) => s.name === v);
                            updateItem(p.id, match
                              ? { name: v, unitCost: String(match.cost) }
                              : { name: v });
                          }}
                          maxLength={100}
                          placeholder="ابحث أو أضف صنف..."
                        />
                      </div>
                      <div>
                        <Label className="text-xs">سعر الوحدة</Label>
                        <Input type="number" value={p.unitCost} onChange={(e) => updateItem(p.id, { unitCost: e.target.value })} className={blurCls} />
                      </div>
                      <div>
                        <Label className="text-xs">الكمية</Label>
                        <Input type="number" value={p.quantity} onChange={(e) => updateItem(p.id, { quantity: e.target.value })} />
                      </div>
                    </div>
                    {p.barcode && (
                      <div className="text-xs text-muted-foreground font-mono inline-flex items-center gap-1">
                        <ScanLine className="w-3 h-3" /> {p.barcode}
                      </div>
                    )}
                    <div className={cn("text-xs text-muted-foreground text-left", blurCls)}>
                      الإجمالي: <span className="font-bold text-foreground">{fmt((Number(p.unitCost) || 0) * (Number(p.quantity) || 0))} ج.م</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <datalist id="purchase-item-suggestions">
              {suggestions.map((s) => <option key={s.name} value={s.name} />)}
            </datalist>
          </div>

          <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></div>

          <div className={cn(
            "rounded-2xl border p-3 flex items-center justify-between text-sm",
            paymentType === "cash" ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5",
          )}>
            <span className={cn("font-extrabold text-base", blurCls, paymentType === "cash" ? "text-success" : "text-warning")}>
              {fmt(total)} ج.م
            </span>
            <span className="text-muted-foreground">إجمالي الفاتورة:</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="w-full">حفظ الفاتورة</Button>
        </DialogFooter>
        <BarcodeScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={handleScan}
          title="مسح باركود — فاتورة شراء"
        />
      </DialogContent>
    </Dialog>

    </>
  );
}

function PaymentDialog({ supplier, balance }: { supplier: Supplier; balance: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) { toast.error("أدخل مبلغ صحيح"); return; }
    try {
      await db.recordSupplierPayment(supplier.id, n);
      toast.success("تم تسجيل الدفعة");
      setOpen(false);
      setAmount("");
    } catch (e: any) { toast.error(e.message || "خطأ"); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-success hover:bg-success/10" title="تسجيل دفعة">
          <Wallet className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">دفعة للمورد {supplier.name}</DialogTitle>
          <DialogDescription className="text-right">المديونية الحالية: {fmt(Math.max(0, balance))} ج.م</DialogDescription>
        </DialogHeader>
        <div><Label>المبلغ المدفوع (ج.م)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <DialogFooter>
          <Button onClick={submit} className="w-full">تسجيل الدفعة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierProfileDialog({
  supplier, onClose, privacy,
}: { supplier: Supplier | null; onClose: () => void; privacy: boolean }) {
  const data = useDB();
  if (!supplier) return null;
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const purchases = data.purchases.filter((p) => p.supplierId === supplier.id);
  const payments = data.supplierPayments.filter((p) => p.supplierId === supplier.id);
  const items = data.purchaseItems;
  const balance = supplierBalance(data.purchases, data.supplierPayments, supplier.id, supplier.openingBalance);

  return (
    <Dialog open={!!supplier} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2 justify-end">
            <span>{supplier.name}</span>
            <Truck className="w-5 h-5 text-primary" />
          </DialogTitle>
          <DialogDescription className="text-right flex items-center gap-2 justify-end">
            {supplier.contact && (<><span dir="ltr">{supplier.contact}</span><Phone className="w-3.5 h-3.5" /></>)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="rounded-2xl border border-border/30 bg-foreground/[0.06] p-3">
            <div className="text-xs text-muted-foreground">المديونية الحالية</div>
            <div className={cn("text-xl font-extrabold text-primary mt-1", blurCls)}>{fmt(Math.max(0, balance))} ج.م</div>
          </div>
          <div className="rounded-2xl border border-border/30 bg-foreground/[0.06] p-3">
            <div className="text-xs text-muted-foreground">عدد فواتير الشراء</div>
            <div className="text-xl font-extrabold mt-1">{purchases.length}</div>
          </div>
          <div className="rounded-2xl border border-border/30 bg-foreground/[0.06] p-3">
            <div className="text-xs text-muted-foreground">إجمالي المدفوعات</div>
            <div className={cn("text-xl font-extrabold text-success mt-1", blurCls)}>
              {fmt(payments.reduce((s, p) => s + p.amount, 0))} ج.م
            </div>
          </div>
        </div>

<Tabs defaultValue="purchases">
          <TabsList className="grid grid-cols-2 w-full h-auto">
            <TabsTrigger value="purchases" className="gap-1.5 data-[state=active]:bg-foreground/[0.06] data-[state=active]:text-foreground"><Receipt className="w-4 h-4" /> فواتير الشراء</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5 data-[state=active]:bg-foreground/[0.06] data-[state=active]:text-foreground"><Wallet className="w-4 w-4" /> المدفوعات</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-4 space-y-3">
          {purchases.length === 0 && payments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">لا توجد سجلات بعد</div>
          )}

          {purchases.map((p) => {
            const its = items.filter((i) => i.purchaseId === p.id);
            return (
              <div key={p.id} className="rounded-2xl border border-border/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-bold tabular-nums", blurCls)}>{fmt(p.total)} ج.م</span>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      p.paymentType === "cash"
                        ? "bg-foreground/[0.06] text-muted-foreground ring-border"
                        : "bg-foreground/[0.06] text-muted-foreground ring-border",
                    )}>
                      {p.paymentType === "cash" ? "نقدي" : "آجل"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{p.purchaseDate}</div>
                </div>
                {its.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    {its.map((it) => (
                      <div key={it.id} className="flex items-center justify-between border-t border-[var(--hairline)] pt-1">
                        <span className={blurCls}>{fmt(it.unitCost)} × {it.quantity}</span>
                        <span className="font-medium text-foreground">{it.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {p.notes && <div className="text-xs text-muted-foreground mt-1.5">{p.notes}</div>}
              </div>
            );
          })}

          {payments.map((p) => (
            <SupplierPaymentRow key={p.id} payment={p} blurCls={blurCls} />
          ))}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full"><X className="w-4 h-4 ml-1" /> إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchasesTable({ privacy }: { privacy: boolean }) {
  const data = useDB();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const [detailFor, setDetailFor] = useState<Purchase | null>(null);
  const [editFor, setEditFor] = useState<Purchase | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return [...data.purchases].sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1));
  }, [data.purchases]);

  const supplierName = (id: string) => data.suppliers.find((s) => s.id === id)?.name ?? "—";

  return (
    <>
      <BezelCard variant="flat" className="animate-[fade-in_0.4s_ease-out]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.04] text-muted-foreground">
              <tr>
                <th className="text-right p-4 font-medium">التاريخ</th>
                <th className="text-right p-4 font-medium">المورد</th>
                <th className="text-right p-4 font-medium">الإجمالي</th>
                <th className="text-right p-4 font-medium">طريقة الدفع</th>
                <th className="text-right p-4 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    لا توجد فواتير شراء
                  </td>
                </tr>
              )}
              <AnimatePresence initial={false}>
                {rows.map((p, idx) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, delay: idx * 0.02 }}
                    className="border-t border-[var(--hairline)] hover:bg-foreground/[0.035] transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer"
                    onClick={() => setDetailFor(p)}
                  >
                    <td className="p-4 text-muted-foreground" dir="ltr">{p.purchaseDate}</td>
                    <td className="p-4 font-medium">{supplierName(p.supplierId)}</td>
                    <td className={cn("p-4 font-bold tabular-nums", blurCls)}>{fmt(p.total)} ج.م</td>
                    <td className="p-4">
<Badge variant="outline" className={cn(
                      "text-xs",
                      p.paymentType === "cash"
                        ? "bg-foreground/[0.06] text-muted-foreground ring-border"
                        : "bg-foreground/[0.06] text-muted-foreground ring-border",
                    )}>
                        {p.paymentType === "cash" ? "نقدي" : "آجل"}
                      </Badge>
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" title="تفاصيل" onClick={() => setDetailFor(p)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" title="تعديل" onClick={() => setEditFor(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger/10" title="حذف" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>

                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </BezelCard>

      <Dialog open={!!detailFor} onOpenChange={(v) => !v && setDetailFor(null)}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right">تفاصيل فاتورة الشراء</DialogTitle>
            <DialogDescription className="text-right">
              {detailFor && `${supplierName(detailFor.supplierId)} — ${detailFor.purchaseDate}`}
            </DialogDescription>
          </DialogHeader>
          {detailFor && (
            <div className="space-y-3 text-right">
              <div className="flex items-center justify-between rounded-2xl hairline p-3 bg-foreground/[0.03]">
                <Badge variant="outline" className={cn(
                  detailFor.paymentType === "cash"
                    ? "bg-success/10 text-success border-success/30"
                    : "bg-warning/10 text-warning border-warning/30",
                )}>
                  {detailFor.paymentType === "cash" ? "نقدي" : "آجل"}
                </Badge>
                <div className={cn("font-extrabold tabular-nums text-lg", blurCls)}>{fmt(detailFor.total)} ج.م</div>
              </div>
              <div className="border-t border-border/30 pt-4">
                <div className="text-xs text-muted-foreground mb-2">الأصناف</div>
                <div className="space-y-1.5">
                  {data.purchaseItems.filter((i) => i.purchaseId === detailFor.id).map((it) => (
                    <div key={it.id} className="flex items-center justify-between border-t border-[var(--hairline)] pt-1.5 text-sm">
                      <span className={cn("text-muted-foreground tabular-nums", blurCls)}>
                        {fmt(it.unitCost)} × {it.quantity} = {fmt(it.unitCost * it.quantity)} ج.م
                      </span>
                      <span className="font-medium">{it.name}</span>
                    </div>
                  ))}
                  {data.purchaseItems.filter((i) => i.purchaseId === detailFor.id).length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-2">لا توجد أصناف</div>
                  )}
                </div>
              </div>
              {detailFor.notes && (
                <div className="rounded-2xl hairline p-3 text-sm">
                  <div className="text-xs text-muted-foreground mb-1">ملاحظات</div>
                  {detailFor.notes}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailFor(null)} className="w-full">
              <X className="w-4 h-4 ml-1" /> إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewPurchaseDialog
        editing={editFor}
        open={!!editFor}
        onOpenChange={(v) => { if (!v) setEditFor(null); }}
      />


      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">حذف فاتورة الشراء؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف الفاتورة وكل أصنافها. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteId) return;
                try { await db.removePurchase(deleteId); toast.success("تم حذف الفاتورة"); }
                catch (e: any) { toast.error(e.message || "خطأ"); }
                setDeleteId(null);
              }}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** One supplier payment with inline edit + delete. */
function SupplierPaymentRow({ payment, blurCls }: { payment: SupplierPayment; blurCls: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = Number(amount);
    if (!n || n <= 0) { toast.error("أدخل مبلغ صحيح"); return; }
    setBusy(true);
    try {
      await db.updateSupplierPayment(payment.id, n);
      toast.success("تم تعديل الدفعة");
      setEditOpen(false);
    } catch (e: any) { toast.error(e.message || "خطأ"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="rounded-2xl border border-border/30 bg-foreground/[0.06] p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-muted-foreground" />
          <span className={cn("font-bold text-foreground tabular-nums", blurCls)}>{fmt(payment.amount)} ج.م</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon" variant="ghost" title="تعديل الدفعة"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]"
            onClick={() => { setAmount(String(payment.amount)); setEditOpen(true); }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="icon" variant="ghost" title="حذف الدفعة"
            className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger/10"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground mr-1" dir="ltr">
            {new Date(payment.paidAt).toLocaleDateString("en-GB")}
          </span>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل الدفعة</DialogTitle>
            <DialogDescription className="text-right">
              تعديل المبلغ بيعدّل مديونية المورد على طول.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>المبلغ (ج.م)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={busy} className="w-full">حفظ التعديل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">حذف الدفعة؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هيترجع المبلغ لمديونية المورد. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={async () => {
                try { await db.removeSupplierPayment(payment.id); toast.success("تم حذف الدفعة"); }
                catch (e: any) { toast.error(e.message || "خطأ"); }
                setConfirmDelete(false);
              }}
            >حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
