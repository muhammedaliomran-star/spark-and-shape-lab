import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { usePrivacy } from "@/lib/privacy";
import { useDB, fmt, useShopSettings } from "@/lib/store";
import {
  useDiscounts,
  type PromoCoupon,
  type QuantityTierOffer,
  type BundleComboOffer,
  type DiscountType,
  type CouponCustomerEligibility,
  getCouponStatus,
  generatePromoWhatsAppText,
} from "@/lib/discounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tag,
  Percent,
  Plus,
  Search,
  Copy,
  Check,
  Edit2,
  Trash2,
  Sparkles,
  Calculator,
  Calendar,
  Layers,
  TrendingDown,
  Gift,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  Share2,
  MessageCircle,
  ShieldCheck,
  ShieldAlert,
  Coins,
  PackagePlus,
  Users,
  Sliders,
  Award,
} from "lucide-react";

type ActiveTab = "coupons" | "tiers" | "loyalty" | "guard";

export default function Discounts() {
  const { privacy } = usePrivacy();
  const { invoices, customers } = useDB();
  const { settings: shop } = useShopSettings();
  const {
    coupons,
    qtyOffers,
    bundles,
    loyaltyConfig,
    marginGuard,
    metrics,
    customerLoyaltyStats,
    addCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon,
    addQtyOffer,
    updateQtyOffer,
    deleteQtyOffer,
    addBundle,
    updateBundle,
    deleteBundle,
    updateLoyaltyConfig,
    updateMarginGuard,
    generateCustomerLoyaltyVoucher,
    checkMarginSafety,
  } = useDiscounts();

  const [activeTab, setActiveTab] = useState<ActiveTab>("coupons");
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "active" | "expired" | "inactive">("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // WhatsApp Campaign Modal
  const [whatsappModalCoupon, setWhatsappModalCoupon] = useState<PromoCoupon | null>(null);

  // Coupon Dialog State
  const [isOpenCouponModal, setIsOpenCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<PromoCoupon | null>(null);
  const [deleteTargetCouponId, setDeleteTargetCouponId] = useState<string | null>(null);

  // Coupon Form State
  const [formCode, setFormCode] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<DiscountType>("percentage");
  const [formValue, setFormValue] = useState("10");
  const [formMinOrder, setFormMinOrder] = useState("0");
  const [formMaxUsage, setFormMaxUsage] = useState("");
  const [formHasMaxUsage, setFormHasMaxUsage] = useState(false);
  const [formStartsAt, setFormStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [formEndsAt, setFormEndsAt] = useState("");
  const [formCustomerEligibility, setFormCustomerEligibility] = useState<CouponCustomerEligibility>("all");
  const [formNotes, setFormNotes] = useState("");

  // Quantity Tier Offer Form State
  const [isOpenQtyModal, setIsOpenQtyModal] = useState(false);
  const [editingQtyOffer, setEditingQtyOffer] = useState<QuantityTierOffer | null>(null);
  const [deleteTargetQtyId, setDeleteTargetQtyId] = useState<string | null>(null);
  const [qtyTitle, setQtyTitle] = useState("");
  const [qtyMinCount, setQtyMinCount] = useState("3");
  const [qtyPct, setQtyPct] = useState("10");
  const [qtyNotes, setQtyNotes] = useState("");

  // Bundle Offer Form State
  const [isOpenBundleModal, setIsOpenBundleModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<BundleComboOffer | null>(null);
  const [deleteTargetBundleId, setDeleteTargetBundleId] = useState<string | null>(null);
  const [bundleTitle, setBundleTitle] = useState("");
  const [bundleKeywords, setBundleKeywords] = useState("");
  const [bundleDiscount, setBundleDiscount] = useState("50");
  const [bundleNotes, setBundleNotes] = useState("");

  // Simulator State
  const [simPrice, setSimPrice] = useState("1000");
  const [simCost, setSimCost] = useState("700");
  const [simDiscType, setSimDiscType] = useState<DiscountType>("percentage");
  const [simDiscVal, setSimDiscVal] = useState("10");

  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  // Filtered coupons
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      const matchSearch =
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.notes && c.notes.toLowerCase().includes(search.toLowerCase()));

      if (!matchSearch) return false;

      const st = getCouponStatus(c).status;
      if (filterTab === "all") return true;
      if (filterTab === "active") return st === "active";
      if (filterTab === "expired") return st === "expired" || st === "exhausted";
      if (filterTab === "inactive") return st === "inactive";
      return true;
    });
  }, [coupons, search, filterTab]);

  // Simulator calculations
  const simResults = useMemo(() => {
    const p = Math.max(0, Number(simPrice || 0));
    const c = Math.max(0, Number(simCost || 0));
    const v = Math.max(0, Number(simDiscVal || 0));

    let discAmt = 0;
    if (simDiscType === "percentage") {
      discAmt = (p * Math.min(100, v)) / 100;
    } else {
      discAmt = Math.min(p, v);
    }

    const finalPrice = Math.max(0, p - discAmt);
    const profitBefore = p - c;
    const profitAfter = finalPrice - c;
    const marginPct = finalPrice > 0 ? (profitAfter / finalPrice) * 100 : 0;
    const safety = checkMarginSafety(p, c, discAmt);

    return {
      discAmt,
      finalPrice,
      profitBefore,
      profitAfter,
      marginPct,
      safety,
    };
  }, [simPrice, simCost, simDiscType, simDiscVal, checkMarginSafety]);

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`تم نسخ الكود: ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenNewCoupon = () => {
    setEditingCoupon(null);
    setFormCode("");
    setFormTitle("");
    setFormType("percentage");
    setFormValue("10");
    setFormMinOrder("0");
    setFormMaxUsage("");
    setFormHasMaxUsage(false);
    setFormStartsAt(new Date().toISOString().slice(0, 10));
    setFormEndsAt("");
    setFormCustomerEligibility("all");
    setFormNotes("");
    setIsOpenCouponModal(true);
  };

  const handleEditCoupon = (c: PromoCoupon) => {
    setEditingCoupon(c);
    setFormCode(c.code);
    setFormTitle(c.title);
    setFormType(c.discountType);
    setFormValue(String(c.discountValue));
    setFormMinOrder(String(c.minOrderValue));
    setFormMaxUsage(c.maxUsage !== null ? String(c.maxUsage) : "");
    setFormHasMaxUsage(c.maxUsage !== null);
    setFormStartsAt(c.startsAt ? c.startsAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormEndsAt(c.endsAt ? c.endsAt.slice(0, 10) : "");
    setFormCustomerEligibility(c.customerEligibility || "all");
    setFormNotes(c.notes || "");
    setIsOpenCouponModal(true);
  };

  const handleSaveCoupon = () => {
    const cleanCode = formCode.trim().toUpperCase();
    if (!cleanCode) return toast.error("يرجى إدخال كود الخصم (مثلاً SALE10)");
    if (!formTitle.trim()) return toast.error("يرجى إدخال عنوان أو وصف الكوبون");

    const val = Number(formValue);
    if (isNaN(val) || val <= 0) return toast.error("يرجى إدخال قيمة خصم صالحة");
    if (formType === "percentage" && val > 100) return toast.error("نسبة الخصم لا يمكن أن تتجاوز 100%");

    // Check duplicate code
    const duplicate = coupons.find(
      (c) => c.code.toUpperCase() === cleanCode && (!editingCoupon || c.id !== editingCoupon.id)
    );
    if (duplicate) return toast.error("كود الخصم هذا مستخدم بالفعل، يرجى اختيار كود آخر");

    const maxUsageNum = formHasMaxUsage && formMaxUsage ? Math.max(1, parseInt(formMaxUsage, 10)) : null;

    if (editingCoupon) {
      updateCoupon(editingCoupon.id, {
        code: cleanCode,
        title: formTitle.trim(),
        discountType: formType,
        discountValue: val,
        minOrderValue: Math.max(0, Number(formMinOrder || 0)),
        maxUsage: maxUsageNum,
        startsAt: new Date(formStartsAt).toISOString(),
        endsAt: formEndsAt ? new Date(formEndsAt).toISOString() : null,
        customerEligibility: formCustomerEligibility,
        notes: formNotes.trim() || undefined,
      });
      toast.success("تم تحديث الكوبون بنجاح");
    } else {
      addCoupon({
        code: cleanCode,
        title: formTitle.trim(),
        discountType: formType,
        discountValue: val,
        minOrderValue: Math.max(0, Number(formMinOrder || 0)),
        maxUsage: maxUsageNum,
        startsAt: new Date(formStartsAt).toISOString(),
        endsAt: formEndsAt ? new Date(formEndsAt).toISOString() : null,
        active: true,
        customerEligibility: formCustomerEligibility,
        notes: formNotes.trim() || undefined,
      });
      toast.success("تم إنشاء كود الخصم بنجاح ✓");
    }

    setIsOpenCouponModal(false);
  };

  // Quantity Offer Handlers
  const handleOpenNewQtyOffer = () => {
    setEditingQtyOffer(null);
    setQtyTitle("");
    setQtyMinCount("3");
    setQtyPct("10");
    setQtyNotes("");
    setIsOpenQtyModal(true);
  };

  const handleEditQtyOffer = (o: QuantityTierOffer) => {
    setEditingQtyOffer(o);
    setQtyTitle(o.title);
    setQtyMinCount(String(o.minQuantity));
    setQtyPct(String(o.discountPercentage));
    setQtyNotes(o.notes || "");
    setIsOpenQtyModal(true);
  };

  const handleSaveQtyOffer = () => {
    if (!qtyTitle.trim()) return toast.error("يرجى كتابة عنوان العرض");
    const count = Number(qtyMinCount);
    const pct = Number(qtyPct);
    if (isNaN(count) || count <= 1) return toast.error("أقل كمية يجب أن تكون قطعتين أو أكثر");
    if (isNaN(pct) || pct <= 0 || pct > 100) return toast.error("نسبة الخصم يجب أن تكون بين 1% و 100%");

    if (editingQtyOffer) {
      updateQtyOffer(editingQtyOffer.id, {
        title: qtyTitle.trim(),
        minQuantity: count,
        discountPercentage: pct,
        notes: qtyNotes.trim() || undefined,
      });
      toast.success("تم تعديل عرض الكميات بنجاح");
    } else {
      addQtyOffer({
        title: qtyTitle.trim(),
        minQuantity: count,
        discountPercentage: pct,
        active: true,
        notes: qtyNotes.trim() || undefined,
      });
      toast.success("تمت إضافة عرض الكميات بنجاح ✓");
    }
    setIsOpenQtyModal(false);
  };

  // Bundle Offer Handlers
  const handleOpenNewBundle = () => {
    setEditingBundle(null);
    setBundleTitle("");
    setBundleKeywords("");
    setBundleDiscount("50");
    setBundleNotes("");
    setIsOpenBundleModal(true);
  };

  const handleEditBundle = (b: BundleComboOffer) => {
    setEditingBundle(b);
    setBundleTitle(b.title);
    setBundleKeywords(b.itemKeywords.join("، "));
    setBundleDiscount(String(b.discountAmount));
    setBundleNotes(b.notes || "");
    setIsOpenBundleModal(true);
  };

  const handleSaveBundle = () => {
    if (!bundleTitle.trim()) return toast.error("يرجى كتابة اسم الباقة");
    const kwList = bundleKeywords
      .split(/[,،]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    if (kwList.length < 2) return toast.error("يرجى كتابة كلمتين رئيسيتين أو صنفين على الأقل مفصولين بفاصلة");
    const disc = Number(bundleDiscount);
    if (isNaN(disc) || disc <= 0) return toast.error("يرجى تحديد مبلغ الخصم للباقة");

    if (editingBundle) {
      updateBundle(editingBundle.id, {
        title: bundleTitle.trim(),
        itemKeywords: kwList,
        discountAmount: disc,
        notes: bundleNotes.trim() || undefined,
      });
      toast.success("تم تحديث باقة العرض بنجاح");
    } else {
      addBundle({
        title: bundleTitle.trim(),
        itemKeywords: kwList,
        discountAmount: disc,
        active: true,
        notes: bundleNotes.trim() || undefined,
      });
      toast.success("تمت إضافة باقة العرض بنجاح ✓");
    }
    setIsOpenBundleModal(false);
  };

  // WhatsApp Share Trigger
  const handleOpenWhatsAppShare = (c: PromoCoupon) => {
    setWhatsappModalCoupon(c);
  };

  const executeWhatsAppSend = (coupon: PromoCoupon, phone = "") => {
    const text = generatePromoWhatsAppText(coupon, shop.shopName || "سِجلّي");
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="space-y-6 pb-12">
          {/* Header */}
          <PageHeader
            title="الخصومات والعروض الترويجية"
            subtitle="إدارة الكوبونات، عروض الكميات والباقات، نقاط الولاء، وحماية هامش الربحية"
            badge="مُحرك المبيعات"
            actions={
              <div className="flex items-center gap-2">
                {activeTab === "coupons" && (
                  <Button
                    onClick={handleOpenNewCoupon}
                    size="sm"
                    className="gap-1.5 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    كوبون جديد
                  </Button>
                )}
                {activeTab === "tiers" && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      onClick={handleOpenNewQtyOffer}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 rounded-xl font-bold border-border/50 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      عرض كميات
                    </Button>
                    <Button
                      onClick={handleOpenNewBundle}
                      size="sm"
                      className="gap-1.5 rounded-xl font-bold bg-primary text-primary-foreground text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      باقة مجمعة
                    </Button>
                  </div>
                )}
              </div>
            }
          />

          {/* Top KPI Cards */}
          <Reveal>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
              <BezelCard
                label="إجمالي الخصومات الممنوحة"
                icon={TrendingDown}
                value={
                  <span className={cn("font-mono font-bold tabular-nums text-warning", blurCls)}>
                    <CountUp value={metrics.totalDiscountsGiven} /> ج.م
                  </span>
                }
                sub={`${metrics.invoicesWithDiscountCount} فاتورة تضمنت خصماً`}
              />

              <BezelCard
                label="الكوبونات والعروض النشطة"
                icon={Tag}
                value={
                  <span className="font-mono font-bold text-success tabular-nums">
                    <CountUp value={metrics.activeCouponsCount} /> / {metrics.totalCouponsCount}
                  </span>
                }
                sub={`${qtyOffers.filter((o) => o.active).length} عروض كميات + ${bundles.filter((b) => b.active).length} باقات`}
              />

              <BezelCard
                label="مرات استخدام الكوبونات"
                icon={Gift}
                value={
                  <span className="font-mono font-bold tabular-nums text-primary">
                    <CountUp value={metrics.totalCouponRedemptions} /> مرة
                  </span>
                }
                sub="إجمالي عمليات الاستفادة"
              />

              <BezelCard
                label="معدل الخصم من المبيعات"
                icon={Percent}
                value={
                  <span className={cn("font-mono font-bold tabular-nums text-foreground", blurCls)}>
                    {metrics.discountRate.toFixed(1)}%
                  </span>
                }
                sub={`متوسط ${fmt(metrics.avgDiscountPerInvoice)} ج.م / فاتورة`}
              />
            </div>
          </Reveal>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 border border-border/40 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("coupons")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "coupons"
                  ? "bg-card text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <Tag className="w-3.5 h-3.5 text-primary" />
              أكواد وقسائم الخصم ({coupons.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("tiers")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "tiers"
                  ? "bg-card text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <PackagePlus className="w-3.5 h-3.5 text-primary" />
              عروض الكميات والباقات ({qtyOffers.length + bundles.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("loyalty")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "loyalty"
                  ? "bg-card text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <Coins className="w-3.5 h-3.5 text-warning" />
              نقاط الولاء والمكافآت
              {loyaltyConfig.enabled && (
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("guard")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "guard"
                  ? "bg-card text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              حماية الأرباح والمحاكي
            </button>
          </div>

          {/* TAB 1: COUPONS & WHATSAPP PROMO CAMPAIGNS */}
          {activeTab === "coupons" && (
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 p-3 rounded-2xl border border-border/40">
                <div className="relative flex-1">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث بكود الخصم، اسم العرض، أو الملاحظات..."
                    className="pr-10 h-10 rounded-xl border-border/40 bg-background/50 text-xs"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: "all", label: "الكل" },
                    { id: "active", label: "النشطة" },
                    { id: "expired", label: "المنتهية/المستنفدة" },
                    { id: "inactive", label: "المعطلة" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setFilterTab(t.id as any)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                        filterTab === t.id
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coupons Grid */}
              {filteredCoupons.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/30">
                  <Tag className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <h3 className="font-bold text-sm text-foreground">لا توجد كوبونات تطابق بحثك</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    يمكنك إنشاء كوبون خصم جديد بنسبة مئوية أو مبلغ ثابت ومشاركته مع عملائك.
                  </p>
                  <Button onClick={handleOpenNewCoupon} size="sm" className="mt-4 gap-1.5 rounded-xl text-xs font-bold">
                    <Plus className="w-4 h-4" />
                    إنشاء أول كوبون
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCoupons.map((coupon) => {
                    const status = getCouponStatus(coupon);
                    const usagePct =
                      coupon.maxUsage !== null && coupon.maxUsage > 0
                        ? Math.min(100, (coupon.usedCount / coupon.maxUsage) * 100)
                        : 0;

                    return (
                      <div
                        key={coupon.id}
                        className={cn(
                          "group relative flex flex-col justify-between rounded-2xl p-4 transition-all duration-300 border bg-card/80 hover:shadow-md hover:border-primary/40",
                          status.status === "inactive" && "opacity-75 bg-muted/20",
                          status.status === "expired" && "border-warning/30",
                          coupon.isLoyaltyReward && "border-warning/50 bg-warning/[0.02]"
                        )}
                      >
                        {/* Card Header */}
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "px-2.5 py-1 rounded-xl font-mono text-sm font-black tracking-wider flex items-center gap-1.5 border shadow-2xs",
                                  coupon.discountType === "percentage"
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-warning/10 text-warning border-warning/20"
                                )}
                              >
                                {coupon.code}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyCouponCode(coupon.code)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                                title="نسخ الكود"
                              >
                                {copiedCode === coupon.code ? (
                                  <Check className="w-3.5 h-3.5 text-success" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              {coupon.isLoyaltyReward && (
                                <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30 gap-1 py-0.5">
                                  <Award className="w-2.5 h-2.5" /> مكافأة ولاء
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-bold py-0.5",
                                  status.color === "success" && "bg-success/10 text-success border-success/30",
                                  status.color === "warning" && "bg-warning/10 text-warning border-warning/30",
                                  status.color === "danger" && "bg-danger/10 text-danger border-danger/30",
                                  status.color === "muted" && "bg-muted text-muted-foreground border-border/40"
                                )}
                              >
                                {status.label}
                              </Badge>
                            </div>
                          </div>

                          <h4 className="font-bold text-sm text-foreground line-clamp-1">{coupon.title}</h4>

                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-xl font-black text-foreground font-mono">
                              {coupon.discountType === "percentage"
                                ? `خصم ${coupon.discountValue}%`
                                : `خصم ${fmt(coupon.discountValue)} ج.م`}
                            </span>
                            {coupon.minOrderValue > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                (حد أدنى: {fmt(coupon.minOrderValue)} ج.م)
                              </span>
                            )}
                          </div>

                          {coupon.notes && (
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                              {coupon.notes}
                            </p>
                          )}
                        </div>

                        {/* Card Footer Info */}
                        <div className="mt-4 pt-3 border-t border-border/30 space-y-2.5 text-xs text-muted-foreground">
                          {/* Usage Count Progress */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span>
                              الاستخدام: <strong className="text-foreground font-mono">{coupon.usedCount}</strong>
                              {coupon.maxUsage !== null && (
                                <span> من {coupon.maxUsage}</span>
                              )}
                            </span>
                            {coupon.maxUsage !== null && (
                              <span className="font-mono text-[10px] text-muted-foreground">{usagePct.toFixed(0)}%</span>
                            )}
                          </div>

                          {coupon.maxUsage !== null && (
                            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  usagePct >= 100 ? "bg-danger" : usagePct > 70 ? "bg-warning" : "bg-primary"
                                )}
                                style={{ width: `${usagePct}%` }}
                              />
                            </div>
                          )}

                          {/* Validity Date */}
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {coupon.endsAt
                                ? `ينتهي: ${new Date(coupon.endsAt).toLocaleDateString("ar-EG")}`
                                : "مفتوح بدون تاريخ انتهاء"}
                            </span>

                            {coupon.customerEligibility !== "all" && (
                              <span className="px-1.5 py-0.5 rounded bg-muted/60 text-[9px] font-medium">
                                {coupon.customerEligibility === "vip"
                                  ? "مميزين VIP"
                                  : coupon.customerEligibility === "cash"
                                  ? "دفع نقدي"
                                  : "عملاء أقساط"}
                              </span>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center justify-between pt-1 border-t border-border/20">
                            {/* WhatsApp Share Button */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenWhatsAppShare(coupon)}
                              className="h-8 px-2.5 rounded-lg text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30 gap-1.5"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                              واتساب
                            </Button>

                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleCouponStatus(coupon.id)}
                                className="h-8 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                              >
                                {coupon.active ? "تعطيل" : "تفعيل"}
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditCoupon(coupon)}
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTargetCouponId(coupon.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-danger"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUANTITY TIERS & BUNDLE DEALS */}
          {activeTab === "tiers" && (
            <div className="space-y-6">
              {/* Section 1: Quantity Tier Offers */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-3">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      عروض خصم الكميات التلقائي (Quantity Tiers)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      يتم تطبيق الخصم تلقائياً عند زيادة كمية الصنف في الفاتورة عن الحد المحدد.
                    </p>
                  </div>
                  <Button
                    onClick={handleOpenNewQtyOffer}
                    size="sm"
                    className="gap-1.5 rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة عرض كمية
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {qtyOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className={cn(
                        "rounded-xl border p-4 flex flex-col justify-between transition-all bg-background/50",
                        offer.active ? "border-border/60 hover:border-primary/40" : "opacity-60 bg-muted/20"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                            {offer.minQuantity} قطع فأكثر
                          </span>
                          <span className="text-base font-black text-foreground font-mono">
                            خصم {offer.discountPercentage}%
                          </span>
                        </div>
                        <h4 className="font-bold text-sm">{offer.title}</h4>
                        {offer.notes && <p className="text-xs text-muted-foreground mt-1">{offer.notes}</p>}
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-2 border-t border-border/20 text-xs">
                        <span className={offer.active ? "text-success font-medium" : "text-muted-foreground"}>
                          {offer.active ? "مفعّل تلقائياً" : "معطّل"}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditQtyOffer(offer)}
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTargetQtyId(offer.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Bundle Deals */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-3">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <PackagePlus className="w-4 h-4 text-primary" />
                      عروض باقات الأصناف المجمعة (Bundle Combos)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      خصم تلقائي عند شراء أصناف معينة معاً في نفس الفاتورة (مثال: شراء هاتف + جراب).
                    </p>
                  </div>
                  <Button
                    onClick={handleOpenNewBundle}
                    size="sm"
                    className="gap-1.5 rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة باقة مجمعة
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {bundles.map((bundle) => (
                    <div
                      key={bundle.id}
                      className={cn(
                        "rounded-xl border p-4 flex flex-col justify-between transition-all bg-background/50",
                        bundle.active ? "border-border/60 hover:border-primary/40" : "opacity-60 bg-muted/20"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-muted-foreground">خصم الباقة:</span>
                          <span className="text-base font-black text-warning font-mono">
                            − {fmt(bundle.discountAmount)} ج.م
                          </span>
                        </div>
                        <h4 className="font-bold text-sm">{bundle.title}</h4>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {bundle.itemKeywords.map((kw, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-muted/70 text-[10px] font-bold text-foreground border border-border/30"
                            >
                              + {kw}
                            </span>
                          ))}
                        </div>
                        {bundle.notes && <p className="text-xs text-muted-foreground mt-2">{bundle.notes}</p>}
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-2 border-t border-border/20 text-xs">
                        <span className={bundle.active ? "text-success font-medium" : "text-muted-foreground"}>
                          {bundle.active ? "مفعّل تلقائياً" : "معطّل"}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditBundle(bundle)}
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTargetBundleId(bundle.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOYALTY POINTS & REWARDS */}
          {activeTab === "loyalty" && (
            <div className="space-y-6">
              {/* Program Configuration Card */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-3">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Coins className="w-4 h-4 text-warning" />
                      إعدادات برنامج نقاط الولاء والمكافآت (Cashback & Loyalty)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      احتساب نقاط ولاء تلقائياً مع كل عملية شراء مسددة للعميل وتحويلها لكوبونات خصم حصرية.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-bold">تفعيل البرنامج:</Label>
                    <Switch
                      checked={loyaltyConfig.enabled}
                      onCheckedChange={(c) => updateLoyaltyConfig({ enabled: c })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5 bg-background/50 p-3 rounded-xl border border-border/30">
                    <Label className="text-xs text-muted-foreground">معدل احتساب النقاط</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={loyaltyConfig.pointsPer100Egp}
                        onChange={(e) => updateLoyaltyConfig({ pointsPer100Egp: Math.max(1, Number(e.target.value)) })}
                        className="h-9 font-mono text-center"
                      />
                      <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                        نقطة / 100 ج.م
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-background/50 p-3 rounded-xl border border-border/30">
                    <Label className="text-xs text-muted-foreground">قيمة النقطة الواحدة عند الاستبدال</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={loyaltyConfig.pointValueEgp}
                        onChange={(e) => updateLoyaltyConfig({ pointValueEgp: Math.max(0.1, Number(e.target.value)) })}
                        className="h-9 font-mono text-center"
                      />
                      <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                        ج.م لكل نقطة
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-background/50 p-3 rounded-xl border border-border/30">
                    <Label className="text-xs text-muted-foreground">الحد الأدنى للنقاط للاستبدال</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="5"
                        value={loyaltyConfig.minPointsToRedeem}
                        onChange={(e) => updateLoyaltyConfig({ minPointsToRedeem: Math.max(5, Number(e.target.value)) })}
                        className="h-9 font-mono text-center"
                      />
                      <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                        نقطة كحد أدنى
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customers Loyalty Leaderboard Table */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-3">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Award className="w-4 h-4 text-warning" />
                      أرصدة نقاط الولاء للعملاء
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      يمكنك استبدال نقاط العميل وتوليد كود خصم مخصص له بضغطة زر.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground">
                        <th className="pb-2 font-bold">العميل</th>
                        <th className="pb-2 font-bold">إجمالي المشتريات</th>
                        <th className="pb-2 font-bold">النقاط المكتسبة</th>
                        <th className="pb-2 font-bold">النقاط المتاحة</th>
                        <th className="pb-2 font-bold">القيمة المالية للاستبدال</th>
                        <th className="pb-2 font-bold text-left">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {customerLoyaltyStats.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground">
                            لا توجد بيانات عملاء أو مشتريات حتى الآن
                          </td>
                        </tr>
                      ) : (
                        customerLoyaltyStats.slice(0, 15).map((stat) => (
                          <tr key={stat.customer.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 font-bold text-foreground">
                              {stat.customer.name}
                              <span className="block text-[10px] font-normal text-muted-foreground">{stat.customer.phone}</span>
                            </td>
                            <td className={cn("py-3 font-mono font-medium", blurCls)}>
                              {fmt(stat.totalSpent)} ج.م
                            </td>
                            <td className="py-3 font-mono font-bold text-muted-foreground">
                              {stat.earnedPoints} نقطة
                            </td>
                            <td className="py-3 font-mono font-bold text-warning">
                              {stat.availablePoints} نقطة
                            </td>
                            <td className={cn("py-3 font-mono font-bold text-success", blurCls)}>
                              {fmt(stat.redeemableValueEgp)} ج.م
                            </td>
                            <td className="py-3 text-left">
                              <Button
                                size="sm"
                                disabled={!stat.canRedeem}
                                onClick={() => {
                                  const cpn = generateCustomerLoyaltyVoucher(stat.customer, stat.availablePoints);
                                  toast.success(`تم توليد كوبون مكافأة ولاء (${cpn.code}) بقيمة ${cpn.discountValue} ج.م!`);
                                }}
                                className="h-7 px-2.5 rounded-lg text-[11px] font-bold gap-1 bg-warning text-warning-foreground hover:bg-warning/90 disabled:opacity-40"
                              >
                                <Gift className="w-3 h-3" />
                                تحويل لكوبون
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MARGIN GUARD & PROFIT SIMULATOR */}
          {activeTab === "guard" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Margin Guard Settings Card */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-3">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      حماية حد الربحية التلقائي (Minimum Margin Lock)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      تنبيه وتحذير البائع في شاشة الفاتورة إذا كان الخصم سيهبط بصافي الربح عن الحد الأدنى.
                    </p>
                  </div>
                  <Switch
                    checked={marginGuard.enabled}
                    onCheckedChange={(c) => updateMarginGuard({ enabled: c })}
                  />
                </div>

                <div className="space-y-3">
                  <div className="bg-background/50 p-4 rounded-xl border border-border/30 space-y-2">
                    <Label className="text-xs font-bold text-foreground">
                      الحد الأدنى لنسبة هامش الربح المحمي (%)
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={marginGuard.minMarginPct}
                        onChange={(e) =>
                          updateMarginGuard({ minMarginPct: Math.max(1, Math.min(90, Number(e.target.value))) })
                        }
                        className="h-10 font-mono text-base font-bold text-center w-28"
                      />
                      <span className="text-xs text-muted-foreground">
                        لن يُسمح بأي خصم يجعل هامش ربح الفاتورة أقل من {marginGuard.minMarginPct}%
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs leading-relaxed text-muted-foreground">
                    <div className="font-bold text-foreground mb-1 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-primary" /> كيف تعمل هذه الميزة؟
                    </div>
                    عند كتابة كود خصم أو خصم يدوي أثناء إنشاء الفاتورة، يقوم النظام بحساب مجموع تكلفة الأصناف ومقارنتها بالسعر بعد الخصم. إذا نزل هامش الربح عن {marginGuard.minMarginPct}%، يتم إظهار تنبيه فوري يوضح أقصى خصم آمن مسموح به لمنع تآكل الأرباح.
                  </div>
                </div>
              </div>

              {/* Live Interactive Simulator */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="border-b border-border/30 pb-3">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-primary" />
                    محاكي الأرباح وتأثير الخصم (Live Simulator)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    اختبر أي خصم وتأكد من تأثيره المالي ومطابقته لحد الأمان.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">سعر البيع (ج.م)</Label>
                    <Input
                      type="number"
                      value={simPrice}
                      onChange={(e) => setSimPrice(e.target.value)}
                      className="h-9 font-mono text-center text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">التكلفة (ج.م)</Label>
                    <Input
                      type="number"
                      value={simCost}
                      onChange={(e) => setSimCost(e.target.value)}
                      className="h-9 font-mono text-center text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">نوع الخصم</Label>
                    <Select value={simDiscType} onValueChange={(v: any) => setSimDiscType(v)}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                        <SelectItem value="fixed">مبلغ ثابت (ج.م)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">قيمة الخصم</Label>
                    <Input
                      type="number"
                      value={simDiscVal}
                      onChange={(e) => setSimDiscVal(e.target.value)}
                      className="h-9 font-mono text-center text-xs"
                    />
                  </div>
                </div>

                {/* Results Panel */}
                <div className="rounded-xl border border-border/40 bg-background/60 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">مبلغ الخصم:</span>
                    <span className="font-mono font-bold text-warning">− {fmt(simResults.discAmt)} ج.م</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">السعر النهائي بعد الخصم:</span>
                    <span className="font-mono font-bold text-foreground">{fmt(simResults.finalPrice)} ج.م</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/20 pt-2">
                    <span className="text-muted-foreground">صافي الربح بعد الخصم:</span>
                    <span
                      className={cn(
                        "font-mono font-bold",
                        simResults.profitAfter > 0 ? "text-success" : "text-danger"
                      )}
                    >
                      {fmt(simResults.profitAfter)} ج.م ({simResults.marginPct.toFixed(1)}%)
                    </span>
                  </div>

                  {/* Margin safety status banner */}
                  <div
                    className={cn(
                      "mt-2 p-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5",
                      simResults.safety.isSafe
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-danger/10 text-danger border border-danger/20"
                    )}
                  >
                    {simResults.safety.isSafe ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        خصم آمن ومطابق لنسبة الربح المحمية ({marginGuard.minMarginPct}%)
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {simResults.safety.warning}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DIALOG 1: CREATE / EDIT COUPON */}
        <Dialog open={isOpenCouponModal} onOpenChange={setIsOpenCouponModal}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                {editingCoupon ? "تعديل كود الخصم" : "إنشاء كود خصم جديد"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">كود الخصم (Promo Code)</Label>
                <div className="flex gap-2">
                  <Input
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="مثال: SUMMER20"
                    className="font-mono uppercase font-bold text-center tracking-wider text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const random = `SALE${Math.floor(10 + Math.random() * 90)}`;
                      setFormCode(random);
                    }}
                    className="text-xs px-3 font-medium shrink-0"
                  >
                    توليد كود
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">اسم أو عنوان العرض</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: خصم الصيف 20%"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">نوع الخصم</Label>
                  <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                      <SelectItem value="fixed">مبلغ ثابت (ج.م)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">
                    القيمة {formType === "percentage" ? "(%)" : "(ج.م)"}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">الحد الأدنى للفاتورة (ج.م)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formMinOrder}
                    onChange={(e) => setFormMinOrder(e.target.value)}
                    className="font-mono text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">الفئة المستهدفة</Label>
                  <Select
                    value={formCustomerEligibility}
                    onValueChange={(v: any) => setFormCustomerEligibility(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع العملاء</SelectItem>
                      <SelectItem value="cash">الدفع الفوري فقط</SelectItem>
                      <SelectItem value="installment">عملاء الأقساط</SelectItem>
                      <SelectItem value="vip">كبار العملاء (VIP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/30 pt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">تحديد سقف لمرات الاستخدام؟</Label>
                  <Switch checked={formHasMaxUsage} onCheckedChange={setFormHasMaxUsage} />
                </div>
                {formHasMaxUsage && (
                  <Input
                    type="number"
                    min="1"
                    value={formMaxUsage}
                    onChange={(e) => setFormMaxUsage(e.target.value)}
                    placeholder="مثال: 50 مرة"
                    className="font-mono text-center"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-border/30 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">تاريخ البدء</Label>
                  <Input
                    type="date"
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">تاريخ الانتهاء (اختياري)</Label>
                  <Input
                    type="date"
                    value={formEndsAt}
                    onChange={(e) => setFormEndsAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ملاحظات داخلية (اختياري)</Label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="ملاحظات لإدارة المحل..."
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsOpenCouponModal(false)} className="text-xs">
                إلغاء
              </Button>
              <Button onClick={handleSaveCoupon} className="text-xs font-bold bg-primary text-primary-foreground">
                {editingCoupon ? "حفظ التعديلات" : "إنشاء الكوبون"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 2: QUANTITY TIER OFFER */}
        <Dialog open={isOpenQtyModal} onOpenChange={setIsOpenQtyModal}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                {editingQtyOffer ? "تعديل عرض الكميات" : "إضافة عرض كميات جديد"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">عنوان العرض</Label>
                <Input
                  value={qtyTitle}
                  onChange={(e) => setQtyTitle(e.target.value)}
                  placeholder="مثال: خصم 10% عند شراء 3 قطع فأكثر"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">الحد الأدنى للكمية (قطع)</Label>
                  <Input
                    type="number"
                    min="2"
                    value={qtyMinCount}
                    onChange={(e) => setQtyMinCount(e.target.value)}
                    className="font-mono text-center font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">نسبة الخصم (%)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={qtyPct}
                    onChange={(e) => setQtyPct(e.target.value)}
                    className="font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ملاحظات توضيحية</Label>
                <Input
                  value={qtyNotes}
                  onChange={(e) => setQtyNotes(e.target.value)}
                  placeholder="مثال: يطبق تلقائياً على أي صنف بالكمية المحددة"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsOpenQtyModal(false)} className="text-xs">
                إلغاء
              </Button>
              <Button onClick={handleSaveQtyOffer} className="text-xs font-bold bg-primary text-primary-foreground">
                حفظ العرض
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 3: BUNDLE OFFER */}
        <Dialog open={isOpenBundleModal} onOpenChange={setIsOpenBundleModal}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-primary" />
                {editingBundle ? "تعديل باقة العرض" : "إضافة باقة مجمعة جديدة"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم الباقة</Label>
                <Input
                  value={bundleTitle}
                  onChange={(e) => setBundleTitle(e.target.value)}
                  placeholder="مثال: باقة الهاتف + الشاحن السريع"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">الكلمات المفتاحية للأصناف المطلوبة (مفصولة بفاصلة)</Label>
                <Input
                  value={bundleKeywords}
                  onChange={(e) => setBundleKeywords(e.target.value)}
                  placeholder="مثال: هاتف, شاحن"
                />
                <p className="text-[10px] text-muted-foreground">
                  عند وجود صنف يحتوي الكلمة الأولى وصنف يحتوي الكلمة الثانية في نفس الفاتورة، يُطبق الخصم تلقائياً.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">مبلغ الخصم الإجمالي للباقة (ج.م)</Label>
                <Input
                  type="number"
                  min="1"
                  value={bundleDiscount}
                  onChange={(e) => setBundleDiscount(e.target.value)}
                  className="font-mono text-center font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ملاحظات (اختياري)</Label>
                <Input
                  value={bundleNotes}
                  onChange={(e) => setBundleNotes(e.target.value)}
                  placeholder="ملاحظات..."
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsOpenBundleModal(false)} className="text-xs">
                إلغاء
              </Button>
              <Button onClick={handleSaveBundle} className="text-xs font-bold bg-primary text-primary-foreground">
                حفظ الباقة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 4: WHATSAPP PROMO CAMPAIGN MODAL */}
        <Dialog open={!!whatsappModalCoupon} onOpenChange={(open) => !open && setWhatsappModalCoupon(null)}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-600">
                <MessageCircle className="w-5 h-5" />
                مشاركة العرض عبر رسالة واتساب
              </DialogTitle>
            </DialogHeader>

            {whatsappModalCoupon && (
              <div className="space-y-4 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  تم تجهيز نص دعائي مصمم وجاهز للإرسال للعملاء أو المجموعات للترويج لكود الخصم:
                </p>

                {/* Message Preview Box */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3.5 space-y-2 whitespace-pre-wrap font-sans text-xs text-foreground leading-relaxed">
                  {generatePromoWhatsAppText(whatsappModalCoupon, shop.shopName || "سِجلّي")}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        generatePromoWhatsAppText(whatsappModalCoupon, shop.shopName || "سِجلّي")
                      );
                      toast.success("تم نسخ نص الرسالة بالكامل بنجاح ✓");
                    }}
                    className="flex-1 text-xs gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    نسخ نص الرسالة
                  </Button>

                  <Button
                    type="button"
                    onClick={() => {
                      executeWhatsAppSend(whatsappModalCoupon);
                      setWhatsappModalCoupon(null);
                    }}
                    className="flex-1 text-xs font-bold gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    فتح واتساب وإرسال
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* DELETE CONFIRMATIONS */}
        <AlertDialog open={!!deleteTargetCouponId} onOpenChange={(open) => !open && setDeleteTargetCouponId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد من حذف كود الخصم؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف هذا الكوبون نهائياً ولن يتمكن العملاء من استخدامه في الفواتير القادمة.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTargetCouponId) {
                    deleteCoupon(deleteTargetCouponId);
                    toast.success("تم حذف الكوبون");
                    setDeleteTargetCouponId(null);
                  }
                }}
                className="bg-danger text-danger-foreground hover:bg-danger/90"
              >
                تأكيد الحذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTargetQtyId} onOpenChange={(open) => !open && setDeleteTargetQtyId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف عرض الكميات؟</AlertDialogTitle>
              <AlertDialogDescription>
                لن يتم تطبيق خصم هذه الكمية تلقائياً على الفواتير بعد الحذف.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTargetQtyId) {
                    deleteQtyOffer(deleteTargetQtyId);
                    toast.success("تم حذف عرض الكميات");
                    setDeleteTargetQtyId(null);
                  }
                }}
                className="bg-danger text-danger-foreground"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTargetBundleId} onOpenChange={(open) => !open && setDeleteTargetBundleId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف باقة العرض المجمعة؟</AlertDialogTitle>
              <AlertDialogDescription>
                لن يتم احتساب خصم الباقة تلقائياً عند شراء الأصناف معاً.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTargetBundleId) {
                    deleteBundle(deleteTargetBundleId);
                    toast.success("تم حذف الباقة");
                    setDeleteTargetBundleId(null);
                  }
                }}
                className="bg-danger text-danger-foreground"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageTransition>
    </AppShell>
  );
}
