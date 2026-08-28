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

import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  db, useDB, fmt, EXPENSE_CATEGORIES, expenseCategoryLabel,
  type Expense, type ExpenseCategory,
} from "@/lib/store";
import { Plus, Pencil, Trash2, Search, Receipt, Wallet, Download, FileSpreadsheet, FileText, X, Loader2, Calendar } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CountUp } from "@/components/CountUp";
import { toast } from "sonner";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/lib/privacy";

export default function Page() { return (<AppShell><PageTransition><ExpensesPage /></PageTransition></AppShell>); }

const expenseSchema = z.object({
  amount: z.number().positive("أدخل مبلغ صحيح").max(1e9, "المبلغ كبير جداً"),
  category: z.enum(["rent", "electricity", "salaries", "transport", "other"]),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ غير صحيح"),
  notes: z.string().trim().max(500, "الملاحظات طويلة جداً").nullable(),
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function ExpensesPage() {
  const { expenses } = useDB();
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [fadingId, setFadingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<"all" | ExpenseCategory>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pulse animation when underlying data changes
  const [pulseKey, setPulseKey] = useState(0);
  const lastSig = useRef("");
  useEffect(() => {
    const sig = `${expenses.length}|${expenses.reduce((s, e) => s + e.amount, 0)}`;
    if (lastSig.current && lastSig.current !== sig) setPulseKey((k) => k + 1);
    lastSig.current = sig;
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (filterCat !== "all" && e.category !== filterCat) return false;
      if (fromDate && e.expenseDate < fromDate) return false;
      if (toDate && e.expenseDate > toDate) return false;
      if (q) {
        const txt = `${expenseCategoryLabel(e.category)} ${e.notes ?? ""}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, search, filterCat, fromDate, toDate]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const topCat = topCategoryKey(filtered);

  const onAdd = () => { setEditing(null); setOpenForm(true); };
  const onEdit = (e: Expense) => { setEditing(e); setOpenForm(true); };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    setFadingId(id);
    // Wait for fade-out animation to play before persisting deletion
    await new Promise((r) => setTimeout(r, 320));
    try {
      await db.removeExpense(id);
      toast.success("تم حذف المصروف");
    } catch (err: any) {
      toast.error(err.message || "خطأ");
    } finally {
      setFadingId(null);
    }
  };

  const exportCSV = async () => {
    setExporting("csv");
    try {
      // Small delay so the loading animation is visible even on instant exports
      await new Promise((r) => setTimeout(r, 600));
      const headers = ["التاريخ", "التصنيف", "المبلغ", "ملاحظات"];
      const rows = filtered.map((e) => [e.expenseDate, expenseCategoryLabel(e.category), e.amount, e.notes ?? ""]);
      const totalRow = ["", "الإجمالي", total, ""];
      const csv = "\uFEFF" + [headers, ...rows, totalRow].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير الملف");
    } finally {
      setExporting(null);
    }
  };

  const exportPDF = async () => {
    setExporting("pdf");
    try {
      await new Promise((r) => setTimeout(r, 400));
      const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const rowsHtml = filtered.map((e, i) => `<tr><td>${i + 1}</td><td dir="ltr">${escapeHtml(e.expenseDate)}</td><td>${escapeHtml(expenseCategoryLabel(e.category))}</td><td class="num due">${fmt(e.amount)} ج.م</td><td>${escapeHtml(e.notes ?? "—")}</td></tr>`).join("");
      const filterInfo: string[] = [];
      if (filterCat !== "all") filterInfo.push(`التصنيف: ${expenseCategoryLabel(filterCat as ExpenseCategory)}`);
      if (fromDate) filterInfo.push(`من: ${fromDate}`);
      if (toDate) filterInfo.push(`إلى: ${toDate}`);
      const avg = filtered.length ? total / filtered.length : 0;
      const body = `
<h2 class="sec">قيود المصروفات</h2>
<div class="t-wrap"><table><thead><tr><th>م</th><th>التاريخ</th><th>التصنيف</th><th class="num">المبلغ</th><th>ملاحظات</th></tr></thead>
<tbody>${rowsHtml || `<tr><td colspan="5" class="empty">لا توجد قيود</td></tr>`}</tbody></table></div>
<div class="total-bar"><span>إجمالي المصروفات</span><span class="v">${fmt(total)} ج.م</span></div>`;
      const html = pdfDocument({
        docTitle: "تقرير المصروفات — سِجلّي",
        badge: "تقرير مصروفات",
        title: "تقرير المصروفات",
        lede: filterInfo.length ? filterInfo.join(" • ") : "كل المصروفات المسجّلة.",
        meta: [
          { label: "تاريخ التقرير", value: today },
          { label: "عدد القيود", value: String(filtered.length) },
        ],
        kpis: [
          { label: "إجمالي المصروفات", value: `${fmt(total)} ج.م`, tone: "danger" },
          { label: "عدد القيود", value: String(filtered.length) },
          { label: "متوسط القيد", value: `${fmt(Math.round(avg))} ج.م` },
        ],
        body,
      });
      if (!openPdfDocument(html, { autoPrint: true })) toast.error("الرجاء السماح بفتح النوافذ المنبثقة");
    } finally {
      setExporting(null);
    }
  };


  return (
    <>
      <PageHeader
        title="المصروفات"
        subtitle="تتبع مصروفات المحل لحساب صافي الأرباح بدقة."
        icon={<Receipt className="w-7 h-7" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant={privacy ? "default" : "outline"} size="sm" className="gap-1.5" onClick={toggle} title="إخفاء الأرقام">
              {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">إخفاء الأرقام</span>
            </Button>
            <Button onClick={onAdd} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> إضافة مصروف
            </Button>
          </div>
        }
      />

      {/* Summary */}
      <div key={`stats-${pulseKey}`} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-pulse-soft">
        <SummaryCard label="إجمالي المصروفات (الفلتر)">
          <CountUp
            value={total}
            disabled={privacy}
            className={cn("tabular-nums", blurCls)}
            suffix=" ج.م"
            format={(n) => fmt(n)}
          >
            {fmt(total)} ج.م
          </CountUp>
        </SummaryCard>
        <SummaryCard label="عدد القيود">
          <CountUp value={filtered.length} duration={600} format={(n) => String(Math.round(n))} />
        </SummaryCard>
        <SummaryCard
          label="أعلى تصنيف"
          clickable={!!topCat}
          active={!!topCat && filterCat === topCat}
          onClick={() => topCat && setFilterCat((cur) => cur === topCat ? "all" : topCat)}
        >
          {topCat ? expenseCategoryLabel(topCat) : "—"}
        </SummaryCard>
      </div>

      {/* Filters */}
      <div className="sticky-search-bar mb-6">
        <div className="rounded-2xl border border-foreground/10 bg-card/70 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="بحث في الملاحظات..."
              value={search}
              onChange={(e) => setSearch(e.target.value.slice(0, 100))}
              className="pr-9"
            />
          </div>
          <Select value={filterCat} onValueChange={(v) => setFilterCat(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التصنيفات</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="من" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="إلى" />
        </div>
        <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 min-w-[130px] justify-center" disabled={!!exporting}>
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري التصدير...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" /> تصدير التقرير
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={exportCSV} className="gap-2" disabled={!!exporting}>
                  <FileSpreadsheet className="w-4 h-4 text-muted-foreground" /> Excel (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF} className="gap-2" disabled={!!exporting}>
                  <FileText className="w-4 h-4 text-muted-foreground" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {filterCat !== "all" && (
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setFilterCat("all")}>
                <X className="w-3.5 h-3.5" /> إلغاء فلتر التصنيف
              </Button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} قيد</span>
        </div>
      </div>
    </div>

      <Reveal delay={140}>
        <div className="flex flex-col gap-3">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-foreground/10 bg-card/70 px-6 py-10">
                <EmptyState
                  icon={Wallet}
                  title="لا توجد مصروفات مسجلة."
                  hint="سجّل مصروفات المحل عشان الربح الظاهر يبقى ربح حقيقي."
                />
            </div>
          ) : (
            filtered.map((e, idx) => (
              <div
                key={e.id}
                className="group flex animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)] both rounded-2xl border border-foreground/10 bg-card/70 p-5"
                style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
              >
                <div className="grid w-full grid-cols-1 items-center gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-6">
                  {/* الهوية */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="text-display grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/12 text-danger ring-1 ring-danger/25">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold">{expenseCategoryLabel(e.category)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">{e.expenseDate}</div>
                    </div>
                  </div>

                  {/* المبلغ */}
                  <div className="min-w-0">
                    <div className={cn("text-numeric text-xl font-extrabold text-danger", blurCls)}>
                      {fmt(e.amount)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground truncate">{e.notes || "لا توجد ملاحظات"}</div>
                  </div>

                  {/* الإجراءات */}
                  <div className="flex items-center justify-end gap-1.5 md:opacity-70 md:transition-[opacity] md:group-hover:opacity-100">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-warning hover:bg-warning/10" onClick={() => onEdit(e)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>تعديل</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="action-btn danger rounded-full text-danger hover:bg-danger/10" onClick={() => setDeleteId(e.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>حذف</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Reveal>

      <ExpenseFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        editing={editing}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">حذف المصروف؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-danger text-danger-foreground hover:bg-danger/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryCard({ label, children, clickable, active, onClick }: { label: string; children: React.ReactNode; clickable?: boolean; active?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
      className={cn(
        "rounded-2xl border bg-card/70 p-4 transition-[border-color,background-color,box-shadow,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
        active ? "border-foreground ring-1 ring-foreground/20 bg-foreground/[0.04]" : "border-foreground/10",
        clickable && "cursor-pointer hover:border-foreground/20 hover:shadow-sm hover:-translate-y-0.5"
      )}
    >
      <div className="text-xs text-muted-foreground text-right flex items-center justify-between">
        <span>{label}</span>
        {clickable && <span className="text-xs text-muted-foreground/70">{active ? "تم التصفية ✓" : "اضغط للتصفية"}</span>}
      </div>
      <div className="text-2xl font-extrabold text-foreground mt-1 text-right tabular-nums">{children}</div>
    </div>
  );
}

function categoryClass(c: ExpenseCategory): string {
  switch (c) {
    case "rent": return "bg-primary/10 border-primary/30 text-primary";
    case "electricity": return "bg-warning/10 border-warning/30 text-warning";
    case "salaries": return "bg-chart-4/10 border-chart-4/30 text-foreground";
    case "transport": return "bg-chart-5/10 border-chart-5/30 text-foreground";
    default: return "bg-secondary border-border text-muted-foreground";
  }
}

function topCategoryKey(list: Expense[]): ExpenseCategory | null {
  if (list.length === 0) return null;
  const tally = new Map<ExpenseCategory, number>();
  for (const e of list) tally.set(e.category, (tally.get(e.category) ?? 0) + e.amount);
  let best: ExpenseCategory | null = null; let max = -1;
  tally.forEach((v, k) => { if (v > max) { max = v; best = k; } });
  return best;
}

export function ExpenseFormDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Expense | null;
  onSaved?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // initialize when opened
  useMemo(() => {
    if (open) {
      if (editing) {
        setAmount(String(editing.amount));
        setCategory(editing.category);
        setExpenseDate(editing.expenseDate);
        setNotes(editing.notes ?? "");
      } else {
        setAmount(""); setCategory("other");
        setExpenseDate(new Date().toISOString().slice(0, 10));
        setNotes("");
      }
    }
  }, [open, editing]);

  const submit = async () => {
    const parsed = expenseSchema.safeParse({
      amount: Number(amount),
      category,
      expenseDate,
      notes: notes.trim() || null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await db.updateExpense(editing.id, parsed.data);
        toast.success("تم تحديث المصروف");
      } else {
        await db.addExpense(parsed.data as any);
        toast.success("تم إضافة المصروف");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) { toast.error(err.message || "خطأ"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">
            {editing ? "تعديل المصروف" : "إضافة مصروف جديد"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>المبلغ</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>التصنيف</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>التاريخ</Label>
            <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 500))} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={busy}>{editing ? "حفظ التعديلات" : "إضافة"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}