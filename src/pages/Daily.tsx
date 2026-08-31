import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { MetricCard, MetricLabel } from "@/components/MetricCard";
import { ActionButton } from "@/components/ActionButton";
import { EmptyState } from "@/components/EmptyState";
import { Reveal } from "@/components/Reveal";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  db, useDB, fmt, invoiceNumber, EXPENSE_CATEGORIES, expenseCategoryLabel,
  type ExpenseCategory, type Invoice,
} from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus, Eye, EyeOff, Download, Search, FileSpreadsheet, FileText, Receipt,
  Coins, Wallet, CheckCircle2, ChevronDown, CalendarDays, TrendingUp,
  ArrowDownRight, ArrowUpRight, Clock, RotateCcw, DollarSign, Calendar,
  CreditCard, Sparkles, Filter, Layers, ListFilter
} from "lucide-react";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <DailyPage />
      </PageTransition>
    </AppShell>
  );
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const noteKey = (d: string) => `segilly:daily-note:${d}`;

type TypeFilter = "all" | "installment" | "cash";
type StatusFilter = "all" | "paid" | "partial" | "unpaid";
type ActiveTab = "invoices" | "payments" | "expenses" | "returns";

type InvStatus = Exclude<StatusFilter, "all">;

function invStatus(inv: Invoice): InvStatus {
  if (inv.paid >= inv.total) return "paid";
  if (inv.paid > 0) return "partial";
  return "unpaid";
}

