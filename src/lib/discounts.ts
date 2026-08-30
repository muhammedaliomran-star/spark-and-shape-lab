import { useState, useEffect, useCallback, useMemo } from "react";
import { type Invoice, type Customer, useDB } from "@/lib/store";

export type DiscountType = "percentage" | "fixed";
export type CouponCustomerEligibility = "all" | "cash" | "installment" | "vip";

export interface PromoCoupon {
  id: string;
  code: string;
  title: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  maxUsage: number | null;
  usedCount: number;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  customerEligibility: CouponCustomerEligibility;
  notes?: string;
  createdAt: string;
  isLoyaltyReward?: boolean;
  customerId?: string;
}

export interface QuantityTierOffer {
  id: string;
  title: string;
  minQuantity: number;
  discountPercentage: number;
  active: boolean;
  notes?: string;
}

export interface BundleComboOffer {
  id: string;
  title: string;
  itemKeywords: string[];
  discountAmount: number;
  active: boolean;
  notes?: string;
}

export interface LoyaltyConfig {
  enabled: boolean;
  pointsPer100Egp: number; // e.g. 1 point for each 100 EGP
  pointValueEgp: number; // e.g. 1 point = 1 EGP discount
  minPointsToRedeem: number; // e.g. 50 points
}

export interface MarginGuardConfig {
  enabled: boolean;
  minMarginPct: number; // e.g. 10%
}

const STORAGE_KEY_COUPONS = "segilly_promo_coupons_v1";
const STORAGE_KEY_QTY_OFFERS = "segilly_qty_offers_v1";
const STORAGE_KEY_BUNDLES = "segilly_bundles_v1";
const STORAGE_KEY_LOYALTY = "segilly_loyalty_config_v1";
const STORAGE_KEY_MARGIN_GUARD = "segilly_margin_guard_v1";

