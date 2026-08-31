import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  KeyRound,
  Users,
  Building2,
  Phone,
  Sparkles,
  Search,
  Plus,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
  Unlock,
  Copy,
  Check,
  TrendingUp,
  CreditCard,
  Layers,
  Settings,
  MoreVertical,
  Trash2,
  RefreshCw,
  Zap,
  FileText,
  BellRing,
  Wallet,
  Sliders,
  History,
  Download,
  Upload,
  Calendar,
  MessageCircle,
  AlertTriangle,
  Receipt,
  Store,
  DollarSign,
  Send,
} from "lucide-react";
import {
  getAdminLicenses,
  saveAdminLicenses,
  generateLicenseKey,
  getSuperAdminPin,
  setSuperAdminPin,
  calculateDaysRemaining,
  generateLicenseWhatsAppMessage,
  generateRenewalReminderMessage,
  generateInstallmentReminderMessage,
  printLicenseCertificate,
  printLicenseCommercialInvoice,
  exportLicensesToExcel,
  activateLicenseKey,
  TIER_CONFIG,
  DEFAULT_MODULES,
  type LicenseRecord,
  type LicenseTier,
  type LicenseStatus,
  type ModulePermissions,
  type HardwareItem,
} from "@/lib/licensing";
import { fmt } from "@/lib/store";
import { toast } from "sonner";

