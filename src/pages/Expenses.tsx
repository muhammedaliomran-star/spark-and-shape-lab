import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { EmptyState } from "@/components/EmptyState";
import { CountUp } from "@/components/CountUp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { db, useDB, fmt, type Expense, useShopSettings } from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { pdfDocument, openPdfDocument, esc } from "@/lib/pdf-doc";
import { cn } from "@/lib/utils";
import {
  getAllExpenseCategories,
  getCategoryInfo,
  getExpenseMeta,
  printPaymentVoucherPdf,
  getRecurringExpenses,
  checkRecurringStatus,
  decodeExpenseNotes,
  runRecurringAutoGeneration,
  getCategoryBudgets,
  calculateBudgetStatus,
} from "@/lib/expenses-system";
import { getTreasuryAccounts } from "@/lib/cashbox-system";
import { ExpenseFormModal } from "@/components/expenses/ExpenseFormModal";
import { ReceiptViewerModal } from "@/components/expenses/ReceiptViewerModal";
import { RecurringExpensesTab } from "@/components/expenses/RecurringExpensesTab";
import { BudgetsTab } from "@/components/expenses/BudgetsTab";
import { CustomCategoriesTab } from "@/components/expenses/CustomCategoriesTab";
import { ExpenseAnalyticsTab } from "@/components/expenses/ExpenseAnalyticsTab";
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  X,
  Loader2,
  Calendar,
  Wallet,
  Eye,
  EyeOff,
  Building2,
  Printer,
  Paperclip,
  CalendarClock,
  Target,
  BarChart3,
  Tags,
  AlertTriangle,
  User,
  SlidersHorizontal,
} from "lucide-react";

export { ExpenseFormModal as ExpenseFormDialog };

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <ExpensesPage />
      </PageTransition>
    </AppShell>
  );
}