const statusMeta: Record<InvStatus, { label: string; cls: string }> = {
  paid: { label: "مسدّدة", cls: "bg-success/12 text-success ring-success/25" },
  partial: { label: "جزئي", cls: "bg-warning/12 text-warning ring-warning/25" },
  unpaid: { label: "غير مسدّدة", cls: "bg-danger/12 text-danger ring-danger/25" },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function DailyPage() {
  const { invoices, customers, expenses, payments, returns } = useDB();
  const { privacy, toggle } = usePrivacy();
  const masked = privacy;

  const [from, setFrom] = useState(todayISO);
  const [to, setTo] = useState(todayISO);
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState<"all" | string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeTab, setActiveTab] = useState<ActiveTab>("invoices");

  const [openExpense, setOpenExpense] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    try { setNote(localStorage.getItem(noteKey(from)) ?? ""); } catch { setNote(""); }
  }, [from]);

  // Quick Preset Date Selectors
  const setQuickDate = (preset: "today" | "yesterday" | "this-week" | "this-month") => {
    const today = new Date();
    const tIso = today.toISOString().slice(0, 10);
    
    if (preset === "today") {
      setFrom(tIso);
      setTo(tIso);
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yIso = y.toISOString().slice(0, 10);
      setFrom(yIso);
      setTo(yIso);
    } else if (preset === "this-week") {
      const w = new Date();
      const dayOfWeek = w.getDay(); // 0 is Sunday, 6 is Saturday
      const diff = w.getDate() - dayOfWeek + (dayOfWeek === 6 ? 0 : -1); // approximate start of week
      const startW = new Date(w.setDate(diff));
      setFrom(startW.toISOString().slice(0, 10));
      setTo(tIso);
    } else if (preset === "this-month") {
      const mStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      setFrom(mStart);
      setTo(tIso);
    }
  };

  const customerById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );

  const invoiceById = useMemo(
    () => new Map(invoices.map((inv) => [inv.id, inv])),
    [invoices]
  );

  // Invoices filtered by created date
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((inv) => {
        const day = inv.createdAt.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        if (customerId !== "all" && inv.customerId !== customerId) return false;
        const c = customerById.get(inv.customerId);
        if (typeFilter !== "all" && (c?.customerType ?? "installment") !== typeFilter) return false;
        if (statusFilter !== "all" && invStatus(inv) !== statusFilter) return false;
        if (q) {
          const txt = `${c?.name ?? ""} ${c?.phone ?? ""} ${invoiceNumber(invoices, inv.id)}`.toLowerCase();
          if (!txt.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [invoices, customerById, from, to, customerId, typeFilter, statusFilter, search]);

  // Actual Payments collected during period (including old invoice installment collections)
  const periodPayments = useMemo(() => {
    return payments
      .filter((p) => {
        const pDay = p.paidAt.slice(0, 10);
        if (from && pDay < from) return false;
        if (to && pDay > to) return false;
        return true;
      })
      .map((p) => {
        const inv = invoiceById.get(p.invoiceId);
        const cust = inv ? customerById.get(inv.customerId) : null;
        return {
          ...p,
          invoice: inv,
          customer: cust,
        };
      })
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  }, [payments, invoiceById, customerById, from, to]);

  // Expenses during period
  const periodExpensesList = useMemo(() => {
    return expenses
      .filter((e) => (!from || e.expenseDate >= from) && (!to || e.expenseDate <= to))
      .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
  }, [expenses, from, to]);

  // Returns during period
  const periodReturnsList = useMemo(() => {
    return returns
      .filter((r) => {
        const rDay = r.createdAt.slice(0, 10);
        if (from && rDay < from) return false;
        if (to && rDay > to) return false;
        return true;
      })
      .map((r) => {
        const inv = r.invoiceId ? invoiceById.get(r.invoiceId) : null;
        const cust = inv ? customerById.get(inv.customerId) : null;
        return {
          ...r,
          invoice: inv,
          customer: cust,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [returns, invoiceById, customerById, from, to]);

  const stats = useMemo(() => {
    let sales = 0, cashSales = 0, instSales = 0;
    let paidFromNewInvoices = 0, cashPaid = 0, instPaid = 0;

    // شبكة زمنية للـ sparklines
    const days: string[] = [];
    if (from && to && from <= to) {
      const cur = new Date(`${from}T00:00:00`);
      const end = new Date(`${to}T00:00:00`);
      while (cur <= end && days.length < 62) {
        days.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }
    const hourly = days.length < 2;
    const size = hourly ? 24 : days.length;
    const dayIndex = new Map(days.map((d, i) => [d, i]));
    const slotOf = (iso: string) =>
      hourly ? new Date(iso).getHours() : (dayIndex.get(iso.slice(0, 10)) ?? -1);
    const mk = () => new Array<number>(size).fill(0);
    const sCount = mk(), sSales = mk(), sCashSales = mk(), sInstSales = mk();
    const sPaid = mk(), sCashPaid = mk(), sInstPaid = mk(), sRemaining = mk();

    for (const inv of rows) {
      const isCash = (customerById.get(inv.customerId)?.customerType ?? "installment") === "cash";
      sales += inv.total;
      paidFromNewInvoices += inv.paid;
      if (isCash) { cashSales += inv.total; cashPaid += inv.paid; }
      else { instSales += inv.total; instPaid += inv.paid; }

      const i = slotOf(inv.createdAt);
      if (i >= 0 && i < size) {
        sCount[i] += 1;
        sSales[i] += inv.total;
        sPaid[i] += inv.paid;
        sRemaining[i] += Math.max(0, inv.total - inv.paid);
        if (isCash) { sCashSales[i] += inv.total; sCashPaid[i] += inv.paid; }
        else { sInstSales[i] += inv.total; sInstPaid[i] += inv.paid; }
      }
    }

    const totalCollectedActual = periodPayments.reduce((s, p) => s + p.amount, 0);
    const periodExpenses = periodExpensesList.reduce((s, e) => s + e.amount, 0);
    const periodReturnsTotal = periodReturnsList.reduce((s, r) => s + r.totalAmount, 0);
    
    // صافي الخزينة / الدرج الحقيقي اليوم: كل المحصل الفعلي - المصروفات - المرتجعات
    const netCashDrawer = totalCollectedActual - periodExpenses - periodReturnsTotal;

    return {
      count: rows.length,
      sales, cashSales, instSales,
      paid: paidFromNewInvoices,
      totalCollectedActual,
      cashPaid, instPaid,
      remaining: Math.max(0, sales - paidFromNewInvoices),
      periodExpenses,
      periodReturnsTotal,
      netCashDrawer,
      net: paidFromNewInvoices - periodExpenses,
      series: {
        count: sCount, sales: sSales, cashSales: sCashSales, instSales: sInstSales,
        paid: sPaid, cashPaid: sCashPaid, instPaid: sInstPaid, remaining: sRemaining,
      },
    };
  }, [rows, customerById, periodPayments, periodExpensesList, periodReturnsList, from, to]);

  const filtersActive =
    !!search.trim() || customerId !== "all" || typeFilter !== "all" || statusFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setCustomerId("all");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  const money = (n: number) => `${fmt(n)} ج.م`;
  const rangeLabel = from === to
    ? new Date(from || todayISO()).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })
    : `${from} — ${to}`;

  const saveNote = () => {
    try {
      localStorage.setItem(noteKey(from), note);
      toast.success("تم حفظ ملاحظة اليوم");
    } catch {
      toast.error("مش قادر يحفظ الملاحظة على الجهاز");
    }
  };

  const exportCSV = () => {
    const headers = ["رقم", "الوقت", "العميل", "الإجمالي", "مدفوع", "متبقي", "نوع", "الحالة"];
    const body = rows.map((inv) => {
      const c = customerById.get(inv.customerId);
      const isCash = (c?.customerType ?? "installment") === "cash";
      return [
        invoiceNumber(invoices, inv.id),
        new Date(inv.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        c?.name ?? "—",
        inv.total, inv.paid, Math.max(0, inv.total - inv.paid),
        isCash ? "فوري" : "قسط",
        statusMeta[invStatus(inv)].label,
      ];
    });
    const csv = "\uFEFF" + [headers, ...body, ["", "الإجمالي", "", stats.sales, stats.paid, stats.remaining, "", ""]]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `daily-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير اليومية");
  };

  const exportPDF = () => {
    const rowsHtml = rows.map((inv, i) => {
      const c = customerById.get(inv.customerId);
      const isCash = (c?.customerType ?? "installment") === "cash";
      return `<tr><td>${i + 1}</td><td>${escapeHtml(invoiceNumber(invoices, inv.id))}</td><td>${escapeHtml(c?.name ?? "—")}</td><td class="num">${fmt(inv.total)} ج.م</td><td class="num">${fmt(inv.paid)} ج.م</td><td class="num due">${fmt(Math.max(0, inv.total - inv.paid))} ج.م</td><td>${isCash ? "فوري" : "قسط"}</td><td>${escapeHtml(statusMeta[invStatus(inv)].label)}</td></tr>`;
    }).join("");
    const html = pdfDocument({
      docTitle: "اليومية — سِجلّي",
      badge: "تشغيل يومي",
      title: "اليومية",
      lede: rangeLabel,
      meta: [{ label: "الفترة", value: `${from} — ${to}` }],
      body: `
        <table><thead><tr><th>م</th><th>رقم</th><th>العميل</th><th>الإجمالي</th><th>مدفوع</th><th>متبقي</th><th>نوع</th><th>الحالة</th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="8">لا توجد حركة في الفترة</td></tr>`}</tbody></table>
        <p>إجمالي المبيعات: ${fmt(stats.sales)} ج.م — المحصّل الفعلي: ${fmt(stats.totalCollectedActual)} ج.م — المصروفات: ${fmt(stats.periodExpenses)} ج.م — صافي الدرج: ${fmt(stats.netCashDrawer)} ج.م</p>
      `,
    });
    openPdfDocument(html);
  };

  return (
    <>
      <PageHeader
        eyebrow="تشغيل يومي • رصد التدفقات النقدية اللحظية"
        title="اليومية"
        subtitle={`${rangeLabel} — ملخص المبيعات، التحصيلات، المصروفات، وصافي نقدية الخزينة.`}
        action={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ActionButton tone="surface" icon={<Download className="h-4 w-4" />}>
                  <span className="inline-flex items-center gap-1">
                    تصدير <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </span>
                </ActionButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-right">
                <DropdownMenuItem onClick={exportCSV}>
                  <FileSpreadsheet className="me-2 h-4 w-4" /> ملف Excel / CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF}>
                  <FileText className="me-2 h-4 w-4" /> تقرير PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ActionButton
              tone="surface"
              onClick={toggle}
              icon={masked ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            >
              {masked ? "إظهار الأرقام" : "إخفاء الأرقام"}
            </ActionButton>
            <ActionButton onClick={() => setOpenExpense(true)} icon={<Plus className="h-4 w-4" />}>
              إضافة مصروف
            </ActionButton>
          </>
        }
      />

      {/* شريط الفترات السريعة والفلترة */}
      <Reveal className="sticky-search-bar mb-6">
        <BezelCard variant="flat" innerClassName="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-[var(--hairline)] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-primary" /> فترات سريعة:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickDate("today")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-xl transition-all",
                    from === todayISO() && to === todayISO()
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate("yesterday")}
                  className="px-3 py-1 text-xs font-bold rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                >
                  أمس
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate("this-week")}
                  className="px-3 py-1 text-xs font-bold rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                >
                  هذا الأسبوع
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate("this-month")}
                  className="px-3 py-1 text-xs font-bold rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                >
                  هذا الشهر
                </button>
              </div>
            </div>

            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="press rounded-full px-3 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-[var(--hairline)] hover:text-foreground"
              >
                مسح الفلاتر
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-right">
              <MetricLabel className="mb-1.5 text-xs">من تاريخ</MetricLabel>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" className="text-numeric h-9 text-xs" />
            </label>
            <label className="block text-right">
              <MetricLabel className="mb-1.5 text-xs">إلى تاريخ</MetricLabel>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" className="text-numeric h-9 text-xs" />
            </label>
            <label className="block text-right">
              <MetricLabel className="mb-1.5 text-xs">بحث سريع</MetricLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="اسم العميل أو رقم الفاتورة"
                  className="pe-8 h-9 text-xs"
                />
              </div>
            </label>
            <label className="block text-right">
              <MetricLabel className="mb-1.5 text-xs">العميل</MetricLabel>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="كل العملاء" /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل العملاء</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-right">
              <MetricLabel className="mb-1.5 text-xs">نوع التعامل</MetricLabel>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل الأنواع (فوري + قسط)</SelectItem>
                  <SelectItem value="installment">قسط فقط</SelectItem>
                  <SelectItem value="cash">فوري فقط</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block text-right">
              <MetricLabel className="mb-1.5 text-xs">حالة الفاتورة</MetricLabel>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="paid">مسدّدة بالكامل</SelectItem>
                  <SelectItem value="partial">مسدّدة جزئياً</SelectItem>
                  <SelectItem value="unpaid">غير مسدّدة</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
        </BezelCard>
      </Reveal>

      {/* مؤشرات التدفق المالي — معادلة الدرج الصافية */}
      <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="إجمالي المبيعات المُصدرة"
          value={stats.sales}
          icon={Coins}
          tone="positive"
          masked={masked}
          series={stats.series.sales}
          format={money}
          sub={`${fmt(stats.count)} فاتورة في الفترة`}
        />

        <MetricCard
          label="التحصيلات الفعلية بالدرج"
          value={stats.totalCollectedActual}
          icon={ArrowDownRight}
          tone="positive"
          masked={masked}
          series={stats.series.paid}
          format={money}
          sub={`${fmt(periodPayments.length)} دفعة وقسط مُحصّل`}
        />

        <MetricCard
          label="المصروفات والمرتجعات"
          value={stats.periodExpenses + stats.periodReturnsTotal}
          icon={ArrowUpRight}
          tone="danger"
          masked={masked}
          format={money}
          sub={`${fmt(stats.periodExpenses)} مصروفات • ${fmt(stats.periodReturnsTotal)} مرتجع`}
        />

        <MetricCard
          label="صافي التدفق النقدي بالخزينة"
          value={stats.netCashDrawer}
          icon={Wallet}
          tone={stats.netCashDrawer >= 0 ? "positive" : "danger"}
          masked={masked}
          format={money}
          sub="التحصيلات - المصروفات - المرتجعات"
        />
      </div>

      {/* تفصيل المبيعات الفورية والأقساط */}
      <div className="stagger mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="مبيعات فوري" value={stats.cashSales} icon={Coins} tone="positive" masked={masked}
          series={stats.series.cashSales} format={money} sub={stats.cashSales ? "بيع نقدي" : "لا توجد مبيعات فورية"}
        />
        <MetricCard
          label="مبيعات قسط" value={stats.instSales} icon={Coins} tone="positive" masked={masked}
          series={stats.series.instSales} format={money} sub={stats.instSales ? "فواتير آجلة/قسط" : "لا توجد مبيعات أقساط"}
        />
        <MetricCard
          label="المتبقي على فواتير الفترة" value={stats.remaining} icon={Clock} tone={stats.remaining > 0 ? "danger" : "neutral"}
          masked={masked} series={stats.series.remaining} format={money} sub="مستحقات غير محصلة بعد"
        />
        <MetricCard
          label="عدد الفواتير" value={stats.count} icon={FileText} isMoney={false}
          series={stats.series.count} format={(n) => `${Math.round(n)} فاتورة`} sub="حركة الفواتير"
        />
      </div>

      {/* تبويبات تفصيل حركة اليومية */}
      <div className="mt-8 space-y-4 pb-24 lg:pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/50 border border-[var(--hairline)] rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab("invoices")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                activeTab === "invoices"
                  ? "bg-card text-foreground shadow-sm border border-[var(--hairline)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              فواتير الفترة ({rows.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("payments")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                activeTab === "payments"
                  ? "bg-card text-foreground shadow-sm border border-[var(--hairline)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              التحصيلات والأقساط المستلمة ({periodPayments.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("expenses")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                activeTab === "expenses"
                  ? "bg-card text-foreground shadow-sm border border-[var(--hairline)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Receipt className="h-3.5 w-3.5 text-warning" />
              المصروفات اليومية ({periodExpensesList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("returns")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                activeTab === "returns"
                  ? "bg-card text-foreground shadow-sm border border-[var(--hairline)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <RotateCcw className="h-3.5 w-3.5 text-danger" />
              المرتجعات ({periodReturnsList.length})
            </button>
          </div>

          <span className="text-xs font-medium text-muted-foreground font-mono">
            {rangeLabel}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          {/* Main Table Content */}
          <Reveal>
            <BezelCard variant="flat" innerClassName="overflow-hidden p-1.5">
              {/* TAB 1: INVOICES */}
              {activeTab === "invoices" && (
                <div className="no-scrollbar overflow-x-auto p-2 sm:p-3">
                  <table className="w-full min-w-[44rem] text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] text-[11px] font-bold text-muted-foreground">
                        <th className="p-3">رقم الفاتورة</th>
                        <th className="p-3">الوقت</th>
                        <th className="p-3">العميل</th>
                        <th className="p-3">الإجمالي</th>
                        <th className="p-3">المدفوع</th>
                        <th className="p-3">المتبقي</th>
                        <th className="p-3">النوع</th>
                        <th className="p-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-muted-foreground">
                            لا توجد فواتير صادرة في هذا النطاق الزمني
                          </td>
                        </tr>
                      ) : (
                        rows.map((inv) => {
                          const c = customerById.get(inv.customerId);
                          const st = statusMeta[invStatus(inv)];
                          const rem = Math.max(0, inv.total - inv.paid);
                          return (
                            <tr key={inv.id} className="hover:bg-foreground/[0.02] transition-colors">
                              <td className="p-3 font-mono font-bold text-muted-foreground" dir="ltr">
                                {invoiceNumber(invoices, inv.id)}
                              </td>
                              <td className="p-3 text-muted-foreground font-mono">
                                {new Date(inv.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="p-3 font-semibold text-foreground">{c?.name ?? "—"}</td>
                              <td className={cn("p-3 font-mono font-bold", masked && "privacy-blur")}>{money(inv.total)}</td>
                              <td className={cn("p-3 font-mono font-bold text-success", masked && "privacy-blur")}>{money(inv.paid)}</td>
                              <td className={cn("p-3 font-mono font-bold", rem > 0 ? "text-danger" : "text-muted-foreground", masked && "privacy-blur")}>
                                {money(rem)}
                              </td>
                              <td className="p-3"><CustomerTypeBadge type={c?.customerType ?? "installment"} /></td>
                              <td className="p-3">
                                <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1", st.cls)}>
                                  {st.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: PAYMENTS & INSTALLMENTS COLLECTED */}
              {activeTab === "payments" && (
                <div className="no-scrollbar overflow-x-auto p-2 sm:p-3">
                  <table className="w-full min-w-[36rem] text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] text-[11px] font-bold text-muted-foreground">
                        <th className="p-3">تاريخ ووقت التحصيل</th>
                        <th className="p-3">العميل</th>
                        <th className="p-3">رقم الفاتورة</th>
                        <th className="p-3">المبلغ المحصّل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {periodPayments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-muted-foreground">
                            لا توجد تحصيلات أو أقساط مسددة في هذه الفترة
                          </td>
                        </tr>
                      ) : (
                        periodPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-foreground/[0.02] transition-colors">
                            <td className="p-3 font-mono text-muted-foreground">
                              {new Date(p.paidAt).toLocaleDateString("ar-EG")} {new Date(p.paidAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="p-3 font-semibold text-foreground">
                              {p.customer?.name || "عميل غير محدد"}
                            </td>
                            <td className="p-3 font-mono font-semibold" dir="ltr">
                              {p.invoice ? invoiceNumber(invoices, p.invoice.id) : "—"}
                            </td>
                            <td className={cn("p-3 font-mono font-black text-success text-sm", masked && "privacy-blur")}>
                              +{money(p.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: EXPENSES LIST */}
              {activeTab === "expenses" && (
                <div className="no-scrollbar overflow-x-auto p-2 sm:p-3">
                  <table className="w-full min-w-[36rem] text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] text-[11px] font-bold text-muted-foreground">
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">التصنيف</th>
                        <th className="p-3">المبلغ</th>
                        <th className="p-3">ملاحظات وبيان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {periodExpensesList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-muted-foreground">
                            لا توجد مصروفات مسجلة في هذا النطاق الزمني
                          </td>
                        </tr>
                      ) : (
                        periodExpensesList.map((exp) => (
                          <tr key={exp.id} className="hover:bg-foreground/[0.02] transition-colors">
                            <td className="p-3 font-mono text-muted-foreground">{exp.expenseDate}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px]">
                                {expenseCategoryLabel(exp.category)}
                              </Badge>
                            </td>
                            <td className={cn("p-3 font-mono font-bold text-danger", masked && "privacy-blur")}>
                              -{money(exp.amount)}
                            </td>
                            <td className="p-3 text-muted-foreground">{exp.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 4: RETURNS LIST */}
              {activeTab === "returns" && (
                <div className="no-scrollbar overflow-x-auto p-2 sm:p-3">
                  <table className="w-full min-w-[36rem] text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] text-[11px] font-bold text-muted-foreground">
                        <th className="p-3">تاريخ المرتجع</th>
                        <th className="p-3">العميل / الفاتورة</th>
                        <th className="p-3">قيمة المرتجع</th>
                        <th className="p-3">سبب الارتجاع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {periodReturnsList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-muted-foreground">
                            لا توجد مرتجعات مسجلة في هذه الفترة
                          </td>
                        </tr>
                      ) : (
                        periodReturnsList.map((ret) => (
                          <tr key={ret.id} className="hover:bg-foreground/[0.02] transition-colors">
                            <td className="p-3 font-mono text-muted-foreground">
                              {new Date(ret.createdAt).toLocaleDateString("ar-EG")}
                            </td>
                            <td className="p-3 font-semibold text-foreground">
                              {ret.customer?.name || (ret.invoice ? invoiceNumber(invoices, ret.invoice.id) : "مرتجع بيع")}
                            </td>
                            <td className={cn("p-3 font-mono font-bold text-danger", masked && "privacy-blur")}>
                              -{money(ret.totalAmount)}
                            </td>
                            <td className="p-3 text-muted-foreground">{ret.reason || ret.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </BezelCard>
          </Reveal>

          {/* Right Side Summary & Note */}
          <Reveal delay={90}>
            <BezelCard variant="flat" innerClassName="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--hairline)] pb-3">
                <span className="text-numeric text-[11px] text-muted-foreground font-mono" dir="ltr">{from} — {to}</span>
                <h2 className="text-base font-bold text-foreground">كشف تسوية الخزينة</h2>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center p-2 rounded-xl bg-background/50 border border-[var(--hairline)]">
                  <span className="text-muted-foreground">إجمالي المبيعات المصدرة:</span>
                  <strong className={cn("font-mono text-foreground", masked && "privacy-blur")}>
                    {money(stats.sales)}
                  </strong>
                </div>

                <div className="flex justify-between items-center p-2 rounded-xl bg-success/5 border border-success/20">
                  <span className="text-success font-bold">التحصيلات والأقساط المستلمة:</span>
                  <strong className={cn("font-mono text-success text-sm font-black", masked && "privacy-blur")}>
                    +{money(stats.totalCollectedActual)}
                  </strong>
                </div>

                <div className="flex justify-between items-center p-2 rounded-xl bg-danger/5 border border-danger/20">
                  <span className="text-danger">المصروفات النقدية المسحوبة:</span>
                  <strong className={cn("font-mono text-danger", masked && "privacy-blur")}>
                    -{money(stats.periodExpenses)}
                  </strong>
                </div>

                {stats.periodReturnsTotal > 0 && (
                  <div className="flex justify-between items-center p-2 rounded-xl bg-danger/5 border border-danger/20">
                    <span className="text-danger">مرتجعات مبيعات نقدية:</span>
                    <strong className={cn("font-mono text-danger", masked && "privacy-blur")}>
                      -{money(stats.periodReturnsTotal)}
                    </strong>
                  </div>
                )}

                <div className="flex justify-between items-center p-3 rounded-xl bg-primary/10 border border-primary/30 pt-3">
                  <span className="font-bold text-foreground">صافي رصيد الخزينة بالدرج:</span>
                  <strong className={cn("font-mono text-base font-black text-primary", masked && "privacy-blur")}>
                    {money(stats.netCashDrawer)}
                  </strong>
                </div>
              </div>

              <div className="border-t border-[var(--hairline)] pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground">تُحفَظ محلياً تلقائياً</span>
                  <h3 className="text-xs font-bold text-foreground">ملاحظة اليوم واليومية</h3>
                </div>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="سجل ملاحظات أو أحداث اليوم أو جرد العهدة هنا..."
                  className="mt-2 text-xs resize-none"
                />
                <div className="mt-2.5 flex justify-end">
                  <Button size="sm" variant="secondary" onClick={saveNote} className="rounded-xl text-xs font-bold">
                    حفظ الملاحظة
                  </Button>
                </div>
              </div>
            </BezelCard>
          </Reveal>
        </div>
      </div>

      <AddExpenseDialog open={openExpense} onOpenChange={setOpenExpense} defaultDate={from || todayISO()} />
    </>
  );
}

function AddExpenseDialog({
  open, onOpenChange, defaultDate,
}: { open: boolean; onOpenChange: (v: boolean) => void; defaultDate: string }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [date, setDate] = useState(defaultDate);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setAmount(""); setCategory("other"); setDate(defaultDate); setNotes(""); } }, [open, defaultDate]);

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) { toast.error("أدخل مبلغ صحيح"); return; }
    setSaving(true);
    try {
      await db.addExpense({ amount: n, category, expenseDate: date, notes: notes.trim() || null });
      toast.success("تم تسجيل المصروف بنجاح");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "خطأ في تسجيل المصروف");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="text-right sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-end gap-2 text-base font-bold">
            إضافة مصروف جديد <Receipt className="h-4 w-4 text-primary" />
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">المبلغ (ج.م)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className="h-9 text-xs" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">التصنيف</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{expenseCategoryLabel(c.value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">التاريخ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className="h-9 text-xs" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">ملاحظات وبيان الصرف</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="بيان تفصيلي للمصروف..." className="resize-none text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} className="rounded-xl text-xs font-bold">
            {saving ? "جاري الحفظ..." : "حفظ المصروف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
