import { useState, useEffect, useMemo } from "react";
import { PageTransition } from "@/components/PageTransition";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import {
  useDB,
  db,
  daysLate,
  fmt,
  customerBalance,
  useShopSettings,
  isDueSoonOrOverdue,
  daysUntilDue,
  type Customer,
  type Invoice,
} from "@/lib/store";
import { getBranchLowStockAlerts } from "@/lib/branch-system";
import { useActiveBranch } from "@/hooks/use-active-branch";
import {
  Bell,
  MessageCircle,
  Phone,
  Calendar,
  AlertCircle,
  Eye,
  EyeOff,
  Wallet,
  Clock,
  Copy,
  Send,
  Package,
  AlertTriangle,
  FileText,
  Printer,
  Search,
  Handshake,
  ShieldAlert,
  PhoneCall,
  CheckCircle2,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePrivacy } from "@/lib/privacy";
import { motion, AnimatePresence } from "framer-motion";
import { AlertsKpiStrip } from "@/components/alerts/AlertsKpiStrip";
import { PromiseModal } from "@/components/alerts/PromiseModal";
import { SmartReminderModal } from "@/components/alerts/SmartReminderModal";
import { CallLogsViewer } from "@/components/alerts/CallLogsViewer";
import { useCollectionTracker } from "@/lib/collection-store";
import { printDemandLetterA4, printCollectorSheetA4, CollectorSheetItem } from "@/lib/collection-docs";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <AlertsPage />
      </PageTransition>
    </AppShell>
  );
}

type TabType = "all" | "due_today" | "minor" | "moderate" | "critical" | "promises" | "stock" | "history";
type SortOption = "late_desc" | "remaining_desc" | "due_asc";

