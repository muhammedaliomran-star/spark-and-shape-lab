import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { CountUp } from "@/components/CountUp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDB, fmt, useShopSettings, db } from "@/lib/store";
import { encodeExpenseNotes } from "@/lib/expenses-system";
import {
  TreasuryAccount,
  InternalTransfer,
  ManualCashTransaction,
  CashDenominationAudit,
  getTreasuryAccounts,
  addTreasuryAccount,
  updateTreasuryAccount,
  deleteTreasuryAccount,
  getManualTransactions,
  addManualTransaction,
  deleteManualTransaction,
  updateManualTransaction,
  getInternalTransfers,
  createInternalTransfer,
  deleteInternalTransfer,
  getDenominationAudits,
  createDenominationAudit,
  calculateDenominationTotal,
  calculateAccountBalance,
  getUnifiedCashLedger,
  printCashStatementPdf,
  CashTransactionUnified,
} from "@/lib/cashbox-system";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Calculator,
  Printer,
  Plus,
  Building2,
  CreditCard,
  Smartphone,
  Coins,
  Search,
  Filter,
  Trash2,
  History,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Banknote,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Info,
  Calendar,
  Check,
  Pencil,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function CashboxPage() {
  const { invoices, expenses, payments, loading } = useDB();
  const { settings: shopSettings } = useShopSettings();
  const cur = shopSettings.currency || "ج.م";

  // Navigation tab
  const [activeTab, setActiveTab] = useState("overview");

  // State from storage
  const [accounts, setAccounts] = useState<TreasuryAccount[]>(getTreasuryAccounts());
  const [manualTxs, setManualTxs] = useState<ManualCashTransaction[]>(getManualTransactions());
  const [transfers, setTransfers] = useState<InternalTransfer[]>(getInternalTransfers());
  const [audits, setAudits] = useState<CashDenominationAudit[]>(getDenominationAudits());

  // Filter & Search
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "today" | "week" | "month">("month");
  const [typeFilter, setTypeFilter] = useState<"all" | "in" | "out" | "transfer">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isManualTxOpen, setIsManualTxOpen] = useState(false);
  const [manualTxType, setManualTxType] = useState<"in" | "out">("in");
  const [manualAmount, setManualAmount] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualCategory, setManualCategory] = useState("إيراد إضافي");
  const [manualAccountId, setManualAccountId] = useState("acc-cash-main");
  const [manualNotes, setManualNotes] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  // Analytics trend granularity
  const [trendMode, setTrendMode] = useState<"daily" | "weekly" | "monthly">("daily");

  // Transfer modal
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState("acc-cash-main");
  const [transferTo, setTransferTo] = useState("acc-vodafone-cash");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferFee, setTransferFee] = useState("0");
  const [transferNotes, setTransferNotes] = useState("");

  // Denomination Audit Modal
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditAccountId, setAuditAccountId] = useState("acc-cash-main");
  const [denoms, setDenoms] = useState({
    d200: 0,
    d100: 0,
    d50: 0,
    d20: 0,
    d10: 0,
    d5: 0,
    coins: 0,
  });
  const [auditVarianceReason, setAuditVarianceReason] = useState("");
  const [auditNotes, setAuditNotes] = useState("");
  const [auditCashier, setAuditCashier] = useState("أمين الخزينة");

  // Account Manage Modal
  const [isAccountManageOpen, setIsAccountManageOpen] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<TreasuryAccount["type"]>("cash");
  const [newAccInitial, setNewAccInitial] = useState("0");
  const [newAccNumber, setNewAccNumber] = useState("");
  const [newAccBank, setNewAccBank] = useState("");
  const [newAccColor, setNewAccColor] = useState("emerald");

  // Sync listener
  const refreshAll = () => {
    setAccounts(getTreasuryAccounts());
    setManualTxs(getManualTransactions());
    setTransfers(getInternalTransfers());
    setAudits(getDenominationAudits());
  };

  useEffect(() => {
    const handleUpdate = () => refreshAll();
    window.addEventListener("segilly_cashbox_data_updated", handleUpdate);
    return () => window.removeEventListener("segilly_cashbox_data_updated", handleUpdate);
  }, []);

  // Balances calculation for each account
  const accountBalances = useMemo(() => {
    const map: Record<string, { initial: number; inflows: number; outflows: number; currentBalance: number }> = {};
    accounts.forEach((acc) => {
      map[acc.id] = calculateAccountBalance(acc, invoices, payments, expenses, manualTxs, transfers);
    });
    return map;
  }, [accounts, invoices, payments, expenses, manualTxs, transfers]);

  // Overall Total Liquid Assets
  const totalLiquidity = useMemo(() => {
    let total = 0;
    Object.values(accountBalances).forEach((b: { currentBalance: number }) => {
      total += b.currentBalance;
    });
    return total;
  }, [accountBalances]);

  // Unified Transactions Ledger
  const rawLedger = useMemo(() => {
    return getUnifiedCashLedger(invoices, payments, expenses, manualTxs, transfers, selectedAccountId);
  }, [invoices, payments, expenses, manualTxs, transfers, selectedAccountId]);

  // Filtered Ledger by date and search
  const filteredLedger = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return rawLedger.filter((tx) => {
      // Type Filter
      if (typeFilter === "in" && tx.type !== "in") return false;
      if (typeFilter === "out" && tx.type !== "out") return false;
      if (typeFilter === "transfer" && !tx.source.startsWith("transfer")) return false;

      // Date Range Filter
      const txDate = new Date(tx.date);
      if (dateRangeFilter === "today") {
        if (tx.date.split("T")[0] !== todayStr) return false;
      } else if (dateRangeFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (txDate < weekAgo) return false;
      } else if (dateRangeFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (txDate < monthAgo) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          tx.title.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          String(tx.amount).includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [rawLedger, typeFilter, dateRangeFilter, searchQuery]);

  // Period Inflows & Outflows for filtered view
  const periodStats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    filteredLedger.forEach((tx) => {
      if (tx.type === "in") inflow += tx.amount;
      else outflow += tx.amount;
    });
    return {
      inflow,
      outflow,
      net: inflow - outflow,
    };
  }, [filteredLedger]);

  // Charts: Expenses by Category
  const expenseChartData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category || "عام";
      map[cat] = (map[cat] || 0) + e.amount;
    });
    manualTxs
      .filter((t) => t.type === "out")
      .forEach((t) => {
        const cat = t.category || "سحب يدوي";
        map[cat] = (map[cat] || 0) + t.amount;
      });

    const colors = ["#ef4444", "#f97316", "#f59e0b", "#8b5cf6", "#ec4899", "#6b7280"];
    return Object.entries(map).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length],
    }));
  }, [expenses, manualTxs]);

  // Charts: Inflows by Source
  const inflowChartData = useMemo(() => {
    let downPayments = 0;
    let installments = 0;
    let manualInflows = 0;
    let transferInflows = 0;

    invoices.forEach((i) => (downPayments += i.downPayment || 0));
    payments.forEach((p) => (installments += p.amount || 0));
    manualTxs.filter((t) => t.type === "in").forEach((t) => (manualInflows += t.amount || 0));
    transfers.forEach((t) => (transferInflows += t.amount || 0));

    return [
      { name: "مقدمات ومبيعات كاش", value: downPayments, color: "#10b981" },
      { name: "تحصيلات أقساط", value: installments, color: "#06b6d4" },
      { name: "إيداعات يدوية واستثمارات", value: manualInflows, color: "#8b5cf6" },
      { name: "تحويلات واردة", value: transferInflows, color: "#f59e0b" },
    ].filter((i) => i.value > 0);
  }, [invoices, payments, manualTxs, transfers]);

  // Cash Flow Trend (daily / weekly / monthly)
  const cashFlowTrendData = useMemo(() => {
    const buckets: Record<string, { dateLabel: string; in: number; out: number }> = {};
    const now = new Date();

    const keyOf = (d: Date) => {
      if (trendMode === "daily") return d.toISOString().split("T")[0];
      if (trendMode === "monthly") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      // weekly → مفتاح بداية الأسبوع (السبت الأقرب قبل التاريخ)
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
      return start.toISOString().split("T")[0];
    };

    const labelOf = (d: Date) => {
      if (trendMode === "daily") return d.toLocaleDateString("ar-EG", { weekday: "short" });
      if (trendMode === "monthly") return d.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
      return `أسبوع ${d.getDate()}/${d.getMonth() + 1}`;
    };

    const periods = trendMode === "daily" ? 7 : trendMode === "weekly" ? 8 : 6;

    for (let i = periods - 1; i >= 0; i--) {
      const d = new Date(now);
      if (trendMode === "daily") d.setDate(d.getDate() - i);
      else if (trendMode === "weekly") d.setDate(d.getDate() - i * 7);
      else d.setMonth(d.getMonth() - i);
      const k = keyOf(d);
      if (!buckets[k]) buckets[k] = { dateLabel: labelOf(d), in: 0, out: 0 };
    }

    rawLedger.forEach((tx) => {
      const d = new Date(tx.date);
      if (isNaN(d.getTime())) return;
      const k = keyOf(d);
      if (buckets[k]) {
        if (tx.type === "in") buckets[k].in += tx.amount;
        else buckets[k].out += tx.amount;
      }
    });

    return Object.values(buckets);
  }, [rawLedger, trendMode]);

  const resetManualForm = () => {
    setEditingTxId(null);
    setManualAmount("");
    setManualTitle("");
    setManualNotes("");
    setManualDate(new Date().toISOString().split("T")[0]);
  };

  const openEditManualTx = (rawId: string) => {
    const tx = manualTxs.find((t) => t.id === rawId);
    if (!tx) return;
    setEditingTxId(tx.id);
    setManualTxType(tx.type);
    setManualCategory(tx.category);
    setManualAccountId(tx.accountId);
    setManualAmount(String(tx.amount));
    setManualTitle(tx.title);
    setManualNotes(tx.notes || "");
    setManualDate((tx.date || tx.createdAt).split("T")[0]);
    setIsManualTxOpen(true);
  };

  // Handlers for Manual Transactions
  const handleSaveManualTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(manualAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("يرجى إدخال مبلغ مالي صحيح");
      return;
    }
    if (!manualTitle.trim()) {
      toast.error("يرجى إدخال وصف أو بيان المعاملة");
      return;
    }

    const payload = {
      accountId: manualAccountId,
      type: manualTxType,
      category: manualCategory,
      amount: amt,
      date: manualDate,
      title: manualTitle.trim(),
      notes: manualNotes.trim() || undefined,
      performedBy: "المسؤول المالي",
    };

    if (editingTxId) {
      updateManualTransaction(editingTxId, payload);
      toast.success(`تم تعديل الحركة اليدوية بنجاح (${fmt(amt)} ${cur})`);
    } else {
      addManualTransaction(payload);
      toast.success(`تم تسجيل حركة ${manualTxType === "in" ? "الإيداع" : "السحب"} بمبلغ ${fmt(amt)} ${cur} بنجاح`);
    }

    setIsManualTxOpen(false);
    resetManualForm();
    refreshAll();
  };

  // Handlers for Internal Transfer
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    const fee = parseFloat(transferFee) || 0;
    if (isNaN(amt) || amt <= 0) {
      toast.error("يرجى إدخال مبلغ تحويل صحيح");
      return;
    }
    if (transferFrom === transferTo) {
      toast.error("لا يمكن التحويل لنفس الحساب!");
      return;
    }

    const srcBal = accountBalances[transferFrom]?.currentBalance || 0;
    if (amt + fee > srcBal) {
      toast.warning("تنبيه: رصيد حساب المصدر الحالي أقل من المبلغ والعمولة!");
    }

    const today = new Date().toISOString().split("T")[0];
    let feeRecorded = false;

    // تسجيل عمولة التحويل كمصروف حقيقي في دفتر المصروفات
    if (fee > 0) {
      const fromName = accounts.find((a) => a.id === transferFrom)?.name || "الخزينة";
      const toName = accounts.find((a) => a.id === transferTo)?.name || "حساب آخر";
      try {
        await db.addExpense({
          amount: fee,
          category: "other",
          expenseDate: today,
          notes: encodeExpenseNotes(`عمولة تحويل داخلي من ${fromName} إلى ${toName}`, {
            accountId: transferFrom,
            accountName: fromName,
          }),
        });
        feeRecorded = true;
      } catch {
        toast.error("تعذّر تسجيل عمولة التحويل كمصروف، تم حفظ التحويل فقط");
      }
    }

    createInternalTransfer({
      fromAccountId: transferFrom,
      toAccountId: transferTo,
      amount: amt,
      fee,
      feeRecordedAsExpense: feeRecorded,
      date: today,
      notes: transferNotes.trim() || undefined,
      performedBy: "المسؤول المالي",
    });

    toast.success(
      fee > 0 && feeRecorded
        ? `تم تحويل ${fmt(amt)} ${cur} وتسجيل عمولة ${fmt(fee)} ${cur} كمصروف`
        : `تم تحويل ${fmt(amt)} ${cur} بنجاح`
    );
    setIsTransferOpen(false);
    setTransferAmount("");
    setTransferFee("0");
    setTransferNotes("");
    refreshAll();
  };

  // Handlers for Denomination Audit
  const handleSaveAudit = () => {
    const totalActual = calculateDenominationTotal(denoms);
    const expected = accountBalances[auditAccountId]?.currentBalance || 0;
    const variance = Math.round((totalActual - expected) * 100) / 100;

    const audit = createDenominationAudit({
      accountId: auditAccountId,
      countedAt: new Date().toISOString(),
      countedBy: auditCashier,
      denominations: denoms,
      totalActualCash: totalActual,
      systemExpectedCash: expected,
      variance,
      varianceReason: auditVarianceReason.trim() || undefined,
      notes: auditNotes.trim() || undefined,
      status: Math.abs(variance) > 5 ? "flagged" : "settled",
    });

    // اعتماد التسوية تلقائياً: إنشاء حركة تسوية للعجز أو الزيادة لمطابقة الرصيد الدفتري
    if (Math.abs(variance) >= 0.01) {
      addManualTransaction({
        accountId: auditAccountId,
        type: variance > 0 ? "in" : "out",
        category: variance > 0 ? "تسوية زيادة جرد" : "تسوية عجز",
        amount: Math.abs(variance),
        date: new Date().toISOString().split("T")[0],
        title: `تسوية فرق جرد ${audit.auditNumber} (${variance > 0 ? "زيادة" : "عجز"})`,
        notes: auditVarianceReason.trim() || "تسوية تلقائية بعد اعتماد محضر الجرد",
        performedBy: auditCashier,
      });
      toast.success(
        `تم اعتماد الجرد وتسجيل حركة تسوية ${variance > 0 ? "زيادة" : "عجز"} بمبلغ ${fmt(Math.abs(variance))} ${cur}`
      );
    } else {
      toast.success(`تم حفظ واعتماد محضر جرد الخزينة مطابقاً (${fmt(totalActual)} ${cur})`);
    }

    setIsAuditModalOpen(false);
    setDenoms({ d200: 0, d100: 0, d50: 0, d20: 0, d10: 0, d5: 0, coins: 0 });
    setAuditVarianceReason("");
    setAuditNotes("");
    refreshAll();
  };


  // Handlers for Creating Account
  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) {
      toast.error("يرجى إدخال اسم الحساب أو الخزينة");
      return;
    }
    const initial = parseFloat(newAccInitial) || 0;

    addTreasuryAccount({
      name: newAccName.trim(),
      type: newAccType,
      initialBalance: initial,
      accountNumber: newAccNumber.trim() || undefined,
      bankName: newAccBank.trim() || undefined,
      color: newAccColor,
      active: true,
    });

    toast.success("تمت إضافة الخزينة / الحساب المالي الجديد بنجاح");
    setIsAccountManageOpen(false);
    setNewAccName("");
    setNewAccInitial("0");
    setNewAccNumber("");
    setNewAccBank("");
    refreshAll();
  };

  // Handlers for Printing Cash Statement PDF
  const handlePrintStatement = () => {
    const acc = accounts.find((a) => a.id === selectedAccountId);
    const accName = selectedAccountId === "all" ? "كافة الخزن والحسابات المجمعة" : acc?.name || "الخزينة";

    const rangeLabels: Record<string, string> = {
      all: "كامل الحركات المسجلة",
      today: "حركات اليوم فقط",
      week: "آخر 7 أيام",
      month: "آخر 30 يوماً",
    };

    printCashStatementPdf({
      transactions: filteredLedger,
      accountName: accName,
      totalInflow: periodStats.inflow,
      totalOutflow: periodStats.outflow,
      netBalance: periodStats.net,
      dateRangeLabel: rangeLabels[dateRangeFilter] || "مخصص",
      shopSettings,
    });
  };

  const currentAuditTotal = calculateDenominationTotal(denoms);
  const currentExpectedCash = accountBalances[auditAccountId]?.currentBalance || 0;
  const currentVariance = currentAuditTotal - currentExpectedCash;

  return (
    <AppShell>
      <PageTransition>
        <div className="flex flex-col gap-6" dir="rtl">
          {/* Header */}
          <PageHeader
            title="إدارة الصندوق والسيولة النقدية"
            icon={<Wallet className="h-7 w-7 text-primary" />}
            subtitle="المنظومة المركزية لإدارة الخزن النقدية، المحافظ الإلكترونية، الحسابات البنكية، الجرد، والتحويلات"
            action={
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintStatement}
                  className="rounded-full px-4 text-xs font-semibold gap-1.5 h-9"
                >
                  <Printer className="h-4 w-4" />
                  طباعة كشف الحساب
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTransferOpen(true)}
                  className="rounded-full px-4 text-xs font-semibold gap-1.5 h-9"
                >
                  <ArrowLeftRight className="h-4 w-4 text-amber-500" />
                  تحويل بين الخزن
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAuditModalOpen(true)}
                  className="rounded-full px-4 text-xs font-semibold gap-1.5 h-9"
                >
                  <Calculator className="h-4 w-4 text-emerald-500" />
                  جرد الدرج والفئات
                </Button>

                <Button
                  onClick={() => {
                    setManualTxType("in");
                    setIsManualTxOpen(true);
                  }}
                  className="rounded-full px-5 text-xs font-bold gap-1.5 h-9 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  تسجيل إيداع / سحب
                </Button>
              </div>
            }
          />

          {/* High-Level Liquidity Summary Cards */}
          <Reveal className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>إجمالي السيولة الكلية (جميع الخزن)</span>
                <PiggyBank className="h-4 w-4 text-primary" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-primary mt-1">
                {fmt(totalLiquidity)} <span className="text-xs font-normal text-muted-foreground">{cur}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                موزعة على {accounts.length} حسابات وخزائن
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>الدرج النقدي الرئيسي (الكاش)</span>
                <Banknote className="h-4 w-4 text-emerald-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {fmt(accountBalances["acc-cash-main"]?.currentBalance || 0)}{" "}
                <span className="text-xs font-normal text-muted-foreground">{cur}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                السيولة الحاضرة المتاحة فوراً
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>المحافظ الإلكترونية وإنستاباي</span>
                <Smartphone className="h-4 w-4 text-indigo-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
                {fmt(
                  accounts
                    .filter((a) => a.type === "ewallet")
                    .reduce((s, a) => s + (accountBalances[a.id]?.currentBalance || 0), 0)
                )}{" "}
                <span className="text-xs font-normal text-muted-foreground">{cur}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                فودافون كاش، أورانج، InstaPay
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>الحسابات البنكية وماكينات الدفع</span>
                <CreditCard className="h-4 w-4 text-blue-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-blue-600 dark:text-blue-400 mt-1">
                {fmt(
                  accounts
                    .filter((a) => a.type === "bank" || a.type === "pos")
                    .reduce((s, a) => s + (accountBalances[a.id]?.currentBalance || 0), 0)
                )}{" "}
                <span className="text-xs font-normal text-muted-foreground">{cur}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                أرصدة البنوك وماكينات POS
              </span>
            </div>
          </Reveal>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--hairline)] pb-4">
              <TabsList className="h-auto p-1.5 bg-card/80 border border-foreground/10 rounded-2xl flex-wrap justify-start gap-1">
                <TabsTrigger
                  value="overview"
                  className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Layers className="h-3.5 w-3.5" />
                  1. الخزن والحسابات والسيولة
                </TabsTrigger>

                <TabsTrigger
                  value="ledger"
                  className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  2. سجل الحركات المالي (Ledger)
                </TabsTrigger>

                <TabsTrigger
                  value="analytics"
                  className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  3. الرسوم والتدفقات النقدية
                </TabsTrigger>

                <TabsTrigger
                  value="transfers"
                  className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  4. سجل التحويلات الداخلية
                  {transfers.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
                      {transfers.length}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="audits"
                  className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  5. محاضر الجرد وتصفية الدرج
                  {audits.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
                      {audits.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Account Quick Filter */}
              <div className="flex items-center gap-2 bg-card/60 border border-foreground/10 px-3 py-1.5 rounded-full">
                <span className="text-xs text-muted-foreground font-semibold">تصفية حسب الخزينة:</span>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="h-8 w-48 rounded-full text-xs font-bold border-none bg-primary/10 text-primary">
                    <SelectValue placeholder="كل الخزن والحسابات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-bold">
                      عرض كل الحسابات (مجمّع)
                    </SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs">
                        {acc.name} ({fmt(accountBalances[acc.id]?.currentBalance || 0)} {cur})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 1️⃣ تبويب: الخزن والحسابات والسيولة (Accounts Overview) */}
            {/* ========================================================================= */}
            <TabsContent value="overview" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">الخزائن، المحافظ والحسابات البنكية المعتمدة</h3>
                  <p className="text-xs text-muted-foreground">
                    تتبع دقيق لأرصدة ومقبوضات ومدفوعات كل قناة مالية بشكل منفصل
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAccountManageOpen(true)}
                  className="rounded-full px-4 text-xs font-semibold gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة خزينة / محفظة جديدة
                </Button>
              </div>

              {/* Account Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {accounts.map((acc) => {
                  const bal = accountBalances[acc.id] || { initial: 0, inflows: 0, outflows: 0, currentBalance: 0 };
                  const isNegative = bal.currentBalance < 0;

                  const typeIcon = {
                    cash: <Banknote className="h-5 w-5 text-emerald-500" />,
                    ewallet: <Smartphone className="h-5 w-5 text-indigo-500" />,
                    bank: <Building2 className="h-5 w-5 text-blue-500" />,
                    pos: <CreditCard className="h-5 w-5 text-purple-500" />,
                    petty: <Coins className="h-5 w-5 text-amber-500" />,
                  }[acc.type];

                  const typeLabel = {
                    cash: "خزينة نقدية (كاش)",
                    ewallet: "محفظة إلكترونية",
                    bank: "حساب بنكي",
                    pos: "ماكينة POS",
                    petty: "عهدة فرعية",
                  }[acc.type];

                  return (
                    <div
                      key={acc.id}
                      className={cn(
                        "rounded-2xl border p-5 bg-card/80 transition-all shadow-sm hover:shadow-md flex flex-col justify-between gap-4",
                        selectedAccountId === acc.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-foreground/10"
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center">
                              {typeIcon}
                            </div>
                            <div>
                              <h4 className="font-bold text-sm leading-tight">{acc.name}</h4>
                              <span className="text-[10px] text-muted-foreground font-medium block mt-0.5">
                                {typeLabel}
                              </span>
                            </div>
                          </div>

                          {acc.isDefault && (
                            <Badge variant="secondary" className="text-[9px] font-bold bg-primary/10 text-primary">
                              الافتراضي
                            </Badge>
                          )}
                        </div>

                        {/* Balance */}
                        <div className="p-3.5 rounded-xl bg-muted/30 border border-foreground/5 mb-3">
                          <span className="text-[10px] text-muted-foreground font-semibold block">الرصيد الفعلي الحالي</span>
                          <div className={cn("text-xl font-black tabular-nums mt-0.5", isNegative ? "text-danger" : "text-foreground")}>
                            {fmt(bal.currentBalance)} <span className="text-xs font-normal text-muted-foreground">{cur}</span>
                          </div>
                        </div>

                        {/* Inflows & Outflows stats */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                          <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            <span className="text-[10px] text-muted-foreground block font-normal">إجمالي الوارد</span>
                            +{fmt(bal.inflows)} {cur}
                          </div>
                          <div className="text-rose-600 dark:text-rose-400 font-semibold">
                            <span className="text-[10px] text-muted-foreground block font-normal">إجمالي المنصرف</span>
                            -{fmt(bal.outflows)} {cur}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--hairline)]">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 rounded-xl text-[11px] h-7 font-bold"
                          onClick={() => {
                            setSelectedAccountId(acc.id);
                            setActiveTab("ledger");
                          }}
                        >
                          كشف الحساب
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-[11px] h-7 px-2.5"
                          onClick={() => {
                            setTransferFrom(acc.id);
                            setIsTransferOpen(true);
                          }}
                        >
                          تحويل
                        </Button>

                        {!acc.isDefault && accounts.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-xl text-danger hover:bg-danger/10"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف الحساب "${acc.name}"؟`)) {
                                deleteTreasuryAccount(acc.id);
                                refreshAll();
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Period Summary Bar */}
              <div className="p-5 rounded-2xl border border-foreground/10 bg-card/60 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">صافي حركة السيولة للشهر الحالي</h4>
                    <p className="text-xs text-muted-foreground">
                      مقارنة مباشرة بين التدفقات النقدية الواردة والمدفوعات والمصروفات
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">المقبوضات الواردة</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                      +{fmt(periodStats.inflow)} {cur}
                    </span>
                  </div>
                  <div className="h-7 w-[1px] bg-foreground/10" />
                  <div>
                    <span className="text-muted-foreground block text-[10px]">المدفوعات والمنصرفات</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 text-sm tabular-nums">
                      -{fmt(periodStats.outflow)} {cur}
                    </span>
                  </div>
                  <div className="h-7 w-[1px] bg-foreground/10" />
                  <div>
                    <span className="text-muted-foreground block text-[10px]">صافي التدفق المالي</span>
                    <span
                      className={cn(
                        "font-black text-sm tabular-nums",
                        periodStats.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-danger"
                      )}
                    >
                      {periodStats.net >= 0 ? "+" : ""}{fmt(periodStats.net)} {cur}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ========================================================================= */}
            {/* 2️⃣ تبويب: سجل الحركات المالي التفصيلي (Ledger) */}
            {/* ========================================================================= */}
            <TabsContent value="ledger" className="space-y-4">
              {/* Controls and filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-foreground/10">
                <div className="relative flex-1 w-full max-w-sm">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="البحث في الحركات أو البيان أو المبلغ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pr-9 text-xs rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                  {/* Date Filter */}
                  <Select value={dateRangeFilter} onValueChange={(v: any) => setDateRangeFilter(v)}>
                    <SelectTrigger className="h-9 w-32 rounded-xl text-xs font-semibold">
                      <Calendar className="h-3.5 w-3.5 ml-1 opacity-60" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today" className="text-xs">اليوم</SelectItem>
                      <SelectItem value="week" className="text-xs">آخر 7 أيام</SelectItem>
                      <SelectItem value="month" className="text-xs">آخر 30 يوماً</SelectItem>
                      <SelectItem value="all" className="text-xs">كافة الحركات</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Type Filter */}
                  <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                    <SelectTrigger className="h-9 w-32 rounded-xl text-xs font-semibold">
                      <Filter className="h-3.5 w-3.5 ml-1 opacity-60" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">كافة الأنواع</SelectItem>
                      <SelectItem value="in" className="text-xs text-emerald-600">وارد (مقبوضات)</SelectItem>
                      <SelectItem value="out" className="text-xs text-rose-600">منصرف (مدفوعات)</SelectItem>
                      <SelectItem value="transfer" className="text-xs text-amber-600">تحويلات خزن</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrintStatement}
                    className="h-9 rounded-xl text-xs font-semibold gap-1.5"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    تصدير PDF
                  </Button>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="rounded-2xl border border-foreground/10 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] bg-muted/40 text-muted-foreground font-bold">
                        <th className="p-3.5 w-24">التاريخ والوقت</th>
                        <th className="p-3.5">البيان / المعاملة</th>
                        <th className="p-3.5">التصنيف والمصدر</th>
                        <th className="p-3.5">الحساب / الخزينة</th>
                        <th className="p-3.5 text-left">المبلغ</th>
                        <th className="p-3.5 text-left">الرصيد التراكمي</th>
                        <th className="p-3.5 text-center w-16">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {filteredLedger.map((tx) => {
                        const isPositive = tx.type === "in";
                        const acc = accounts.find((a) => a.id === tx.accountId);

                        return (
                          <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                              {new Date(tx.date).toLocaleDateString("ar-EG")}
                            </td>
                            <td className="p-3.5">
                              <div className="font-bold text-foreground">{tx.title}</div>
                              {tx.referenceId && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  #{tx.referenceId.slice(0, 8)}
                                </span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-semibold",
                                  isPositive
                                    ? "border-emerald-500/20 text-emerald-600 bg-emerald-500/10"
                                    : "border-rose-500/20 text-rose-600 bg-rose-500/10"
                                )}
                              >
                                {tx.category}
                              </Badge>
                            </td>
                            <td className="p-3.5">
                              <span className="font-semibold text-[11px] flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                {acc?.name || "الدرج الرئيسي"}
                              </span>
                            </td>
                            <td className="p-3.5 text-left whitespace-nowrap">
                              <span
                                className={cn(
                                  "text-sm font-black tabular-nums",
                                  isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                )}
                              >
                                {isPositive ? "+" : "-"}{fmt(tx.amount)} {cur}
                              </span>
                            </td>
                            <td className="p-3.5 text-left whitespace-nowrap font-bold font-mono text-foreground">
                              {fmt(tx.runningBalance || 0)} {cur}
                            </td>
                            <td className="p-3.5 text-center">
                              {tx.source === "manual" && (
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-lg text-primary hover:bg-primary/10"
                                    onClick={() => openEditManualTx(tx.id.replace("man-", ""))}
                                    title="تعديل الحركة اليدوية"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-lg text-danger hover:bg-danger/10"
                                    onClick={() => {
                                      if (confirm("هل أنت متأكد من حذف هذه الحركة اليدوية؟")) {
                                        const rawId = tx.id.replace("man-", "");
                                        deleteManualTransaction(rawId);
                                        toast.success("تم حذف المعاملة اليدوية");
                                        refreshAll();
                                      }
                                    }}
                                    title="حذف"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredLedger.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                            لا توجد حركات مسجلة تطابق محددات البحث الحالية.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ========================================================================= */}
            {/* 3️⃣ تبويب: الرسوم والتحليلات النقدية (Visual Analytics) */}
            {/* ========================================================================= */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 7-Day In/Out Trend Chart */}
                <div className="rounded-2xl border border-foreground/10 bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="font-bold text-sm">
                        حركة التدفق النقدي{" "}
                        {trendMode === "daily" ? "(آخر 7 أيام)" : trendMode === "weekly" ? "(آخر 8 أسابيع)" : "(آخر 6 شهور)"}
                      </h4>
                      <p className="text-xs text-muted-foreground">مقارنة المقبوضات بالمدفوعات حسب الفترة</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl border border-foreground/10 bg-muted/30 p-1">
                      {([
                        { key: "daily", label: "يومي" },
                        { key: "weekly", label: "أسبوعي" },
                        { key: "monthly", label: "شهري" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setTrendMode(opt.key)}
                          className={cn(
                            "px-3 h-7 rounded-lg text-[11px] font-bold transition-colors",
                            trendMode === opt.key
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-foreground/5"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-64 w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cashFlowTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            `${fmt(Number(value))} ${cur}`,
                            name === "in" ? "وارد" : "منصرف",
                          ]}
                        />
                        <Bar dataKey="in" name="وارد" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="out" name="منصرف" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Expense Categories Breakdown */}
                <div className="rounded-2xl border border-foreground/10 bg-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-sm">توزيع المصروفات والمدفوعات</h4>
                      <p className="text-xs text-muted-foreground">نسب استهلاك السيولة حسب البنود</p>
                    </div>
                  </div>

                  {expenseChartData.length > 0 ? (
                    <div className="h-64 w-full flex items-center" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {expenseChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => `${fmt(Number(value))} ${cur}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
                      لا توجد بيانات مصروفات كافية لعرض الرسم البياني
                    </div>
                  )}
                </div>

                {/* Inflows Breakdown */}
                <div className="col-span-full rounded-2xl border border-foreground/10 bg-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-sm">مصادر الإيرادات والسيولة الداخلة</h4>
                      <p className="text-xs text-muted-foreground">توزيع مصادر المقبوضات بالصندوق</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {inflowChartData.map((item) => (
                      <div key={item.name} className="p-4 rounded-xl border border-foreground/5 bg-muted/20">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-semibold text-muted-foreground">{item.name}</span>
                        </div>
                        <div className="text-lg font-black tabular-nums">
                          {fmt(item.value)} <span className="text-xs font-normal">{cur}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ========================================================================= */}
            {/* 4️⃣ تبويب: التحويلات الداخلية بين الخزن (Internal Transfers) */}
            {/* ========================================================================= */}
            <TabsContent value="transfers" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">سجل التحويلات المالية الداخلية بين الخزن</h3>
                  <p className="text-xs text-muted-foreground">
                    نقل الأرصدة والسيولة بين الدرج، المحافظ الإلكترونية، والحسابات البنكية
                  </p>
                </div>
                <Button
                  onClick={() => setIsTransferOpen(true)}
                  className="rounded-full px-5 text-xs font-bold gap-1.5 h-9"
                >
                  <Plus className="h-4 w-4" />
                  إجراء تحويل مالي جديد
                </Button>
              </div>

              <div className="rounded-2xl border border-foreground/10 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] bg-muted/40 text-muted-foreground font-bold">
                        <th className="p-3.5">رقم التحويل</th>
                        <th className="p-3.5">التاريخ</th>
                        <th className="p-3.5">من حساب (المصدر)</th>
                        <th className="p-3.5">إلى حساب (الوجهة)</th>
                        <th className="p-3.5">المبلغ المحول</th>
                        <th className="p-3.5">العمولة / الرسوم</th>
                        <th className="p-3.5">المسؤول والملاحظات</th>
                        <th className="p-3.5 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {transfers.map((trf) => {
                        const fromAcc = accounts.find((a) => a.id === trf.fromAccountId);
                        const toAcc = accounts.find((a) => a.id === trf.toAccountId);

                        return (
                          <tr key={trf.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3.5 font-bold font-mono text-primary">{trf.transferNumber}</td>
                            <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                              {new Date(trf.date).toLocaleDateString("ar-EG")}
                            </td>
                            <td className="p-3.5">
                              <span className="font-semibold text-rose-600 dark:text-rose-400">
                                {fromAcc?.name || "حساب محذوف"}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {toAcc?.name || "حساب محذوف"}
                              </span>
                            </td>
                            <td className="p-3.5 font-black tabular-nums text-sm">
                              {fmt(trf.amount)} {cur}
                            </td>
                            <td className="p-3.5 tabular-nums text-muted-foreground">
                              {trf.fee > 0 ? `${fmt(trf.fee)} ${cur}` : "بدون عمولة"}
                            </td>
                            <td className="p-3.5 text-muted-foreground">
                              {trf.notes || "تحويل سيولة دوري"}
                            </td>
                            <td className="p-3.5 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-danger hover:bg-danger/10"
                                onClick={() => {
                                  if (confirm("هل أنت متأكد من حذف هذا التحويل واسترداد الأرصدة؟")) {
                                    deleteInternalTransfer(trf.id);
                                    toast.success("تم حذف سجل التحويل");
                                    refreshAll();
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}

                      {transfers.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                            لا توجد تحويلات داخلية مسجلة بعد.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ========================================================================= */}
            {/* 5️⃣ تبويب: محاضر الجرد وتصفية الدرج (Audits & Denominations) */}
            {/* ========================================================================= */}
            <TabsContent value="audits" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">محاضر جرد الفئات النقدية وتسوية الدرج</h3>
                  <p className="text-xs text-muted-foreground">
                    توثيق عد النقدية الفعلي بالفئات ومطابقته مع رصيد النظام واكتشاف الفروقات
                  </p>
                </div>
                <Button
                  onClick={() => setIsAuditModalOpen(true)}
                  className="rounded-full px-5 text-xs font-bold gap-1.5 h-9"
                >
                  <Calculator className="h-4 w-4" />
                  بدء جرد نقدي جديد
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {audits.map((aud) => {
                  const acc = accounts.find((a) => a.id === aud.accountId);
                  const isExact = aud.variance === 0;
                  const isSurplus = aud.variance > 0;

                  return (
                    <div key={aud.id} className="rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm">{aud.auditNumber}</span>
                          <span className="text-[10px] text-muted-foreground block">
                            {new Date(aud.countedAt).toLocaleString("ar-EG")}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold",
                            isExact
                              ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                              : "border-amber-500/30 text-amber-600 bg-amber-500/10"
                          )}
                        >
                          {isExact ? "مطابق تماماً" : isSurplus ? `زيادة (+${fmt(aud.variance)})` : `عجز (${fmt(aud.variance)})`}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-[var(--hairline)]">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">الخزينة المجرودة</span>
                          <span className="font-bold">{acc?.name || "الدرج"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">المسؤول عن الجرد</span>
                          <span className="font-semibold">{aud.countedBy}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">المبلغ الفعلي المحصى</span>
                          <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {fmt(aud.totalActualCash)} {cur}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">رصيد النظام المسجل</span>
                          <span className="font-bold tabular-nums">
                            {fmt(aud.systemExpectedCash)} {cur}
                          </span>
                        </div>
                      </div>

                      {/* Denomination Breakdown pills */}
                      <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                        {aud.denominations.d200 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">200ج × {aud.denominations.d200}</span>}
                        {aud.denominations.d100 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">100ج × {aud.denominations.d100}</span>}
                        {aud.denominations.d50 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">50ج × {aud.denominations.d50}</span>}
                        {aud.denominations.d20 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">20ج × {aud.denominations.d20}</span>}
                        {aud.denominations.d10 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">10ج × {aud.denominations.d10}</span>}
                        {aud.denominations.d5 > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">5ج × {aud.denominations.d5}</span>}
                        {aud.denominations.coins > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">فكة: {aud.denominations.coins}ج</span>}
                      </div>

                      {aud.varianceReason && (
                        <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg">
                          <span className="font-bold text-foreground">سبب الفارق: </span>
                          {aud.varianceReason}
                        </div>
                      )}
                    </div>
                  );
                })}

                {audits.length === 0 && (
                  <div className="col-span-full py-16 text-center text-muted-foreground rounded-2xl border border-dashed border-foreground/10 bg-card/40">
                    <Calculator className="h-10 w-10 mx-auto opacity-30 mb-2" />
                    لا توجد محاضر جرد مسجلة حتى الآن. استخدم حاسبة الفئات لبدء أول جرد.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* ========================================================================= */}
          {/* Modal 1: تسجيل معاملة مالية يدوية (إيداع / سحب) */}
          {/* ========================================================================= */}
          <Dialog open={isManualTxOpen} onOpenChange={setIsManualTxOpen}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">تسجيل حركة مالية مباشرة بالصندوق</DialogTitle>
                <DialogDescription className="text-xs">
                  إيداع رأس مال، إيرادات خدمات، أو سحب مسحوبات شخصية ومصاريف نثرية
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSaveManualTx} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={manualTxType === "in" ? "default" : "outline"}
                    className={cn(
                      "rounded-xl text-xs font-bold h-10",
                      manualTxType === "in" && "bg-emerald-600 hover:bg-emerald-700 text-white"
                    )}
                    onClick={() => {
                      setManualTxType("in");
                      setManualCategory("إيراد إضافي");
                    }}
                  >
                    <ArrowDownLeft className="ml-1.5 h-4 w-4" />
                    إيداع نقدي (وارد +)
                  </Button>
                  <Button
                    type="button"
                    variant={manualTxType === "out" ? "default" : "outline"}
                    className={cn(
                      "rounded-xl text-xs font-bold h-10",
                      manualTxType === "out" && "bg-rose-600 hover:bg-rose-700 text-white"
                    )}
                    onClick={() => {
                      setManualTxType("out");
                      setManualCategory("مسحوبات شخصية");
                    }}
                  >
                    <ArrowUpRight className="ml-1.5 h-4 w-4" />
                    سحب نقدي (منصرف -)
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">الخزينة / القناة المستهدفة</Label>
                  <Select value={manualAccountId} onValueChange={setManualAccountId}>
                    <SelectTrigger className="h-9 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">
                          {a.name} ({fmt(accountBalances[a.id]?.currentBalance || 0)} {cur})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">المبلغ ({cur}) *</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      className="h-9 rounded-xl text-xs font-bold"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">التاريخ</Label>
                    <Input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">بيان المعاملة *</Label>
                    <Input
                      placeholder="مثال: إيداع رأس مال شريك"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      className="h-9 rounded-xl text-xs font-semibold"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">التصنيف</Label>
                    <Select value={manualCategory} onValueChange={setManualCategory}>
                      <SelectTrigger className="h-9 rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {manualTxType === "in" ? (
                          <>
                            <SelectItem value="إيراد إضافي" className="text-xs">إيراد إضافي</SelectItem>
                            <SelectItem value="إيداع رأس مال" className="text-xs">إيداع رأس مال</SelectItem>
                            <SelectItem value="سداد سلفة موظف" className="text-xs">سداد سلفة موظف</SelectItem>
                            <SelectItem value="إيراد خدمات وصيانة" className="text-xs">إيراد خدمات وصيانة</SelectItem>
                            <SelectItem value="تسوية رصيد" className="text-xs">تسوية رصيد</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="مسحوبات شخصية" className="text-xs">مسحوبات شخصية (أرباح)</SelectItem>
                            <SelectItem value="سلفة موظف" className="text-xs">سلفة موظف</SelectItem>
                            <SelectItem value="مصاريف صيانة ونثرية" className="text-xs">مصاريف صيانة ونثرية</SelectItem>
                            <SelectItem value="مصاريف ضيافة وبوفيه" className="text-xs">مصاريف ضيافة وبوفيه</SelectItem>
                            <SelectItem value="تسوية عجز" className="text-xs">تسوية عجز</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">ملاحظات إضافية</Label>
                  <Input
                    placeholder="أي تفاصيل أو رقم مرجعي..."
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <DialogFooter className="pt-3">
                  <Button type="button" variant="outline" onClick={() => setIsManualTxOpen(false)} className="rounded-xl text-xs">
                    إلغاء
                  </Button>
                  <Button type="submit" className="rounded-xl text-xs font-bold px-5">
                    تأكيد وحفظ الحركة
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* ========================================================================= */}
          {/* Modal 2: تحويل مالي داخلي بين الخزن */}
          {/* ========================================================================= */}
          <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">تحويل مالي بين الخزن والحسابات</DialogTitle>
                <DialogDescription className="text-xs">
                  نقل السيولة بين الدرج الكاش والمحافظ الإلكترونية والحسابات البنكية
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateTransfer} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">من حساب (المصدر)</Label>
                    <Select value={transferFrom} onValueChange={setTransferFrom}>
                      <SelectTrigger className="h-9 rounded-xl text-xs font-bold border-rose-500/20 text-rose-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id} className="text-xs">
                            {a.name} ({fmt(accountBalances[a.id]?.currentBalance || 0)} {cur})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">إلى حساب (الوجهة)</Label>
                    <Select value={transferTo} onValueChange={setTransferTo}>
                      <SelectTrigger className="h-9 rounded-xl text-xs font-bold border-emerald-500/20 text-emerald-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id} className="text-xs">
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">المبلغ المراد تحويله ({cur}) *</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="h-9 rounded-xl text-xs font-black"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">عمولة / رسوم التحويل ({cur})</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={transferFee}
                      onChange={(e) => setTransferFee(e.target.value)}
                      className="h-9 rounded-xl text-xs text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">بيان وملاحظات التحويل</Label>
                  <Input
                    placeholder="مثال: تغذية حساب فودافون كاش للسحب"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <DialogFooter className="pt-3">
                  <Button type="button" variant="outline" onClick={() => setIsTransferOpen(false)} className="rounded-xl text-xs">
                    إلغاء
                  </Button>
                  <Button type="submit" className="rounded-xl text-xs font-bold px-5 bg-amber-600 hover:bg-amber-700 text-white">
                    تنفيذ التحويل المالي
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* ========================================================================= */}
          {/* Modal 3: حاسبة جرد الفئات النقدية وتسوية الدرج */}
          {/* ========================================================================= */}
          <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
            <DialogContent className="max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-emerald-500" />
                  حاسبة جرد الفئات النقدية ومطابقة الدرج
                </DialogTitle>
                <DialogDescription className="text-xs">
                  أدخل عدد الورقات النقدية من كل فئة لاحتساب المجموع ومقارنته برصيد السيستم
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">الخزينة المجرودة</Label>
                    <Select value={auditAccountId} onValueChange={setAuditAccountId}>
                      <SelectTrigger className="h-9 rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id} className="text-xs">
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">أمين الخزينة / المسؤول</Label>
                    <Input
                      value={auditCashier}
                      onChange={(e) => setAuditCashier(e.target.value)}
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Denomination Grid */}
                <div className="rounded-2xl border border-foreground/10 bg-muted/30 p-3.5 space-y-2.5">
                  <span className="text-xs font-bold text-muted-foreground block mb-1">
                    الفئات النقدية (العد الفعلي):
                  </span>

                  {[
                    { key: "d200", label: "فئة 200 جنيه", val: 200 },
                    { key: "d100", label: "فئة 100 جنيه", val: 100 },
                    { key: "d50", label: "فئة 50 جنيه", val: 50 },
                    { key: "d20", label: "فئة 20 جنيه", val: 20 },
                    { key: "d10", label: "فئة 10 جنيهات", val: 10 },
                    { key: "d5", label: "فئة 5 جنيهات", val: 5 },
                  ].map((row) => {
                    const count = (denoms as any)[row.key] || 0;
                    const subtotal = count * row.val;
                    return (
                      <div key={row.key} className="flex items-center justify-between gap-3 text-xs bg-card p-2 rounded-xl border border-foreground/5">
                        <span className="font-bold w-28">{row.label}</span>
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="number"
                            min="0"
                            placeholder="0 ورقة"
                            value={count || ""}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10) || 0;
                              setDenoms((prev) => ({ ...prev, [row.key]: v }));
                            }}
                            className="h-8 rounded-lg text-xs font-bold text-center w-24"
                          />
                          <span className="text-[11px] text-muted-foreground">ورقة</span>
                        </div>
                        <span className="font-black tabular-nums text-foreground w-24 text-left">
                          = {fmt(subtotal)} {cur}
                        </span>
                      </div>
                    );
                  })}

                  {/* Coins */}
                  <div className="flex items-center justify-between gap-3 text-xs bg-card p-2 rounded-xl border border-foreground/5">
                    <span className="font-bold w-28">فكة ونقود معدنية</span>
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={denoms.coins || ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setDenoms((prev) => ({ ...prev, coins: v }));
                        }}
                        className="h-8 rounded-lg text-xs font-bold text-center w-24"
                      />
                      <span className="text-[11px] text-muted-foreground">{cur}</span>
                    </div>
                    <span className="font-black tabular-nums text-foreground w-24 text-left">
                      = {fmt(denoms.coins || 0)} {cur}
                    </span>
                  </div>
                </div>

                {/* Audit Comparison Summary */}
                <div className="p-4 rounded-2xl border border-foreground/10 bg-card space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-muted/40">
                      <span className="text-[10px] text-muted-foreground block">المجموع الفعلي</span>
                      <span className="font-black text-base text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {fmt(currentAuditTotal)} {cur}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/40">
                      <span className="text-[10px] text-muted-foreground block">رصيد النظام</span>
                      <span className="font-black text-base text-foreground tabular-nums">
                        {fmt(currentExpectedCash)} {cur}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "p-2 rounded-xl border",
                        currentVariance === 0
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                          : currentVariance > 0
                          ? "bg-blue-500/10 border-blue-500/20 text-blue-600"
                          : "bg-rose-500/10 border-rose-500/20 text-rose-600"
                      )}
                    >
                      <span className="text-[10px] block opacity-80">الفارق (عجز / زيادة)</span>
                      <span className="font-black text-base tabular-nums">
                        {currentVariance > 0 ? "+" : ""}{fmt(currentVariance)} {cur}
                      </span>
                    </div>
                  </div>

                  {currentVariance !== 0 && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs font-semibold text-danger">سبب الفارق المالي / التوضيح</Label>
                      <Input
                        placeholder="مثال: فكة ناقصة، أو لم تسجل مصروفات صيانة..."
                        value={auditVarianceReason}
                        onChange={(e) => setAuditVarianceReason(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                  )}
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAuditModalOpen(false)} className="rounded-xl text-xs">
                    إلغاء
                  </Button>
                  <Button type="button" onClick={handleSaveAudit} className="rounded-xl text-xs font-bold px-5 bg-emerald-600 hover:bg-emerald-700 text-white">
                    اعتماد وحفظ محضر الجرد
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {/* ========================================================================= */}
          {/* Modal 4: إضافة وتعديل الخزن والمحافظ */}
          {/* ========================================================================= */}
          <Dialog open={isAccountManageOpen} onOpenChange={setIsAccountManageOpen}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">إضافة قناة / خزينة مالية جديدة</DialogTitle>
                <DialogDescription className="text-xs">
                  إضافة حساب بنكي، محفظة إلكترونية (Vodafone / InstaPay)، أو عهدة جديدة
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateAccount} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">اسم الحساب / الخزينة *</Label>
                  <Input
                    placeholder="مثال: محفظة أورانج كاش، أو بنك CIB"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="h-9 rounded-xl text-xs font-semibold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">نوع الحساب</Label>
                    <Select value={newAccType} onValueChange={(v: any) => setNewAccType(v)}>
                      <SelectTrigger className="h-9 rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash" className="text-xs">خزينة نقدية (درج)</SelectItem>
                        <SelectItem value="ewallet" className="text-xs">محفظة إلكترونية</SelectItem>
                        <SelectItem value="bank" className="text-xs">حساب بنكي</SelectItem>
                        <SelectItem value="pos" className="text-xs">ماكينة POS / فيزا</SelectItem>
                        <SelectItem value="petty" className="text-xs">عهدة فرعية</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">الرصيد الافتتاحي ({cur})</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={newAccInitial}
                      onChange={(e) => setNewAccInitial(e.target.value)}
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">رقم الحساب / الهاتف</Label>
                    <Input
                      placeholder="010XXXXXXXX"
                      value={newAccNumber}
                      onChange={(e) => setNewAccNumber(e.target.value)}
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">اسم البنك / الخدمة</Label>
                    <Input
                      placeholder="مثال: فودافون كاش"
                      value={newAccBank}
                      onChange={(e) => setNewAccBank(e.target.value)}
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <DialogFooter className="pt-3">
                  <Button type="button" variant="outline" onClick={() => setIsAccountManageOpen(false)} className="rounded-xl text-xs">
                    إلغاء
                  </Button>
                  <Button type="submit" className="rounded-xl text-xs font-bold px-5">
                    حفظ وإضافة الحساب
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageTransition>
    </AppShell>
  );
}