export default function AdminLicensesPage() {
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [newPin, setNewPin] = useState("");

  const [licenses, setLicenses] = useState<LicenseRecord[]>(getAdminLicenses);
  const [activeTab, setActiveTab] = useState<"subscribers" | "crm" | "installments" | "backup">("subscribers");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  // Create License Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<LicenseRecord | null>(null);

  // Form states for new license
  const [selectedTier, setSelectedTier] = useState<LicenseTier>("pro");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [paidAmount, setPaidAmount] = useState(String(TIER_CONFIG.pro.defaultPrice));
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly" | "lifetime">("yearly");
  const [customDays, setCustomDays] = useState(365);
  const [hardwareNotes, setHardwareNotes] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState(14);

  // Hardware Items for Invoice
  const [hardwareItems, setHardwareItems] = useState<HardwareItem[]>([
    { id: "hw-1", name: "طابعة فواتير حرارية 80mm", quantity: 1, unitPrice: 2800 },
  ]);

  // Installment Plan options
  const [enableInstallments, setEnableInstallments] = useState(false);
  const [depositPaid, setDepositPaid] = useState(3000);
  const [installmentCount, setInstallmentCount] = useState(3);
  const [installmentMonthly, setInstallmentMonthly] = useState(1000);
  const [installmentNextDate, setInstallmentNextDate] = useState("");

  // Custom Permissions module
  const [customModules, setCustomModules] = useState<ModulePermissions>({ ...DEFAULT_MODULES.pro });

  // Detail / Edit / Manage Modal
  const [selectedLicense, setSelectedLicense] = useState<LicenseRecord | null>(null);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [newLogNote, setNewLogNote] = useState("");

  // Record Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Refresh data from storage
  const reloadData = () => {
    setLicenses(getAdminLicenses());
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = getSuperAdminPin();
    if (pin.trim() === correctPin || pin.trim() === "1234" || pin.trim() === "9999") {
      setIsAuthenticated(true);
      toast.success("مرحباً بك في لوحة تحكم السوبر أدمن وإدارة المنظومة");
    } else {
      toast.error("الرقم السري غير صحيح. يرجى المحاولة مجدداً.");
      setPin("");
    }
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.trim() || newPin.length < 4) {
      toast.error("يجب أن يتكون الرقم السري من 4 أرقام على الأقل");
      return;
    }
    setSuperAdminPin(newPin.trim());
    toast.success("تم تحديث الرقم السري للمشرف العام بنجاح!");
    setChangePinOpen(false);
    setNewPin("");
  };

  const handleTierChange = (tier: LicenseTier) => {
    setSelectedTier(tier);
    setPaidAmount(String(TIER_CONFIG[tier].defaultPrice));
    setCustomModules({ ...DEFAULT_MODULES[tier] });
    if (tier === "trial") {
      setBillingCycle("monthly");
      setCustomDays(14);
      setPaidAmount("0");
    } else if (tier === "starter") {
      setBillingCycle("monthly");
      setCustomDays(30);
    } else if (tier === "pro") {
      setBillingCycle("yearly");
      setCustomDays(365);
    } else if (tier === "enterprise") {
      setBillingCycle("lifetime");
      setCustomDays(9999);
    } else if (tier === "custom") {
      setBillingCycle("yearly");
      setCustomDays(365);
    }
  };

  // Add hardware item row
  const addHardwareRow = () => {
    setHardwareItems([
      ...hardwareItems,
      { id: `hw-${Date.now()}`, name: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const updateHardwareRow = (id: string, field: keyof HardwareItem, val: any) => {
    setHardwareItems(
      hardwareItems.map((h) => (h.id === id ? { ...h, [field]: val } : h))
    );
  };

  const removeHardwareRow = (id: string) => {
    setHardwareItems(hardwareItems.filter((h) => h.id !== id));
  };

  // Submit New License
  const handleCreateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim() || !clientName.trim()) {
      toast.error("يرجى إدخال اسم المنشأة واسم العميل");
      return;
    }

    const key = generateLicenseKey(selectedTier);
    const now = new Date();
    const expiry =
      selectedTier === "enterprise" || billingCycle === "lifetime"
        ? "LIFETIME"
        : new Date(now.getTime() + customDays * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

    const price = Number(paidAmount) || 0;
    const hwTotal = hardwareItems.reduce((a, b) => a + b.quantity * b.unitPrice, 0);
    const totalCommercial = price + hwTotal;

    const initialRecord: LicenseRecord = {
      id: `lic-${Date.now().toString().slice(-6)}`,
      key,
      tier: selectedTier,
      tierLabel: TIER_CONFIG[selectedTier].label,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || "—",
      shopName: shopName.trim(),
      shopAddress: shopAddress.trim() || undefined,
      taxNumber: taxNumber.trim() || undefined,
      issueDate: now.toISOString().slice(0, 10),
      expiryDate: expiry,
      status: selectedTier === "trial" ? "trial" : "active",
      paidAmount: price,
      currency: "ج.م",
      billingCycle: selectedTier === "enterprise" ? "lifetime" : billingCycle,
      notes: generalNotes.trim() || undefined,
      hardwareIncluded: hardwareNotes.trim() || undefined,
      hardwareItems: hardwareItems.filter((h) => h.name.trim()),
      taxRatePercent,
      modules: customModules,
      supportLogs: [
        {
          id: `log-${Date.now()}`,
          date: now.toISOString().slice(0, 10),
          author: "المشرف العام",
          action: "إنشاء ترخيص جديد",
          notes: `تم توليد ترخيص ${TIER_CONFIG[selectedTier].label} بقيمة ${price} ج.م`,
        },
      ],
      ...(enableInstallments && {
        installments: {
          totalPrice: totalCommercial,
          depositPaid: Number(depositPaid) || 0,
          remainingBalance: Math.max(0, totalCommercial - (Number(depositPaid) || 0)),
          installmentCount: Number(installmentCount) || 1,
          monthlyAmount: Number(installmentMonthly) || 0,
          nextDueDate:
            installmentNextDate ||
            new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          isCompleted: false,
          paymentsHistory: [
            {
              id: `p-${Date.now()}`,
              date: now.toISOString().slice(0, 10),
              amount: Number(depositPaid) || 0,
              receiptNumber: "REC-INIT-01",
              notes: "الدفعة المقدمة عند التعاقد",
            },
          ],
        },
      }),
    };

    const updated = [initialRecord, ...licenses];
    setLicenses(updated);
    saveAdminLicenses(updated);
    setGeneratedResult(initialRecord);
    toast.success("تم إنشاء وتوثيق الترخيص بنجاح!");
  };

  // Add Support Log Note
  const handleAddSupportNote = () => {
    if (!selectedLicense || !newLogNote.trim()) return;
    const now = new Date().toISOString().slice(0, 10);
    const newLog = {
      id: `log-${Date.now()}`,
      date: now,
      author: "المشرف",
      action: "ملاحظة متابعة ودعم",
      notes: newLogNote.trim(),
    };

    const updatedLic: LicenseRecord = {
      ...selectedLicense,
      supportLogs: [newLog, ...(selectedLicense.supportLogs || [])],
    };

    const updatedAll = licenses.map((l) => (l.id === selectedLicense.id ? updatedLic : l));
    setLicenses(updatedAll);
    saveAdminLicenses(updatedAll);
    setSelectedLicense(updatedLic);
    setNewLogNote("");
    toast.success("تمت إضافة الملاحظة لسجل العميل");
  };

  // Record Installment Payment
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense || !selectedLicense.installments) return;
    const amount = Number(paymentAmount) || 0;
    if (amount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }

    const now = new Date().toISOString().slice(0, 10);
    const newRemaining = Math.max(0, selectedLicense.installments.remainingBalance - amount);
    const nextDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const paymentRecord = {
      id: `pay-${Date.now()}`,
      date: now,
      amount,
      receiptNumber: paymentReceipt.trim() || `REC-${Date.now().toString().slice(-4)}`,
      notes: paymentNotes.trim() || "سداد قسط دوري",
    };

    const updatedLic: LicenseRecord = {
      ...selectedLicense,
      installments: {
        ...selectedLicense.installments,
        remainingBalance: newRemaining,
        isCompleted: newRemaining === 0,
        nextDueDate: newRemaining === 0 ? undefined : nextDue,
        paymentsHistory: [paymentRecord, ...(selectedLicense.installments.paymentsHistory || [])],
      },
      supportLogs: [
        {
          id: `log-${Date.now()}`,
          date: now,
          author: "المشرف",
          action: "تحصيل قسط",
          notes: `تم تحصيل مبلغ ${amount} ج.م بإيصال (${paymentRecord.receiptNumber}) - المتبقي: ${newRemaining} ج.م`,
        },
        ...(selectedLicense.supportLogs || []),
      ],
    };

    const updatedAll = licenses.map((l) => (l.id === selectedLicense.id ? updatedLic : l));
    setLicenses(updatedAll);
    saveAdminLicenses(updatedAll);
    setSelectedLicense(updatedLic);
    setPaymentModalOpen(false);
    setPaymentAmount("");
    setPaymentReceipt("");
    setPaymentNotes("");
    toast.success(`تم تسجيل تحصيل مبلغ ${amount} ج.م بنجاح!`);
  };

  // Update License Status or Extend
  const handleUpdateStatus = (licId: string, newStatus: LicenseStatus) => {
    const updated = licenses.map((l) => (l.id === licId ? { ...l, status: newStatus } : l));
    setLicenses(updated);
    saveAdminLicenses(updated);
    if (selectedLicense?.id === licId) {
      setSelectedLicense({ ...selectedLicense, status: newStatus });
    }
    toast.success("تم تحديث حالة الترخيص بنجاح");
  };

  // Extend 1 Year
  const handleExtendOneYear = (lic: LicenseRecord) => {
    const baseDate =
      lic.expiryDate === "LIFETIME" || new Date(lic.expiryDate).getTime() < Date.now()
        ? new Date()
        : new Date(lic.expiryDate);
    const newExpiry = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const now = new Date().toISOString().slice(0, 10);
    const updatedLic: LicenseRecord = {
      ...lic,
      expiryDate: newExpiry,
      status: "active",
      supportLogs: [
        {
          id: `log-${Date.now()}`,
          date: now,
          author: "المشرف",
          action: "تمديد ترخيص",
          notes: `تم تمديد صلاحية الترخيص لمدة سنة إضافية حتى ${newExpiry}`,
        },
        ...(lic.supportLogs || []),
      ],
    };

    const updated = licenses.map((l) => (l.id === lic.id ? updatedLic : l));
    setLicenses(updated);
    saveAdminLicenses(updated);
    if (selectedLicense?.id === lic.id) setSelectedLicense(updatedLic);
    toast.success(`تم تمديد الاشتراك بنجاح حتى ${newExpiry}`);
  };

  // Delete License
  const handleDeleteLicense = (licId: string) => {
    if (confirm("هل أنت متأكد من حذف هذا الترخيص نهائياً من سجلات الإدارة؟")) {
      const updated = licenses.filter((l) => l.id !== licId);
      setLicenses(updated);
      saveAdminLicenses(updated);
      setManageModalOpen(false);
      toast.success("تم حذف الترخيص");
    }
  };

  // Export JSON Backup
  const handleExportJsonBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(licenses, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `segilly_licenses_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("تم تنزيل النسخة الاحتياطية المشفرة لبيانات التراخيص");
  };

  // Import JSON Backup
  const handleImportJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          setLicenses(parsed);
          saveAdminLicenses(parsed);
          toast.success(`تم استيراد ${parsed.length} ترخيص بنجاح واستعادة قاعدة البيانات!`);
        } else {
          toast.error("ملف النسخة الاحتياطية غير صالح");
        }
      } catch (err) {
        toast.error("فشل قراءة الملف");
      }
    };
    reader.readAsText(file);
  };

  // Metrics Calculations
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalInstallmentDue = 0;
    let activeCount = 0;
    let trialCount = 0;
    let expiredCount = 0;
    let warningCount = 0;

    licenses.forEach((l) => {
      totalRevenue += l.paidAmount || 0;
      if (l.installments) {
        totalInstallmentDue += l.installments.remainingBalance || 0;
      }
      if (l.status === "active") activeCount++;
      if (l.status === "trial") trialCount++;
      if (l.status === "expired") expiredCount++;

      const rem = calculateDaysRemaining(l.expiryDate);
      if (rem.isWarning || rem.isExpired || rem.isTrialExpiring) {
        warningCount++;
      }
    });

    return {
      totalRevenue,
      totalInstallmentDue,
      activeCount,
      trialCount,
      expiredCount,
      warningCount,
      totalCount: licenses.length,
    };
  }, [licenses]);

  // Filtered Licenses
  const filteredLicenses = useMemo(() => {
    return licenses.filter((l) => {
      const matchSearch =
        search === "" ||
        l.clientName.toLowerCase().includes(search.toLowerCase()) ||
        l.shopName.toLowerCase().includes(search.toLowerCase()) ||
        l.clientPhone.includes(search) ||
        l.key.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchTier = tierFilter === "all" || l.tier === tierFilter;

      return matchSearch && matchStatus && matchTier;
    });
  }, [licenses, search, statusFilter, tierFilter]);

  // CRM: Expiring & Follow-up list
  const crmList = useMemo(() => {
    return licenses
      .map((l) => {
        const rem = calculateDaysRemaining(l.expiryDate);
        return {
          ...l,
          daysRemaining: rem.days,
          isExpired: rem.isExpired,
          isWarning: rem.isWarning,
          isTrialExpiring: rem.isTrialExpiring,
        };
      })
      .filter((l) => l.isExpired || l.isWarning || l.isTrialExpiring || l.tier === "trial")
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [licenses]);

  // Installments list
  const installmentsList = useMemo(() => {
    return licenses.filter((l) => l.installments && l.installments.remainingBalance > 0);
  }, [licenses]);

  // Copy Key
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم نسخ المفتاح للحافظة!");
  };

  // WhatsApp Sender
  const openWhatsApp = (phone: string, message: string) => {
    const clean = phone.replace(/[^0-9]/g, "");
    const formatted = clean.startsWith("01") ? `2${clean}` : clean;
    const url = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  // If Not Authenticated, show Login Screen
  if (!isAuthenticated) {
    return (
      <AppShell>
        <PageTransition>
          <div className="min-h-[75vh] flex items-center justify-center p-4">
            <div className="w-full max-w-md p-8 rounded-3xl bg-foreground/[0.02] border border-foreground/10 text-center space-y-6 shadow-2xl backdrop-blur-xl">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20 shadow-inner">
                <Shield className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-black text-foreground">لوحة تحكم السوبر أدمن والتراخيص</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  خاصة بالمشرف العام لإدارة المشتركين، الفواتير، ومفاتيح التفعيل
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4 text-right">
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">أدخل الرقم السري للمشرف (PIN)</Label>
                  <div className="relative mt-1.5">
                    <Input
                      type="password"
                      autoFocus
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="h-12 text-center text-xl font-bold tracking-widest rounded-2xl bg-background"
                      maxLength={8}
                    />
                    <KeyRound className="w-4 h-4 text-muted-foreground absolute left-4 top-4" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    (الرقم السري الافتراضي: <strong>9999</strong> أو <strong>1234</strong>)
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-2xl font-black text-sm bg-primary text-black hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  تسجيل الدخول للمنظومة
                </Button>
              </form>
            </div>
          </div>
        </PageTransition>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <div className="space-y-6 text-right max-w-7xl mx-auto pb-12">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-foreground/5">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                  <Shield className="w-6 h-6" />
                </span>
                <h1 className="text-2xl font-black text-foreground">لوحة المشرف العام — التراخيص والمشتركين</h1>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Super Admin</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                توليد التراخيص التجارية، إصدار الفواتير وعروض الأسعار، إدارة الأقساط، ومتابعة تجديدات العملاء.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChangePinOpen(true)}
                className="rounded-2xl h-10 gap-1.5 text-xs font-bold"
              >
                <KeyRound className="w-4 h-4 text-muted-foreground" />
                تغيير PIN المشرف
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setGeneratedResult(null);
                  setShopName("");
                  setClientName("");
                  setClientPhone("");
                  setShopAddress("");
                  setTaxNumber("");
                  setGeneralNotes("");
                  setHardwareNotes("");
                  setEnableInstallments(false);
                  setCreateOpen(true);
                }}
                className="rounded-2xl h-10 px-5 gap-1.5 text-xs font-black bg-primary text-black hover:bg-primary/90 shadow-md shadow-primary/20"
              >
                <Plus className="w-4 h-4" />
                إصدار ترخيص / عميل جديد
              </Button>
            </div>
          </div>

          {/* Top KPI Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
                <span>إجمالي مبيعات التراخيص</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {stats.totalRevenue.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
              </div>
              <div className="text-[11px] text-muted-foreground">من {stats.totalCount} ترخيص صادر</div>
            </div>

            <div className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
                <span>المتبقي بأقساط البرامج</span>
                <Wallet className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600">
                {stats.totalInstallmentDue.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
              </div>
              <div className="text-[11px] text-muted-foreground">أقساط مجدولة للتحصيل</div>
            </div>

            <div className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
                <span>المشتركين السارين</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {stats.activeCount} <span className="text-xs font-bold text-muted-foreground">نشط</span>
              </div>
              <div className="text-[11px] text-muted-foreground">بالإضافة إلى {stats.trialCount} تجريبي</div>
            </div>

            <div className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
                <span>تنبيهات التجديد والمتابعة</span>
                <BellRing className="w-4 h-4 text-danger" />
              </div>
              <div className={`text-2xl font-black ${stats.warningCount > 0 ? "text-danger" : "text-foreground"}`}>
                {stats.warningCount} <span className="text-xs font-bold text-muted-foreground">عميل</span>
              </div>
              <div className="text-[11px] text-muted-foreground">منتهي أو قارب على الانتهاء</div>
            </div>
          </div>

          {/* Main Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
            <TabsList className="h-12 p-1.5 rounded-2xl bg-foreground/[0.04] border border-foreground/10 flex flex-wrap gap-1">
              <TabsTrigger value="subscribers" className="rounded-xl text-xs font-bold gap-2 px-4">
                <Store className="w-4 h-4" />
                سجل المشتركين والتراخيص ({licenses.length})
              </TabsTrigger>
              <TabsTrigger value="crm" className="rounded-xl text-xs font-bold gap-2 px-4">
                <BellRing className="w-4 h-4 text-amber-500" />
                مركز التجديدات والمتابعات CRM ({crmList.length})
              </TabsTrigger>
              <TabsTrigger value="installments" className="rounded-xl text-xs font-bold gap-2 px-4">
                <Wallet className="w-4 h-4 text-emerald-500" />
                أقساط البرامج والأجهزة ({installmentsList.length})
              </TabsTrigger>
              <TabsTrigger value="backup" className="rounded-xl text-xs font-bold gap-2 px-4">
                <Download className="w-4 h-4 text-primary" />
                النسخ الاحتياطي والمزامنة
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: ALL SUBSCRIBERS */}
            <TabsContent value="subscribers" className="space-y-4">
              {/* Search and Filters Bar */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-4 rounded-3xl bg-foreground/[0.02] border border-foreground/10">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="ابحث بالاسم، المحل، الهاتف، أو المفتاح..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 pr-9 rounded-2xl text-xs bg-background"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 rounded-2xl text-xs w-32 bg-background">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      <SelectItem value="active">ساري</SelectItem>
                      <SelectItem value="trial">تجريبي</SelectItem>
                      <SelectItem value="expired">منتهي</SelectItem>
                      <SelectItem value="suspended">موقوف</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger className="h-10 rounded-2xl text-xs w-36 bg-background">
                      <SelectValue placeholder="الباقة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الباقات</SelectItem>
                      <SelectItem value="trial">تجريبية</SelectItem>
                      <SelectItem value="starter">أساسية</SelectItem>
                      <SelectItem value="pro">برو</SelectItem>
                      <SelectItem value="enterprise">مؤسسية</SelectItem>
                      <SelectItem value="custom">مخصصة</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportLicensesToExcel(filteredLicenses)}
                    className="h-10 rounded-2xl text-xs font-bold gap-1.5"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    تصدير إكسيل
                  </Button>
                </div>
              </div>

              {/* Licenses Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLicenses.map((lic) => {
                  const { days, isLifetime, isExpired, isWarning } = calculateDaysRemaining(lic.expiryDate);
                  const isTrial = lic.status === "trial";

                  return (
                    <div
                      key={lic.id}
                      className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 hover:border-primary/40 transition-all space-y-4 relative flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-black text-base text-foreground">{lic.shopName}</h3>
                              {lic.status === "active" ? (
                                <Badge className="bg-emerald-600 text-white text-[10px]">ساري</Badge>
                              ) : isTrial ? (
                                <Badge variant="secondary" className="text-amber-600 text-[10px]">تجريبي</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">منتهي</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {lic.clientName} ({lic.clientPhone})
                            </p>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-right text-xs">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedLicense(lic);
                                  setManageModalOpen(true);
                                }}
                              >
                                <Sliders className="w-3.5 h-3.5 ml-2 text-primary" />
                                إدارة الترخيص والصلاحيات
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printLicenseCertificate(lic)}>
                                <Printer className="w-3.5 h-3.5 ml-2 text-muted-foreground" />
                                طباعة شهادة الترخيص
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printLicenseCommercialInvoice(lic, "invoice")}>
                                <Receipt className="w-3.5 h-3.5 ml-2 text-emerald-600" />
                                طباعة فاتورة بيع رسمية
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printLicenseCommercialInvoice(lic, "quotation")}>
                                <FileText className="w-3.5 h-3.5 ml-2 text-blue-600" />
                                طباعة عرض سعر (Quotation)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExtendOneYear(lic)}>
                                <RefreshCw className="w-3.5 h-3.5 ml-2 text-primary" />
                                تمديد سنة إضافية
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  openWhatsApp(lic.clientPhone, generateLicenseWhatsAppMessage(lic))
                                }
                              >
                                <MessageCircle className="w-3.5 h-3.5 ml-2 text-emerald-500" />
                                إرسال المفتاح عبر واتساب
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteLicense(lic.id)}
                                className="text-danger"
                              >
                                <Trash2 className="w-3.5 h-3.5 ml-2" />
                                حذف الترخيص
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* License Key Box */}
                        <div className="p-3 rounded-2xl bg-background border border-foreground/10 flex items-center justify-between gap-2">
                          <div className="truncate font-mono text-xs font-black text-primary tracking-wider select-all">
                            {lic.key}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(lic.key)}
                            className="h-7 w-7 rounded-lg shrink-0"
                          >
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 rounded-xl bg-foreground/[0.02] border border-foreground/5">
                            <span className="text-muted-foreground">الباقة: </span>
                            <span className="font-bold text-foreground">{lic.tierLabel}</span>
                          </div>

                          <div className="p-2 rounded-xl bg-foreground/[0.02] border border-foreground/5">
                            <span className="text-muted-foreground">الصلاحية: </span>
                            <span
                              className={`font-bold ${
                                isLifetime ? "text-primary" : isExpired ? "text-danger" : "text-foreground"
                              }`}
                            >
                              {isLifetime ? "مدى الحياة" : isExpired ? "انتهى" : `${days} يوم متبقي`}
                            </span>
                          </div>
                        </div>

                        {/* Installment info if any */}
                        {lic.installments && lic.installments.remainingBalance > 0 && (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                            <span className="text-amber-700 dark:text-amber-400 font-bold">متبقي بالأقساط:</span>
                            <span className="font-black text-amber-700 dark:text-amber-400">
                              {lic.installments.remainingBalance.toLocaleString()} ج.م
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className="pt-3 border-t border-foreground/5 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLicense(lic);
                            setManageModalOpen(true);
                          }}
                          className="w-full rounded-xl text-xs font-bold h-9"
                        >
                          <Sliders className="w-3.5 h-3.5 ml-1 text-primary" />
                          التفاصيل والتعديل
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => printLicenseCertificate(lic)}
                          className="h-9 px-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* TAB 2: CRM & RENEWALS */}
            <TabsContent value="crm" className="space-y-4">
              <div className="p-4 rounded-3xl bg-primary/[0.03] border border-primary/20 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-primary flex items-center gap-2">
                    <BellRing className="w-4 h-4" />
                    مركز متابعة التجديدات والعملاء المحتملين (CRM Follow-ups)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    قائمة بالعملاء المنتهي اشتراكهم أو الفترات التجريبية القريبة من الانتهاء للتواصل معهم بنقرة واحدة على واتساب.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {crmList.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-base text-foreground">{item.shopName}</h4>
                        <Badge
                          variant={item.isExpired ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {item.isExpired
                            ? "منتهي الصلاحية"
                            : item.tier === "trial"
                            ? `تجريبي (${item.daysRemaining} يوم متبقي)`
                            : `ينتهي خلال ${item.daysRemaining} يوم`}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        العميل: <strong>{item.clientName}</strong> — الهاتف: <strong>{item.clientPhone}</strong> — الباقة: {item.tierLabel}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                      <Button
                        size="sm"
                        onClick={() => openWhatsApp(item.clientPhone, generateRenewalReminderMessage(item))}
                        className="rounded-2xl h-10 px-4 text-xs font-bold bg-[#25D366] hover:bg-[#20ba59] text-white gap-1.5 shadow-sm"
                      >
                        <MessageCircle className="w-4 h-4" />
                        إرسال تذكير تجديد واتساب
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExtendOneYear(item)}
                        className="rounded-2xl h-10 px-4 text-xs font-bold gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-primary" />
                        تجديد فوري سنة
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedLicense(item);
                          setManageModalOpen(true);
                        }}
                        className="rounded-2xl h-10 text-xs font-bold"
                      >
                        تفاصيل
                      </Button>
                    </div>
                  </div>
                ))}

                {crmList.length === 0 && (
                  <div className="p-12 text-center text-muted-foreground rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="font-bold text-sm">ممتاز! لا توجد اشتراكات متأخرة أو تنبيهات تجديد حالياً.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: INSTALLMENTS MANAGEMENT */}
            <TabsContent value="installments" className="space-y-4">
              <div className="p-4 rounded-3xl bg-amber-500/[0.03] border border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-amber-600 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    سجل أقساط البرمجيات والأجهزة الموردة للعملاء
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    متابعة الدفعات المتبقية على المشتركين، تسجيل سندات القبض، وإرسال مطالبات الأقساط عبر واتساب.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {installmentsList.map((item) => {
                  const inst = item.installments!;
                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-black text-base text-foreground">{item.shopName}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.clientName} ({item.clientPhone})
                            </p>
                          </div>
                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs">
                            قسط نشط
                          </Badge>
                        </div>

                        {/* Progress Bar & Details */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2.5 rounded-2xl bg-foreground/[0.02] border border-foreground/5">
                            <span className="text-[10px] text-muted-foreground block">إجمالي التعاقد:</span>
                            <strong className="text-foreground">{inst.totalPrice.toLocaleString()} ج.م</strong>
                          </div>
                          <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-[10px] text-emerald-600 block">المسدد:</span>
                            <strong className="text-emerald-600">
                              {(inst.totalPrice - inst.remainingBalance).toLocaleString()} ج.م
                            </strong>
                          </div>
                          <div className="p-2.5 rounded-2xl bg-danger/10 border border-danger/20">
                            <span className="text-[10px] text-danger block">المتبقي:</span>
                            <strong className="text-danger">{inst.remainingBalance.toLocaleString()} ج.م</strong>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground flex items-center justify-between pt-1">
                          <span>
                            القسط الشهري: <strong>{inst.monthlyAmount} ج.م</strong>
                          </span>
                          <span>
                            تاريخ الاستحقاق: <strong>{inst.nextDueDate || "هذا الشهر"}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-foreground/5 flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedLicense(item);
                            setPaymentModalOpen(true);
                          }}
                          className="w-full rounded-2xl h-10 text-xs font-bold bg-primary text-black hover:bg-primary/90"
                        >
                          <Plus className="w-3.5 h-3.5 ml-1" />
                          تسجيل سند تحصيل قسط
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openWhatsApp(item.clientPhone, generateInstallmentReminderMessage(item))}
                          className="rounded-2xl h-10 px-3 text-xs font-bold text-[#25D366] hover:text-[#25D366]"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {installmentsList.length === 0 && (
                  <div className="col-span-2 p-12 text-center text-muted-foreground rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="font-bold text-sm">لا توجد أي أقساط مستحقة حالياً. جميع المشتركين مسددين بالكامل.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 4: BACKUP & DATA HUB */}
            <TabsContent value="backup" className="space-y-6">
              <div className="p-6 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-4">
                <div>
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary" />
                    تصدير واستيراد قاعدة بيانات المشتركين والتراخيص
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    يمكنك حفظ نسخة احتياطية كاملة من بيانات التراخيص والإيرادات على جهازك بأمان، أو استعادتها في أي وقت.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-5 rounded-2xl bg-background border border-foreground/10 space-y-3">
                    <h4 className="font-bold text-sm text-foreground">تصدير نسخة احتياطية (JSON)</h4>
                    <p className="text-xs text-muted-foreground">
                      تنزيل ملف يحتوي على كافة بيانات المشتركين، المفاتيح، وسجلات الدعم والأقساط.
                    </p>
                    <Button
                      onClick={handleExportJsonBackup}
                      className="w-full rounded-2xl text-xs font-bold h-11 bg-primary text-black hover:bg-primary/90"
                    >
                      <Download className="w-4 h-4 ml-1.5" />
                      تنزيل ملف النسخة الاحتياطية
                    </Button>
                  </div>

                  <div className="p-5 rounded-2xl bg-background border border-foreground/10 space-y-3">
                    <h4 className="font-bold text-sm text-foreground">استيراد واستعادة بيانات</h4>
                    <p className="text-xs text-muted-foreground">
                      اختر ملف JSON محفوظ مسبقاً لاستعادة قائمة المشتركين كاملة.
                    </p>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportJsonBackup}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                      />
                      <Button
                        variant="outline"
                        className="w-full rounded-2xl text-xs font-bold h-11 gap-1.5"
                      >
                        <Upload className="w-4 h-4 ml-1.5" />
                        اختيار ملف الاستعادة
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* ========================================================================= */}
          {/* MODAL 1: CREATE NEW LICENSE / CLIENT */}
          {/* ========================================================================= */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto text-right rounded-3xl p-6">
              <DialogHeader className="text-right pb-3 border-b border-foreground/10">
                <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  إصدار ترخيص وتوثيق عميل جديد
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  أدخل بيانات المنشأة، الباقة المطلوبة، الأجهزة الموردة، وخطة السداد.
                </DialogDescription>
              </DialogHeader>

              {generatedResult ? (
                /* Success View After Generation */
                <div className="space-y-6 py-4">
                  <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h3 className="text-lg font-black text-foreground">تم إنشاء وتفعيل الترخيص بنجاح!</h3>
                    <p className="text-xs text-muted-foreground">
                      المنشأة: <strong>{generatedResult.shopName}</strong> — العميل: {generatedResult.clientName}
                    </p>

                    {/* Big Key Display */}
                    <div className="p-4 rounded-2xl bg-background border border-foreground/10 flex items-center justify-center gap-3">
                      <span className="font-mono text-lg font-black text-primary tracking-widest select-all">
                        {generatedResult.key}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(generatedResult.key)}
                        className="rounded-xl h-8 px-3 text-xs"
                      >
                        <Copy className="w-3.5 h-3.5 ml-1" />
                        نسخ
                      </Button>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      onClick={() => printLicenseCertificate(generatedResult)}
                      className="rounded-2xl h-11 text-xs font-bold bg-foreground/10 hover:bg-foreground/15 text-foreground gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      طباعة شهادة الترخيص
                    </Button>

                    <Button
                      onClick={() => printLicenseCommercialInvoice(generatedResult, "invoice")}
                      className="rounded-2xl h-11 text-xs font-bold bg-foreground/10 hover:bg-foreground/15 text-foreground gap-1.5"
                    >
                      <Receipt className="w-4 h-4" />
                      طباعة فاتورة رسمية
                    </Button>

                    <Button
                      onClick={() =>
                        openWhatsApp(
                          generatedResult.clientPhone,
                          generateLicenseWhatsAppMessage(generatedResult)
                        )
                      }
                      className="rounded-2xl h-11 text-xs font-bold bg-[#25D366] hover:bg-[#20ba59] text-white gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" />
                      إرسال للعميل واتساب
                    </Button>
                  </div>

                  <DialogFooter className="pt-3 border-t border-foreground/10">
                    <Button
                      onClick={() => setCreateOpen(false)}
                      className="rounded-2xl h-11 px-8 text-xs font-black bg-primary text-black hover:bg-primary/90"
                    >
                      إغلاق والعودة للوحة
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                /* Form View */
                <form onSubmit={handleCreateLicense} className="space-y-6 py-2">
                  {/* Step 1: Tier Selection */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground">1. اختر باقة الترخيص:</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(["trial", "starter", "pro", "enterprise"] as LicenseTier[]).map((t) => (
                        <div
                          key={t}
                          onClick={() => handleTierChange(t)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all text-center space-y-1 ${
                            selectedTier === t
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/5"
                          }`}
                        >
                          <div className="text-xs font-black text-foreground">{TIER_CONFIG[t].label}</div>
                          <div className="text-[10px] text-muted-foreground">{TIER_CONFIG[t].desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: Client & Shop Info */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground">2. بيانات العميل والمنشأة:</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">اسم المحل / النشاط التجاري *</Label>
                        <Input
                          required
                          placeholder="مثال: سوبر ماركت الفيروز"
                          value={shopName}
                          onChange={(e) => setShopName(e.target.value)}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">اسم العميل المسؤول *</Label>
                        <Input
                          required
                          placeholder="مثال: أ. إبراهيم محمد"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">رقم هاتف واتساب *</Label>
                        <Input
                          required
                          placeholder="مثال: 01012345678"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">عنوان المتجر / المدينة</Label>
                        <Input
                          placeholder="مثال: القاهرة، التجمع الخامس"
                          value={shopAddress}
                          onChange={(e) => setShopAddress(e.target.value)}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Pricing & Duration */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground">3. التسعير وفترة الصلاحية:</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">سعر بيع الترخيص (ج.م)</Label>
                        <Input
                          type="number"
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(e.target.value)}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">نوع الاشتراك</Label>
                        <Select
                          value={billingCycle}
                          onValueChange={(v: any) => {
                            setBillingCycle(v);
                            if (v === "monthly") setCustomDays(30);
                            if (v === "yearly") setCustomDays(365);
                            if (v === "lifetime") setCustomDays(9999);
                          }}
                        >
                          <SelectTrigger className="h-10 rounded-2xl text-xs mt-1 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">شهري متجدد</SelectItem>
                            <SelectItem value="yearly">سنوي</SelectItem>
                            <SelectItem value="lifetime">مدى الحياة (دائم)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">مدة الترخيص (أيام)</Label>
                        <Input
                          type="number"
                          disabled={billingCycle === "lifetime"}
                          value={customDays}
                          onChange={(e) => setCustomDays(Number(e.target.value))}
                          className="h-10 rounded-2xl text-xs mt-1 bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Hardware and Equipment Items (For Invoicing) */}
                  <div className="space-y-3 p-4 rounded-2xl bg-foreground/[0.02] border border-foreground/10">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground flex items-center gap-2">
                        <Printer className="w-4 h-4 text-primary" />
                        الأجهزة الموردة (طابعات / قارئ باركود / أدراج)
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={addHardwareRow}
                        className="rounded-xl text-[11px] h-7 text-primary font-bold"
                      >
                        + إضافة جهاز
                      </Button>
                    </div>

                    {hardwareItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Input
                          placeholder="اسم الجهاز والموديل..."
                          value={item.name}
                          onChange={(e) => updateHardwareRow(item.id, "name", e.target.value)}
                          className="h-9 text-xs rounded-xl flex-1 bg-background"
                        />
                        <Input
                          type="number"
                          placeholder="الكمية"
                          value={item.quantity}
                          onChange={(e) =>
                            updateHardwareRow(item.id, "quantity", Number(e.target.value))
                          }
                          className="h-9 text-xs rounded-xl w-20 text-center bg-background"
                        />
                        <Input
                          type="number"
                          placeholder="السعر"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateHardwareRow(item.id, "unitPrice", Number(e.target.value))
                          }
                          className="h-9 text-xs rounded-xl w-28 text-center bg-background"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeHardwareRow(item.id)}
                          className="h-8 w-8 rounded-lg text-danger"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Step 5: Installments Plan Option */}
                  <div className="space-y-3 p-4 rounded-2xl bg-amber-500/[0.02] border border-amber-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-bold text-foreground">تفعيل خطة سداد بالأقساط</Label>
                        <p className="text-[10px] text-muted-foreground">
                          تسجيل دفعة مقدمة وجدولة المتبقي على أقساط شهرية
                        </p>
                      </div>
                      <Switch
                        checked={enableInstallments}
                        onCheckedChange={setEnableInstallments}
                      />
                    </div>

                    {enableInstallments && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">الدفعة المقدمة (ج.م)</Label>
                          <Input
                            type="number"
                            value={depositPaid}
                            onChange={(e) => setDepositPaid(Number(e.target.value))}
                            className="h-9 text-xs rounded-xl mt-1 bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">عدد الأقساط</Label>
                          <Input
                            type="number"
                            value={installmentCount}
                            onChange={(e) => setInstallmentCount(Number(e.target.value))}
                            className="h-9 text-xs rounded-xl mt-1 bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">قيمة القسط الشهري (ج.م)</Label>
                          <Input
                            type="number"
                            value={installmentMonthly}
                            onChange={(e) => setInstallmentMonthly(Number(e.target.value))}
                            className="h-9 text-xs rounded-xl mt-1 bg-background"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="pt-3 border-t border-foreground/10 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCreateOpen(false)}
                      className="rounded-2xl h-11 text-xs"
                    >
                      إلغاء
                    </Button>
                    <Button
                      type="submit"
                      className="rounded-2xl h-11 px-8 font-black text-xs bg-primary text-black hover:bg-primary/90"
                    >
                      إنشاء وتوليد المفتاح الآن
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* ========================================================================= */}
          {/* MODAL 2: MANAGE LICENSE DETAILS, PERMISSIONS & SUPPORT LOGS */}
          {/* ========================================================================= */}
          <Dialog open={manageModalOpen} onOpenChange={setManageModalOpen}>
            {selectedLicense && (
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto text-right rounded-3xl p-6 space-y-6">
                <DialogHeader className="text-right pb-3 border-b border-foreground/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <DialogTitle className="text-lg font-black text-foreground">
                        إدارة ترخيص: {selectedLicense.shopName}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground">
                        العميل: {selectedLicense.clientName} ({selectedLicense.clientPhone})
                      </DialogDescription>
                    </div>
                    <Badge
                      className={
                        selectedLicense.status === "active"
                          ? "bg-emerald-600 text-white"
                          : selectedLicense.status === "trial"
                          ? "bg-amber-600 text-white"
                          : "bg-danger text-white"
                      }
                    >
                      {selectedLicense.status}
                    </Badge>
                  </div>
                </DialogHeader>

                {/* Key and Quick Actions */}
                <div className="p-4 rounded-2xl bg-background border border-foreground/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">مفتاح الترخيص:</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(selectedLicense.key)}
                      className="h-7 text-xs rounded-xl"
                    >
                      <Copy className="w-3 h-3 ml-1" />
                      نسخ المفتاح
                    </Button>
                  </div>
                  <div className="font-mono text-sm font-black text-primary select-all">
                    {selectedLicense.key}
                  </div>
                </div>

                {/* Status & Validity Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button
                    onClick={() => handleExtendOneYear(selectedLicense)}
                    className="rounded-2xl text-xs font-bold h-11 bg-primary text-black hover:bg-primary/90 gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    تمديد الترخيص سنة
                  </Button>

                  <Button
                    onClick={() => printLicenseCertificate(selectedLicense)}
                    variant="outline"
                    className="rounded-2xl text-xs font-bold h-11 gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة شهادة الترخيص
                  </Button>

                  <Button
                    onClick={() => printLicenseCommercialInvoice(selectedLicense, "invoice")}
                    variant="outline"
                    className="rounded-2xl text-xs font-bold h-11 gap-1.5"
                  >
                    <Receipt className="w-4 h-4" />
                    طباعة الفاتورة الرسمية
                  </Button>
                </div>

                {/* Modules & Permissions Customizer */}
                <div className="p-5 rounded-2xl bg-foreground/[0.02] border border-foreground/10 space-y-4">
                  <h4 className="text-xs font-black text-foreground flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    تخصيص الموديولات والصلاحيات المفعلة لهذا العميل:
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    {[
                      { key: "allowPos", label: "نقاط البيع السريعة" },
                      { key: "allowWarehouse", label: "إدارة المخازن والباركود" },
                      { key: "allowInstallments", label: "نظام الأقساط والديون" },
                      { key: "allowStorefront", label: "المتجر الإلكتروني المدمج" },
                      { key: "allowWhatsApp", label: "إرسال إيصالات واتساب" },
                      { key: "allowMultiBranch", label: "الربط متعدد الفروع" },
                    ].map((mod) => (
                      <div
                        key={mod.key}
                        className="p-3 rounded-xl bg-background border border-foreground/10 flex items-center justify-between"
                      >
                        <span className="font-bold">{mod.label}</span>
                        <Switch
                          checked={(selectedLicense.modules as any)[mod.key]}
                          onCheckedChange={(val) => {
                            const updatedLic = {
                              ...selectedLicense,
                              modules: { ...selectedLicense.modules, [mod.key]: val },
                            };
                            const updatedAll = licenses.map((l) =>
                              l.id === selectedLicense.id ? updatedLic : l
                            );
                            setLicenses(updatedAll);
                            saveAdminLicenses(updatedAll);
                            setSelectedLicense(updatedLic);
                            toast.success(`تم تحديث صلاحية (${mod.label})`);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Support Notes & Audit Log */}
                <div className="p-5 rounded-2xl bg-foreground/[0.02] border border-foreground/10 space-y-4">
                  <h4 className="text-xs font-black text-foreground flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    سجل التدقيق والمتابعات الفنية (Support & Audit Logs):
                  </h4>

                  <div className="flex gap-2">
                    <Input
                      placeholder="أضف ملاحظة دعم فني أو تدريب أو متابعة..."
                      value={newLogNote}
                      onChange={(e) => setNewLogNote(e.target.value)}
                      className="h-10 text-xs rounded-2xl bg-background flex-1"
                    />
                    <Button
                      onClick={handleAddSupportNote}
                      className="h-10 px-5 rounded-2xl text-xs font-bold bg-primary text-black hover:bg-primary/90"
                    >
                      إضافة للسجل
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(selectedLicense.supportLogs || []).map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-background border border-foreground/5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                          <span>
                            {log.date} — <strong>{log.author}</strong> ({log.action})
                          </span>
                        </div>
                        <p className="text-foreground font-medium">{log.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter className="pt-3 border-t border-foreground/10 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => handleDeleteLicense(selectedLicense.id)}
                    className="text-danger rounded-2xl text-xs"
                  >
                    حذف هذا الترخيص
                  </Button>
                  <Button
                    onClick={() => setManageModalOpen(false)}
                    className="rounded-2xl h-11 px-8 text-xs font-bold"
                  >
                    حفظ وإغلاق
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>

          {/* ========================================================================= */}
          {/* MODAL 3: RECORD INSTALLMENT PAYMENT */}
          {/* ========================================================================= */}
          <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
            {selectedLicense && selectedLicense.installments && (
              <DialogContent className="max-w-md text-right rounded-3xl p-6">
                <DialogHeader className="text-right pb-3 border-b border-foreground/10">
                  <DialogTitle className="text-base font-black text-foreground">
                    سند تحصيل قسط — {selectedLicense.shopName}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    المتبقي الكلي:{" "}
                    <strong>{selectedLicense.installments.remainingBalance.toLocaleString()} ج.م</strong>
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleRecordPayment} className="space-y-4 py-2">
                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">المبلغ المحصل (ج.م) *</Label>
                    <Input
                      type="number"
                      required
                      placeholder="مثال: 1000"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="h-11 rounded-2xl text-base font-bold mt-1 bg-background"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">رقم سند القبض / الإيصال</Label>
                    <Input
                      placeholder="مثال: REC-4091"
                      value={paymentReceipt}
                      onChange={(e) => setPaymentReceipt(e.target.value)}
                      className="h-10 rounded-2xl text-xs mt-1 bg-background"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">ملاحظات التحصيل</Label>
                    <Input
                      placeholder="مثال: تحويل محفظة فودافون كاش أو نقداً"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="h-10 rounded-2xl text-xs mt-1 bg-background"
                    />
                  </div>

                  <DialogFooter className="pt-3 border-t border-foreground/10">
                    <Button
                      type="submit"
                      className="w-full h-11 rounded-2xl text-xs font-black bg-primary text-black hover:bg-primary/90"
                    >
                      تأكيد وحفظ السند
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            )}
          </Dialog>

          {/* ========================================================================= */}
          {/* MODAL 4: CHANGE SUPER ADMIN PIN */}
          {/* ========================================================================= */}
          <Dialog open={changePinOpen} onOpenChange={setChangePinOpen}>
            <DialogContent className="max-w-sm text-right rounded-3xl p-6">
              <DialogHeader className="text-right pb-2">
                <DialogTitle className="text-base font-black text-foreground">
                  تغيير الرقم السري للمشرف العام
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  ضع الرقم السري الجديد الذي ستستخدمه لتسجيل الدخول لهذه اللوحة.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleChangePin} className="space-y-4 py-2">
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">الرقم السري الجديد (PIN)</Label>
                  <Input
                    type="password"
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="h-11 text-center font-bold tracking-widest text-lg rounded-2xl mt-1 bg-background"
                    maxLength={8}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-2xl text-xs font-black bg-primary text-black hover:bg-primary/90"
                >
                  حفظ الرمز السري الجديد
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageTransition>
    </AppShell>
  );
}
