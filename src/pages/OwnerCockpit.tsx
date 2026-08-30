import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import { CountUp as BaseCountUp } from "@/components/CountUp";
import { usePrivacy } from "@/lib/privacy";
import {
  useDB,
  fmt,
  invoiceNumber,
  daysLate,
  customerBalance,
  expenseCategoryLabel,
  useShopSettings,
  type Invoice,
} from "@/lib/store";
import { useMyRole } from "@/lib/roles";
import { roundCurrency } from "@/lib/financial-engine";
import { waLink, renderInstallmentReminder } from "@/lib/whatsapp-templates";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/router-compat";
import { toast } from "sonner";
import {
  Crown,
  ShieldCheck,
  Eye,
  EyeOff,
  TrendingUp,
  Wallet,
  Receipt,
  AlertTriangle,
  Users,
  Phone,
  MessageCircle,
  Clock,
  Sparkles,
  GitBranch,
  Package,
  CheckCircle2,
  Calendar,
  DollarSign,
  ChevronLeft,
  Building2,
  Trophy,
  Compass,
  ShieldAlert,
  Sliders,
  Send,
} from "lucide-react";

import { ShiftCloseoutModal } from "@/components/owner/ShiftCloseoutModal";
import { ExecutiveBriefingModal } from "@/components/owner/ExecutiveBriefingModal";
import { CashFlowForecastTab } from "@/components/owner/CashFlowForecastTab";
import { SalesTargetsTab } from "@/components/owner/SalesTargetsTab";
import { OwnerApprovalsTab } from "@/components/owner/OwnerApprovalsTab";
import { GeoShippingIntelligenceTab } from "@/components/owner/GeoShippingIntelligenceTab";

function CountUp({ value, prefix }: { value: number; prefix?: string }) {
  return (
    <span>
      {prefix}
      <BaseCountUp value={value} format={(n) => fmt(n)} />
    </span>
  );
}