const DEFAULT_COUPONS: PromoCoupon[] = [
  {
    id: "coupon-welcome10",
    code: "WELCOME10",
    title: "خصم الترحيب للعملاء الجدد",
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 200,
    maxUsage: 100,
    usedCount: 14,
    startsAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    endsAt: new Date(Date.now() + 60 * 86400000).toISOString(),
    active: true,
    customerEligibility: "all",
    notes: "خصم ترحيبي 10% بحد أدنى 200 ج.م",
    createdAt: new Date().toISOString(),
  },
  {
    id: "coupon-save50",
    code: "SAVE50",
    title: "خصم 50 ج.م على المشتريات",
    discountType: "fixed",
    discountValue: 50,
    minOrderValue: 500,
    maxUsage: 50,
    usedCount: 22,
    startsAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    endsAt: new Date(Date.now() + 45 * 86400000).toISOString(),
    active: true,
    customerEligibility: "all",
    notes: "خصم مباشر بقيمة 50 ج.م للفواتير فوق 500 ج.م",
    createdAt: new Date().toISOString(),
  },
  {
    id: "coupon-ramadan20",
    code: "RAMADAN20",
    title: "عرض الموسم الخاص 20%",
    discountType: "percentage",
    discountValue: 20,
    minOrderValue: 1000,
    maxUsage: 30,
    usedCount: 8,
    startsAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    active: true,
    customerEligibility: "all",
    notes: "خصم موسمي 20% على الفواتير الكبيرة",
    createdAt: new Date().toISOString(),
  },
  {
    id: "coupon-vip15",
    code: "VIP15",
    title: "خصم كبار العملاء المميزين",
    discountType: "percentage",
    discountValue: 15,
    minOrderValue: 300,
    maxUsage: null,
    usedCount: 5,
    startsAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    endsAt: null,
    active: true,
    customerEligibility: "vip",
    notes: "خصم دائم لعملاء الفئة المميزة",
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_QTY_OFFERS: QuantityTierOffer[] = [
  {
    id: "qty-offer-3",
    title: "خصم الكميات: 3 قطع فأكثر",
    minQuantity: 3,
    discountPercentage: 5,
    active: true,
    notes: "خصم 5% تلقائي عند شراء 3 قطع من نفس الصنف أو أكثر",
  },
  {
    id: "qty-offer-5",
    title: "خصم الكميات الكبير: 5 قطع فأكثر",
    minQuantity: 5,
    discountPercentage: 10,
    active: true,
    notes: "خصم 10% تلقائي عند شراء 5 قطع أو أكثر",
  },
  {
    id: "qty-offer-10",
    title: "عرض الجملة والتجار: 10 قطع فأكثر",
    minQuantity: 10,
    discountPercentage: 15,
    active: true,
    notes: "خصم خاص 15% للطلبيات التي تزيد عن 10 قطع",
  },
];

const DEFAULT_BUNDLES: BundleComboOffer[] = [
  {
    id: "bundle-combo-1",
    title: "عرض باقة الشراء المزدوجة",
    itemKeywords: ["هاتف", "سماعة"],
    discountAmount: 100,
    active: true,
    notes: "خصم 100 ج.م عند شراء هاتف مع سماعة في نفس الفاتورة",
  },
];

const DEFAULT_LOYALTY: LoyaltyConfig = {
  enabled: true,
  pointsPer100Egp: 2, // 2 points per 100 EGP (2% cashback rate)
  pointValueEgp: 1, // 1 point = 1 EGP
  minPointsToRedeem: 25,
};

const DEFAULT_MARGIN_GUARD: MarginGuardConfig = {
  enabled: true,
  minMarginPct: 10, // Minimum 10% profit margin protected
};

function loadStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to load ${key}`, e);
    return defaultValue;
  }
}

function saveStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("segilly_discounts_updated"));
  } catch (e) {
    console.error(`Failed to save ${key}`, e);
  }
}

export function getCouponStatus(coupon: PromoCoupon): {
  status: "active" | "expired" | "exhausted" | "inactive";
  label: string;
  color: "success" | "warning" | "danger" | "muted";
} {
  if (!coupon.active) {
    return { status: "inactive", label: "معطّل", color: "muted" };
  }

  const now = new Date();
  if (coupon.endsAt && new Date(coupon.endsAt) < now) {
    return { status: "expired", label: "منتهي الصلاحية", color: "warning" };
  }

  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    return { status: "inactive", label: "لم يبدأ بعد", color: "muted" };
  }

  if (coupon.maxUsage !== null && coupon.usedCount >= coupon.maxUsage) {
    return { status: "exhausted", label: "استُنفد بالكامل", color: "danger" };
  }

  return { status: "active", label: "نشط وساري", color: "success" };
}

// WhatsApp Promo message builder
export function generatePromoWhatsAppText(coupon: PromoCoupon, shopName = "سِجلّي"): string {
  const discountLabel =
    coupon.discountType === "percentage" ? `${coupon.discountValue}%` : `${coupon.discountValue} ج.م`;

  let text = `🎉 *عرض خاص وحصري من ${shopName}!* 🎉\n\n`;
  text += `✨ *${coupon.title}*\n`;
  text += `🏷️ كود الخصم: *${coupon.code}*\n`;
  text += `🎁 قيمة الخصم: *خصم ${discountLabel}*\n`;

  if (coupon.minOrderValue > 0) {
    text += `📌 الحد الأدنى للطلب: ${coupon.minOrderValue} ج.م\n`;
  }

  if (coupon.endsAt) {
    const expDate = new Date(coupon.endsAt).toLocaleDateString("ar-EG");
    text += `⏳ يسري العرض حتى: ${expDate}\n`;
  }

  text += `\n💬 استخدم الكود عند طلبك القادم واستمتع بأفضل الأسعار!\n`;
  text += `نسعد دائماً بخدمتكم في *${shopName}* ✨`;

  return text;
}

// Profit margin guard checker
export function evaluateMarginSafety(
  subtotal: number,
  cost: number,
  discountAmount: number,
  marginGuard: MarginGuardConfig
): {
  isSafe: boolean;
  profit: number;
  profitMarginPct: number;
  maxSafeDiscount: number;
  warning?: string;
} {
  const finalPrice = Math.max(0, subtotal - discountAmount);
  const profit = finalPrice - cost;
  const profitMarginPct = finalPrice > 0 ? (profit / finalPrice) * 100 : 0;

  if (!marginGuard.enabled || subtotal <= 0 || cost <= 0) {
    return {
      isSafe: true,
      profit,
      profitMarginPct,
      maxSafeDiscount: subtotal,
    };
  }

  // To maintain minMarginPct: (finalPrice - cost) / finalPrice >= minMarginPct / 100
  // finalPrice * (1 - minMarginPct/100) >= cost
  // finalPrice >= cost / (1 - minMarginPct/100)
  const minRequiredFinalPrice = cost / (1 - marginGuard.minMarginPct / 100);
  const maxSafeDiscount = Math.max(0, subtotal - minRequiredFinalPrice);

  const isSafe = profitMarginPct >= marginGuard.minMarginPct;

  let warning: string | undefined;
  if (!isSafe) {
    if (profit < 0) {
      warning = `تحذير: هذا الخصم يسبب خسارة مباشرة قدرها ${Math.abs(Math.round(profit))} ج.م (السعر بعد الخصم أقل من التكلفة)`;
    } else {
      warning = `تنبيه حماية الربح: هامش الربح (${profitMarginPct.toFixed(1)}%) أقل من الحد الأدنى المسموح به (${marginGuard.minMarginPct}%). أقصى خصم آمن: ${Math.round(maxSafeDiscount)} ج.م`;
    }
  }

  return {
    isSafe,
    profit,
    profitMarginPct,
    maxSafeDiscount: Math.round(maxSafeDiscount * 10) / 10,
    warning,
  };
}

// Auto-Offers & Quantity discounts engine
export function evaluateAutoOffers(
  items: Array<{ name: string; price: number; quantity: number; cost?: number }>,
  qtyOffers: QuantityTierOffer[],
  bundles: BundleComboOffer[]
): {
  suggestedDiscountAmount: number;
  appliedOffers: Array<{ id: string; title: string; amount: number; type: "qty" | "bundle" }>;
} {
  const appliedOffers: Array<{ id: string; title: string; amount: number; type: "qty" | "bundle" }> = [];
  let totalAutoDiscount = 0;

  // 1. Quantity discounts per item
  const activeQtyOffers = qtyOffers.filter((o) => o.active).sort((a, b) => b.minQuantity - a.minQuantity);
  for (const item of items) {
    if (item.quantity <= 0 || item.price <= 0) continue;
    const matchOffer = activeQtyOffers.find((o) => item.quantity >= o.minQuantity);
    if (matchOffer) {
      const itemSubtotal = item.price * item.quantity;
      const discountVal = (itemSubtotal * matchOffer.discountPercentage) / 100;
      totalAutoDiscount += discountVal;
      appliedOffers.push({
        id: matchOffer.id,
        title: `${matchOffer.title} على (${item.name || "صنف"})`,
        amount: Math.round(discountVal * 100) / 100,
        type: "qty",
      });
    }
  }

  // 2. Bundle combo offers
  const activeBundles = bundles.filter((b) => b.active);
  for (const bundle of activeBundles) {
    const allKeywordsPresent = bundle.itemKeywords.every((kw) =>
      items.some((item) => item.name && item.name.toLowerCase().includes(kw.toLowerCase()))
    );

    if (allKeywordsPresent && bundle.itemKeywords.length > 0) {
      totalAutoDiscount += bundle.discountAmount;
      appliedOffers.push({
        id: bundle.id,
        title: bundle.title,
        amount: bundle.discountAmount,
        type: "bundle",
      });
    }
  }

  return {
    suggestedDiscountAmount: Math.round(totalAutoDiscount * 100) / 100,
    appliedOffers,
  };
}

export function validateCouponCode(
  code: string,
  subtotal: number,
  coupons: PromoCoupon[],
  customerType?: string,
  customerId?: string
): {
  valid: boolean;
  coupon?: PromoCoupon;
  discountAmount: number;
  discountPct: number;
  errorReason?: string;
} {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, discountAmount: 0, discountPct: 0, errorReason: "يرجى كتابة كود الخصم" };
  }

  const coupon = coupons.find((c) => c.code.toUpperCase() === cleanCode);
  if (!coupon) {
    return { valid: false, discountAmount: 0, discountPct: 0, errorReason: "كود الخصم غير موجود أو غير صحيح" };
  }

  // Customer lock for loyalty reward vouchers
  if (coupon.isLoyaltyReward && coupon.customerId && coupon.customerId !== customerId) {
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      discountPct: 0,
      errorReason: "هذا الكوبون خاص بعميل مكافآت ولاء محدد ولا يمكن استخدامه لعميل آخر",
    };
  }

  const status = getCouponStatus(coupon);
  if (status.status === "inactive") {
    return { valid: false, discountAmount: 0, discountPct: 0, errorReason: "هذا الكود معطل حالياً" };
  }
  if (status.status === "expired") {
    return { valid: false, discountAmount: 0, discountPct: 0, errorReason: "انتهت فترة صلاحية هذا الكود" };
  }
  if (status.status === "exhausted") {
    return { valid: false, discountAmount: 0, discountPct: 0, errorReason: "تم استنفاد الحد الأقصى لمرات استخدام هذا الكود" };
  }

  if (coupon.minOrderValue > 0 && subtotal < coupon.minOrderValue) {
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      discountPct: 0,
      errorReason: `الحد الأدنى لتطبيق هذا الكود هو ${coupon.minOrderValue} ج.م (الإجمالي الحالي: ${subtotal} ج.م)`,
    };
  }

  if (coupon.customerEligibility === "vip" && customerType !== "vip" && customerType !== "committed") {
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      discountPct: 0,
      errorReason: "هذا الكود مخصص لعملاء الفئة المميزة فقط",
    };
  }

  if (coupon.customerEligibility === "cash" && customerType === "installment") {
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      discountPct: 0,
      errorReason: "هذا الكود مخصص لفواتير الدفع النقدي الفوري فقط",
    };
  }

  let discountAmount = 0;
  let discountPct = 0;

  if (coupon.discountType === "percentage") {
    discountPct = coupon.discountValue;
    discountAmount = Math.min(subtotal, (subtotal * coupon.discountValue) / 100);
  } else {
    discountAmount = Math.min(subtotal, coupon.discountValue);
    discountPct = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  }

  return {
    valid: true,
    coupon,
    discountAmount: Math.round(discountAmount * 100) / 100,
    discountPct: Math.round(discountPct * 10) / 10,
  };
}

export function useDiscounts() {
  const [coupons, setCoupons] = useState<PromoCoupon[]>(() => loadStorage(STORAGE_KEY_COUPONS, DEFAULT_COUPONS));
  const [qtyOffers, setQtyOffers] = useState<QuantityTierOffer[]>(() =>
    loadStorage(STORAGE_KEY_QTY_OFFERS, DEFAULT_QTY_OFFERS)
  );
  const [bundles, setBundles] = useState<BundleComboOffer[]>(() =>
    loadStorage(STORAGE_KEY_BUNDLES, DEFAULT_BUNDLES)
  );
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig>(() =>
    loadStorage(STORAGE_KEY_LOYALTY, DEFAULT_LOYALTY)
  );
  const [marginGuard, setMarginGuard] = useState<MarginGuardConfig>(() =>
    loadStorage(STORAGE_KEY_MARGIN_GUARD, DEFAULT_MARGIN_GUARD)
  );

  const { invoices, customers } = useDB();

  const reloadAll = useCallback(() => {
    setCoupons(loadStorage(STORAGE_KEY_COUPONS, DEFAULT_COUPONS));
    setQtyOffers(loadStorage(STORAGE_KEY_QTY_OFFERS, DEFAULT_QTY_OFFERS));
    setBundles(loadStorage(STORAGE_KEY_BUNDLES, DEFAULT_BUNDLES));
    setLoyaltyConfig(loadStorage(STORAGE_KEY_LOYALTY, DEFAULT_LOYALTY));
    setMarginGuard(loadStorage(STORAGE_KEY_MARGIN_GUARD, DEFAULT_MARGIN_GUARD));
  }, []);

  useEffect(() => {
    window.addEventListener("segilly_discounts_updated", reloadAll);
    window.addEventListener("storage", reloadAll);
    return () => {
      window.removeEventListener("segilly_discounts_updated", reloadAll);
      window.removeEventListener("storage", reloadAll);
    };
  }, [reloadAll]);

  // Coupons CRUD
  const addCoupon = useCallback((input: Omit<PromoCoupon, "id" | "usedCount" | "createdAt">) => {
    const newCoupon: PromoCoupon = {
      ...input,
      id: `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: input.code.trim().toUpperCase(),
      usedCount: 0,
      createdAt: new Date().toISOString(),
    };
    setCoupons((prev) => {
      const next = [newCoupon, ...prev];
      saveStorage(STORAGE_KEY_COUPONS, next);
      return next;
    });
    return newCoupon;
  }, []);

  const updateCoupon = useCallback((id: string, patch: Partial<PromoCoupon>) => {
    setCoupons((prev) => {
      const next = prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...patch };
        if (patch.code) updated.code = patch.code.trim().toUpperCase();
        return updated;
      });
      saveStorage(STORAGE_KEY_COUPONS, next);
      return next;
    });
  }, []);

  const toggleCouponStatus = useCallback((id: string) => {
    setCoupons((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c));
      saveStorage(STORAGE_KEY_COUPONS, next);
      return next;
    });
  }, []);

  const deleteCoupon = useCallback((id: string) => {
    setCoupons((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveStorage(STORAGE_KEY_COUPONS, next);
      return next;
    });
  }, []);

  const recordCouponUsage = useCallback((code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setCoupons((prev) => {
      const next = prev.map((c) => {
        if (c.code.toUpperCase() === clean) {
          return { ...c, usedCount: c.usedCount + 1 };
        }
        return c;
      });
      saveStorage(STORAGE_KEY_COUPONS, next);
      return next;
    });
  }, []);

  // Quantity Offers CRUD
  const addQtyOffer = useCallback((input: Omit<QuantityTierOffer, "id">) => {
    const newOffer: QuantityTierOffer = {
      ...input,
      id: `qty-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setQtyOffers((prev) => {
      const next = [...prev, newOffer];
      saveStorage(STORAGE_KEY_QTY_OFFERS, next);
      return next;
    });
    return newOffer;
  }, []);

  const updateQtyOffer = useCallback((id: string, patch: Partial<QuantityTierOffer>) => {
    setQtyOffers((prev) => {
      const next = prev.map((o) => (o.id === id ? { ...o, ...patch } : o));
      saveStorage(STORAGE_KEY_QTY_OFFERS, next);
      return next;
    });
  }, []);

  const deleteQtyOffer = useCallback((id: string) => {
    setQtyOffers((prev) => {
      const next = prev.filter((o) => o.id !== id);
      saveStorage(STORAGE_KEY_QTY_OFFERS, next);
      return next;
    });
  }, []);

  // Bundles CRUD
  const addBundle = useCallback((input: Omit<BundleComboOffer, "id">) => {
    const newBundle: BundleComboOffer = {
      ...input,
      id: `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setBundles((prev) => {
      const next = [...prev, newBundle];
      saveStorage(STORAGE_KEY_BUNDLES, next);
      return next;
    });
    return newBundle;
  }, []);

  const updateBundle = useCallback((id: string, patch: Partial<BundleComboOffer>) => {
    setBundles((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, ...patch } : b));
      saveStorage(STORAGE_KEY_BUNDLES, next);
      return next;
    });
  }, []);

  const deleteBundle = useCallback((id: string) => {
    setBundles((prev) => {
      const next = prev.filter((b) => b.id !== id);
      saveStorage(STORAGE_KEY_BUNDLES, next);
      return next;
    });
  }, []);

  // Config updates
  const updateLoyaltyConfig = useCallback((patch: Partial<LoyaltyConfig>) => {
    setLoyaltyConfig((prev) => {
      const next = { ...prev, ...patch };
      saveStorage(STORAGE_KEY_LOYALTY, next);
      return next;
    });
  }, []);

  const updateMarginGuard = useCallback((patch: Partial<MarginGuardConfig>) => {
    setMarginGuard((prev) => {
      const next = { ...prev, ...patch };
      saveStorage(STORAGE_KEY_MARGIN_GUARD, next);
      return next;
    });
  }, []);

  // Loyalty rewards generator for a customer
  const generateCustomerLoyaltyVoucher = useCallback(
    (customer: Customer, pointsToRedeem: number) => {
      const discountValue = pointsToRedeem * loyaltyConfig.pointValueEgp;
      const code = `LOYAL-${customer.name.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "X")}-${Math.floor(100 + Math.random() * 900)}`;

      const newCoupon: PromoCoupon = {
        id: `coupon-loyal-${Date.now()}`,
        code,
        title: `مكافأة ولاء للعميل ${customer.name} (${pointsToRedeem} نقطة)`,
        discountType: "fixed",
        discountValue,
        minOrderValue: discountValue * 2,
        maxUsage: 1,
        usedCount: 0,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        active: true,
        customerEligibility: "all",
        notes: `كوبون مكافأة ولاء مستبدل بـ ${pointsToRedeem} نقطة`,
        createdAt: new Date().toISOString(),
        isLoyaltyReward: true,
        customerId: customer.id,
      };

      setCoupons((prev) => {
        const next = [newCoupon, ...prev];
        saveStorage(STORAGE_KEY_COUPONS, next);
        return next;
      });

      return newCoupon;
    },
    [loyaltyConfig]
  );

  // Customer Loyalty Rankings & Points
  const customerLoyaltyStats = useMemo(() => {
    if (!loyaltyConfig.enabled) return [];

    return customers.map((c) => {
      const custInvoices = invoices.filter((i) => i.customerId === c.id && i.status === "paid");
      const totalSpent = custInvoices.reduce((acc, i) => acc + Number(i.total || 0), 0);
      const earnedPoints = Math.floor((totalSpent / 100) * loyaltyConfig.pointsPer100Egp);

      // Points used in loyalty coupons
      const redeemedVouchers = coupons.filter(
        (cp) => cp.isLoyaltyReward && cp.customerId === c.id && cp.usedCount > 0
      );
      const redeemedPoints = redeemedVouchers.reduce(
        (acc, cp) => acc + Math.floor(cp.discountValue / loyaltyConfig.pointValueEgp),
        0
      );

      const availablePoints = Math.max(0, earnedPoints - redeemedPoints);
      const redeemableValueEgp = availablePoints * loyaltyConfig.pointValueEgp;

      return {
        customer: c,
        totalSpent,
        earnedPoints,
        redeemedPoints,
        availablePoints,
        redeemableValueEgp,
        canRedeem: availablePoints >= loyaltyConfig.minPointsToRedeem,
      };
    }).sort((a, b) => b.availablePoints - a.availablePoints);
  }, [customers, invoices, coupons, loyaltyConfig]);

  // Overall metrics
  const metrics = useMemo(() => {
    const totalInvoicesDiscounts = invoices.reduce((acc, inv) => acc + Number(inv.discountAmount || 0), 0);
    const invoicesWithDiscount = invoices.filter((inv) => Number(inv.discountAmount || 0) > 0);
    const totalCouponRedemptions = coupons.reduce((acc, c) => acc + c.usedCount, 0);
    const activeCouponsCount = coupons.filter((c) => getCouponStatus(c).status === "active").length;

    const avgDiscountPerInvoice =
      invoicesWithDiscount.length > 0 ? totalInvoicesDiscounts / invoicesWithDiscount.length : 0;

    const totalSalesBeforeDiscount = invoices.reduce(
      (acc, inv) => acc + Number(inv.total || 0) + Number(inv.discountAmount || 0),
      0
    );
    const discountRate =
      totalSalesBeforeDiscount > 0 ? (totalInvoicesDiscounts / totalSalesBeforeDiscount) * 100 : 0;

    return {
      totalDiscountsGiven: totalInvoicesDiscounts,
      invoicesWithDiscountCount: invoicesWithDiscount.length,
      totalCouponRedemptions,
      activeCouponsCount,
      totalCouponsCount: coupons.length,
      avgDiscountPerInvoice,
      discountRate,
    };
  }, [invoices, coupons]);

  return {
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
    recordCouponUsage,
    addQtyOffer,
    updateQtyOffer,
    deleteQtyOffer,
    addBundle,
    updateBundle,
    deleteBundle,
    updateLoyaltyConfig,
    updateMarginGuard,
    generateCustomerLoyaltyVoucher,
    validateCoupon: (code: string, subtotal: number, customerType?: string, customerId?: string) =>
      validateCouponCode(code, subtotal, coupons, customerType, customerId),
    checkMarginSafety: (subtotal: number, cost: number, discountAmount: number) =>
      evaluateMarginSafety(subtotal, cost, discountAmount, marginGuard),
    calculateAutoOffers: (items: Array<{ name: string; price: number; quantity: number; cost?: number }>) =>
      evaluateAutoOffers(items, qtyOffers, bundles),
  };
}