function AlertsPage() {
  const data = useDB();
  const { activeBranchId, isAllBranches } = useActiveBranch();
  const { settings } = useShopSettings();
  const lowStockLimit = settings.lowStockThreshold;
  const daysBefore = settings.reminderDaysBefore;
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  const { promises, callLogs, snoozes, setSnooze, clearSnooze } = useCollectionTracker();

  // State
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("late_desc");

  // Modals state
  const [smartReminderTarget, setSmartReminderTarget] = useState<{
    inv: Invoice;
    customer: Customer;
    daysLate: number;
    totalBalance: number;
    promiseDate?: string | null;
  } | null>(null);

  const [promiseModalTarget, setPromiseModalTarget] = useState<{
    inv: Invoice;
    customer: Customer;
  } | null>(null);

  const [payInvId, setPayInvId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [paying, setPaying] = useState(false);

  // Periodic ticker to check snoozes and timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const now = Date.now();

  // Raw Alert items (all due soon or overdue)
  const allAlertItems = useMemo(() => {
    return data.invoices
      .filter((inv) => isDueSoonOrOverdue(inv, daysBefore))
      .filter((inv) => {
        const remaining = inv.total - inv.paid;
        return remaining > 0.01;
      })
      .map((inv) => {
        const late = daysLate(inv);
        const until = daysUntilDue(inv);
        const customer = data.customers.find((c) => c.id === inv.customerId);
        const activePromise = promises[inv.id] || null;
        const isSnoozed = !!(snoozes[inv.id] && snoozes[inv.id] > now);

        let bracket: "due_today" | "minor" | "moderate" | "critical" = "due_today";
        if (late > 30) bracket = "critical";
        else if (late >= 16) bracket = "moderate";
        else if (late >= 1) bracket = "minor";
        else bracket = "due_today";

        const remaining = inv.total - inv.paid;
        const totalBal = customer ? customerBalance(data.invoices, customer.id, customer.openingBalance) : remaining;

        return {
          inv,
          customer,
          late,
          until,
          bracket,
          activePromise,
          isSnoozed,
          remaining,
          totalBal,
        };
      })
      .filter((item): item is typeof item & { customer: Customer } => !!item.customer);
  }, [data.invoices, data.customers, daysBefore, promises, snoozes, now]);

  // نواقص كل فرع على حدة
  const branchAlerts = useMemo(
    () => getBranchLowStockAlerts(data.branches, data.stockItems, isAllBranches ? undefined : activeBranchId),
    [data.branches, data.stockItems, isAllBranches, activeBranchId]
  );

  // Stock items
  const lowStock = useMemo(() => {
    return data.stockItems
      .filter((it) => it.quantity < lowStockLimit)
      .sort((a, b) => a.quantity - b.quantity);
  }, [data.stockItems, lowStockLimit]);

  // Statistics calculation for KPIs
  const stats = useMemo(() => {
    const overdueItems = allAlertItems.filter((x) => x.late > 0);
    const totalOverdueAmount = overdueItems.reduce((sum, x) => sum + x.remaining, 0);

    const dueTodayItems = allAlertItems.filter((x) => x.late === 0);
    const dueSoonAmount = dueTodayItems.reduce((sum, x) => sum + x.remaining, 0);

    const promiseItems = allAlertItems.filter((x) => !!x.activePromise);
    const promisesAmount = promiseItems.reduce((sum, x) => sum + (x.activePromise?.promisedAmount || x.remaining), 0);

    const criticalItems = allAlertItems.filter((x) => x.late > 30);
    const criticalAmount = criticalItems.reduce((sum, x) => sum + x.remaining, 0);

    return {
      totalOverdueAmount,
      overdueCount: overdueItems.length,
      dueSoonAmount,
      dueSoonCount: dueTodayItems.length,
      promisesCount: promiseItems.length,
      promisesAmount,
      criticalCount: criticalItems.length,
      criticalAmount,
      lowStockCount: lowStock.length,
    };
  }, [allAlertItems, lowStock]);

  // Filtered & Sorted items
  const displayItems = useMemo(() => {
    return allAlertItems
      .filter((item) => {
        // Tab filtering
        if (activeTab === "due_today" && item.bracket !== "due_today") return false;
        if (activeTab === "minor" && item.bracket !== "minor") return false;
        if (activeTab === "moderate" && item.bracket !== "moderate") return false;
        if (activeTab === "critical" && item.bracket !== "critical") return false;
        if (activeTab === "promises" && !item.activePromise) return false;

        // Search filtering
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = item.customer.name.toLowerCase().includes(q);
          const matchPhone = item.customer.phone?.includes(q);
          const matchInv = (item.inv.invoiceNumber || item.inv.id).toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchInv) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === "late_desc") return b.late - a.late;
        if (sortOption === "remaining_desc") return b.remaining - a.remaining;
        if (sortOption === "due_asc") return a.until - b.until;
        return 0;
      });
  }, [allAlertItems, activeTab, searchQuery, sortOption]);

  const payTarget = payInvId ? allAlertItems.find((x) => x.inv.id === payInvId) : null;

  const openPay = (invId: string, suggested: number) => {
    setPayInvId(invId);
    setPayAmount(String(Math.round(suggested)));
  };

  const submitPayment = async () => {
    if (!payTarget) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    setPaying(true);
    try {
      await db.recordPayment(payTarget.inv.id, amount);
      toast.success("تم تسجيل الدفعة بنجاح");
      setPayInvId(null);
      setPayAmount("");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل تسجيل الدفعة");
    } finally {
      setPaying(false);
    }
  };

  // 1-Click Print Official Demand Notice A4
  const handlePrintDemandNotice = (item: typeof allAlertItems[0]) => {
    const customerInvoices = data.invoices
      .filter((i) => i.customerId === item.customer.id && i.total - i.paid > 0.01)
      .map((i) => ({
        invoiceNo: i.invoiceNumber || i.id.slice(0, 6),
        date: new Date(i.date || i.createdAt).toLocaleDateString("ar-EG"),
        dueDate: i.firstDueDate ? new Date(i.firstDueDate).toLocaleDateString("ar-EG") : undefined,
        total: i.total,
        paid: i.paid,
        remaining: i.total - i.paid,
        daysLate: daysLate(i),
      }));

    printDemandLetterA4({
      customerName: item.customer.name,
      customerPhone: item.customer.phone,
      customerAddress: item.customer.address,
      customerNationalId: item.customer.nationalId,
      totalBalance: item.totalBal,
      overdueAmount: item.remaining,
      daysLate: item.late,
      invoices: customerInvoices,
      shopName: settings.shopName || "سِجلّي",
      shopPhone: settings.phone,
      shopAddress: settings.address,
      taxNumber: settings.taxNumber,
      deadlineDays: 7,
    });
  };

  // Print Daily Field Collection Sheet
  const handlePrintCollectorSheet = () => {
    const sheetItems: CollectorSheetItem[] = allAlertItems.map((it) => ({
      customerName: it.customer.name,
      customerPhone: it.customer.phone || "-",
      customerAddress: it.customer.address || "غير مسجل",
      invoiceNo: it.inv.invoiceNumber || it.inv.id.slice(0, 6),
      dueDate: it.inv.firstDueDate ? new Date(it.inv.firstDueDate).toLocaleDateString("ar-EG") : "-",
      daysLate: it.late,
      remainingAmount: it.remaining,
      totalCustomerBalance: it.totalBal,
      lastPromiseDate: it.activePromise?.promisedDate || null,
      statusSeverity: it.bracket === "critical" ? "critical" : it.bracket === "moderate" ? "moderate" : it.bracket === "minor" ? "minor" : it.until > 0 ? "soon" : "due",
    }));

    if (sheetItems.length === 0) {
      toast.info("لا توجد فواتير متأخرة للطباعة حالياً");
      return;
    }

    printCollectorSheetA4(sheetItems, settings.shopName || "سِجلّي", settings.phone || "");
  };

  const tabs: Array<{ id: TabType; label: string; count?: number; icon?: React.ReactNode }> = [
    { id: "all", label: "الكل", count: allAlertItems.length },
    { id: "due_today", label: "🎯 مستحق اليوم وقريباً", count: stats.dueSoonCount },
    { id: "minor", label: "🟡 تأخر (1-15 يوم)", count: allAlertItems.filter((x) => x.bracket === "minor").length },
    { id: "moderate", label: "🟠 تأخر (16-30 يوم)", count: allAlertItems.filter((x) => x.bracket === "moderate").length },
    { id: "critical", label: "🔴 متعثر (>30 يوم)", count: stats.criticalCount },
    { id: "promises", label: "🤝 وعود السداد", count: stats.promisesCount },
    { id: "stock", label: "📦 نواقص المخزن", count: stats.lowStockCount },
    { id: "history", label: "📞 سجل المتابعات", count: callLogs.length },
  ];

  return (
    <>
      <PageHeader
        title="المنبه والتحصيل المالي الذكي"
        subtitle="مركز إدارة المتأخرات، وجدولة المتابعات الهاتفية، ورسائل التحصيل عبر واتساب والمطالبات الرسمية."
        icon={<Bell className="w-7 h-7 text-rose-500" />}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-primary/40 hover:bg-primary/5 text-primary"
              onClick={handlePrintCollectorSheet}
              title="طباعة كشف خطة التحصيل الميداني للمحصلين"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">كشف التحصيل الميداني</span>
            </Button>

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
          </div>
        }
      />

      <div className="space-y-6">
        {/* Top KPI Cards */}
        <AlertsKpiStrip
          totalOverdueAmount={stats.totalOverdueAmount}
          overdueCount={stats.overdueCount}
          dueSoonAmount={stats.dueSoonAmount}
          dueSoonCount={stats.dueSoonCount}
          promisesCount={stats.promisesCount}
          promisesAmount={stats.promisesAmount}
          criticalCount={stats.criticalCount}
          criticalAmount={stats.criticalAmount}
          lowStockCount={stats.lowStockCount}
          blurCls={blurCls}
          activeTab={activeTab}
          onSelectTab={(t) => setActiveTab(t as TabType)}
        />

        {/* Tab Selection Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/60 scrollbar-none">
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] rounded-full font-mono font-bold",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Sort Controls (for list views) */}
        {activeTab !== "stock" && activeTab !== "history" && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم العميل أو الهاتف أو الفاتورة..."
                className="pr-9 text-xs text-right h-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>الترتيب:</span>
              </div>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="bg-card border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="late_desc">الأكثر تأخراً أولاً</option>
                <option value="remaining_desc">المبلغ المتبقي الأكبر أولاً</option>
                <option value="due_asc">الأقرب استحقاقاً</option>
              </select>
            </div>
          </div>
        )}

        {/* Content based on Active Tab */}
        {activeTab === "history" ? (
          <CallLogsViewer logs={callLogs} customers={data.customers} />
        ) : activeTab === "stock" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2 text-warning">
                <Package className="w-5 h-5" /> نواقص المخزن (أقل من {lowStockLimit} وحدات)
              </h3>
              <Link to="/inventory" className="text-xs text-primary hover:underline font-bold">
                إدارة المخزن بالكامل ←
              </Link>
            </div>

            {branchAlerts.length > 0 && (
              <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-primary flex items-center gap-2">
                    <Package className="w-4 h-4" /> نواقص على مستوى الفروع ({branchAlerts.length})
                  </div>
                  <Link to="/branches" className="text-[11px] font-bold text-primary hover:underline">
                    إدارة الفروع ←
                  </Link>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {branchAlerts.slice(0, 12).map((a) => (
                    <div
                      key={`${a.branchId}-${a.stockItemId}`}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs",
                        a.isOut ? "border-rose-500/40 bg-rose-500/[0.05]" : "border-amber-500/40 bg-amber-500/[0.05]"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-bold truncate">{a.itemName}</div>
                        <div className="text-[10px] text-muted-foreground">{a.branchName}</div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className={cn("font-extrabold text-numeric", a.isOut ? "text-rose-600" : "text-amber-600")}>
                          {a.quantity}
                        </div>
                        <div className="text-[10px] text-muted-foreground">الحد {a.minStock}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lowStock.length === 0 ? (
              <div className="text-center py-16 bg-card border rounded-2xl p-6">
                <Package className="w-12 h-12 mx-auto text-emerald-500 mb-2 opacity-80" />
                <div className="text-base font-bold text-foreground">المخزون مكتمل ومستقر 🎉</div>
                <div className="text-xs text-muted-foreground mt-1">لا توجد أصناف تحت حد الأمان المطلوب.</div>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {lowStock.map((it) => {
                  const out = it.quantity <= 0;
                  return (
                    <Link
                      key={it.id}
                      to="/inventory"
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl border p-4 transition-all duration-200 hover:shadow-xs",
                        out
                          ? "border-rose-500/40 bg-rose-500/[0.04] hover:bg-rose-500/[0.08]"
                          : "border-amber-500/40 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-2.5 rounded-xl",
                            out ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          )}
                        >
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-foreground">{it.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {out ? "نفذ بالكامل من المخزن — يلزم الشراء فوراً" : "كمية منخفضة جداً — تحت حد الأمان"}
                          </div>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className={cn("text-2xl font-black tabular-nums", out ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400", blurCls)}>
                          {fmt(it.quantity)}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-semibold">المتبقي بالمخزن</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Invoices List */
          <div className="space-y-3.5">
            <AnimatePresence initial={false}>
              {displayItems.map(({ inv, customer, late, until, bracket, activePromise, isSnoozed, remaining, totalBal }, idx) => {
                const upcoming = until > 0;
                const dueAmount = Math.min(inv.monthlyInstallment || remaining, remaining);

                const cardStyles = {
                  due_today: {
                    border: "border-emerald-500/40 bg-emerald-500/[0.03]",
                    badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
                    accent: "text-emerald-600 dark:text-emerald-400",
                    label: upcoming ? `يستحق بعد ${until} يوم` : "مستحق السداد اليوم",
                  },
                  minor: {
                    border: "border-amber-500/40 bg-amber-500/[0.03]",
                    badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
                    accent: "text-amber-600 dark:text-amber-400",
                    label: `تأخر بسيط (${late} يوم)`,
                  },
                  moderate: {
                    border: "border-orange-500/40 bg-orange-500/[0.03]",
                    badgeBg: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
                    accent: "text-orange-600 dark:text-orange-400",
                    label: `تأخر متوسط (${late} يوم)`,
                  },
                  critical: {
                    border: "border-rose-500/50 bg-rose-500/[0.04]",
                    badgeBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
                    accent: "text-rose-600 dark:text-rose-400",
                    label: `ديون حرجة متعثرة (${late} يوم)`,
                  },
                }[bracket];

                return (
                  <motion.div
                    key={inv.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
                    className={cn(
                      "rounded-2xl border p-4 sm:p-5 transition-all shadow-2xs hover:shadow-xs",
                      cardStyles.border,
                      isSnoozed && "opacity-60 bg-muted/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      {/* Left Metrics / Indicators */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Days Counter */}
                        <div className="text-center bg-card rounded-2xl p-3 min-w-[90px] border shadow-2xs">
                          <div className={cn("text-2xl font-black font-mono", cardStyles.accent)}>
                            {upcoming ? until : late > 0 ? late : "اليوم"}
                          </div>
                          <div className="text-[10.5px] text-muted-foreground font-semibold">
                            {upcoming ? "يوم متبقي" : late > 0 ? "يوم تأخر" : "مستحق"}
                          </div>
                        </div>

                        {/* Amount Due Box */}
                        <div className="bg-card rounded-2xl p-3 border shadow-2xs min-w-[130px] text-right">
                          <div className="text-[11px] text-muted-foreground font-medium">
                            {upcoming ? "قيمة القسط القريب" : "المبلغ المستحق"}
                          </div>
                          <div className={cn("text-lg font-black font-mono", cardStyles.accent, blurCls)}>
                            {fmt(dueAmount)} <span className="text-xs font-bold">ج.م</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            من أصل <b className={blurCls}>{fmt(remaining)}</b> ج.م
                          </div>
                        </div>
                      </div>

                      {/* Right: Customer Info & Status */}
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          <span className={cn("text-[11px] px-2.5 py-0.5 rounded-full font-bold border", cardStyles.badgeBg)}>
                            {cardStyles.label}
                          </span>
                          <Link
                            to={`/customers?id=${customer.id}`}
                            className="text-base sm:text-lg font-black text-foreground hover:text-primary transition-colors hover:underline"
                          >
                            {customer.name}
                          </Link>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground justify-end flex-wrap pt-0.5">
                          {customer.phone && (
                            <a
                              href={`tel:${customer.phone}`}
                              className="flex items-center gap-1 hover:text-foreground font-mono"
                              title="اتصال هاتفي"
                            >
                              <Phone className="w-3.5 h-3.5 text-primary" />
                              <span dir="ltr">{customer.phone}</span>
                            </a>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>
                              {upcoming ? "تاريخ الاستحقاق: " : "مستحق منذ: "}
                              {inv.firstDueDate ? new Date(inv.firstDueDate).toLocaleDateString("ar-EG") : "-"}
                            </span>
                          </div>
                        </div>

                        {/* Total Customer Balance */}
                        <div className="text-xs text-muted-foreground flex items-center justify-end gap-1.5">
                          <span>إجمالي رصيد العميل بالكامل:</span>
                          <b className={cn("text-foreground font-mono font-bold", blurCls)}>{fmt(totalBal)} ج.م</b>
                        </div>
                      </div>
                    </div>

                    {/* Active Promise to Pay notification badge if exists */}
                    {activePromise && (
                      <div className="mt-3.5 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between flex-wrap gap-2 text-right">
                        <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-300">
                          <Handshake className="w-4 h-4 text-sky-500 shrink-0" />
                          <span>
                            🤝 يوجد وعد بالسداد بتاريخ: <b>{activePromise.promisedDate}</b>
                            {activePromise.promisedAmount ? ` بمبلغ ${fmt(activePromise.promisedAmount)} ج.م` : ""}
                            {activePromise.note ? ` (${activePromise.note})` : ""}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPromiseModalTarget({ inv, customer })}
                          className="text-[11px] h-6 px-2 text-sky-600 hover:text-sky-700 hover:bg-sky-500/15"
                        >
                          تعديل الوعد
                        </Button>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="mt-4 pt-3.5 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 1. Quick Pay */}
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs shadow-xs"
                          onClick={() => openPay(inv.id, dueAmount)}
                        >
                          <Wallet className="w-3.5 h-3.5" /> تسجيل دفعة
                        </Button>

                        {/* 2. Smart Reminder / WhatsApp modal */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 h-8 text-xs font-bold"
                          onClick={() =>
                            setSmartReminderTarget({
                              inv,
                              customer,
                              daysLate: late,
                              totalBalance: totalBal,
                              promiseDate: activePromise?.promisedDate,
                            })
                          }
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> رسالة ذكية / واتساب
                        </Button>

                        {/* 3. Record Call / Promise */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-sky-500/40 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 h-8 text-xs font-bold"
                          onClick={() => setPromiseModalTarget({ inv, customer })}
                        >
                          <PhoneCall className="w-3.5 h-3.5" /> تسجيل مكالمة / وعد
                        </Button>

                        {/* 4. Print Official Demand Letter */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-muted-foreground hover:text-foreground h-8 text-xs"
                          onClick={() => handlePrintDemandNotice({ inv, customer, late, until, bracket, activePromise, isSnoozed, remaining, totalBal })}
                          title="طباعة خطاب مطالبة مالية رسمي A4"
                        >
                          <FileText className="w-3.5 h-3.5" /> خطاب مطالبة A4
                        </Button>
                      </div>

                      {/* Snooze 24h button */}
                      <div>
                        {isSnoozed ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs text-amber-600 hover:text-amber-700 h-8"
                            onClick={() => {
                              clearSnooze(inv.id);
                              toast.info("تم إلغاء التأجيل");
                            }}
                          >
                            <Clock className="w-3.5 h-3.5" /> مؤجل حالياً (إلغاء)
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs text-muted-foreground hover:text-foreground h-8"
                            onClick={() => {
                              setSnooze(inv.id, 24);
                              toast.success("تم تأجيل التنبيه لمدة 24 ساعة");
                            }}
                            title="تأجيل التنبيه لمدة 24 ساعة"
                          >
                            <Clock className="w-3.5 h-3.5" /> تأجيل 24س
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {displayItems.length === 0 && (
              <div className="text-center py-20 bg-card border rounded-2xl p-6">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3 opacity-90" />
                <div className="text-lg font-bold text-foreground">لا توجد تنبيهات في هذا القسم 🎉</div>
                <div className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? "لا توجد نتائج مطابقة لبحثك، جرب البحث بكلمة أخرى."
                    : "جميع العملاء مسددين في المواعيد أو تم تأجيلهم."}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. Smart Reminder Modal */}
      {smartReminderTarget && (
        <SmartReminderModal
          open={!!smartReminderTarget}
          onOpenChange={(o) => !o && setSmartReminderTarget(null)}
          invoice={smartReminderTarget.inv}
          customer={smartReminderTarget.customer}
          daysLate={smartReminderTarget.daysLate}
          totalBalance={smartReminderTarget.totalBalance}
          promiseDate={smartReminderTarget.promiseDate}
        />
      )}

      {/* 2. Promise to Pay / Call Log Modal */}
      {promiseModalTarget && (
        <PromiseModal
          open={!!promiseModalTarget}
          onOpenChange={(o) => !o && setPromiseModalTarget(null)}
          invoice={promiseModalTarget.inv}
          customer={promiseModalTarget.customer}
          existingPromise={promises[promiseModalTarget.inv.id]}
        />
      )}

      {/* 3. Quick Pay Dialog */}
      <Dialog
        open={!!payTarget}
        onOpenChange={(o) => {
          if (!o) {
            setPayInvId(null);
            setPayAmount("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Wallet className="w-5 h-5 text-emerald-600" />
              تسجيل دفعة سريعة
            </DialogTitle>
            <DialogDescription className="text-right">
              {payTarget
                ? `العميل: ${payTarget.customer.name} • المتبقي: ${fmt(payTarget.remaining)} ج.م`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-right pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="quick-pay-amount" className="text-xs font-bold text-muted-foreground">
                المبلغ المراد سداده (ج.م)
              </Label>
              <Input
                id="quick-pay-amount"
                type="number"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0"
                className="text-right font-mono text-lg font-black"
                autoFocus
              />
            </div>

            {payTarget && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPayAmount(String(Math.round(payTarget.inv.monthlyInstallment || payTarget.remaining)))}
                  className="text-xs flex-1"
                >
                  قيمة القسط ({fmt(payTarget.inv.monthlyInstallment || payTarget.remaining)})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPayAmount(String(Math.round(payTarget.remaining)))}
                  className="text-xs flex-1"
                >
                  كامل المتبقي ({fmt(payTarget.remaining)})
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row-reverse items-center justify-between gap-2 pt-3 border-t mt-3">
            <div className="flex gap-2">
              <Button onClick={submitPayment} disabled={paying} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                <Wallet className="w-4 h-4" /> تأكيد وقيد الدفع
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPayInvId(null);
                  setPayAmount("");
                }}
              >
                إلغاء
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