function ExpensesPage() {
  const { expenses, branches } = useDB();
  const { settings: shopSettings } = useShopSettings();
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  const [activeTab, setActiveTab] = useState<"list" | "recurring" | "budgets" | "analytics" | "categories">("list");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  // Lightbox Receipt Viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [viewingReceiptName, setViewingReceiptName] = useState<string | undefined>();
  const [viewingExpenseTitle, setViewingExpenseTitle] = useState<string | undefined>();
  const [viewingExpenseAmount, setViewingExpenseAmount] = useState<number | undefined>();

  // Filter States
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const categories = useMemo(() => getAllExpenseCategories(), [openForm]);
  const treasuryAccounts = useMemo(() => getTreasuryAccounts(), [openForm]);

  // Recurring check for badge
  const [recurringTick, setRecurringTick] = useState(0);
  const recurringList = useMemo(() => getRecurringExpenses(), [activeTab, recurringTick]);
  const dueRecurringCount = recurringList.filter((r) => r.active && checkRecurringStatus(r).isDue).length;

  // المولّد التلقائي للمصروفات الدورية + تنبيهات عامة (مرة يومياً عند فتح الصفحة)
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current || branches === undefined) return;
    autoRanRef.current = true;
    runRecurringAutoGeneration({
      addExpense: (exp) => db.addExpense({ ...exp, category: exp.category as Expense["category"] }),
      branches,
    })
      .then(({ generated, pending }) => {
        if (generated.length) {
          setRecurringTick((t) => t + 1);
          toast.success(
            `تم تسجيل ${generated.length} مصروف دوري تلقائياً بقيمة ${fmt(generated.reduce((s, g) => s + g.amount, 0))} ج.م`,
            { duration: 8000 }
          );
        }
        if (pending.length) {
          toast.warning(`لديك ${pending.length} مصروف دوري مستحق بانتظار الاعتماد`, {
            duration: 8000,
            action: { label: "عرض", onClick: () => setActiveTab("recurring") },
          });
        }
      })
      .catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches]);

  // تنبيه تجاوز الميزانيات الشهرية
  const exceededBudgets = useMemo(
    () => calculateBudgetStatus(getCategoryBudgets(), expenses).filter((b) => b.status !== "safe"),
    [expenses, activeTab]
  );

  // Filtered List
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (filterCat !== "all" && e.category !== filterCat) return false;
      if (fromDate && e.expenseDate < fromDate) return false;
      if (toDate && e.expenseDate > toDate) return false;

      const meta = getExpenseMeta(e);
      if (filterAccount !== "all" && meta.accountId !== filterAccount) return false;
      if (filterBranch !== "all" && meta.branchId !== filterBranch) return false;

      if (q) {
        const catInfo = getCategoryInfo(e.category);
        const { cleanNotes } = decodeExpenseNotes(e.notes);
        const txt = `${catInfo.label} ${cleanNotes} ${meta.recipientName || ""} ${meta.voucherNumber || ""}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, search, filterCat, filterAccount, filterBranch, fromDate, toDate]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const onAdd = () => {
    setEditing(null);
    setOpenForm(true);
  };

  const onEdit = (e: Expense) => {
    setEditing(e);
    setOpenForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await db.removeExpense(id);
      toast.success("تم حذف المصروف بنجاح");
    } catch (err: any) {
      toast.error(err.message || "خطأ أثناء الحذف");
    }
  };

  const handleViewReceipt = (e: Expense) => {
    const meta = getExpenseMeta(e);
    if (!meta.receiptUrl) {
      toast.info("لا توجد صورة فاتورة مرفقة مع هذا المصروف");
      return;
    }
    const { cleanNotes } = decodeExpenseNotes(e.notes);
    const cat = getCategoryInfo(e.category);
    setViewingReceiptUrl(meta.receiptUrl);
    setViewingReceiptName(meta.receiptName);
    setViewingExpenseTitle(`${cat.label} - ${cleanNotes || "مصروف"}`);
    setViewingExpenseAmount(e.amount);
    setViewerOpen(true);
  };

  const handlePrintVoucher = (e: Expense) => {
    const meta = getExpenseMeta(e);
    const ok = printPaymentVoucherPdf(e, meta, shopSettings?.shopName || "سِجلّي لإدارة المتاجر والأقساط", {
      paper: shopSettings?.printPaper === "thermal" ? "thermal" : "a4",
      thermalWidth: shopSettings?.thermalPaperWidth || "80mm",
    });
    if (!ok) {
      toast.error("يرجى السماح بفتح النوافذ المنبثقة للطباعة");
    }
  };

  // Export CSV
  const exportCSV = async () => {
    setExporting("csv");
    try {
      await new Promise((r) => setTimeout(r, 400));
      const headers = ["رقم السند", "التاريخ", "التصنيف", "المبلغ", "الخزينة", "المستلم", "البيان"];
      const rows = filtered.map((e) => {
        const meta = getExpenseMeta(e);
        const { cleanNotes } = decodeExpenseNotes(e.notes);
        const catInfo = getCategoryInfo(e.category);
        const acc = treasuryAccounts.find((a) => a.id === meta.accountId);
        return [
          meta.voucherNumber || `VCH-${e.id.slice(0, 6)}`,
          e.expenseDate,
          catInfo.label,
          e.amount,
          acc?.name || "الدرج",
          meta.recipientName || "—",
          cleanNotes || "—",
        ];
      });
      const totalRow = ["", "", "الإجمالي", total, "", "", ""];
      const csv =
        "\uFEFF" +
        [headers, ...rows, totalRow]
          .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
          .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير ملف Excel بنجاح");
    } finally {
      setExporting(null);
    }
  };

  // Export PDF Report
  const exportPDF = async () => {
    setExporting("pdf");
    try {
      await new Promise((r) => setTimeout(r, 400));
      const today = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
      const rowsHtml = filtered
        .map((e, i) => {
          const meta = getExpenseMeta(e);
          const { cleanNotes } = decodeExpenseNotes(e.notes);
          const catInfo = getCategoryInfo(e.category);
          const acc = treasuryAccounts.find((a) => a.id === meta.accountId);
          return `<tr>
            <td>${i + 1}</td>
            <td dir="ltr">${esc(e.expenseDate)}</td>
            <td><b>${esc(catInfo.label)}</b></td>
            <td class="num due">${fmt(e.amount)} ج.م</td>
            <td>${esc(acc?.name || "الدرج")}</td>
            <td>${esc(meta.recipientName || "—")}</td>
            <td>${esc(cleanNotes || "—")}</td>
          </tr>`;
        })
        .join("");

      const body = `
<div class="t-wrap">
  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>التاريخ</th>
        <th>التصنيف</th>
        <th class="num">المبلغ</th>
        <th>الخزينة المسحوبة</th>
        <th>المستلم</th>
        <th>البيان والملاحظات</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || `<tr><td colspan="7" class="empty">لا توجد قيود مصروفات</td></tr>`}</tbody>
  </table>
