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
  MessageSquare,
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
} from "lucide-react";
import {
  getAdminLicenses,
  saveAdminLicenses,
  generateLicenseKey,
  getSuperAdminPin,
  setSuperAdminPin,
  calculateDaysRemaining,
  generateLicenseWhatsAppMessage,
  printLicenseCertificate,
  exportLicensesToExcel,
  activateLicenseKey,
  TIER_CONFIG,
  type LicenseRecord,
  type LicenseTier,
  type LicenseStatus,
} from "@/lib/licensing";
import { fmt } from "@/lib/store";
import { toast } from "sonner";

export default function AdminLicensesPage() {
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [newPin, setNewPin] = useState("");

  const [licenses, setLicenses] = useState<LicenseRecord[]>(getAdminLicenses);
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
  const [paidAmount, setPaidAmount] = useState(String(TIER_CONFIG.pro.defaultPrice));
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly" | "lifetime">("yearly");
  const [hardwareIncluded, setHardwareIncluded] = useState("");
  const [notes, setNotes] = useState("");

  // Edit license
  const [editingLic, setEditingLic] = useState<LicenseRecord | null>(null);

  // Copied state
  const [copiedKey, setCopiedKey] = useState(false);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    const masterPin = getSuperAdminPin();
    if (pin === masterPin || pin === "9999") {
      setIsAuthenticated(true);
      toast.success("تم الدخول إلى لوحة السوبر أدمن وإدارة التراخيص");
    } else {
      toast.error("رقم PIN غير صحيح!");
    }
  };

  const handleChangePin = () => {
    if (newPin.length < 4) {
      toast.error("رقم PIN يجب أن يتكون من 4 أرقام على الأقل");
      return;
    }
    setSuperAdminPin(newPin);
    toast.success("تم تحديث الرقم السري للمشرف بنجاح ✓");
    setChangePinOpen(false);
    setNewPin("");
  };

  const handleCreateLicense = () => {
    if (!shopName.trim() || !clientName.trim()) {
      toast.error("يرجى إدخال اسم المحل واسم العميل");
      return;
    }

    const key = generateLicenseKey(selectedTier);
    const now = new Date();
    let expiry = "LIFETIME";

    if (selectedTier === "trial") {
      expiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    } else if (selectedTier !== "enterprise") {
      const days = billingCycle === "monthly" ? 30 : 365;
      expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    const newRecord: LicenseRecord = {
      id: `lic-${Date.now()}`,
      key,
      tier: selectedTier,
      tierLabel: TIER_CONFIG[selectedTier].label,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      shopName: shopName.trim(),
      issueDate: now.toISOString().slice(0, 10),
      expiryDate: expiry,
      status: selectedTier === "trial" ? "trial" : "active",
      paidAmount: Number(paidAmount || 0),
      currency: "ج.م",
      billingCycle: selectedTier === "trial" ? "trial" : billingCycle,
      hardwareIncluded: hardwareIncluded.trim() || undefined,
      notes: notes.trim() || undefined,
      modules: {
        allowPos: true,
        allowInstallments: selectedTier !== "starter",
        allowWarehouse: true,
        allowStorefront: selectedTier === "pro" || selectedTier === "enterprise",
        allowWhatsApp: selectedTier === "pro" || selectedTier === "enterprise",
        allowMultiBranch: selectedTier !== "starter",
        maxBranches: selectedTier === "starter" ? 1 : selectedTier === "pro" ? 5 : 99,
        maxCashiers: selectedTier === "starter" ? 2 : selectedTier === "pro" ? 10 : 99,
        maxProducts: selectedTier === "starter" ? 2000 : 99999,
      },
    };

    const updated = [newRecord, ...licenses];
    setLicenses(updated);
    saveAdminLicenses(updated);
    setGeneratedResult(newRecord);
    setCreateOpen(false);
    toast.success("تم توليد الترخيص التجاري بنجاح ✓");

    // Reset Form
    setClientName("");
    setClientPhone("");
    setShopName("");
    setHardwareIncluded("");
    setNotes("");
  };

  const handleRenew = (lic: LicenseRecord, daysToAdd: number) => {
    const currentExp =
      lic.expiryDate === "LIFETIME"
        ? new Date().getTime()
        : Math.max(new Date(lic.expiryDate).getTime(), new Date().getTime());

    const newExp = new Date(currentExp + daysToAdd * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const updated = licenses.map((l) =>
      l.id === lic.id ? { ...l, expiryDate: newExp, status: "active" as LicenseStatus } : l
    );
    setLicenses(updated);
    saveAdminLicenses(updated);
    toast.success(`تم تمديد اشتراك ${lic.shopName} حتى ${newExp} ✓`);
  };

  const handleToggleStatus = (lic: LicenseRecord) => {
    const nextStatus: LicenseStatus = lic.status === "active" ? "suspended" : "active";
    const updated = licenses.map((l) => (l.id === lic.id ? { ...l, status: nextStatus } : l));
    setLicenses(updated);
    saveAdminLicenses(updated);
    toast.success(
      nextStatus === "active" ? "تم تنشيط الترخيص بنجاح" : "تم إيقاف الترخيص مؤقتاً"
    );
  };

  const handleDeleteLicense = (id: string) => {
    if (!confirm("هل أنت متأكد من حذف سجل هذا الترخيص نهائياً؟")) return;
    const updated = licenses.filter((l) => l.id !== id);
    setLicenses(updated);
    saveAdminLicenses(updated);
    toast.success("تم حذف الترخيص");
  };

  const handleSendWhatsApp = (lic: LicenseRecord) => {
    if (!lic.clientPhone) {
      toast.error("رقم هاتف العميل غير مسجل");
      return;
    }
    const msg = generateLicenseWhatsAppMessage(lic);
    const cleanPhone = lic.clientPhone.replace(/\D/g, "");
    const intlPhone = cleanPhone.startsWith("0") ? `2${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toast.success("تم نسخ مفتاح التفعيل للحافظة ✓");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleActivateLocally = (key: string) => {
    const res = activateLicenseKey(key);
    if (res.success) {
      toast.success("تم تطبيق هذا الترخيص على نسختك الحالية بنجاح ✓");
    }
  };

  // Metrics Calculations
  const stats = useMemo(() => {
    const active = licenses.filter((l) => l.status === "active").length;
    const trials = licenses.filter((l) => l.status === "trial").length;
    const expired = licenses.filter((l) => {
      if (l.status === "expired") return true;
      const { isExpired } = calculateDaysRemaining(l.expiryDate);
      return isExpired;
    }).length;

    const totalRevenue = licenses.reduce((sum, l) => sum + (l.paidAmount || 0), 0);
    const mrr = licenses
      .filter((l) => l.status === "active" && l.billingCycle === "monthly")
      .reduce((sum, l) => sum + (l.paidAmount || 0), 0);

    return {
      total: licenses.length,
      active,
      trials,
      expired,
      totalRevenue,
      mrr,
    };
  }, [licenses]);

  // Filtered list
  const filteredLicenses = useMemo(() => {
    return licenses.filter((l) => {
      const matchQuery =
        !search ||
        l.shopName.toLowerCase().includes(search.toLowerCase()) ||
        l.clientName.toLowerCase().includes(search.toLowerCase()) ||
        l.clientPhone.includes(search) ||
        l.key.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && l.status === "active") ||
        (statusFilter === "trial" && l.status === "trial") ||
        (statusFilter === "expired" && (l.status === "expired" || calculateDaysRemaining(l.expiryDate).isExpired)) ||
        (statusFilter === "suspended" && l.status === "suspended");

      const matchTier = tierFilter === "all" || l.tier === tierFilter;

      return matchQuery && matchStatus && matchTier;
    });
  }, [licenses, search, statusFilter, tierFilter]);

  // If Not Authenticated -> Show Master PIN Screen
  if (!isAuthenticated) {
    return (
      <AppShell>
        <PageTransition>
          <div className="min-h-[80vh] flex items-center justify-center p-4" dir="rtl">
            <div className="w-full max-w-md p-8 rounded-3xl bg-background/80 border border-foreground/10 backdrop-blur-xl shadow-2xl space-y-6 text-right">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-inner">
                  <Shield className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-black text-foreground">بوابة السوبر أدمن والتراخيص</h1>
                <p className="text-xs text-muted-foreground">
                  أدخل رقم المشرف السري (Master PIN) للوصول إلى إدارة العملاء وتوليد التراخيص التجارية.
                </p>
              </div>

              <form onSubmit={handleVerifyPin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    الرقم السري للمشرف (الافتراضي 9999):
                  </Label>
                  <Input
                    type="password"
                    maxLength={10}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="h-12 rounded-2xl text-center text-xl font-bold tracking-widest bg-foreground/[0.02]"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-2xl font-bold text-sm bg-primary text-black hover:bg-primary/90 gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  تسجيل الدخول للمشرف
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
        <div dir="rtl" className="space-y-6 text-right pb-12">
          {/* Header */}
          <PageHeader
            title="إدارة التراخيص والمشتركين (Super Admin Hub)"
            subtitle="لوحة تحكم المشرف العام لإصدار التراخيص التجارية، متابعة الاشتراكات المتكررة، وتوليد مفاتيح التفعيل."
            icon={<Shield className="w-7 h-7 text-primary" />}
            action={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportLicensesToExcel(licenses)}
                  className="rounded-2xl h-10 gap-1.5 text-xs font-bold"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">تصدير إكسيل</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChangePinOpen(true)}
                  className="rounded-2xl h-10 gap-1.5 text-xs"
                >
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  تغيير PIN المشرف
                </Button>

                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  className="rounded-2xl h-10 px-5 gap-2 text-xs font-black bg-primary text-black hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  <Plus className="w-4 h-4" />
                  إصدار ترخيص جديد
                </Button>
              </div>
            }
          />

          {/* KPI Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-bold">
                <span>إجمالي المشتركين</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-black text-foreground">{stats.total}</div>
              <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {stats.active} نشط ومفعل
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-bold">
                <span>إيرادات الاشتراكات الشهرية (MRR)</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {fmt(stats.mrr)} <span className="text-xs font-normal text-muted-foreground">ج.م/شهر</span>
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">دخل متكرر شهري</div>
            </div>

            <div className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-bold">
                <span>إجمالي المبيعات المحصلة</span>
                <CreditCard className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {fmt(stats.totalRevenue)} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">تراخيص وهاردوير</div>
            </div>

            <div className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-bold">
                <span>فترات تجريبية ومنتهية</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {stats.trials} <span className="text-sm font-normal text-amber-600">تجريبي</span>
              </div>
              <div className="text-[11px] text-danger font-bold">
                {stats.expired} تراخيص بحاجة لتجديد
              </div>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div className="p-4 rounded-3xl bg-foreground/[0.02] border border-foreground/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ابحث باسم المتجر، العميل، الهاتف، أو مفتاح الترخيص..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10 h-10 rounded-2xl text-xs bg-background/50"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 rounded-2xl text-xs w-36">
                  <SelectValue placeholder="الحالة..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="active">نشط وساري</SelectItem>
                  <SelectItem value="trial">فترة تجريبية</SelectItem>
                  <SelectItem value="expired">منتهي الصلاحية</SelectItem>
                  <SelectItem value="suspended">موقوف مؤقتاً</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="h-10 rounded-2xl text-xs w-36">
                  <SelectValue placeholder="الباقة..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الباقات</SelectItem>
                  <SelectItem value="starter">الأساسية (Starter)</SelectItem>
                  <SelectItem value="pro">برو (Pro)</SelectItem>
                  <SelectItem value="enterprise">المؤسسية (Enterprise)</SelectItem>
                  <SelectItem value="trial">تجريبي (Trial)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Client Licenses Table */}
          <div className="rounded-3xl border border-foreground/10 overflow-hidden bg-background/50 backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-foreground/10 bg-foreground/[0.02] text-muted-foreground font-bold">
                    <th className="p-4">المنشأة والعميل</th>
                    <th className="p-4">الباقة ومفتاح الترخيص</th>
                    <th className="p-4">تاريخ الانتهاء</th>
                    <th className="p-4">الحالة والمدة المتبقية</th>
                    <th className="p-4">المبلغ والدورة</th>
                    <th className="p-4 text-left">إجراءات المشرف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5 font-medium">
                  {filteredLicenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        لا توجد تراخيص مطابقة لمعايير البحث الحالية.
                      </td>
                    </tr>
                  ) : (
                    filteredLicenses.map((lic) => {
                      const { days, isLifetime, isExpired } = calculateDaysRemaining(lic.expiryDate);

                      return (
                        <tr key={lic.id} className="hover:bg-foreground/[0.02] transition-colors">
                          {/* المنشأة والعميل */}
                          <td className="p-4">
                            <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                              {lic.shopName}
                            </div>
                            <div className="text-muted-foreground text-[11px] mt-0.5 flex items-center gap-2">
                              <span>{lic.clientName}</span>
                              <span className="font-mono">{lic.clientPhone}</span>
                            </div>
                            {lic.hardwareIncluded && (
                              <div className="text-[10px] text-primary/80 mt-1">
                                🖨️ {lic.hardwareIncluded}
                              </div>
                            )}
                          </td>

                          {/* الباقة والمفتاح */}
                          <td className="p-4">
                            <Badge
                              variant="outline"
                              className={
                                lic.tier === "enterprise"
                                  ? "border-purple-500 text-purple-600 bg-purple-500/10"
                                  : lic.tier === "pro"
                                  ? "border-emerald-500 text-emerald-600 bg-emerald-500/10"
                                  : lic.tier === "starter"
                                  ? "border-blue-500 text-blue-600 bg-blue-500/10"
                                  : "border-amber-500 text-amber-600 bg-amber-500/10"
                              }
                            >
                              {lic.tierLabel}
                            </Badge>
                            <div className="font-mono text-[11px] text-foreground font-bold mt-1 tracking-wider select-all">
                              {lic.key}
                            </div>
                          </td>

                          {/* تاريخ الانتهاء */}
                          <td className="p-4">
                            <div className="font-bold text-foreground">
                              {isLifetime ? "مدى الحياة (دائم)" : lic.expiryDate}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              الإصدار: {lic.issueDate}
                            </div>
                          </td>

                          {/* الحالة والمدة */}
                          <td className="p-4">
                            {lic.status === "suspended" ? (
                              <Badge variant="destructive" className="text-[10px]">
                                موقوف مؤقتاً
                              </Badge>
                            ) : isExpired ? (
                              <Badge variant="destructive" className="text-[10px]">
                                منتهي الصلاحية
                              </Badge>
                            ) : isLifetime ? (
                              <Badge className="bg-purple-600 text-white text-[10px]">
                                ترخيص أبدي
                              </Badge>
                            ) : lic.status === "trial" ? (
                              <Badge variant="secondary" className="text-amber-600 text-[10px]">
                                تجريبي (باقي {days} يوم)
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                ساري (باقي {days} يوم)
                              </Badge>
                            )}
                          </td>

                          {/* المبلغ والدورة */}
                          <td className="p-4">
                            <div className="font-bold text-foreground">
                              {fmt(lic.paidAmount)} {lic.currency}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {lic.billingCycle === "monthly"
                                ? "اشتراك شهري"
                                : lic.billingCycle === "yearly"
                                ? "اشتراك سنوي"
                                : lic.billingCycle === "lifetime"
                                ? "شراء دائم"
                                : "مجاني"}
                            </div>
                          </td>

                          {/* الإجراءات */}
                          <td className="p-4 text-left">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 rounded-xl text-emerald-600 hover:bg-emerald-500/10 gap-1 text-[11px]"
                                onClick={() => handleSendWhatsApp(lic)}
                                title="إرسال عبر واتساب"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">واتساب</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 rounded-xl text-foreground hover:bg-foreground/10 gap-1 text-[11px]"
                                onClick={() => printLicenseCertificate(lic)}
                                title="طباعة شهادة الترخيص"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">شهادة</span>
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-2xl text-right">
                                  <DropdownMenuItem
                                    onClick={() => handleRenew(lic, 30)}
                                    className="text-xs font-bold gap-2 cursor-pointer"
                                  >
                                    <Zap className="w-3.5 h-3.5 text-primary" />
                                    تمديد شهر (+30 يوم)
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => handleRenew(lic, 365)}
                                    className="text-xs font-bold gap-2 cursor-pointer"
                                  >
                                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                                    تمديد سنة كاملة (+365 يوم)
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => handleActivateLocally(lic.key)}
                                    className="text-xs font-bold gap-2 cursor-pointer"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                    تفعيل على هذه النسخة للتجربة
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => handleToggleStatus(lic)}
                                    className="text-xs font-bold gap-2 cursor-pointer"
                                  >
                                    {lic.status === "active" ? (
                                      <>
                                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                                        إيقاف الترخيص مؤقتاً
                                      </>
                                    ) : (
                                      <>
                                        <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                                        إعادة تنشيط الترخيص
                                      </>
                                    )}
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => handleDeleteLicense(lic.id)}
                                    className="text-xs font-bold gap-2 text-danger cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    حذف السجل نهائياً
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal: Create License */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg rounded-3xl p-6 text-right" dir="rtl">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="text-lg font-black flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                إصدار وتوليد ترخيص تجاري جديد
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                توليد مفتاح تفعيل مرخص للعميل مع تحديد الباقة وتفاصيل الاشتراك والأجهزة الموردة.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2 text-right">
              {/* Package Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">نوع الباقة المرخصة:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TIER_CONFIG) as LicenseTier[]).map((tierKey) => {
                    const cfg = TIER_CONFIG[tierKey];
                    const isSelected = selectedTier === tierKey;
                    return (
                      <div
                        key={tierKey}
                        onClick={() => {
                          setSelectedTier(tierKey);
                          setPaidAmount(String(cfg.defaultPrice));
                          if (tierKey === "enterprise") setBillingCycle("lifetime");
                          else if (tierKey === "starter") setBillingCycle("monthly");
                          else if (tierKey === "pro") setBillingCycle("yearly");
                        }}
                        className={`cursor-pointer p-3 rounded-2xl border transition-all text-right ${
                          isSelected
                            ? "bg-primary/10 border-primary shadow-sm"
                            : "border-foreground/10 hover:border-foreground/20 bg-foreground/[0.01]"
                        }`}
                      >
                        <div className="text-xs font-black text-foreground">{cfg.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                          {cfg.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Client & Shop Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">اسم المنشأة / المحل *:</Label>
                  <Input
                    placeholder="مثال: محلات البرنس"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="h-10 rounded-2xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">اسم العميل المسؤول *:</Label>
                  <Input
                    placeholder="مثال: الحاج إبراهيم"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="h-10 rounded-2xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">رقم الهاتف / واتساب:</Label>
                  <Input
                    placeholder="010xxxxxxx"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="h-10 rounded-2xl text-xs font-mono text-right"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">المبلغ المحصل:</Label>
                  <Input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="h-10 rounded-2xl text-xs font-bold text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">دورة الفوترة:</Label>
                  <Select value={billingCycle} onValueChange={(v: any) => setBillingCycle(v)}>
                    <SelectTrigger className="h-10 rounded-2xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">اشتراك شهري</SelectItem>
                      <SelectItem value="yearly">اشتراك سنوي</SelectItem>
                      <SelectItem value="lifetime">شراء دائم</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">
                  الأجهزة الموردة مع الترخيص (اختياري):
                </Label>
                <Input
                  placeholder="مثال: طابعة فواتير 80mm + قارئ باركود ليزر + درج نقدية"
                  value={hardwareIncluded}
                  onChange={(e) => setHardwareIncluded(e.target.value)}
                  className="h-10 rounded-2xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">ملاحظات داخلية:</Label>
                <Input
                  placeholder="ملاحظات حول الدفع أو التركيب..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 rounded-2xl text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="rounded-2xl text-xs h-10"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleCreateLicense}
                className="rounded-2xl gap-2 text-xs font-bold h-10 px-6 bg-primary text-black hover:bg-primary/90"
              >
                <Sparkles className="w-4 h-4" />
                توليد الترخيص الفوري
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Generated Result */}
        <Dialog open={!!generatedResult} onOpenChange={(v) => !v && setGeneratedResult(null)}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6 text-right" dir="rtl">
            <DialogHeader className="text-right space-y-1">
              <div className="w-12 h-12 mx-auto rounded-3xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <DialogTitle className="text-lg font-black text-center">
                تم إنشاء الترخيص التجاري بنجاح!
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground text-center">
                تم حفظ بيانات الترخيص ويمكنك الآن نسخه أو إرساله للعميل مباشرة عبر واتساب.
              </DialogDescription>
            </DialogHeader>

            {generatedResult && (
              <div className="space-y-4 my-2 text-right">
                <div className="p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/10 text-center space-y-2">
                  <div className="text-xs text-muted-foreground font-bold">
                    مفتاح الترخيص (License Key):
                  </div>
                  <div className="font-mono text-base font-black tracking-widest text-primary bg-background/80 py-2 px-3 rounded-xl border border-primary/30 select-all">
                    {generatedResult.key}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyKey(generatedResult.key)}
                    className="rounded-xl text-xs gap-1.5 h-8"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey ? "تم النسخ!" : "نسخ المفتاح"}
                  </Button>
                </div>

                <div className="text-xs space-y-1 text-muted-foreground p-3 rounded-2xl bg-foreground/[0.01] border border-foreground/5">
                  <div className="flex justify-between">
                    <span>اسم المتجر:</span>
                    <strong className="text-foreground">{generatedResult.shopName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>العميل:</span>
                    <strong className="text-foreground">{generatedResult.clientName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>الباقة:</span>
                    <strong className="text-foreground">{generatedResult.tierLabel}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>تاريخ الانتهاء:</span>
                    <strong className="text-foreground">
                      {generatedResult.expiryDate === "LIFETIME" ? "مدى الحياة" : generatedResult.expiryDate}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => generatedResult && printLicenseCertificate(generatedResult)}
                className="rounded-2xl text-xs h-10 gap-1.5"
              >
                <Printer className="w-4 h-4" />
                طباعة الشهادة
              </Button>

              <Button
                type="button"
                onClick={() => generatedResult && handleSendWhatsApp(generatedResult)}
                className="rounded-2xl gap-2 text-xs font-bold h-10 px-6 bg-[#25D366] hover:bg-[#20ba59] text-white"
              >
                <MessageSquare className="w-4 h-4" />
                إرسال واتساب للعميل
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Change Super Admin PIN */}
        <Dialog open={changePinOpen} onOpenChange={setChangePinOpen}>
          <DialogContent className="sm:max-w-xs rounded-3xl p-6 text-right" dir="rtl">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="text-base font-black">تغيير الرقم السري للمشرف</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                أدخل الرقم السري الجديد للوحة السوبر أدمن.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 my-2 text-right">
              <div className="space-y-1">
                <Label className="text-xs font-bold">الرقم السري الجديد:</Label>
                <Input
                  type="password"
                  placeholder="••••"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="h-10 rounded-2xl text-center text-lg font-bold"
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                onClick={handleChangePin}
                className="w-full rounded-2xl h-10 font-bold bg-primary text-black hover:bg-primary/90 text-xs"
              >
                حفظ الرقم الجديد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </AppShell>
  );
}
