import { PageTransition } from "@/components/PageTransition";
import { usePrivacy } from "@/lib/privacy";
import { Link } from "@/lib/router-compat";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
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
  getTreasuryAccounts,
  getManualTransactions,
  getInternalTransfers,
  calculateAccountBalance,
} from "@/lib/cashbox-system";
import { runComprehensiveReconciliation } from "@/lib/reconciliation-engine";
import { exportExecutiveReport } from "@/lib/executive-report-pdf";
import {
  useDashboardLayout,
  DashboardCustomizationModal,
  type DashboardSectionId,
} from "@/components/DashboardCustomization";
import { getMyStorefront, getMyStoreOrders, type Storefront, type StoreOrder } from "@/lib/storefront";
import {
  Crown,
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
  Boxes,
  ShieldCheck,
  Package,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  Clock,
  Flame,
  CheckCircle2,
  ChevronLeft,
  Printer,
  SlidersHorizontal,
  Store,
  ExternalLink,
  ShoppingBag,
  ArrowRight,
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
  BarChart,
  Bar,
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
const PRIMARY = "oklch(0.62 0.18 250)";

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

type TimeRange = "today" | "7d" | "30d" | "month" | "all";
type TopProductsSort = "quantity" | "revenue";

export function Dashboard() {
  const data = useDB();
  const { privacy, toggle } = usePrivacy();
  const [timeRange, setTimeRange] = useState<TimeRange>("month");
  const [topProductsSort, setTopProductsSort] = useState<TopProductsSort>("quantity");
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const { sections, isVisible, toggleSection, moveSection, resetToDefault } = useDashboardLayout();

  // Storefront live stats
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>([]);
  const [storefrontLoading, setStorefrontLoading] = useState(false);
  const [storefrontError, setStorefrontError] = useState<string | null>(null);
  const [storefrontLoadAttempt, setStorefrontLoadAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    const loadStoreStats = async () => {
      setStorefrontLoading(true);
      setStorefrontError(null);
      try {
        const shop = await getMyStorefront();
        if (!mounted) return;
        setStorefront(shop);
        if (shop) {
          const orders = await getMyStoreOrders(shop.id);
          if (mounted) setStoreOrders(orders);
        }
      } catch (error) {
        console.error("تعذر تحميل بيانات المتجر", error);
        if (mounted) setStorefrontError("تعذر تحميل بيانات المتجر الآن");
      } finally {
        if (mounted) setStorefrontLoading(false);
      }
    };
    loadStoreStats();
    return () => {
      mounted = false;
    };
  }, [storefrontLoadAttempt]);

  const m = (s: string) => (privacy ? "•••••" : s);

  const today = new Date();

  // Range filter bounds
  const rangeBounds = useMemo(() => {
    const now = new Date();
    if (timeRange === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { start, end: now };
    }
    if (timeRange === "7d") {
      const start = new Date(now.getTime() - 7 * 86400000);
      return { start, end: now };
    }
    if (timeRange === "30d") {
      const start = new Date(now.getTime() - 30 * 86400000);
      return { start, end: now };
    }
    if (timeRange === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: now };
    }
    return { start: new Date(2000, 0, 1), end: now };
  }, [timeRange]);

  const isInRange = (d: Date | string) => {
    const t = new Date(d).getTime();
    return t >= rangeBounds.start.getTime() && t <= rangeBounds.end.getTime();
  };

  // ---- Summary stats ----
  const totalDebt =
    data.invoices.reduce((s, i) => s + (i.total - i.paid), 0) +
    data.customers.reduce((s, c) => s + (c.openingBalance || 0), 0);

  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  // Filtered collections based on selected time-range
  const rangeCollected = useMemo(() => {
    return data.payments
      .filter((p) => isInRange(p.paidAt))
      .reduce((s, p) => s + p.amount, 0);
  }, [data.payments, rangeBounds]);

  // Inventory valuation & low stock count
  const inventoryStats = useMemo(() => {
    let totalCostValuation = 0;
    let totalSaleValuation = 0;
    let totalUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of data.stockItems) {
      const qty = item.quantity || 0;
      const cost = item.lastUnitCost || 0;
      const price = item.salePrice || 0;
      const min = item.minStock || 5;

      totalUnits += qty;
      totalCostValuation += qty * cost;
      totalSaleValuation += qty * price;

      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= min) {
        lowStockCount++;
      }
    }

    return {
      totalCostValuation: roundCurrency(totalCostValuation),
      totalSaleValuation: roundCurrency(totalSaleValuation),
      potentialMargin: roundCurrency(totalSaleValuation - totalCostValuation),
      totalUnits,
      lowStockCount,
      outOfStockCount,
    };
  }, [data.stockItems]);

  // Cashbox live total liquidity across accounts
  const treasuryLiquidityResult = useMemo((): { value: number | null; error: string | null } => {
    try {
      const accounts = getTreasuryAccounts();
      const manualTxs = getManualTransactions();
      const transfers = getInternalTransfers();

      let total = 0;
      for (const acc of accounts) {
        const bal = calculateAccountBalance(
          acc,
          data.invoices,
          data.payments,
          data.expenses,
          manualTxs,
          transfers
        );
        total += bal.currentBalance;
      }
      return { value: roundCurrency(total), error: null };
    } catch (error) {
      console.error("تعذر التحقق من رصيد الخزينة", error);
      return { value: null, error: "تعذر التحقق من الرصيد" };
    }
  }, [data.invoices, data.payments, data.expenses]);
  const treasuryLiquidity = treasuryLiquidityResult.value;

  // Shipping & COD statistics
  const shippingStats = useMemo(() => {
    const activeShipments = data.shipments.filter(
      (s) => s.status === "shipped" || s.status === "processing"
    );
    const deliveredUnsettled = data.shipments.filter(
      (s) => s.status === "delivered" && s.collectionStatus !== "settled"
    );
    const pendingCodAmount = deliveredUnsettled.reduce((s, sh) => s + (sh.codAmount || 0), 0);

    return {
      activeCount: activeShipments.length,
      unsettledCount: deliveredUnsettled.length,
      pendingCodAmount: roundCurrency(pendingCodAmount),
    };
  }, [data.shipments]);

  // Reconciliation health check
  const reconciliationSummary = useMemo(() => {
    return runComprehensiveReconciliation(data, []);
  }, [data]);

  // Top selling products for the selected period, ranked by volume or revenue
  const topProducts = useMemo(() => {
    const salesMap = new Map<string, { name: string; quantity: number; revenue: number; profit: number }>();

    for (const item of data.invoiceItems) {
      const inv = data.invoices.find((i) => i.id === item.invoiceId);
      if (!inv || inv.status === "cancelled" || !isInRange(inv.createdAt)) continue;

      const curr = salesMap.get(item.name) || {
        name: item.name,
        quantity: 0,
        revenue: 0,
        profit: 0,
      };

      const q = item.quantity || 1;
      const revenue = q * (item.price || 0);
      const cost = item.cost ? q * item.cost : 0;
      const profit = revenue - cost;

      salesMap.set(item.name, {
        name: item.name,
        quantity: curr.quantity + q,
        revenue: curr.revenue + revenue,
        profit: curr.profit + profit,
      });
    }

    return Array.from(salesMap.values())
      .sort((a, b) => topProductsSort === "quantity" ? b.quantity - a.quantity : b.revenue - a.revenue)
      .slice(0, 5);
  }, [data.invoiceItems, data.invoices, rangeBounds, topProductsSort]);

  // Profit calculation (Dynamic based on selected time-range)
  const { netProfit, grossProfit, expensesTotal, cashPurchasesTotal, incompleteCostCount } = useMemo(() => {
    const expenses = data.expenses
      .filter((e) => isInRange(e.expenseDate))
      .reduce((s, e) => s + e.amount, 0);

    const cashPurchases = data.purchases
      .filter((p) => p.paymentType === "cash" && isInRange(p.purchaseDate))
      .reduce((s, p) => s + p.total, 0);
    
    const rangeInvoices = data.invoices.filter((invoice) => {
      return invoice.status !== "cancelled" && isInRange(invoice.createdAt);
    });

    const invoiceIds = new Set(rangeInvoices.map((invoice) => invoice.id));
    const sales = rangeInvoices.reduce((sum, invoice) => sum + invoice.total - (invoice.taxAmount ?? 0), 0);
    const rangeItems = data.invoiceItems.filter((item) => invoiceIds.has(item.invoiceId));
    
    const itemsByInvoice = new Map<string, typeof rangeItems>();
    for (const item of rangeItems) {
      itemsByInvoice.set(item.invoiceId, [...(itemsByInvoice.get(item.invoiceId) ?? []), item]);
    }

    const incomplete = rangeInvoices.filter((invoice) => {
      const items = itemsByInvoice.get(invoice.id) ?? [];
      return items.length === 0 || items.some((item) => !Number.isFinite(item.cost) || item.cost <= 0);
    });

    const cogs = rangeItems
      .filter((item) => !incomplete.some((invoice) => invoice.id === item.invoiceId))
      .reduce((sum, item) => sum + item.cost * item.quantity, 0);

    const returns = data.returns
      .filter((item) => item.type === "sale" && isInRange(item.createdAt))
      .reduce((sum, item) => sum + item.totalAmount, 0);

    const gross = roundCurrency(sales - cogs - returns);

    return {
      netProfit: roundCurrency(gross - expenses - cashPurchases),
      grossProfit: gross,
      expensesTotal: expenses,
      cashPurchasesTotal: cashPurchases,
      incompleteCostCount: incomplete.length,
    };
  }, [data.expenses, data.purchases, data.invoices, data.invoiceItems, data.returns, rangeBounds]);

  // Storefront calculated metrics
  const storefrontStats = useMemo(() => {
    const totalOrders = storeOrders.length;
    const pendingOrders = storeOrders.filter((o) => o.status === "submitted" || o.status === "under_review").length;
    const completedOrders = storeOrders.filter((o) => o.status === "delivered" || o.status === "shipped").length;
    const storeRevenue = storeOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + (o.total || 0), 0);

    // Orders in today
    const todayOrders = storeOrders.filter((o) => {
      const d = new Date(o.created_at);
      return d.toDateString() === today.toDateString();
    });
    const todayRevenue = todayOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      storeRevenue,
      todayOrdersCount: todayOrders.length,
      todayRevenue,
    };
  }, [storeOrders, today]);

  // Executive PDF export handler
  const handleExportExecutiveReport = () => {
    const totalSalesRevenue = data.invoices
      .filter((i) => (i as any).status !== "cancelled" && isInRange(i.createdAt))
      .reduce((s, i) => s + (i.total || 0), 0);

    const totalCollections = data.payments
      .filter((p) => isInRange(p.paidAt))
      .reduce((s, p) => s + (p.amount || 0), 0);

    exportExecutiveReport({
      timeRangeLabel: rangeLabel,
      generatedAt: new Date(),
      treasuryLiquidity: treasuryLiquidity ?? 0,
      totalCustomerDebt: totalDebt,
      totalSupplierDebt,
      collectedAmount: totalCollections,
      salesAmount: totalSalesRevenue,
      expensesAmount: expensesTotal,
      netProfit,
      inventoryCostValuation: inventoryStats.totalCostValuation,
      inventorySaleValuation: inventoryStats.totalSaleValuation,
      lowStockCount: inventoryStats.lowStockCount,
      outOfStockCount: inventoryStats.outOfStockCount,
      pendingCodAmount: shippingStats.pendingCodAmount,
      unsettledShipmentsCount: shippingStats.unsettledCount,
      healthScore: reconciliationSummary.healthScore,
      auditFindingsCount: reconciliationSummary.criticalCount + reconciliationSummary.warningCount,
      storefrontOrdersCount: storefrontStats.todayOrdersCount,
      storefrontNewRevenue: storefrontStats.todayRevenue,
      topProducts: topProducts.map((p) => ({
        name: p.name,
        quantity: p.quantity,
        revenue: p.revenue,
        profit: p.profit,
      })),
      dueTodayList: dueToday.slice(0, 10).map((d) => ({
        customerName: d.customer?.name || "عميل غير محدد",
        amount: d.due,
        phone: d.customer?.phone || "",
        isLate: d.late > 0,
      })),
      atRiskCustomers: atRiskCustomers.slice(0, 10).map((c) => ({
        customerName: c.customer.name,
        phone: c.customer.phone || "",
        balance: c.balance,
        daysLate: c.maxLate,
      })),
    });
  };

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
    const invoiceIdsByMonth = keys.map(() => new Set<string>());
    for (const inv of data.invoices) {
      const i = idxOf(inv.createdAt);
      if (i >= 0 && inv.status !== "cancelled") {
        invoiced[i] += inv.total - (inv.taxAmount ?? 0);
        invoiceIdsByMonth[i].add(inv.id);
      }
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

    // Actual debt snapshot at each month end from records available at that date.
    const debtTrend = keys.map((key) => {
      const [year, month] = key.split("-").map(Number);
      const end = new Date(year, month + 1, 1).getTime();
      const opening = data.customers
        .filter((customer) => new Date(customer.createdAt).getTime() < end)
        .reduce((sum, customer) => sum + (customer.openingBalance || 0), 0);
      const outstanding = data.invoices
        .filter((invoice) => invoice.status !== "cancelled" && new Date(invoice.createdAt).getTime() < end)
        .reduce((sum, invoice) => {
          const paidByEnd = data.payments
            .filter((payment) => payment.invoiceId === invoice.id && new Date(payment.paidAt).getTime() < end)
            .reduce((paid, payment) => paid + payment.amount, 0);
          return sum + Math.max(0, invoice.total - (invoice.downPayment || 0) - paidByEnd);
        }, 0);
      return roundCurrency(opening + outstanding);
    });

    const supplierRunning: number[] = [];
    let sacc = 0;
    for (let i = 0; i < keys.length; i++) {
      sacc += creditPurchases[i] - supplierPaid[i];
      supplierRunning.push(Math.max(0, sacc));
    }

    const cogs = zero();
    for (let i = 0; i < keys.length; i++) {
      const invoiceIds = invoiceIdsByMonth[i];
      const monthItems = data.invoiceItems.filter((item) => invoiceIds.has(item.invoiceId));
      const incompleteIds = new Set(
        [...invoiceIds].filter((invoiceId) => {
          const items = monthItems.filter((item) => item.invoiceId === invoiceId);
          return items.length === 0 || items.some((item) => !Number.isFinite(item.cost) || item.cost <= 0);
        }),
      );
      cogs[i] = monthItems
        .filter((item) => !incompleteIds.has(item.invoiceId))
        .reduce((sum, item) => sum + item.cost * item.quantity, 0);
    }
    const returned = zero();
    for (const record of data.returns) {
      if (record.type !== "sale") continue;
      const i = idxOf(record.createdAt);
      if (i >= 0) returned[i] += record.totalAmount;
    }
    const profitTrend = keys.map((_, i) =>
      roundCurrency(invoiced[i] - cogs[i] - returned[i] - expenses[i] - cashPurchases[i]),
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
    data.invoiceItems,
    data.returns,
  ]);

  // ---- Expense breakdown (this month) ----
  const expenseBreakdown = useMemo(() => {
    const by = new Map<string, number>();
    for (const e of data.expenses) {
      if (!isInRange(e.expenseDate)) continue;
      by.set(e.category, (by.get(e.category) ?? 0) + e.amount);
    }
    const colors = [EMERALD, WARNING, DANGER, "oklch(0.6 0.15 240)", "oklch(0.7 0.18 320)"];
    return Array.from(by.entries()).map(([cat, value], i) => ({
      name: expenseCategoryLabel(cat as never),
      value,
      color: colors[i % colors.length],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.expenses, rangeBounds]);
  const totalRangeExpenses = expenseBreakdown.reduce((s, x) => s + x.value, 0);

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
        return c.dueDay === dom && daysLate(i) === 0;
      })
      .map((i) => {
        const c = data.customers.find((cc) => cc.id === i.customerId);
        const remaining = i.total - i.paid;
        const due = Math.min(i.monthlyInstallment || remaining, remaining);
        return { inv: i, customer: c, due, late: daysLate(i) };
      })
      .sort((a, b) => a.customer?.name.localeCompare(b.customer?.name ?? "") ?? 0)
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
              ? `التحصيلات ارتفعت ${Math.round(diff)}% مقارنة بالأسبوع السابق`
              : `التحصيلات انخفضت ${Math.abs(Math.round(diff))}% مقارنة بالأسبوع السابق`,
          tone: diff > 0 ? "success" : "warning",
        });
      }
    } else if (thisWeek > 0) {
      out.push({ text: `تم تحصيل ${fmt(thisWeek)} ج.م خلال آخر 7 أيام`, tone: "success" });
    }

    if (inventoryStats.lowStockCount > 0 || inventoryStats.outOfStockCount > 0) {
      out.push({
        text: `المخزون: ${inventoryStats.outOfStockCount} صنف نفد رصيده بالكامل، و ${inventoryStats.lowStockCount} صنف قارب على النفاد`,
        tone: "warning",
      });
    }

    if (shippingStats.unsettledCount > 0) {
      out.push({
        text: `شحن COD: يوجد ${shippingStats.unsettledCount} شحنة مسلّمة بإجمالي ${fmt(shippingStats.pendingCodAmount)} ج.م تنتظر التوريد للخزينة`,
        tone: "info",
      });
    }

    if (reconciliationSummary.healthScore < 90) {
      out.push({
        text: `الرقابة المالية: مؤشر الصحة ${reconciliationSummary.healthScore}% — يوجد ${reconciliationSummary.findings.length} ملاحظة تدقيقية تحتاج مراجعة`,
        tone: reconciliationSummary.healthScore < 75 ? "danger" : "warning",
      });
    }

    const dom = today.getDate();
    const dueTodayCount = dueToday.length;
    if (dueTodayCount > 0) {
      out.push({ text: `${dueTodayCount} فاتورة تستحق التحصيل اليوم حسب الموعد المحدد`, tone: "warning" });
    }

    const defaulters = data.customers.filter((c) => c.status === "defaulter").length;
    if (defaulters > 0) {
      out.push({ text: `يوجد ${defaulters} عميل في حالة تعثر — راجع قائمة المتابعة والتحصيل`, tone: "danger" });
    }

    if (out.length === 0) {
      out.push({ text: "جميع العمليات والمؤشرات متطابقة ومستقرة تماماً", tone: "success" });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.payments, data.invoices, data.customers, atRiskCustomers, inventoryStats, shippingStats, reconciliationSummary, dueToday]);

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

  // هيكل تحميل
  if (data.loading && data.invoices.length === 0 && data.customers.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Live overview"
          title="لوحة التحكم الرئيسية"
          subtitle="جاري تجهيز وتدقيق مؤشراتك المالية والتشغيلية…"
        />
        <section className="mb-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CardsSkeleton count={4} height="h-36" />
        </section>
        <section className="mb-14 grid gap-4 lg:grid-cols-3">
          <BlockSkeleton className="h-72 lg:col-span-2" />
          <BlockSkeleton className="h-72" />
        </section>
      </>
    );
  }

  const rangeLabel = {
    today: "اليوم",
    "7d": "آخر 7 أيام",
    "30d": "آخر 30 يوم",
    month: "هذا الشهر",
    all: "كافة السجلات",
  }[timeRange];

  return (
    <>
      {/* Header & Quick Filter Controls */}
      <PageHeader
        eyebrow="Live overview"
        title="لوحة التحكم الرئيسية"
        subtitle="مركز القيادة والرقابة اللحظية على الخزينة، الديون، المخزون، المبيعات والشحن."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Executive Companion: Segelly Boss */}
            <Link
              to="/owner"
              className="island-btn group bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/25 font-bold"
            >
              <span>تطبيق المالك (سِجلّي Boss)</span>
              <span className="island-btn-icon text-amber-400">
                <Crown className="h-4 w-4" />
              </span>
            </Link>

            {/* Time Range Selector */}
            <div className="flex items-center rounded-lg bg-foreground/[0.05] p-1 ring-1 ring-border text-xs">
              {(["today", "7d", "month", "all"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-semibold transition-all",
                    timeRange === r
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r === "today" ? "اليوم" : r === "7d" ? "7 أيام" : r === "month" ? "الشهر" : "الكل"}
                </button>
              ))}
            </div>

            {/* Customization Button */}
            <button
              type="button"
              onClick={() => setCustomizationOpen(true)}
              title="تخصيص وترتيب البطاقات"
              className="island-btn group ring-1 bg-foreground/[0.05] text-foreground ring-border hover:bg-foreground/[0.1] transition-all"
            >
              <span className="hidden sm:inline">تخصيص العرض</span>
              <span className="island-btn-icon">
                <SlidersHorizontal className="h-4 w-4" />
              </span>
            </button>

            {/* Export Executive PDF Report */}
            <button
              type="button"
              onClick={handleExportExecutiveReport}
              title="تصدير الموجز التنفيذي للوحة التحكم PDF"
              className="island-btn group ring-1 bg-primary text-primary-foreground ring-primary/30 hover:bg-primary/90 shadow-sm transition-all"
            >
              <span className="hidden sm:inline">تقرير تنفيذي (PDF)</span>
              <span className="island-btn-icon">
                <Printer className="h-4 w-4" />
              </span>
            </button>

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
              to="/reconciliation"
              className={cn(
                "island-btn group ring-1 transition-all",
                reconciliationSummary.healthScore >= 90
                  ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 hover:bg-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 ring-amber-500/20 hover:bg-amber-500/20"
              )}
            >
              <span>المطابقة {reconciliationSummary.healthScore}%</span>
              <span className="island-btn-icon">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </Link>
          </div>
        }
      />

      {/* Render sections according to user order and visibility */}
      {sections.map((section) => {
        if (!section.visible) return null;

        switch (section.id) {
          case "quick_actions":
            return (
              <section key={section.id} className="mb-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Link
                    to="/invoices"
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/70 hover:border-primary/50 transition-all group hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                        <Plus className="h-4 w-4" />
                      </span>
                      <div className="text-right">
                        <div className="text-xs font-bold text-foreground">فاتورة جديدة</div>
                        <div className="text-[10px] text-muted-foreground">بيع / قسط / كاش</div>
                      </div>
                    </div>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </Link>

                  <Link
                    to="/payments"
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/70 hover:border-emerald-500/50 transition-all group hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-105 transition-transform">
                        <ArrowDownLeft className="h-4 w-4" />
                      </span>
                      <div className="text-right">
                        <div className="text-xs font-bold text-foreground">سند تحصيل</div>
                        <div className="text-[10px] text-muted-foreground">توريد للخزينة</div>
                      </div>
                    </div>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground/50 group-hover:text-emerald-600 transition-colors" />
                  </Link>

                  <Link
                    to="/expenses"
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/70 hover:border-rose-500/50 transition-all group hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 group-hover:scale-105 transition-transform">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                      <div className="text-right">
                        <div className="text-xs font-bold text-foreground">إذن صرف مصروف</div>
                        <div className="text-[10px] text-muted-foreground">تشغيلي / إيجار / نثريات</div>
                      </div>
                    </div>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground/50 group-hover:text-rose-600 transition-colors" />
                  </Link>

                  <Link
                    to="/cashbox"
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/70 hover:border-amber-500/50 transition-all group hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-105 transition-transform">
                        <Wallet className="h-4 w-4" />
                      </span>
                      <div className="text-right">
                        <div className="text-xs font-bold text-foreground">حركة الخزينة</div>
                        <div className="text-[10px] text-muted-foreground">{money(treasuryLiquidity)}</div>
                      </div>
                    </div>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground/50 group-hover:text-amber-600 transition-colors" />
                  </Link>
                </div>
              </section>
            );

          case "storefront_bar":
            return (
              <section key={section.id} className="mb-6">
                {storefront ? (
                  <div className="p-4 rounded-3xl bg-gradient-to-r from-primary/10 via-card to-emerald-500/10 border border-primary/20 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Left: Store Stats */}
                      <div className="flex flex-wrap items-center gap-4 text-right">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-2xl bg-primary/15 text-primary">
                            <Store className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-foreground flex items-center gap-2">
                              <span>متجر: {storefront.name}</span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold text-[10px]">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                نشط أونلاين
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {storefront.slug ? `${storefront.slug}.segilly.com` : "المتجر الإلكتروني"}
                            </div>
                          </div>
                        </div>

                        <div className="h-7 w-px bg-border hidden md:block" />

                        {/* Quick metrics in pills */}
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-center">
                            <div className="text-[10px] text-muted-foreground">طلبات اليوم</div>
                            <div className="text-xs font-bold text-foreground">
                              {storefrontStats.todayOrdersCount} طلب
                            </div>
                          </div>

                          <div className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-center">
                            <div className="text-[10px] text-muted-foreground">طلبات معلقة</div>
                            <div className={cn("text-xs font-bold", storefrontStats.pendingOrders > 0 ? "text-amber-600" : "text-foreground")}>
                              {storefrontStats.pendingOrders} طلب
                            </div>
                          </div>

                          <div className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-center">
                            <div className="text-[10px] text-muted-foreground">إيراد المتجر</div>
                            <div className={cn("text-xs font-bold text-emerald-600", privacy && "privacy-blur")}>
                              {money(storefrontStats.storeRevenue)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Link
                          to="/storefront"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
                        >
                          <span>إدارة المتجر والطلبات</span>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-3xl bg-muted/40 border border-dashed border-border/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-right">
                      <div className="p-2.5 rounded-2xl bg-muted text-muted-foreground">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">هل ترغب في فتح متجرك الإلكتروني للبيع أونلاين؟</div>
                        <div className="text-[11px] text-muted-foreground">
                          يمكنك إنشاء متجرك ومشاركة الرابط مع زبائنك لاستقبال طلبات البيع مباشرة ومزامنتها لحظياً مع الخزينة والمخزن.
                        </div>
                      </div>
                    </div>
                    <Link
                      to="/storefront"
                      className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-foreground/[0.08] text-foreground text-xs font-bold hover:bg-foreground/[0.15] transition-all"
                    >
                      <span>تفعيل المتجر الآن</span>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </section>
            );

          case "bento_kpis":
            return (
              <section key={section.id} className="mb-14">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:auto-rows-fr">
                  {/* البطل: إجمالي الديون 2×2 */}
                  <Reveal className="col-span-2 h-full lg:row-span-2" delay={0}>
                    <MetricCard
                      hero
                      className="h-full"
                      label="إجمالي الديون الخارجية (لدى العملاء)"
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

                  {/* رصيد الخزينة والسيولة النقدية */}
                  <Reveal className="h-full" delay={70}>
                    <MetricCard
                      className="h-full"
                      label="السيولة النقدية (الخزائن)"
                      value={treasuryLiquidity}
                      format={money}
                      masked={privacy}
                      tone={treasuryLiquidity >= 0 ? "positive" : "danger"}
                      icon={Wallet}
                      series={monthBuckets.payments}
                      sub="إجمالي النقدية المتاحة بالدرج والحسابات"
                    />
                  </Reveal>

                  {/* تقييم بضاعة المخزن */}
                  <Reveal className="h-full" delay={140}>
                    <MetricCard
                      className="h-full"
                      label="قيمة المخزون بسعر التكلفة"
                      value={inventoryStats.totalCostValuation}
                      format={money}
                      masked={privacy}
                      tone="neutral"
                      icon={Boxes}
                      series={monthBuckets.cashPurchases}
                      sub={
                        inventoryStats.lowStockCount > 0 || inventoryStats.outOfStockCount > 0
                          ? `${inventoryStats.outOfStockCount} نافد + ${inventoryStats.lowStockCount} حرج`
                          : `${inventoryStats.totalUnits} قطعة إجمالي الرصيد`
                      }
                    />
                  </Reveal>

                  {/* صافي الأرباح للنطاق الزمني المحدد */}
                  <Reveal className="h-full" delay={210}>
                    <MetricCard
                      className="h-full"
                      label={`صافي الأرباح (${rangeLabel})`}
                      value={netProfit}
                      format={money}
                      masked={privacy}
                      tone={netProfit > 0 ? "positive" : netProfit < 0 ? "danger" : "neutral"}
                      icon={PiggyBank}
                      series={monthBuckets.profitTrend}
                      sub={incompleteCostCount > 0 ? `${incompleteCostCount} فاتورة بيانات تكلفتها غير مكتملة` : `أرباح ${m(fmt(grossProfit))} − مصروفات ${m(fmt(expensesTotal))}`}
                    />
                  </Reveal>

                  {/* ديون الموردين */}
                  <Reveal className="h-full" delay={280}>
                    <MetricCard
                      className="h-full"
                      label="ديون الموردين (المستحقة علينا)"
                      value={totalSupplierDebt}
                      format={money}
                      masked={privacy}
                      tone={totalSupplierDebt > 0 ? "danger" : "neutral"}
                      icon={Truck}
                      series={monthBuckets.supplierTrend}
                      sub={`${data.suppliers.length} مورد مسجل`}
                    />
                  </Reveal>
                </div>
              </section>
            );

          case "secondary_kpis":
            return (
              <section key={section.id} className="mb-14">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* كرت العملاء النشطين */}
                  <Reveal delay={320}>
                    <BezelCard variant="flat" className="h-full" innerClassName="p-4 flex items-center justify-between">
                      <div className="space-y-1 text-right">
                        <MetricLabel>العملاء والنشاط</MetricLabel>
                        <div className={cn("text-xl font-extrabold text-foreground", privacy && "privacy-blur")}>
                          {activeCustomers} نشط <span className="text-xs text-muted-foreground font-normal">/ {data.customers.length} إجمالي</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {frozenCustomers} مجمد | {data.customers.filter(c => c.status === "committed").length} ملتزم بالدفع
                        </div>
                      </div>
                      <Link
                        to="/customers"
                        className="p-2.5 rounded-xl bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground transition-colors"
                        title="إدارة العملاء"
                      >
                        <Users className="h-5 w-5" />
                      </Link>
                    </BezelCard>
                  </Reveal>

                  {/* كرت تحصيلات الشحن COD */}
                  <Reveal delay={340}>
                    <BezelCard variant="flat" className="h-full" innerClassName="p-4 flex items-center justify-between">
                      <div className="space-y-1 text-right">
                        <MetricLabel>شحنات COD المعلقة</MetricLabel>
                        <div className={cn("text-xl font-extrabold text-foreground", privacy && "privacy-blur")}>
                          {money(shippingStats.pendingCodAmount)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {shippingStats.unsettledCount} شحنة مسلّمة تنتظر التوريد للخزينة
                        </div>
                      </div>
                      <Link
                        to="/shipping"
                        className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                        title="متابعة الشحن"
                      >
                        <Truck className="h-5 w-5" />
                      </Link>
                    </BezelCard>
                  </Reveal>

                  {/* كرت مركز المطابقة والرقابة المالية */}
                  <Reveal delay={360}>
                    <BezelCard variant="flat" className="h-full" innerClassName="p-4 flex items-center justify-between">
                      <div className="space-y-1 text-right">
                        <MetricLabel>مؤشر الرقابة المحاسبية</MetricLabel>
                        <div className={cn("text-xl font-extrabold flex items-center gap-1.5", reconciliationSummary.healthScore >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                          <span>{reconciliationSummary.healthScore}%</span>
                          <span className="text-xs font-medium text-muted-foreground">
                            ({reconciliationSummary.healthScore >= 90 ? "مطابق" : "ملاحظات معلقة"})
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {reconciliationSummary.criticalCount} حرج | {reconciliationSummary.autoFixableCount} قابل للإصلاح الآلي
                        </div>
                      </div>
                      <Link
                        to="/reconciliation"
                        className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                        title="فتح مركز المطابقة"
                      >
                        <ShieldCheck className="h-5 w-5" />
                      </Link>
                    </BezelCard>
                  </Reveal>
                </div>
              </section>
            );

          case "top_products":
            return topProducts.length > 0 ? (
              <Reveal key={section.id} className="mb-14 block" delay={380}>
                <BezelCard variant="flat" innerClassName="p-6 sm:p-8">
                  <SectionHead
                    title="الأصناف الأكثر مبيعاً وتحقيقاً للإيراد"
                    icon={<Flame className="h-5 w-5 text-amber-500" />}
                    aside={
                      <Link
                        to="/inventory"
                        className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3.5 py-1.5 text-[11px] font-bold text-foreground ring-1 ring-border transition hover:bg-foreground/[0.10]"
                      >
                        إدارة المخزون <ArrowLeft className="h-3.5 w-3.5" />
                      </Link>
                    }
                  />

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {topProducts.map((p, idx) => (
                      <div
                        key={p.name + idx}
                        className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-2 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-primary">#{idx + 1}</span>
                          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                            {p.quantity} قطع مباعة
                          </span>
                        </div>
                        <div className="font-bold text-sm truncate" title={p.name}>
                          {p.name}
                        </div>
                        <div className="pt-1 border-t border-border/50 flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">الإيراد:</span>
                          <span className={cn("font-bold text-foreground", privacy && "privacy-blur")}>
                            {money(p.revenue)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </BezelCard>
              </Reveal>
            ) : null;

          case "insights":
            return (
              <Reveal key={section.id} className="mb-14 block">
                <section>
                  <SectionHead
                    title="توصيات وتنبيهات الإدارة الذكية"
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
            );

          case "charts":
            return (
              <section key={section.id} className="mb-14 grid gap-4 lg:grid-cols-3">
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
                          title="لا توجد تحصيلات مسجلة بعد"
                          hint="عند تسجيل أول دفعة على فاتورة، سيظهر هنا اتجاه التحصيل والتوقع للشهر القادم."
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
                      title="حالة ديون العملاء"
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
                          title="لا يوجد عملاء مسجلين"
                          hint="أضف أول عميل لتتمكن من متابعة توزيع الالتزام والتعثر."
                          ctaLabel="إضافة عميل"
                          ctaTo="/customers"
                        />
                      )}
                    </div>
                  </BezelCard>
                </Reveal>
              </section>
            );

          case "expenses":
            return (
              <Reveal key={section.id} className="mb-14 block">
                <BezelCard variant="flat" innerClassName="p-6 sm:p-8">
                  <SectionHead
                    title={`توزيع المصروفات (${rangeLabel})`}
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
                        title={`لا توجد مصروفات مسجلة خلال ${rangeLabel}`}
                        hint="سجّل الإيجار والكهرباء والمرتبات لحساب الأرباح بدقة."
                        ctaLabel="تسجيل مصروف"
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
                            const pct = totalRangeExpenses > 0 ? (row.value / totalRangeExpenses) * 100 : 0;
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
                            {money(totalRangeExpenses)}
                          </span>
                          <MetricLabel>إجمالي المصروفات ({rangeLabel})</MetricLabel>
                        </div>
                      </div>
                    </div>
                  )}
                </BezelCard>
              </Reveal>
            );

          case "at_risk":
            return (
              <Reveal key={section.id} className="mb-14 block">
                <BezelCard variant="flat" innerClassName="p-6 sm:p-8">
                  <SectionHead
                    title="عملاء بحاجة لمتابعة وتحصيل عاجل"
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
                      <p className="text-sm font-bold text-foreground/80">لا يوجد عملاء متأخرين حالياً</p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        جميع الأقساط والأرصدة تسير في مواعيد استحقاقها المحددة.
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
                              أيام التأخير
                            </th>
                            <th className="py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                              الرصيد المستحق
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
            );

          case "due_today":
            return (
              <section key={section.id} className="mb-14">
                <Reveal className="h-full" delay={0}>
                  <BezelCard variant="flat" className="h-full" innerClassName="flex h-full flex-col p-6 sm:p-8">
                    <SectionHead
                      title="أقساط تستحق التحصيل اليوم"
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
                          <p className="text-sm font-bold text-foreground/80">لا توجد أقساط مستحقة اليوم</p>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            يمكنك مراجعة جدول التنبيهات لمعرفة المواعيد القادمة.
                          </p>
                          <Link
                            to="/alerts"
                            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3.5 py-1.5 text-xs font-bold text-foreground ring-1 ring-border transition-[background-color,transform] hover:bg-foreground/[0.10] active:scale-[0.98]"
                          >
                            افتح جدول التنبيهات <ArrowLeft className="h-3.5 w-3.5" />
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
              </section>
            );

          case "quick_links":
            return (
              <section key={section.id} className="mb-14">
                <Reveal className="h-full" delay={90}>
                  <BezelCard variant="flat" className="h-full" innerClassName="h-full p-6 sm:p-8">
                    <SectionHead title="الأقسام والمراكز الحيوية" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <QuickLink
                        to="/cashbox"
                        icon={<Wallet className="h-4 w-4" />}
                        title="الخزائن والحسابات البنكية"
                        sub={`الرصيد: ${money(treasuryLiquidity)}`}
                      />
                      <QuickLink
                        to="/inventory"
                        icon={<Boxes className="h-4 w-4" />}
                        title="إدارة المخزون والمنتجات"
                        sub={`قيمة المخزن: ${money(inventoryStats.totalCostValuation)}`}
                      />
                      <QuickLink
                        to="/reconciliation"
                        icon={<ShieldCheck className="h-4 w-4" />}
                        title="مركز المطابقة والرقابة"
                        sub={`مؤشر السلامة: ${reconciliationSummary.healthScore}%`}
                      />
                      <QuickLink
                        to="/shipping"
                        icon={<Truck className="h-4 w-4" />}
                        title="شحن الطرود ومتحصلات COD"
                        sub={`${shippingStats.unsettledCount} شحنة معلقة`}
                      />
                      <QuickLink
                        to="/alerts"
                        icon={<AlertCircle className="h-4 w-4" />}
                        title="التنبيهات والأقساط"
                        sub={`${data.invoices.filter((i) => daysLate(i) > 0 && i.paid < i.total).length} فاتورة متأخرة`}
                        tone="danger"
                      />
                      <QuickLink
                        to="/storefront"
                        icon={<Store className="h-4 w-4 text-primary" />}
                        title="المتجر الإلكتروني"
                        sub={storefront ? `${storefront.name} (نشط)` : "إنشاء متجر للبيع أونلاين"}
                      />
                    </div>
                  </BezelCard>
                </Reveal>
              </section>
            );

          default:
            return null;
        }
      })}

      {/* Customization Dialog */}
      <DashboardCustomizationModal
        open={customizationOpen}
        onOpenChange={setCustomizationOpen}
        sections={sections}
        onToggle={toggleSection}
        onMove={moveSection}
        onReset={resetToDefault}
      />

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

