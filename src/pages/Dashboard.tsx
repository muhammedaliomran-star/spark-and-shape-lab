import { PageTransition } from "@/components/PageTransition";
import { usePrivacy } from "@/lib/privacy";
import { Link } from "@/lib/router-compat";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CardsSkeleton, BlockSkeleton } from "@/components/LoadingSkeletons";
import { BezelCard } from "@/components/BezelCard";
import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { Sparkline } from "@/components/Sparkline";
import { MetricCard, MetricLabel } from "@/components/MetricCard";
import { ChartEmpty } from "@/components/ChartEmpty";
import {
  useDB,
  daysLate,
  fmt,
  customerBalance,
  expenseCategoryLabel,
  supplierBalance,
} from "@/lib/store";
import { roundCurrency } from "@/lib/financial-engine";
import { QuickActionsFab } from "@/components/QuickActionsFab";
import {
  Users,
  AlertCircle,
  Wallet,
  TrendingUp,
  FileText,
  ArrowLeft,
  Eye,
  EyeOff,
  CalendarCheck,
  PiggyBank,
  Phone,
  Sparkles,
  AlertTriangle,
  Receipt,
  Truck,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function Page() {
  return (
    <AppShell>
        <PageTransition>
          <Dashboard />
        </PageTransition>
      </AppShell>
  );
}

const EMERALD = "oklch(0.68 0.11 162)";
const DANGER = "oklch(0.65 0.18 28)";
const WARNING = "oklch(0.75 0.16 70)";
const MUTED = "oklch(0.55 0.01 270)";

const TOOLTIP_STYLE = {
  background: "oklch(0.21 0.006 270)",
  border: "1px solid oklch(0.3 0.008 270)",
  borderRadius: "0.85rem",
  direction: "rtl" as const,
  boxShadow: "0 18px 45px -22px rgba(0,0,0,0.8)",
};

/** رأس قسم موحّد: عنوان يمين + بيان/إجراء شمال. */
function SectionHead({
  title,
  icon,
  aside,
}: {
  title: string;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0 order-2 text-right">
        <h2 className="text-display flex items-center justify-end gap-2 text-xl font-extrabold sm:text-2xl">
          <span className="truncate">{title}</span>
          {icon && <span className="shrink-0">{icon}</span>}
        </h2>
      </div>
      <div className="order-1 shrink-0">{aside}</div>
    </div>
  );
}

export function Dashboard() {
  const data = useDB();
  const { privacy, toggle } = usePrivacy();
  const m = (s: string) => (privacy ? "•••••" : s);

  const today = new Date();

  // ---- Summary stats ----
  const totalDebt =
    data.invoices.reduce((s, i) => s + (i.total - i.paid), 0) +
    data.customers.reduce((s, c) => s + (c.openingBalance || 0), 0);

  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const dailyCollections = data.payments
    .filter((p) => isToday(new Date(p.paidAt)))
    .reduce((s, p) => s + p.amount, 0);

  const monthCollected = data.payments
    .filter((p) => {
      const d = new Date(p.paidAt);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    })
    .reduce((s, p) => s + p.amount, 0);

  // Profit uses recorded invoice line costs; unknown legacy costs remain unknown, never estimated.
  const { monthlyNetProfit, monthGrossProfit, monthExpenses, monthCashPurchases, incompleteCostCount } = useMemo(() => {
    const expenses = data.expenses
      .filter((e) => {
        const d = new Date(e.expenseDate);
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      })
      .reduce((s, e) => s + e.amount, 0);
    const cashPurchases = data.purchases
      .filter((p) => {
        if (p.paymentType !== "cash") return false;
        const d = new Date(p.purchaseDate);
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      })
      .reduce((s, p) => s + p.total, 0);
    
    const monthInvoices = data.invoices.filter((invoice) => {
      const date = new Date(invoice.createdAt);
      return invoice.status !== "cancelled" && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    });
    const invoiceIds = new Set(monthInvoices.map((invoice) => invoice.id));
    const sales = monthInvoices.reduce((sum, invoice) => sum + invoice.total - (invoice.taxAmount ?? 0), 0);
    const monthItems = data.invoiceItems.filter((item) => invoiceIds.has(item.invoiceId));
    const itemsByInvoice = new Map<string, typeof monthItems>();
    for (const item of monthItems) itemsByInvoice.set(item.invoiceId, [...(itemsByInvoice.get(item.invoiceId) ?? []), item]);
    const incomplete = monthInvoices.filter((invoice) => {
      const items = itemsByInvoice.get(invoice.id) ?? [];
      return items.length === 0 || items.some((item) => !Number.isFinite(item.cost) || item.cost <= 0);
    });
    const cogs = monthItems
      .filter((item) => !incomplete.some((invoice) => invoice.id === item.invoiceId))
      .reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const returns = data.returns
      .filter((item) => item.type === "sale" && (() => { const date = new Date(item.createdAt); return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(); })())
      .reduce((sum, item) => sum + item.totalAmount, 0);
    const grossProfit = roundCurrency(sales - cogs - returns);
    return {
      monthlyNetProfit: roundCurrency(grossProfit - expenses - cashPurchases),
      monthGrossProfit: grossProfit,
      monthExpenses: expenses,
      monthCashPurchases: cashPurchases,
      incompleteCostCount: incomplete.length,
    };
  }, [data.expenses, data.purchases, data.invoices, data.invoiceItems, data.returns, monthCollected, today]);

  const activeCustomers = data.customers.filter((c) => !c.frozen).length;
  const frozenCustomers = data.customers.length - activeCustomers;

  // ---- Month buckets for sparklines (last 6 months) ----
  const monthBuckets = useMemo(() => {
    const keys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${d.getMonth()}`);
    }
    const idxOf = (iso: string) => {
      const d = new Date(iso);
      return keys.indexOf(`${d.getFullYear()}-${d.getMonth()}`);
    };
    const zero = () => keys.map(() => 0);

    const payments = zero();
    for (const p of data.payments) {
      const i = idxOf(p.paidAt);
      if (i >= 0) payments[i] += p.amount;
    }
    const invoiced = zero();
    for (const inv of data.invoices) {
      const i = idxOf(inv.createdAt);
      if (i >= 0) invoiced[i] += inv.total;
    }
    const expenses = zero();
    for (const e of data.expenses) {
      const i = idxOf(e.expenseDate);
      if (i >= 0) expenses[i] += e.amount;
    }
    const cashPurchases = zero();
    const creditPurchases = zero();
    for (const p of data.purchases) {
      const i = idxOf(p.purchaseDate);
      if (i < 0) continue;
      if (p.paymentType === "cash") cashPurchases[i] += p.total;
      else creditPurchases[i] += p.total;
    }
    const supplierPaid = zero();
    for (const sp of data.supplierPayments) {
      const i = idxOf(sp.paidAt);
      if (i >= 0) supplierPaid[i] += sp.amount;
    }
    const joins = zero();
    for (const c of data.customers) {
      const i = idxOf(c.joiningDate || c.createdAt);
      if (i >= 0) joins[i] += 1;
    }

    // Cumulative debt trend, anchored so the last point equals the live total
    const netPerMonth = keys.map((_, i) => invoiced[i] - payments[i]);
    const debtRunning: number[] = [];
    let acc = 0;
    for (const n of netPerMonth) {
      acc += n;
      debtRunning.push(acc);
    }
    const shift = totalDebt - (debtRunning[debtRunning.length - 1] ?? 0);
    const debtTrend = debtRunning.map((v) => Math.max(0, v + shift));

    const supplierRunning: number[] = [];
    let sacc = 0;
    for (let i = 0; i < keys.length; i++) {
      sacc += creditPurchases[i] - supplierPaid[i];
      supplierRunning.push(Math.max(0, sacc));
    }

    const profitTrend = keys.map(
      (_, i) => Math.round(payments[i] * 0.25) - expenses[i] - cashPurchases[i],
    );

    const customersRunning: number[] = [];
    let cacc = Math.max(0, data.customers.length - joins.reduce((s, x) => s + x, 0));
    for (const j of joins) {
      cacc += j;
      customersRunning.push(cacc);
    }

    return {
      payments,
      expenses,
      cashPurchases,
      debtTrend,
      supplierTrend: supplierRunning,
      profitTrend,
      customersTrend: customersRunning,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.payments,
    data.invoices,
    data.expenses,
    data.purchases,
    data.supplierPayments,
    data.customers,
    totalDebt,
  ]);

  // ---- Expense breakdown (this month) ----
  const expenseBreakdown = useMemo(() => {
    const by = new Map<string, number>();
    for (const e of data.expenses) {
      const d = new Date(e.expenseDate);
      if (d.getMonth() !== today.getMonth() || d.getFullYear() !== today.getFullYear()) continue;
      by.set(e.category, (by.get(e.category) ?? 0) + e.amount);
    }
    const colors = [EMERALD, WARNING, DANGER, "oklch(0.6 0.15 240)", "oklch(0.7 0.18 320)"];
    return Array.from(by.entries()).map(([cat, value], i) => ({
      name: expenseCategoryLabel(cat as never),
      value,
      color: colors[i % colors.length],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.expenses]);
  const totalMonthExpenses = expenseBreakdown.reduce((s, x) => s + x.value, 0);

  // ---- Collection trends (last 6 months) ----
  const trendData = useMemo(() => {
    const months: { key: string; label: string; total: number | null; forecast: number | null }[] =
      [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      months.push({ key, label, total: 0, forecast: null });
    }
    for (const p of data.payments) {
      const d = new Date(p.paidAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const slot = months.find((mm) => mm.key === key);
      if (slot) slot.total = (slot.total ?? 0) + p.amount;
    }

    // Predict next month based on upcoming installment due dates + 6-month avg
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextKey = `${next.getFullYear()}-${next.getMonth()}`;
    let expected = 0;
    for (const inv of data.invoices) {
      const remaining = inv.total - inv.paid;
      if (remaining <= 0) continue;
      const due = new Date(inv.firstDueDate);
      const sameMonth =
        due.getFullYear() === next.getFullYear() && due.getMonth() === next.getMonth();
      const overdue = due < today;
      if (sameMonth || overdue) {
        expected += Math.min(inv.monthlyInstallment || remaining, remaining);
      }
    }
    const avg = months.reduce((s, mm) => s + (mm.total ?? 0), 0) / 6;
    const forecast = Math.round(expected * 0.85 + avg * 0.15);
    const lastReal = months[months.length - 1];
    lastReal.forecast = lastReal.total;
    months.push({
      key: nextKey,
      label: next.toLocaleDateString("en-US", { month: "short" }) + " (متوقع)",
      total: null,
      forecast,
    });
    return months;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.payments, data.invoices]);

  const hasTrendData = data.payments.length > 0;

  // ---- Debt status doughnut ----
  const statusData = useMemo(() => {
    let committed = 0,
      neutral = 0,
      defaulter = 0;
    for (const c of data.customers) {
      if (c.status === "committed") committed++;
      else if (c.status === "defaulter") defaulter++;
      else neutral++;
    }
    return [
      { name: "ملتزم", value: committed, color: EMERALD },
      { name: "متأخر", value: neutral, color: WARNING },
      { name: "متعثر", value: defaulter, color: DANGER },
    ];
  }, [data.customers]);

  const hasStatusData = data.customers.length > 0;

  // ---- Due today ----
  const dueToday = useMemo(() => {
    const dom = today.getDate();
    return data.invoices
      .filter((i) => i.total > i.paid)
      .filter((i) => {
        const c = data.customers.find((cc) => cc.id === i.customerId);
        if (!c) return false;
        return c.dueDay === dom || daysLate(i) > 0;
      })
      .map((i) => {
        const c = data.customers.find((cc) => cc.id === i.customerId);
        const remaining = i.total - i.paid;
        const due = Math.min(i.monthlyInstallment || remaining, remaining);
        return { inv: i, customer: c, due, late: daysLate(i) };
      })
      .sort((a, b) => b.late - a.late)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.invoices, data.customers]);

  const totalDueToday = dueToday.reduce((s, x) => s + x.due, 0);

  // ---- At-risk customers (top 5 overdue balances) ----
  const atRiskCustomers = useMemo(() => {
    return data.customers
      .map((c) => {
        const bal = customerBalance(data.invoices, c.id, c.openingBalance);
        const overdueInvs = data.invoices.filter((i) => i.customerId === c.id && daysLate(i) > 0);
        const maxLate = overdueInvs.reduce((mx, i) => Math.max(mx, daysLate(i)), 0);
        return { customer: c, balance: bal, maxLate, overdueCount: overdueInvs.length };
      })
      .filter((x) => x.maxLate > 0 && x.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
  }, [data.customers, data.invoices]);

  // ---- Smart insights ----
  const insights = useMemo(() => {
    const out: { text: string; tone: "success" | "warning" | "danger" | "info" }[] = [];
    const now = Date.now();
    const weekMs = 7 * 86400000;
    const sumRange = (from: number, to: number) =>
      data.payments
        .filter((p) => {
          const t = new Date(p.paidAt).getTime();
          return t >= from && t < to;
        })
        .reduce((s, p) => s + p.amount, 0);
    const thisWeek = sumRange(now - weekMs, now);
    const lastWeek = sumRange(now - 2 * weekMs, now - weekMs);
    if (lastWeek > 0) {
      const diff = ((thisWeek - lastWeek) / lastWeek) * 100;
      if (Math.abs(diff) >= 5) {
        out.push({
          text:
            diff > 0
              ? `التحصيلات ارتفعت ${Math.round(diff)}% مقارنة بالأسبوع اللي فات`
              : `التحصيلات انخفضت ${Math.abs(Math.round(diff))}% مقارنة بالأسبوع اللي فات`,
          tone: diff > 0 ? "success" : "warning",
        });
      }
    } else if (thisWeek > 0) {
      out.push({ text: `حصّلت ${fmt(thisWeek)} ج.م خلال آخر 7 أيام`, tone: "success" });
    }

    const dom = today.getDate();
    const dueTodayCount = data.invoices.filter((i) => {
      if (i.paid >= i.total) return false;
      const c = data.customers.find((cc) => cc.id === i.customerId);
      return c && c.dueDay === dom && daysLate(i) === 0;
    }).length;
    if (dueTodayCount > 0) {
      out.push({ text: `${dueTodayCount} فاتورة بتستحق التحصيل النهاردة`, tone: "warning" });
    }

    const defaulters = data.customers.filter((c) => c.status === "defaulter").length;
    if (defaulters > 0) {
      out.push({ text: `عندك ${defaulters} عميل متعثر — راجع قائمة المتابعة`, tone: "danger" });
    }

    if (atRiskCustomers.length >= 3) {
      out.push({
        text: `${atRiskCustomers.length} عملاء يحتاجوا متابعة عاجلة بإجمالي ${fmt(atRiskCustomers.reduce((s, x) => s + x.balance, 0))} ج.م`,
        tone: "info",
      });
    }

    if (out.length === 0) {
      out.push({ text: "كل حاجة تمام — مفيش تنبيهات حالياً", tone: "success" });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.payments, data.invoices, data.customers, atRiskCustomers]);

  const totalSupplierDebt = data.suppliers.reduce(
    (s, sup) =>
      s +
      Math.max(
        0,
        supplierBalance(data.purchases, data.supplierPayments, sup.id, sup.openingBalance),
      ),
    0,
  );

  const money = (n: number) => (privacy ? "•••••" : `${fmt(n)} ج.م`);
  const plain = (n: number) => (privacy ? "•••" : fmt(n));

  // هيكل تحميل بدل ما الصفحة ترسم «لا توجد بيانات» قبل وصول البيانات.
  if (data.loading && data.invoices.length === 0 && data.customers.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Live overview"
          title="لوحة التحكم الرئيسية"
          subtitle="بنجهّز بياناتك دلوقتي…"
        />
        <section className="mb-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CardsSkeleton count={4} height="h-36" />
        </section>
        <section className="mb-14 grid gap-4 lg:grid-cols-3">
          <BlockSkeleton className="h-72 lg:col-span-2" />
          <BlockSkeleton className="h-72" />
        </section>
        <section className="grid gap-4 lg:grid-cols-3">
          <BlockSkeleton className="h-60" />
          <BlockSkeleton className="h-60" />
          <BlockSkeleton className="h-60" />
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Live overview"
        title="لوحة التحكم الرئيسية"
        subtitle="نظرة شاملة على أداء التحصيل وحركة الديون."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              title="إخفاء الأرقام"
              className={cn(
                "island-btn group ring-1",
                privacy
                  ? "bg-foreground/[0.08] text-foreground ring-foreground/15"
                  : "bg-transparent text-muted-foreground ring-border hover:text-foreground",
              )}
            >
              <span className="hidden sm:inline">
                {privacy ? "إظهار الأرقام" : "إخفاء الأرقام"}
              </span>
              <span className="island-btn-icon">
                {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </span>
            </button>
            <Link
              to="/customers"
              className="island-btn group bg-transparent text-muted-foreground ring-1 ring-border hover:text-foreground"
            >
              <span>العملاء</span>
              <span className="island-btn-icon">
                <Users className="h-4 w-4" />
              </span>
            </Link>
            <Link to="/invoices" className="island-btn group bg-primary text-primary-foreground">
              <span>الفواتير</span>
              <span className="island-btn-icon">
                <FileText className="h-4 w-4" />
              </span>
            </Link>
          </div>
        }
      />

      {/* ============ Bento: مؤشرات غير متماثلة ============ */}
      <section className="mb-14">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:auto-rows-fr">
          {/* البطل: إجمالي الديون 2×2 */}
          <Reveal className="col-span-2 h-full lg:row-span-2" delay={0}>
            <MetricCard
              hero
              className="h-full"
              label="إجمالي الديون الخارجية"
              value={totalDebt}
              format={money}
              masked={privacy}
              tone="neutral"
              icon={Wallet}
              series={monthBuckets.debtTrend}
              sub={
                <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
                  <span>موزعة على {data.customers.length} عميل</span>
                  <span className="h-3 w-px bg-border" />
                  <span>{data.invoices.length} فاتورة مسجلة</span>
                </span>
              }
            />
          </Reveal>

          <Reveal className="h-full" delay={70}>
            <MetricCard
              className="h-full"
              label="ديون الموردين"
              value={totalSupplierDebt}
              format={money}
              masked={privacy}
              tone="neutral"
              icon={Truck}
              series={monthBuckets.supplierTrend}
              sub={`${data.suppliers.length} مورد مسجل`}
            />
          </Reveal>

          <Reveal className="h-full" delay={140}>
            <MetricCard
              className="h-full"
              label="تحصيل اليوم"
              value={dailyCollections}
              format={money}
              masked={privacy}
              tone={dailyCollections > 0 ? "positive" : "neutral"}
              icon={CalendarCheck}
              series={monthBuckets.payments}
              sub={today.toLocaleDateString("en-US", { day: "2-digit", month: "long" })}
            />
          </Reveal>

          <Reveal className="h-full" delay={210}>
            <MetricCard
              className="h-full"
              label="صافي أرباح الشهر"
              value={monthlyNetProfit}
              format={money}
              masked={privacy}
              tone={monthlyNetProfit > 0 ? "positive" : monthlyNetProfit < 0 ? "danger" : "neutral"}
              icon={PiggyBank}
              series={monthBuckets.profitTrend}
              sub={incompleteCostCount > 0 ? `${incompleteCostCount} فاتورة بيانات تكلفتها غير مكتملة` : `أرباح ${m(fmt(monthGrossProfit))} − مصروفات ${m(fmt(monthExpenses))}`}
            />
          </Reveal>

          <Reveal className="h-full" delay={280}>
            <MetricCard
              className="h-full"
              label="مشتريات نقدية"
              value={monthCashPurchases}
              format={money}
              masked={privacy}
              tone={monthCashPurchases > 0 ? "danger" : "neutral"}
              icon={Banknote}
              series={monthBuckets.cashPurchases}
              sub="مخصومة من الخزينة"
            />
          </Reveal>
        </div>

        {/* شريط عريض هادي: العملاء */}
        <Reveal delay={340}>
          <BezelCard variant="flat"
            className="mt-4 bezel-lift"
            innerClassName="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 p-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)_auto]"
          >
            <div className="order-2 flex items-center gap-4 md:order-3">
              <div className="text-right">
                <MetricLabel>العملاء النشطين</MetricLabel>
                <div
                  className={cn(
                    "text-numeric mt-2 text-3xl font-extrabold leading-none",
                    privacy && "privacy-blur",
                  )}
                >
                  <CountUp value={activeCustomers} duration={1200} format={plain} />
                  <span className="ms-1 text-base font-bold text-muted-foreground">
                    / {data.customers.length}
                  </span>
                </div>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-muted-foreground ring-1 ring-foreground/10">
                <Users className="h-5 w-5" />
              </span>
            </div>

            <div className="order-3 hidden min-w-0 text-muted-foreground md:order-2 md:block">
              <Sparkline data={monthBuckets.customersTrend} height={44} area={false} />
            </div>

            <div className="order-1 flex shrink-0 flex-wrap items-center gap-2 md:order-1">
              <span className="rounded-full bg-foreground/[0.05] px-3 py-1.5 text-[11px] font-bold text-muted-foreground ring-1 ring-border">
                {frozenCustomers} مجمّد
              </span>
              <Link
                to="/customers"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3.5 py-1.5 text-[11px] font-bold text-foreground ring-1 ring-border transition-[background-color,color,transform] hover:bg-foreground/[0.10] active:scale-[0.98]"
              >
                إدارة العملاء <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </div>
          </BezelCard>
        </Reveal>
      </section>

      {/* ============ توصيات ذكية ============ */}
      <Reveal className="mb-14 block">
        <section>
          <SectionHead
            title="توصيات ذكية"
            icon={<Sparkles className="h-5 w-5 text-muted-foreground" />}
            aside={<span className="text-[11px] text-muted-foreground">تحديث لحظي</span>}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((ins, i) => {
              const rail =
                ins.tone === "success"
                  ? "bg-success"
                  : ins.tone === "warning"
                    ? "bg-warning"
                    : ins.tone === "danger"
                      ? "bg-danger"
                      : "bg-primary";
              // آخر عنصر فردي يمتد على العرض كامل علشان الصف ما يفضلش نصه فاضي
              const spans = insights.length % 2 === 1 && i === insights.length - 1;
              return (
                <div
                  key={i}
                  className={cn(
                    "group/insight relative overflow-hidden rounded-[1.5rem] bg-foreground/[0.02] p-5 pe-6 text-right text-sm font-medium leading-relaxed border border-border/50 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] transition-[transform,background-color,border-color] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-foreground/[0.04] hover:border-border",
                    spans && "sm:col-span-2",
                  )}
                  style={{ transitionDelay: `${i * 40}ms` }}
                >
                  <span
                    className={cn(
                      "absolute inset-y-4 end-0 w-[3px] rounded-full opacity-70 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/insight:inset-y-3 group-hover/insight:opacity-100",
                      rail,
                    )}
                  />
                  {ins.text}
                </div>
              );
            })}
          </div>
        </section>
      </Reveal>

      {/* ============ الشارتات ============ */}
      <section className="mb-14 grid gap-4 lg:grid-cols-3">
        <Reveal className="h-full lg:col-span-2" delay={0}>
          <BezelCard variant="flat" className="h-full" innerClassName="flex h-full flex-col p-6 sm:p-8">
            <SectionHead
              title="اتجاه التحصيلات"
              icon={<TrendingUp className="h-5 w-5 text-success" />}
              aside={<span className="text-[11px] text-muted-foreground">آخر 6 شهور + توقع</span>}
            />
            <div className="h-72 flex-1">
              {hasTrendData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradLine" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={EMERALD} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.3 0.008 270)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke={MUTED}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke={MUTED}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tickFormatter={(v) =>
                        privacy
                          ? "•••"
                          : new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)
                      }
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ stroke: MUTED, strokeDasharray: "3 4" }}
                      formatter={(value: number, name: string) => [
                        privacy ? "•••••" : `${fmt(value)} ج.م`,
                        name === "forecast" ? "متوقع" : "التحصيلات",
                      ]}
                      labelStyle={{ color: "oklch(0.97 0.005 270)" }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      iconType="line"
                      formatter={(v) => (
                        <span className="text-[11px] text-muted-foreground">
                          {v === "forecast" ? "متوقع" : "فعلي"}
                        </span>
                      )}
                    />
                    <Line
                      name="actual"
                      type="monotone"
                      dataKey="total"
                      stroke={EMERALD}
                      strokeWidth={3}
                      dot={{ fill: EMERALD, r: 3.5 }}
                      activeDot={{ r: 6 }}
                      fill="url(#gradLine)"
                      connectNulls={false}
                      isAnimationActive
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                    <Line
                      name="forecast"
                      type="monotone"
                      dataKey="forecast"
                      stroke={EMERALD}
                      strokeWidth={2}
                      strokeDasharray="6 5"
                      dot={{
                        fill: "oklch(0.21 0.006 270)",
                        stroke: EMERALD,
                        r: 3.5,
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 6 }}
                      connectNulls
                      isAnimationActive
                      animationDuration={1500}
                      animationBegin={300}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty
                  title="لسه مفيش تحصيلات مسجلة"
                  hint="أول ما تسجّل دفعة على فاتورة، هيظهر هنا اتجاه التحصيل والتوقع للشهر الجاي."
                  ctaLabel="افتح الفواتير"
                  ctaTo="/invoices"
                />
              )}
            </div>
          </BezelCard>
        </Reveal>

        <Reveal className="h-full" delay={90}>
          <BezelCard variant="flat" className="h-full" innerClassName="flex h-full flex-col p-6 sm:p-8">
            <SectionHead
              title="حالة الديون"
              aside={
                <span className="text-[11px] text-muted-foreground">
                  {data.customers.length} عميل
                </span>
              }
            />
            <div className="h-72 flex-1">
              {hasStatusData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="oklch(0.17 0.005 270)"
                      strokeWidth={2}
                      isAnimationActive
                      animationDuration={1500}
                      animationEasing="ease-out"
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(v) => (
                        <span className="text-[11px] text-muted-foreground">{v}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty
                  variant="ring"
                  title="مفيش عملاء مسجلين"
                  hint="ضيف أول عميل علشان تتابع توزيع الالتزام والتعثر."
                  ctaLabel="إضافة عميل"
                  ctaTo="/customers"
                />
              )}
            </div>
          </BezelCard>
        </Reveal>
      </section>

      {/* ============ مصروفات الشهر ============ */}
      <Reveal className="mb-14 block">
        <BezelCard variant="flat" innerClassName="p-6 sm:p-8">
          <SectionHead
            title="توزيع مصروفات الشهر"
            icon={<Receipt className="h-5 w-5 text-muted-foreground" />}
            aside={
              <Link
                to="/expenses"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3.5 py-1.5 text-[11px] font-bold text-foreground ring-1 ring-border transition-[background-color,color,transform] hover:bg-foreground/[0.10] active:scale-[0.98]"
              >
                إدارة المصروفات <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {expenseBreakdown.length === 0 ? (
            <div className="h-56">
              <ChartEmpty
                variant="ring"
                title="مفيش مصروفات الشهر ده"
                hint="سجّل الإيجار والكهرباء والمرتبات علشان الأرباح تتحسب صح."
                ctaLabel="سجّل أول مصروف"
                ctaTo="/expenses"
              />
            </div>
          ) : (
            <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="oklch(0.17 0.005 270)"
                      strokeWidth={2}
                      isAnimationActive
                      animationDuration={1500}
                      animationEasing="ease-out"
                    >
                      {expenseBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number) => [money(value), "المصروف"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3.5">
                {expenseBreakdown
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .map((row) => {
                    const pct = totalMonthExpenses > 0 ? (row.value / totalMonthExpenses) * 100 : 0;
                    return (
                      <div key={row.name}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className={cn("text-numeric font-bold", privacy && "privacy-blur")}>
                            {money(row.value)}
                            <span className="ms-1.5 text-muted-foreground">{Math.round(pct)}%</span>
                          </span>
                          <span className="flex items-center gap-2 font-medium">
                            {row.name}
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: row.color }}
                            />
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                          <div
                            className="h-full rounded-full transition-[width] duration-1000"
                            style={{
                              width: `${pct}%`,
                              background: row.color,
                              transitionTimingFunction: "var(--ease-fluid)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                <div className="flex items-center justify-between border-t border-border/60 pt-3.5">
                  <span
                    className={cn(
                      "text-numeric text-base font-extrabold text-danger",
                      privacy && "privacy-blur",
                    )}
                  >
                    {money(totalMonthExpenses)}
                  </span>
                  <MetricLabel>إجمالي الشهر</MetricLabel>
                </div>
              </div>
            </div>
          )}
        </BezelCard>
      </Reveal>

      {/* ============ عملاء بحاجة لمتابعة ============ */}
      <Reveal className="mb-14 block">
        <BezelCard variant="flat" innerClassName="p-6 sm:p-8">
          <SectionHead
            title="عملاء بحاجة لمتابعة"
            icon={<AlertTriangle className="h-5 w-5 text-danger" />}
            aside={
              <Link
                to="/customers"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.05] px-3.5 py-1.5 text-[11px] font-bold text-muted-foreground ring-1 ring-border transition hover:text-foreground active:scale-[0.98]"
              >
                عرض الكل <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {atRiskCustomers.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm font-bold text-foreground/80">مفيش عملاء متأخرين</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                كل الأرصدة المستحقة في ميعادها.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      العميل
                    </th>
                    <th className="hidden py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:table-cell">
                      الهاتف
                    </th>
                    <th className="py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      التأخير
                    </th>
                    <th className="py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      الرصيد
                    </th>
                    <th className="py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {atRiskCustomers.map((row) => (
                    <tr
                      key={row.customer.id}
                      className="border-b border-border/40 transition-colors last:border-0 hover:bg-danger/[0.06]"
                    >
                      <td className="py-3 font-bold">{row.customer.name}</td>
                      <td className="hidden py-3 text-muted-foreground sm:table-cell" dir="ltr">
                        {row.customer.phone || "—"}
                      </td>
                      <td className="py-3">
                        <span className="text-numeric inline-flex items-center rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-bold text-danger ring-1 ring-danger/20">
                          {row.maxLate} يوم
                        </span>
                      </td>
                      <td
                        className={cn(
                          "text-numeric py-3 text-left font-bold text-danger",
                          privacy && "privacy-blur",
                        )}
                      >
                        {money(row.balance)}
                      </td>
                      <td className="py-3 text-left">
                        {row.customer.phone && (
                          <a
                            href={`tel:${row.customer.phone}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25 transition hover:bg-primary/20 active:scale-[0.95]"
                            title="اتصال"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </BezelCard>
      </Reveal>

      {/* ============ مستحق اليوم + روابط ============ */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Reveal className="h-full lg:col-span-2" delay={0}>
          <BezelCard variant="flat" className="h-full" innerClassName="flex h-full flex-col p-6 sm:p-8">
            <SectionHead
              title="يستحق التحصيل اليوم"
              icon={<CalendarCheck className="h-5 w-5 text-warning" />}
              aside={
                <div className="text-left">
                  <MetricLabel>الإجمالي المستحق</MetricLabel>
                  <div
                    className={cn(
                      "text-numeric mt-1.5 text-lg font-extrabold text-warning",
                      privacy && "privacy-blur",
                    )}
                  >
                    {money(totalDueToday)}
                  </div>
                </div>
              }
            />
            {dueToday.length === 0 ? (
              <div className="grid flex-1 place-items-center py-14 text-center">
                <div>
                  <p className="text-sm font-bold text-foreground/80">مفيش أقساط مستحقة النهاردة</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    راجع المنبه لمواعيد الأيام الجاية.
                  </p>
                  <Link
                    to="/alerts"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3.5 py-1.5 text-xs font-bold text-foreground ring-1 ring-border transition-[background-color,transform] hover:bg-foreground/[0.10] active:scale-[0.98]"
                  >
                    افتح المنبه <ArrowLeft className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {dueToday.map((row) => (
                  <div
                    key={row.inv.id}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl p-3.5 ring-1 transition-colors",
                      row.late > 0
                        ? "bg-danger/[0.06] ring-danger/20 hover:bg-danger/[0.11]"
                        : "bg-warning/[0.06] ring-warning/20 hover:bg-warning/[0.11]",
                    )}
                  >
                    <div className="flex shrink-0 items-center gap-3">
                      {row.customer?.phone && (
                        <a
                          href={`tel:${row.customer.phone}`}
                          className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25 transition hover:bg-primary/20 active:scale-[0.95]"
                          title="اتصال"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      <div className="text-left">
                        <div
                          className={cn(
                            "text-numeric text-base font-extrabold leading-none",
                            row.late > 0 ? "text-danger" : "text-warning",
                            privacy && "privacy-blur",
                          )}
                        >
                          {money(row.due)}
                        </div>
                        <div className="mt-1.5 text-[11px] text-muted-foreground">
                          {row.late > 0 ? `متأخر ${row.late} يوم` : "مستحق اليوم"}
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 text-right">
                      <div className="truncate text-sm font-bold">{row.customer?.name ?? "—"}</div>
                      <div className="truncate text-[11px] text-muted-foreground" dir="ltr">
                        {row.customer?.phone ?? ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </BezelCard>
        </Reveal>

        <Reveal className="h-full" delay={90}>
          <BezelCard variant="flat" className="h-full" innerClassName="h-full p-6 sm:p-8">
            <SectionHead title="روابط سريعة" />
            <div className="space-y-2.5">
              <QuickLink
                to="/customers"
                icon={<Users className="h-4 w-4" />}
                title="العملاء"
                sub={`${data.customers.length} عميل`}
              />
              <QuickLink
                to="/invoices"
                icon={<FileText className="h-4 w-4" />}
                title="الفواتير والمبيعات"
                sub={`${data.invoices.length} فاتورة`}
              />
              <QuickLink
                to="/alerts"
                icon={<AlertCircle className="h-4 w-4" />}
                title="التنبيهات"
                sub={`${data.invoices.filter((i) => daysLate(i) > 0 && i.paid < i.total).length} متأخر`}
                tone="danger"
              />
            </div>
          </BezelCard>
        </Reveal>
      </section>

      <QuickActionsFab />
    </>
  );
}

function QuickLink({
  to,
  icon,
  title,
  sub,
  tone = "neutral",
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <Link
      to={to as never}
      className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-transparent p-3.5 transition-[background-color,transform] duration-500 hover:bg-foreground/[0.04] hover:border-border/40 active:scale-[0.99]"
      style={{ transitionTimingFunction: "var(--ease-fluid)" }}
    >
      <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-500 group-hover:-translate-x-1" />
      <div className="flex min-w-0 items-center justify-end gap-3">
        <div className="min-w-0 text-right">
          <div className="truncate text-sm font-bold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        </div>
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1",
            tone === "danger"
              ? "bg-danger/10 text-danger ring-danger/25"
              : "bg-foreground/[0.06] text-muted-foreground ring-foreground/10",
          )}
        >
          {icon}
        </span>
      </div>
    </Link>
  );
}
