import { toArabicDigits } from "@/lib/arabic-digits";

export type ShopInfo = { shopName: string; shopPhone?: string; whatsapp?: string };

export const normalizeEGPhone = (phone: string) =>
  phone.replace(/\D/g, "").replace(/^0/, "20");

export const waLink = (phone: string, text: string, opts?: { arabicDigits?: boolean }) => {
  if (!phone) return "#";
  const body = opts?.arabicDigits === false ? text : toArabicDigits(text);
  return `https://wa.me/${normalizeEGPhone(phone)}?text=${encodeURIComponent(body)}`;
};

export const trackUrlFor = (publicNumber: string, phone?: string) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const q = new URLSearchParams();
  q.set("num", publicNumber);
  if (phone) q.set("phone", phone);
  return `${origin}/order-tracking?${q.toString()}`;
};

// 1) تأكيد الطلب مع العنوان
export function renderOrderConfirmation(params: {
  shop: ShopInfo;
  customerName: string;
  customerPhone: string;
  publicNumber: string;
  address: string;
  area?: string;
  total: string;
  subtotal?: string;
  shippingFee?: string;
  shippingZone?: string;
  estimatedDays?: number | string;
  paymentType?: string;
}) {
  const fullAddress = [params.area, params.address].filter(Boolean).join(" - ") || params.address;
  const zoneLine = params.shippingZone
    ? `• منطقة التوصيل: ${params.shippingZone}${params.estimatedDays ? ` (${params.estimatedDays} أيام)` : ""}`
    : "";
  const track = trackUrlFor(params.publicNumber, params.customerPhone);
  return `مرحباً ${params.customerName} 👋
تم تأكيد طلبك بنجاح في *${params.shop.shopName}* ✅

• رقم الطلب: *${params.publicNumber}*
• العنوان: ${fullAddress}
${zoneLine ? zoneLine + "\n" : ""}• الإجمالي: *${params.total} ج.م*${params.paymentType ? ` (${params.paymentType})` : ""}

تابع حالة طلبك لحظة بلحظة من هنا:
${track}

شكراً لثقتك في ${params.shop.shopName} 🌿`;
}

// 2) الشحنة خرجت مع المندوب + رقم المندوب
export function renderShipmentOutForDelivery(params: {
  shop: ShopInfo;
  recipientName: string;
  recipientPhone: string;
  trackingNumber: string;
  carrierName?: string;
  carrierPhone?: string;
  zoneName?: string;
  deliveryAddress: string;
  codAmount?: string;
  trackUrl?: string;
  publicNumber?: string;
}) {
  const courierLine = params.carrierName
    ? `• شركة الشحن: ${params.carrierName}${params.carrierPhone ? ` — ☎ ${params.carrierPhone}` : ""}`
    : params.carrierPhone
      ? `• هاتف المندوب: ${params.carrierPhone}`
      : "";
  const track = params.trackUrl || trackUrlFor(params.publicNumber || params.trackingNumber, params.recipientPhone);
  return `أهلاً ${params.recipientName} 🚚
شحنتك خرجت مع المندوب الآن!

• رقم التتبع: *${params.trackingNumber}*
${courierLine ? courierLine + "\n" : ""}• العنوان: ${params.deliveryAddress}${params.zoneName ? ` (${params.zoneName})` : ""}
${params.codAmount && params.codAmount !== "0" ? `• المبلغ المطلوب عند الاستلام: *${params.codAmount} ج.م*` : "• الدفع: تم مسبقاً ✅"}

تتبع الشحنة مباشرة:
${track}

لو عندك أي استفسار راسلنا: ${params.shop.whatsapp || params.shop.shopPhone || ""}`;
}

// 3) إنقاذ شحنة معلقة لجدولة موعد جديد
export function renderRescuePending(params: {
  shop: ShopInfo;
  customer: string;
  phone: string;
  number: string;
  statusLabel: string;
  reason: string;
  ageDays: number;
  productSummary?: string;
  total?: string;
  address?: string;
  trackUrl?: string;
}) {
  const track = params.trackUrl || trackUrlFor(params.number, params.phone);
  return `مرحباً ${params.customer} ⚠️
طلبك رقم *${params.number}* (${params.statusLabel}) متعثر منذ ${params.ageDays} يوم.

• السبب: ${params.reason}
${params.productSummary ? `• المنتجات: ${params.productSummary}\n` : ""}${params.total ? `• الإجمالي: ${params.total} ج.م\n` : ""}${params.address ? `• العنوان: ${params.address}\n` : ""}
نقدر نحدد لك موعد جديد للتوصيل — رد بكلمة *تأكيد* والموعد المناسب (اليوم/غداً + الفترة صباحاً/مساءً).

تابع طلبك:
${track}

${params.shop.shopName} — في خدمتك 🌿`;
}

// 4) رابط التتبع المباشر + Timeline نصي جذاب
export type TimelineStep = { key: string; label: string; done: boolean; current?: boolean; date?: string };

export function renderTrackingTimeline(params: {
  shop: ShopInfo;
  publicNumber: string;
  customerName?: string;
  statusLabel: string;
  timeline: TimelineStep[];
  total?: string;
  trackUrl?: string;
}) {
  const track = params.trackUrl || trackUrlFor(params.publicNumber);
  const steps = params.timeline
    .map((s) => `${s.done ? "✅" : s.current ? "⏳" : "◻️"} ${s.label}${s.date ? ` — ${s.date}` : ""}`)
    .join("\n");
  return `تتبع طلبك *${params.publicNumber}* — ${params.statusLabel}

${steps}

${params.total ? `الإجمالي: ${params.total} ج.م\n` : ""}رابط التتبع المباشر:
${track}

${params.shop.shopName} 🚚`;
}

export const timelineLabels: Record<string, string> = {
  submitted: "تم استلام الطلب",
  under_review: "قيد المراجعة",
  needs_info: "محتاج بيانات",
  accepted: "تم قبول الطلب",
  invoiced: "تم إنشاء الفاتورة",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  rejected: "تعذر قبول الطلب",
  cancelled: "تم إلغاء الطلب",
  expired: "انتهت مهلة الحجز",
};

const TIMELINE_ORDER = [
  "submitted",
  "under_review",
  "accepted",
  "invoiced",
  "shipped",
  "delivered",
];

export function buildTimeline(currentStatus: string, opts?: { createdAt?: string; updatedAt?: string }): TimelineStep[] {
  const idx = TIMELINE_ORDER.indexOf(currentStatus);
  return TIMELINE_ORDER.map((key, i) => ({
    key,
    label: timelineLabels[key] ?? key,
    done: idx >= 0 ? i < idx : false,
    current: i === idx,
  }));
}
