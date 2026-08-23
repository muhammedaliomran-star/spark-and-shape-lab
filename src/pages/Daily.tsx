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
  Coins, Wallet, CheckCircle2, ChevronDown, CalendarDays,
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
  const { invoices, customers, expenses } = useDB();
  const { privacy, toggle } = usePrivacy();
  const masked = privacy;

  const [from, setFrom] = useState(todayISO);
  const [to, setTo] = useState(todayISO);
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState<"all" | string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [openExpense, setOpenExpense] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    try { setNote(localStorage.getItem(noteKey(from)) ?? ""); } catch { setNote(""); }
  }, [from]);

  const customerById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );

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

  const stats = useMemo(() => {
    let sales = 0, cashSales = 0, instSales = 0;
    let paid = 0, cashPaid = 0, instPaid = 0;

    // شبكة زمنية للـ sparklines: بالساعة لو يوم واحد، وبالأيام لو فترة.
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
      paid += inv.paid;
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

    const periodExpenses = expenses
      .filter((e) => (!from || e.expenseDate >= from) && (!to || e.expenseDate <= to))
      .reduce((s, e) => s + e.amount, 0);
    return {
      count: rows.length,
      sales, cashSales, instSales,
      paid, cashPaid, instPaid,
      remaining: Math.max(0, sales - paid),
      periodExpenses,
      net: paid - periodExpenses,
      series: {
        count: sCount, sales: sSales, cashSales: sCashSales, instSales: sInstSales,
        paid: sPaid, cashPaid: sCashPaid, instPaid: sInstPaid, remaining: sRemaining,
      },
    };
  }, [rows, customerById, expenses, from, to]);

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
    ? new Date(from || todayISO()).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })
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
        <p>إجمالي المبيعات: ${fmt(stats.sales)} ج.م — المحصّل: ${fmt(stats.paid)} ج.م — المصروفات: ${fmt(stats.periodExpenses)} ج.م — الصافي: ${fmt(stats.net)} ج.م</p>
      `,
    });
    openPdfDocument(html);
  };

  return (
    <>
      <PageHeader
        eyebrow="تشغيل يومي • آخر تحديث الآن"
        title="اليومية"
        subtitle={`${rangeLabel} — ملخص الحركة المالية والملاحظات في مكان واحد.`}
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

      {/* فلترة */}
      <Reveal className="sticky-search-bar mb-8">
        <BezelCard variant="flat" innerClassName="p-5 sm:p-6">
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="order-2 flex min-w-0 items-center justify-end gap-2">
              <span className="truncate text-sm font-bold text-foreground">فلترة اليومية</span>
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="press order-1 justify-self-start rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-[var(--hairline)] hover:text-foreground"
              >
                مسح الفلاتر
              </button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-right">
                <MetricLabel className="mb-2">من تاريخ</MetricLabel>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" className="text-numeric" />
              </label>
              <label className="block text-right">
                <MetricLabel className="mb-2">إلى تاريخ</MetricLabel>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" className="text-numeric" />
              </label>
            </div>
            <div className="block text-right">
              <MetricLabel className="mb-2">بحث</MetricLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="اسم العميل أو رقم الفاتورة"
                  className="pe-10"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block text-right">
              <MetricLabel className="mb-2">العميل</MetricLabel>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="كل العملاء" /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل العملاء</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block text-right">
              <MetricLabel className="mb-2">النوع</MetricLabel>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  <SelectItem value="installment">قسط</SelectItem>
                  <SelectItem value="cash">فوري</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block text-right">
              <MetricLabel className="mb-2">الحالة</MetricLabel>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="paid">مسدّدة</SelectItem>
                  <SelectItem value="partial">جزئي</SelectItem>
                  <SelectItem value="unpaid">غير مسدّدة</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
        </BezelCard>
      </Reveal>

      {/* مؤشرات — الطبقة الأولى: بطل + مرافقين */}
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          className="sm:col-span-2"
          label="إجمالي المبيعات" value={stats.sales} icon={Coins} tone="positive" masked={masked}
          hero series={stats.series.sales} format={money}
          sub={stats.sales ? `${fmt(stats.count)} فاتورة — قيمة الفواتير المُصدَرة في الفترة` : "لا توجد مبيعات في الفترة"}
        />
        <MetricCard
          label="المدفوع" value={stats.paid} icon={CheckCircle2} tone="positive" masked={masked}
          series={stats.series.paid} format={money}
          sub={stats.paid ? "المحصّل فعليًا" : "لا توجد تحصيلات في الفترة"}
        />
        <MetricCard
          label="المتبقي" value={stats.remaining} icon={Wallet} tone={stats.remaining > 0 ? "danger" : "neutral"}
          masked={masked} series={stats.series.remaining} format={money}
          sub={stats.remaining ? "مستحق على العملاء" : "لا توجد مستحقات في الفترة"}
        />
      </div>

      {/* مؤشرات — الطبقة الثانية: التفصيل */}
      <div className="stagger mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="الفواتير" value={stats.count} icon={FileText} isMoney={false}
          series={stats.series.count}
          format={(n) => String(Math.round(n))}
          sub={stats.count ? "فاتورة في الفترة" : "لا توجد حركة في الفترة"}
        />
        <MetricCard
          label="مبيعات الفوري" value={stats.cashSales} icon={Coins} tone="positive" masked={masked}
          series={stats.series.cashSales}
          format={money} sub={stats.cashSales ? "بيع نقدي كامل" : "لا توجد مبيعات فورية"}
        />
        <MetricCard
          label="مبيعات القسط" value={stats.instSales} icon={Coins} tone="positive" masked={masked}
          series={stats.series.instSales}
          format={money} sub={stats.instSales ? "فواتير بالأقساط" : "لا توجد مبيعات بالأقساط"}
        />
        <MetricCard
          label="مدفوع فوري" value={stats.cashPaid} icon={CheckCircle2} tone="positive" masked={masked}
          series={stats.series.cashPaid}
          format={money} sub={stats.cashPaid ? "تحصيل نقدي" : "لا يوجد تحصيل فوري"}
        />
        <MetricCard
          label="مدفوع القسط" value={stats.instPaid} icon={CheckCircle2} tone="positive" masked={masked}
          series={stats.series.instPaid}
          format={money} sub={stats.instPaid ? "مقدمات وأقساط محصّلة" : "لا توجد أقساط محصّلة"}
        />
      </div>

      {/* الحركة + النبذة */}
      <div className="mt-8 grid gap-4 pb-24 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:pb-8">
        <Reveal>
          <BezelCard variant="flat" innerClassName="overflow-hidden p-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 p-6 sm:p-8">
              <span className="order-2 rounded-full bg-foreground/[0.06] px-4 py-1.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-[var(--hairline)]">
                {rangeLabel}
              </span>
              <div className="order-1 min-w-0 text-right">
                <h2 className="truncate text-lg font-bold text-foreground">حركة الفترة</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">{fmt(stats.count)} فاتورة مطابقة</p>
              </div>
            </div>

          <div className="no-scrollbar overflow-x-auto border-t border-[var(--hairline)] px-2 sm:px-3">
            <table className="w-full min-w-[46rem] text-right text-sm">
              <thead>
                <tr className="border-b border-[var(--hairline)] text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-6 py-6 font-bold">رقم</th>
                  <th className="px-6 py-6 font-bold">الوقت</th>
                  <th className="px-6 py-6 font-bold">العميل</th>
                  <th className="px-6 py-6 font-bold">الإجمالي</th>
                  <th className="px-6 py-6 font-bold">مدفوع</th>
                  <th className="px-6 py-6 font-bold">متبقي</th>
                  <th className="px-6 py-6 font-bold">نوع</th>
                  <th className="px-6 py-6 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-2">
                      <EmptyState
                        icon={FileText}
                        title="لا توجد حركة مسجلة في هذه الفترة"
                        hint={
                          filtersActive
                            ? "الفلاتر الحالية بتستبعد كل الحركة — امسحها أو وسّع نطاق التاريخ."
                            : "وسّع نطاق التاريخ أو ابدأ بتسجيل أول حركة في الفترة."
                        }
                        action={
                          filtersActive ? (
                            <ActionButton tone="surface" onClick={resetFilters}>
                              مسح الفلاتر
                            </ActionButton>
                          ) : undefined
                        }
                      />

                    </td>
                  </tr>
                ) : (
                  rows.map((inv) => {
                    const c = customerById.get(inv.customerId);
                    const st = statusMeta[invStatus(inv)];
                    const rem = Math.max(0, inv.total - inv.paid);
                    return (
                      <tr key={inv.id} className="border-b border-[var(--hairline)] transition-colors last:border-0 hover:bg-foreground/[0.03]">
                        <td className="p-4 font-semibold text-muted-foreground" dir="ltr">{invoiceNumber(invoices, inv.id)}</td>
                        <td className="p-4 text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-4 font-semibold text-foreground">{c?.name ?? "—"}</td>
                        <td className={cn("p-4 text-numeric font-bold", masked && "privacy-blur")}>{money(inv.total)}</td>
                        <td className={cn("p-4 text-numeric font-bold text-success", masked && "privacy-blur")}>{money(inv.paid)}</td>
                        <td className={cn("p-4 text-numeric font-bold", rem > 0 ? "text-danger" : "text-muted-foreground", masked && "privacy-blur")}>{money(rem)}</td>
                        <td className="p-4"><CustomerTypeBadge type={c?.customerType ?? "installment"} /></td>
                        <td className="p-4">
                          <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ring-1", st.cls)}>
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
          </BezelCard>
        </Reveal>

        <Reveal delay={90}>
        <BezelCard variant="flat" innerClassName="flex flex-col gap-5 p-6 sm:p-8">

          <div className="flex items-start justify-between gap-3">
            <span className="text-numeric text-[11px] text-muted-foreground" dir="ltr">{from} — {to}</span>
            <h2 className="text-lg font-bold text-foreground">نبذة الفترة</h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-x-reverse divide-border/30">
            <div className="p-5 text-right">
              <MetricLabel>مصروفات الفترة</MetricLabel>
              <div className={cn("text-numeric mt-2 text-xl font-extrabold text-warning", masked && "privacy-blur")}>
                {money(stats.periodExpenses)}
              </div>
            </div>
            <div className="p-5 text-right">
              <MetricLabel>الصافي</MetricLabel>
              <div className={cn("text-numeric mt-2 text-xl font-extrabold", stats.net >= 0 ? "text-success" : "text-danger", masked && "privacy-blur")}>
                {money(stats.net)}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--hairline)] pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">تُحفَظ محليًا حسب التاريخ</span>
              <h3 className="text-sm font-bold text-foreground">ملاحظة اليوم</h3>
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              placeholder="سجل ملاحظات أو أحداث اليوم هنا..."
              className="mt-3 resize-none"
            />
            <div className="mt-3 flex justify-start">
              <Button variant="secondary" onClick={saveNote} className="rounded-full">حفظ الملاحظة</Button>
            </div>
          </div>
        </BezelCard>
        </Reveal>

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
      toast.success("تم تسجيل المصروف");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "خطأ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="text-right sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-end gap-2">
            إضافة مصروف <Receipt className="h-4 w-4 text-primary" />
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>المبلغ</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" />
          </div>
          <div className="grid gap-2">
            <Label>التصنيف</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{expenseCategoryLabel(c.value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>التاريخ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
          </div>
          <div className="grid gap-2">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} className="rounded-full">
            {saving ? "جاري الحفظ..." : "حفظ المصروف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