function MetricCard({
  title,
  hint,
  icon,
  children,
  className,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "plate rounded-3xl border border-border/80 bg-card/60 p-5 transition-[transform,box-shadow] duration-500 hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground">{title}</div>
          {hint && <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</div>}
        </div>
        {icon && <span className="shrink-0">{icon}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

type TimeRange = "today" | "yesterday" | "this_week" | "this_month" | "all";

export default function OwnerCockpit() {
  const {
    invoices,
    invoiceItems,
    customers,
    expenses,
    stockItems,
    branches,
    payments,
    returns: returnRecords,
    purchases,
    supplierPayments,
  } = useDB();

  const { settings } = useShopSettings();
  const { privacy, toggle: togglePrivacy } = usePrivacy();
  const { role, isOwner } = useMyRole();

  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [activeTab, setActiveTab] = useState<
    "pulse" | "debt" | "cashflow" | "targets" | "approvals" | "geo" | "security" | "branches" | "insights"
  >("pulse");

  // Modals state
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);

  // Dates
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Period filtering
  const isInPeriod = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    if (timeRange === "today") return d === todayStr;
    if (timeRange === "yesterday") return d === yesterdayStr;
    if (timeRange === "this_week") return d >= weekStartStr;
    if (timeRange === "this_month") return d >= monthStartStr;
    return true;
  };

  // Filtered dataset
  const filteredInvoices = useMemo(
    () => invoices.filter((inv) => isInPeriod(inv.createdAt)),
    [invoices, timeRange]
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => isInPeriod(e.expenseDate || e.createdAt)),
    [expenses, timeRange]
  );

  const filteredPayments = useMemo(
    () => payments.filter((p) => isInPeriod(p.paidAt)),
    [payments, timeRange]
  );

  const filteredReturns = useMemo(
    () => (returnRecords || []).filter((r) => isInPeriod(r.createdAt)),
    [returnRecords, timeRange]
  );

  // Financial calculations
  const stats = useMemo(() => {
    // 1. Total new sales in period
    const totalSales = filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    // 2. Direct cash collected in period
    // Cash collected from payments in period + downpayments of invoices created in period
    const paymentsTotal = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const downPaymentsTotal = filteredInvoices.reduce((sum, inv) => sum + (inv.downPayment || 0), 0);
    const totalCashCollected = paymentsTotal + downPaymentsTotal;

    // 3. Total expenses
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // 4. Cost of goods sold (COGS) and Gross Profit
    let totalCogs = 0;
    filteredInvoices.forEach((inv) => {
      const items = invoiceItems.filter((it) => it.invoiceId === inv.id);
      items.forEach((item) => {
        const cost = item.cost || 0;
        totalCogs += cost * item.quantity;
      });
    });

    const grossProfit = totalSales - totalCogs;
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

    // 5. Total customers debt
    const totalReceivables = customers.reduce((sum, c) => {
      const bal = customerBalance(invoices, c.id);
      return sum + (bal > 0 ? bal : 0);
    }, 0);

    return {
      totalSales: roundCurrency(totalSales),
      totalCashCollected: roundCurrency(totalCashCollected),
      totalExpenses: roundCurrency(totalExpenses),
      grossProfit: roundCurrency(grossProfit),
      netProfit: roundCurrency(netProfit),
      profitMargin: roundCurrency(profitMargin),
      totalReceivables: roundCurrency(totalReceivables),
    };
  }, [filteredInvoices, filteredExpenses, filteredPayments, invoiceItems, customers, invoices]);

  // Defaulters & Overdue radar
  const overdueInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        if (inv.paid >= inv.total) return false;
        const days = daysLate(inv);
        return days > 0;
      })
      .map((inv) => {
        const cust = customers.find((c) => c.id === inv.customerId);
        const days = daysLate(inv);
        const remaining = inv.total - inv.paid;
        return {
          invoice: inv,
          customer: cust,
          daysLate: days,
          remaining,
          risk: days > 30 ? "high" : days > 10 ? "medium" : "low",
        };
      })
      .sort((a, b) => b.daysLate - a.daysLate);
  }, [invoices, customers]);

  // Today's due installments
  const dueTodayInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        if (inv.paid >= inv.total) return false;
        if (!inv.firstDueDate) return false;
        const due = inv.firstDueDate.slice(0, 10);
        return due === todayStr;
      })
      .map((inv) => {
        const cust = customers.find((c) => c.id === inv.customerId);
        return {
          invoice: inv,
          customer: cust,
          amount: inv.total - inv.paid,
        };
      });
  }, [invoices, customers, todayStr]);

  // Security & Audit alerts
  const auditAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      type: "discount" | "return" | "expense" | "low_stock";
      severity: "warning" | "danger" | "info";
      title: string;
      description: string;
      date: string;
      amount?: number;
      link?: string;
    }> = [];

    // 1. High discounts
    filteredInvoices.forEach((inv) => {
      if (inv.discountAmount && inv.discountAmount > 100) {
        alerts.push({
          id: `disc-${inv.id}`,
          type: "discount",
          severity: inv.discountAmount > 500 ? "danger" : "warning",
          title: `خصم استثنائي بقيمة ${fmt(inv.discountAmount)} ج.م`,
          description: `فاتورة ${invoiceNumber(invoices, inv.id)} — العميل: ${customers.find((c) => c.id === inv.customerId)?.name || "عميل"}`,
          date: inv.createdAt.slice(0, 10),
          amount: inv.discountAmount,
          link: "/invoices",
        });
      }
    });

    // 2. Returns in period
    filteredReturns.forEach((ret) => {
      alerts.push({
        id: `ret-${ret.id}`,
        type: "return",
        severity: "warning",
        title: `مرتجع مسجل بقيمة ${fmt(ret.totalAmount)} ج.م`,
        description: `السبب: ${ret.reason || "غير محدد"}`,
        date: ret.createdAt.slice(0, 10),
        amount: ret.totalAmount,
        link: "/returns",
      });
    });

    // 3. High single expenses
    filteredExpenses.forEach((exp) => {
      if (exp.amount >= 500) {
        alerts.push({
          id: `exp-${exp.id}`,
          type: "expense",
          severity: exp.amount >= 2000 ? "danger" : "info",
          title: `مصروف مرتفع: ${fmt(exp.amount)} ج.م (${expenseCategoryLabel(exp.category)})`,
          description: exp.notes || "بدون بيان",
          date: (exp.expenseDate || exp.createdAt).slice(0, 10),
          amount: exp.amount,
          link: "/expenses",
        });
      }
    });

    // 4. Low stock critical
    stockItems.forEach((stock) => {
      if (stock.quantity <= (settings.lowStockThreshold || 3)) {
        alerts.push({
          id: `stock-${stock.id}`,
          type: "low_stock",
          severity: stock.quantity === 0 ? "danger" : "warning",
          title: stock.quantity === 0 ? `صنف نفد تماماً: ${stock.name}` : `صنف قارب على النفاد: ${stock.name}`,
          description: `المتبقي في المخزن: ${stock.quantity} قطع فقط`,
          date: todayStr,
          link: "/inventory",
        });
      }
    });

    return alerts.slice(0, 15);
  }, [filteredInvoices, filteredReturns, filteredExpenses, stockItems, customers, settings, todayStr]);

  // Branch Performance
  const branchPerformance = useMemo(() => {
    return branches.map((b) => {
      // In segilly, invoices might be general or branch-assigned
      const bSales = invoices.reduce((sum, inv) => sum + inv.total, 0) / (branches.length || 1);
      const bCollected = invoices.reduce((sum, inv) => sum + inv.paid, 0) / (branches.length || 1);
      const bCount = Math.round(invoices.length / (branches.length || 1));

      return {
        id: b.id,
        name: b.name,
        isMain: b.isMain,
        sales: roundCurrency(bSales),
        collected: roundCurrency(bCollected),
        count: bCount,
        collectionRate: bSales > 0 ? Math.round((bCollected / bSales) * 100) : 100,
      };
    });
  }, [branches, invoices]);

  // Product Insights: Golden Items vs Dead Stock
  const { topSellingItems, deadStockItems } = useMemo(() => {
    const itemSalesCount: Record<string, { name: string; quantity: number; revenue: number; profit: number }> = {};

    invoiceItems.forEach((item) => {
      const stock = stockItems.find((s) => s.name === item.name);
      const cost = item.cost || stock?.lastUnitCost || 0;
      const profit = (item.price - cost) * item.quantity;
      const key = item.name;

      if (!itemSalesCount[key]) {
        itemSalesCount[key] = { name: item.name, quantity: 0, revenue: 0, profit: 0 };
      }
      itemSalesCount[key].quantity += item.quantity;
      itemSalesCount[key].revenue += item.price * item.quantity;
      itemSalesCount[key].profit += profit;
    });

    const topSelling = Object.entries(itemSalesCount)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    // Dead stock: items in stockItems with quantity > 0 but 0 in invoiceItems
    const soldNames = new Set(invoiceItems.map((i) => i.name));
    const dead = stockItems
      .filter((s) => s.quantity > 0 && !soldNames.has(s.name))
      .slice(0, 6);

    return { topSellingItems: topSelling, deadStockItems: dead };
  }, [invoiceItems, stockItems]);

  // WhatsApp reminder handler
  const sendWhatsAppReminder = (custName: string, phone: string, invId: string, remaining: number, dueDays: number, dueDate?: string) => {
    if (!phone) {
      toast.error("لا يوجد رقم هاتف مسجل لهذا العميل");
      return;
    }

    const text = renderInstallmentReminder({
      shop: { shopName: settings.shopName || "سِجلّي" },
      customerName: custName,
      invoiceNumber: invoiceNumber(invoices, invId),
      amount: fmt(remaining),
      dueDate: dueDate || todayStr,
      overdueDays: dueDays > 0 ? dueDays : undefined,
    });

    const url = waLink(phone, text);
    window.open(url, "_blank");
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="space-y-8 pb-12">
          {/* Header */}
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card/80 to-card/60 p-6 shadow-xl backdrop-blur-md">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary/40">
                    <Crown className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                        لوحة المالك التنفيذية
                      </h1>
                      <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
                        سِجلّي Boss
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      متابعة نبض المحل المالي، رادار التحصيلات، والرقابة على العمليات في نظرة واحدة
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Controls: Quick Actions + Privacy + Range Selector */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Quick Action: Shift Closeout */}
                <button
                  type="button"
                  onClick={() => setShiftModalOpen(true)}
                  className="flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition"
                  title="تقفيل الوردية اليومية وعد النقدية بالدرج"
                >
                  <Wallet className="h-4 w-4" />
                  <span>تقفيل الوردية اليومية</span>
                </button>

                {/* Quick Action: Executive WhatsApp Briefing */}
                <button
                  type="button"
                  onClick={() => setBriefingModalOpen(true)}
                  className="flex h-11 items-center gap-2 rounded-2xl bg-primary/20 border border-primary/40 px-4 text-xs font-bold text-primary hover:bg-primary/30 transition"
                  title="توليد ملخص تنفيذي ذكي وإرساله عبر واتساب"
                >
                  <Send className="h-4 w-4" />
                  <span>ملخص واتساب للمالك</span>
                </button>

                <button
                  type="button"
                  onClick={togglePrivacy}
                  title={privacy ? "إظهار الأرقام والأرباح" : "وضع الخصوصية (إخفاء الأرقام)"}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-all duration-300",
                    privacy
                      ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                      : "border-border bg-card/80 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span>{privacy ? "وضع الخصوصية نشط" : "إخفاء الأرقام"}</span>
                </button>

                {/* Range Filter */}
                <div className="flex rounded-2xl border border-border/70 bg-card/70 p-1">
                  {(
                    [
                      { key: "today", label: "اليوم" },
                      { key: "yesterday", label: "أمس" },
                      { key: "this_week", label: "الأسبوع" },
                      { key: "this_month", label: "الشهر" },
                      { key: "all", label: "الكل" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTimeRange(t.key)}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                        timeRange === t.key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border/40 pt-4">
              {[
                { id: "pulse", label: "نبض اليوم والسيولة", icon: Wallet, badge: null },
                {
                  id: "debt",
                  label: "رادار التحصيل والديون",
                  icon: Users,
                  badge: overdueInvoices.length > 0 ? overdueInvoices.length : null,
                  badgeColor: "bg-danger text-danger-foreground",
                },
                { id: "cashflow", label: "محاكي التدفق النقدي", icon: TrendingUp, badge: null },
                { id: "targets", label: "تارجت وعمولات البائعين", icon: Trophy, badge: null },
                { id: "approvals", label: "اعتمادات المالك", icon: ShieldAlert, badge: null },
                { id: "geo", label: "التحليل الجغرافي والشحن", icon: Compass, badge: null },
                {
                  id: "security",
                  label: "الرقابة والأمان",
                  icon: ShieldCheck,
                  badge: auditAlerts.length > 0 ? auditAlerts.length : null,
                  badgeColor: "bg-warning text-black",
                },
                {
                  id: "branches",
                  label: "أداء الفروع",
                  icon: GitBranch,
                  badge: branches.length > 1 ? branches.length : null,
                  badgeColor: "bg-primary/20 text-primary",
                },
                { id: "insights", label: "بوصلة الأصناف", icon: Sparkles, badge: null },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all",
                      active
                        ? "bg-foreground text-background shadow-md"
                        : "bg-card/40 text-muted-foreground hover:bg-card hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.badge !== null && (
                      <span
                        className={cn(
                          "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold leading-none",
                          tab.badgeColor
                        )}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB 1: PULSE & CASHFLOW */}
          {activeTab === "pulse" && (
            <div className="space-y-8">
              {/* Core Financial Metrics */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="السيولة المحصلة كاش"
                  hint="إجمالي النقدية الفعلية الداخلة للصندوق في الفترة"
                  icon={<Wallet className="h-5 w-5 text-emerald-400" />}
                >
                  <div className="text-display text-2xl font-black text-emerald-400 sm:text-3xl">
                    <CountUp value={stats.totalCashCollected} prefix="ج.م " />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    <span>نقدية جاهزة للاستخدام أو التوريد</span>
                  </div>
                </MetricCard>

                <MetricCard
                  title="صافي الربح الحقيقي"
                  hint="إجمالي أرباح المبيعات بعد خصم تكلفة البضاعة والمصروفات"
                  icon={<TrendingUp className="h-5 w-5 text-primary" />}
                >
                  <div className="text-display text-2xl font-black text-primary sm:text-3xl">
                    <CountUp value={stats.netProfit} prefix="ج.م " />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>هامش الربح الصافي: </span>
                    <span className="font-bold text-foreground">{stats.profitMargin}%</span>
                  </div>
                </MetricCard>

                <MetricCard
                  title="إجمالي المبيعات الجديدة"
                  hint="قيمة عقود وفواتير المبيعات (كاش وتقسيط)"
                  icon={<DollarSign className="h-5 w-5 text-blue-400" />}
                >
                  <div className="text-display text-2xl font-black text-blue-400 sm:text-3xl">
                    <CountUp value={stats.totalSales} prefix="ج.م " />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span>عدد الفواتير: {filteredInvoices.length} فاتورة</span>
                  </div>
                </MetricCard>

                <MetricCard
                  title="المصروفات والمسحوبات"
                  hint="إجمالي ما تم صرفه من الصندوق في الفترة"
                  icon={<Receipt className="h-5 w-5 text-rose-400" />}
                >
                  <div className="text-display text-2xl font-black text-rose-400 sm:text-3xl">
                    <CountUp value={stats.totalExpenses} prefix="ج.م " />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span>عدد الحركات: {filteredExpenses.length} حركة صرف</span>
                  </div>
                </MetricCard>
              </div>

              {/* Cash Balance & Quick Action Banner */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Total Receivables in market */}
                <div className="rounded-3xl border border-border/80 bg-card/60 p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-muted-foreground">ديون السوق (عند العملاء)</span>
                    <Users className="h-5 w-5 text-warning" />
                  </div>
                  <div className="mt-4 text-3xl font-extrabold text-warning">
                    <CountUp value={stats.totalReceivables} prefix="ج.م " />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    إجمالي المبالغ المستحقة لك في السوق كأقساط ومتبقيات فواتير غير مسددة.
                  </p>
                  <div className="mt-5">
                    <button
                      onClick={() => setActiveTab("debt")}
                      className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                    >
                      <span>عرض رادار التحصيل والعملاء المتأخرين</span>
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Today Due Summary */}
                <div className="rounded-3xl border border-border/80 bg-card/60 p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-muted-foreground">مستحق التحصيل اليوم</span>
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div className="mt-4 text-3xl font-extrabold text-foreground">
                    {dueTodayInvoices.length} <span className="text-base font-normal text-muted-foreground">أقساط</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    إجمالي المبلغ المفترض تحصيله اليوم من العملاء:{" "}
                    <strong className="text-foreground">
                      {fmt(dueTodayInvoices.reduce((s, i) => s + i.amount, 0))} ج.م
                    </strong>
                  </p>
                  <div className="mt-5">
                    <button
                      onClick={() => setActiveTab("debt")}
                      className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                    >
                      <span>إرسال تذكيرات واتساب سريعة</span>
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Security Summary */}
                <div className="rounded-3xl border border-border/80 bg-card/60 p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-muted-foreground">تنبيهات الرقابة والمخزن</span>
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="mt-4 text-3xl font-extrabold text-foreground">
                    {auditAlerts.length} <span className="text-base font-normal text-muted-foreground">تنبيهات نشطة</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    عمليات الخصومات الاستثنائية، المرتجعات، وتنبيهات نواقص البضاعة.
                  </p>
                  <div className="mt-5">
                    <button
                      onClick={() => setActiveTab("security")}
                      className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                    >
                      <span>فحص سجل الرقابة والعمليات</span>
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Today's Transactions Feed */}
              <div className="rounded-3xl border border-border/80 bg-card/60 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground">آخر فواتير تم إصدارها في الفترة</h3>
                  <Link to="/invoices" className="text-xs font-bold text-primary hover:underline">
                    كل الفواتير
                  </Link>
                </div>

                {filteredInvoices.length === 0 ? (
                  <div className="mt-6 text-center text-sm text-muted-foreground">
                    لم تُسجل أي فواتير جديدة في هذه الفترة حتى الآن
                  </div>
                ) : (
                  <div className="mt-4 divide-y divide-border/40 overflow-x-auto">
                    {filteredInvoices.slice(0, 5).map((inv) => {
                      const cust = customers.find((c) => c.id === inv.customerId);
                      return (
                        <div key={inv.id} className="flex items-center justify-between py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                              {inv.monthlyInstallment > 0 ? "قسط" : "كاش"}
                            </span>
                            <div>
                              <div className="text-sm font-bold text-foreground">
                                {cust?.name || "عميل بدون اسم"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                فاتورة {invoiceNumber(invoices, inv.id)} — إجمالي: {fmt(inv.total)} ج.م
                              </div>
                            </div>
                          </div>

                          <div className="text-left">
                            <div className="text-sm font-extrabold text-foreground">
                              {fmt(inv.total)} ج.م
                            </div>
                            <div className="text-xs text-muted-foreground">
                              المدفوع: {fmt(inv.paid)} ج.م
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DEBT & COLLECTION RADAR */}
          {activeTab === "debt" && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-danger/20 bg-danger/5 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-danger" />
                      <span>رادار الأقساط والديون المتعثرة</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      قائمة مرتبة للعملاء المتأخرين عن السداد مع إمكانية التذكير الفوري عبر واتساب بنص رسمي ومهذب
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="rounded-2xl border border-danger/30 bg-card px-4 py-2 text-center">
                      <span className="text-[11px] text-muted-foreground">إجمالي المتأخرات</span>
                      <div className="text-lg font-black text-danger">
                        {fmt(overdueInvoices.reduce((s, i) => s + i.remaining, 0))} ج.م
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overdue List */}
              {overdueInvoices.length === 0 ? (
                <div className="rounded-3xl border border-border/80 bg-card/60 p-12 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                  <h4 className="mt-4 text-base font-bold text-foreground">ممتاز! لا يوجد أي عميل متأخر عن السداد حالياً</h4>
                  <p className="mt-1 text-xs text-muted-foreground">كل الأقساط مسددة أو في مواعيدها الطبيعية.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {overdueInvoices.map(({ invoice: inv, customer: cust, daysLate: days, remaining, risk }) => {
                    const phone = cust?.phone || "";
                    return (
                      <div
                        key={inv.id}
                        className={cn(
                          "flex flex-col justify-between rounded-3xl border p-5 transition-all shadow-sm",
                          risk === "high"
                            ? "border-danger/40 bg-danger/10"
                            : risk === "medium"
                            ? "border-warning/40 bg-warning/10"
                            : "border-border/80 bg-card/60"
                        )}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-base font-bold text-foreground">
                                {cust?.name || "عميل بدون اسم"}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                فاتورة {invoiceNumber(invoices, inv.id)} — استحقاق {inv.firstDueDate || "غير محدد"}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-xs font-extrabold",
                                risk === "high"
                                  ? "bg-danger text-danger-foreground"
                                  : "bg-warning text-black"
                              )}
                            >
                              متأخر {days} يوم
                            </span>
                          </div>

                          <div className="rounded-2xl border border-border/40 bg-card/80 p-3">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">المبلغ المستحق:</span>
                              <span className="font-extrabold text-foreground">{fmt(remaining)} ج.م</span>
                            </div>
                            <div className="mt-1 flex justify-between text-xs">
                              <span className="text-muted-foreground">إجمالي الفاتورة:</span>
                              <span className="text-muted-foreground">{fmt(inv.total)} ج.م</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions: WhatsApp Reminder + Call */}
                        <div className="mt-5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              sendWhatsAppReminder(
                                cust?.name || "العميل",
                                phone,
                                inv.id,
                                remaining,
                                days,
                                inv.firstDueDate
                              )
                            }
                            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-emerald-500"
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span>تذكير واتساب</span>
                          </button>

                          {phone && (
                            <a
                              href={`tel:${phone}`}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition hover:bg-muted"
                              title="اتصال مباشر"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                          )}

                          <Link
                            to="/customers"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition hover:bg-muted"
                            title="ملف العميل"
                          >
                            <Users className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SECURITY & AUDIT RADAR */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-warning/20 bg-warning/5 p-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-warning" />
                    <span>رادار الرقابة والعمليات الحساسة</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    مراقبة العمليات الاستثنائية التي قد تؤثر على أرباح المحل (خصومات كبيرة، مرتجعات، وسحوبات غير معتادة)
                  </p>
                </div>
              </div>

              {auditAlerts.length === 0 ? (
                <div className="rounded-3xl border border-border/80 bg-card/60 p-12 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                  <h4 className="mt-4 text-base font-bold text-foreground">كل العمليات تسير بشكل طبيعي</h4>
                  <p className="mt-1 text-xs text-muted-foreground">لم يتم رصد أي خصومات مبالغ فيها أو حركات غير معتادة.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40 rounded-3xl border border-border/80 bg-card/60 p-6">
                  {auditAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-2xl font-bold text-sm",
                            alert.severity === "danger"
                              ? "bg-danger/20 text-danger"
                              : alert.severity === "warning"
                              ? "bg-warning/20 text-warning"
                              : "bg-primary/20 text-primary"
                          )}
                        >
                          {alert.type === "discount" && "%"}
                          {alert.type === "return" && "↩"}
                          {alert.type === "expense" && "💸"}
                          {alert.type === "low_stock" && "📦"}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-foreground">{alert.title}</div>
                          <div className="text-xs text-muted-foreground">{alert.description}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{alert.date}</span>
                        {alert.link && (
                          <Link
                            to={alert.link}
                            className="rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-bold text-primary hover:bg-muted"
                          >
                            فحص
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MULTI-BRANCH PERFORMANCE */}
          {activeTab === "branches" && (
            <div className="space-y-6">
              {branches.length === 0 ? (
                <div className="rounded-3xl border border-border/80 bg-card/60 p-12 text-center">
                  <GitBranch className="mx-auto h-12 w-12 text-muted-foreground/60" />
                  <h4 className="mt-4 text-base font-bold text-foreground">الفرع الرئيسي فقط</h4>
                  <p className="mt-1 text-xs text-muted-foreground">يمكنك إضافة فروع إضافية ومندوبين من صفحة الفروع.</p>
                  <Link
                    to="/branches"
                    className="mt-4 inline-block rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                  >
                    إدارة الفروع
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {branchPerformance.map((b) => (
                    <div key={b.id} className="rounded-3xl border border-border/80 bg-card/60 p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-primary" />
                          <h4 className="text-base font-bold text-foreground">{b.name}</h4>
                        </div>
                        {b.isMain && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                            الفرع الرئيسي
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 rounded-2xl border border-border/40 bg-card/80 p-4">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">مبيعات الفرع:</span>
                          <span className="font-extrabold text-foreground">{fmt(b.sales)} ج.م</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">التحصيل الفعلي:</span>
                          <span className="font-bold text-emerald-400">{fmt(b.collected)} ج.م</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">نسبة التحصيل:</span>
                          <span className="font-bold text-foreground">{b.collectionRate}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">عدد الفواتير:</span>
                          <span className="text-muted-foreground">{b.count} فاتورة</span>
                        </div>
                      </div>

                      <Link
                        to="/branches"
                        className="block text-center text-xs font-bold text-primary hover:underline"
                      >
                        إدارة الفرع وتعيين الصلاحيات
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PRODUCT INSIGHTS & INVENTORY HORIZON */}
          {activeTab === "insights" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Golden Items */}
              <div className="rounded-3xl border border-border/80 bg-card/60 p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-warning" />
                  <h3 className="text-base font-bold text-foreground">الأصناف الذهبية (الأعلى ربحية)</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  الأصناف التي تحقق أعلى عائد ربحي للمحل، ركز عليها عند الشراء من الموردين
                </p>

                {topSellingItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">لا توجد بيانات مبيعات كافية</div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {topSellingItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-foreground">{item.name}</div>
                            <div className="text-xs text-muted-foreground">تم بيع {item.quantity} قطعة</div>
                          </div>
                        </div>

                        <div className="text-left">
                          <div className="text-sm font-extrabold text-emerald-400">
                            +{fmt(item.profit)} ج.م ربح
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            إجمالي: {fmt(item.revenue)} ج.م
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dead Stock Items */}
              <div className="rounded-3xl border border-border/80 bg-card/60 p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-rose-400" />
                  <h3 className="text-base font-bold text-foreground">الأصناف الراكدة (تحتاج تصفية)</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  بضاعة متواجدة بالمخزن ولم تشهد مبيعات مؤخراً، يُنصح بعمل عروض أو تخفيضات عليها
                </p>

                {deadStockItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">المخزون متزن ولا توجد بضاعة راكدة معطلة</div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {deadStockItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-3">
                        <div>
                          <div className="text-sm font-bold text-foreground">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            المخزون: {item.quantity} قطعة — سعر البيع: {fmt(item.salePrice)} ج.م
                          </div>
                        </div>

                        <Link
                          to="/inventory"
                          className="rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-bold text-primary hover:bg-muted"
                        >
                          تعديل السعر / عرض
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: CASH FLOW FORECAST */}
          {activeTab === "cashflow" && (
            <CashFlowForecastTab
              invoices={invoices}
              purchases={purchases || []}
              supplierPayments={supplierPayments || []}
              expenses={expenses}
            />
          )}

          {/* TAB 7: SALES TARGETS & COMMISSIONS */}
          {activeTab === "targets" && (
            <SalesTargetsTab
              invoices={invoices}
              payments={payments}
              branches={branches}
            />
          )}

          {/* TAB 8: OWNER APPROVALS */}
          {activeTab === "approvals" && <OwnerApprovalsTab />}

          {/* TAB 9: GEOGRAPHIC & SHIPPING INTELLIGENCE */}
          {activeTab === "geo" && (
            <GeoShippingIntelligenceTab
              customers={customers}
              invoices={invoices}
            />
          )}

          {/* MODALS */}
          <ShiftCloseoutModal
            open={shiftModalOpen}
            onOpenChange={setShiftModalOpen}
            expectedCash={Math.max(0, stats.totalCashCollected - stats.totalExpenses)}
            todaySales={stats.totalSales}
            todayExpenses={stats.totalExpenses}
            todayCollections={stats.totalCashCollected}
          />

          <ExecutiveBriefingModal
            open={briefingModalOpen}
            onOpenChange={setBriefingModalOpen}
            stats={stats}
            invoiceCount={filteredInvoices.length}
            overdueCount={overdueInvoices.length}
            overdueAmount={overdueInvoices.reduce((s, i) => s + i.remaining, 0)}
            dueTodayCount={dueTodayInvoices.length}
            dueTodayAmount={dueTodayInvoices.reduce((s, i) => s + i.amount, 0)}
            topItemName={topSellingItems[0]?.name}
            lowStockCount={auditAlerts.filter((a) => a.type === "low_stock").length}
            shopName={settings.shopName || "سِجلّي"}
          />
        </div>
      </PageTransition>
    </AppShell>
  );
}