</div>
<div class="total-bar"><span>إجمالي المصروفات المنصرفة</span><span class="v">${fmt(total)} ج.م</span></div>`;

      const html = pdfDocument({
        docTitle: "تقرير المصروفات الشامل — سِجلّي",
        badge: "تقرير مالي رسمي",
        title: "كشف قيود المصروفات",
        lede: `إجمالي المبالغ المنصرفة: ${fmt(total)} ج.م • عدد القيود: ${filtered.length}`,
        meta: [
          { label: "تاريخ التصدير", value: today },
          { label: "عدد القيود", value: String(filtered.length) },
        ],
        kpis: [
          { label: "إجمالي المصروفات", value: `${fmt(total)} ج.م`, tone: "danger" },
          { label: "عدد القيود", value: String(filtered.length) },
          { label: "متوسط القيد", value: `${fmt(filtered.length ? Math.round(total / filtered.length) : 0)} ج.م` },
        ],
        body,
      });

      if (!openPdfDocument(html, { autoPrint: true })) {
        toast.error("الرجاء السماح بفتح النوافذ المنبثقة");
      }
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="المصروفات والتكاليف"
        subtitle="إدارة النفقات، الربط مع الخزن، الجدولة التلقائية، والميزانيات لضبط صافي الأرباح بدقة."
        icon={<Receipt className="w-7 h-7" />}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={privacy ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={toggle}
              title="إخفاء الأرقام للحفاظ على الخصوصية"
            >
              {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">إخفاء الأرقام</span>
            </Button>
            <Button onClick={onAdd} size="sm" className="gap-1.5 shadow-sm">
              <Plus className="w-4 h-4" /> تسجيل مصروف
            </Button>
          </div>
        }
      />

      {/* Modern Segmented Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v: any) => setActiveTab(v)}
        className="w-full mb-6"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto p-1.5 bg-muted/60 rounded-2xl gap-1">
          <TabsTrigger value="list" className="rounded-xl py-2 gap-2 text-xs font-bold data-[state=active]:shadow-xs">
            <Receipt className="w-4 h-4" />
            سجل المصروفات
          </TabsTrigger>

          <TabsTrigger value="recurring" className="rounded-xl py-2 gap-2 text-xs font-bold data-[state=active]:shadow-xs relative">
            <CalendarClock className="w-4 h-4" />
            <span>المصروفات الدورية</span>
            {dueRecurringCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse absolute top-1.5 left-2" />
            )}
          </TabsTrigger>

          <TabsTrigger value="budgets" className="rounded-xl py-2 gap-2 text-xs font-bold data-[state=active]:shadow-xs">
            <Target className="w-4 h-4" />
            الميزانيات وسقف الإنفاق
          </TabsTrigger>

          <TabsTrigger value="analytics" className="rounded-xl py-2 gap-2 text-xs font-bold data-[state=active]:shadow-xs">
            <BarChart3 className="w-4 h-4" />
            التحليلات والمقارنة
          </TabsTrigger>

          <TabsTrigger value="categories" className="rounded-xl py-2 gap-2 text-xs font-bold data-[state=active]:shadow-xs">
            <Tags className="w-4 h-4" />
            التصنيفات المخصصة
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: سجل المصروفات ================= */}
        <TabsContent value="list" className="space-y-6 mt-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4.5 rounded-2xl border bg-card/80 flex flex-col justify-between">
              <span className="text-xs text-muted-foreground">إجمالي المصروفات (المعروضة)</span>
              <div className="text-2xl font-extrabold text-danger mt-1 tabular-nums">
                <CountUp
                  value={total}
                  disabled={privacy}
                  className={cn("tabular-nums", blurCls)}
                  suffix=" ج.م"
                  format={(n) => fmt(n)}
                >
                  {fmt(total)} ج.م
                </CountUp>
              </div>
            </div>

            <div className="p-4.5 rounded-2xl border bg-card/80 flex flex-col justify-between">
              <span className="text-xs text-muted-foreground">عدد القيود المسجلة</span>
              <div className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                <CountUp value={filtered.length} duration={500} format={(n) => String(Math.round(n))} />
              </div>
            </div>

            <div className="p-4.5 rounded-2xl border bg-card/80 flex flex-col justify-between">
              <span className="text-xs text-muted-foreground">متوسط القيد الواحد</span>
              <div className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                {fmt(filtered.length ? Math.round(total / filtered.length) : 0)} <span className="text-xs text-muted-foreground font-bold">ج.م</span>
              </div>
            </div>
          </div>

          {/* Advanced Multi-Filters Bar */}
          <div className="rounded-2xl border border-foreground/10 bg-card/80 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="بحث في البيان، المستلم، السند..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9 text-xs"
                />
              </div>

              {/* Category Filter */}
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="كل التصنيفات" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل التصنيفات</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Account Filter */}
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="كل الخزن وقنوات الدفع" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل الخزن وقنوات الدفع</SelectItem>
                  {treasuryAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Branch Filter */}
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="كل الفروع" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل الفروع / عام</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/40 flex-wrap">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="text-xs h-8 w-36"
                  placeholder="من تاريخ"
                />
                <span className="text-xs text-muted-foreground">إلى</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="text-xs h-8 w-36"
                  placeholder="إلى تاريخ"
                />
                {(filterCat !== "all" || filterAccount !== "all" || filterBranch !== "all" || fromDate || toDate || search) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground gap-1"
                    onClick={() => {
                      setFilterCat("all");
                      setFilterAccount("all");
                      setFilterBranch("all");
                      setFromDate("");
                      setToDate("");
                      setSearch("");
                    }}
                  >
                    <X className="w-3.5 h-3.5" /> إعادة ضبط
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-xs h-8" disabled={!!exporting}>
                      {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      تصدير التقرير
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={exportCSV} className="gap-2 text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> تصدير كـ Excel (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPDF} className="gap-2 text-xs">
                      <FileText className="w-4 h-4 text-rose-600" /> طباعة تقرير PDF شامل
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <span className="text-xs text-muted-foreground">{filtered.length} قيد</span>
              </div>
            </div>
          </div>

          {/* Expenses Cards List */}
          <Reveal delay={100}>
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-foreground/10 bg-card/70 px-6 py-12 text-center">
                  <EmptyState
                    icon={Wallet}
                    title="لا توجد مصروفات مسجلة تطابق البحث."
                    hint="اضغط على «تسجيل مصروف» لإضافة قيد جديد وخصمه من الخزينة."
                  />
                </div>
              ) : (
                filtered.map((e) => {
                  const meta = getExpenseMeta(e);
                  const { cleanNotes } = decodeExpenseNotes(e.notes);
                  const catInfo = getCategoryInfo(e.category);
                  const acc = treasuryAccounts.find((a) => a.id === meta.accountId);
                  const br = branches.find((b) => b.id === meta.branchId);

                  return (
                    <div
                      key={e.id}
                      className="group rounded-2xl border border-border/60 bg-card/80 p-4.5 transition-all hover:border-border hover:shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Info */}
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-danger/10 text-danger flex items-center justify-center font-bold shrink-0 ring-1 ring-danger/20">
                          <Receipt className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground text-sm">{catInfo.label}</span>
                            <span className="text-xs text-muted-foreground" dir="ltr">
                              {e.expenseDate}
                            </span>
                            {meta.voucherNumber && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                                {meta.voucherNumber}
                              </Badge>
                            )}
                          </div>

                          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                            {cleanNotes && <span className="text-foreground/80 font-medium">{cleanNotes}</span>}
                            {meta.recipientName && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <User className="w-3 h-3 text-muted-foreground" /> {meta.recipientName}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              <Wallet className="w-3 h-3" /> {acc?.name || "الدرج"}
                            </span>
                            {br && (
                              <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                                <Building2 className="w-3 h-3" /> {br.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Middle: Amount */}
                      <div className="text-right md:text-left shrink-0">
                        <div className={cn("text-xl font-extrabold text-danger tabular-nums", blurCls)}>
                          {fmt(e.amount)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center justify-end gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-border/40 shrink-0">
                        {meta.receiptUrl && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
                                  onClick={() => handleViewReceipt(e)}
                                >
                                  <Paperclip className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">الفاتورة</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>معاينة صورة الفاتورة المرفقة</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handlePrintVoucher(e)}
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>طباعة إذن صرف نقدية رسمي مع تفقيط</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => onEdit(e)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>تعديل المصروف</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-danger hover:bg-danger/10"
                                onClick={() => setDeleteId(e.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>حذف المصروف</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Reveal>
        </TabsContent>

        {/* ================= TAB 2: المصروفات الدورية المجدولة ================= */}
        <TabsContent value="recurring" className="mt-6">
          <RecurringExpensesTab />
        </TabsContent>

        {/* ================= TAB 3: الميزانيات وسقف الإنفاق ================= */}
        <TabsContent value="budgets" className="mt-6">
          <BudgetsTab />
        </TabsContent>

        {/* ================= TAB 4: التحليلات ومقارنة الفترات ================= */}
        <TabsContent value="analytics" className="mt-6">
          <ExpenseAnalyticsTab />
        </TabsContent>

        {/* ================= TAB 5: التصنيفات المخصصة ================= */}
        <TabsContent value="categories" className="mt-6">
          <CustomCategoriesTab />
        </TabsContent>
      </Tabs>

      {/* Main Expense Form Dialog */}
      <ExpenseFormModal
        open={openForm}
        onOpenChange={setOpenForm}
        editing={editing}
      />

      {/* Receipt Image Viewer Modal */}
      <ReceiptViewerModal
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        receiptUrl={viewingReceiptUrl}
        receiptName={viewingReceiptName}
        expenseTitle={viewingExpenseTitle}
        expenseAmount={viewingExpenseAmount}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">حذف قيد المصروف؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف القيد من سجل المصروفات وإلغاء تأثيره على الأرباح.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
