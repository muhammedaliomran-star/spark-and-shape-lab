/**
 * WhatsApp Notification Templates & Formatting Engine
 * Specialized in E-Commerce & Logistics lifecycle:
 * 1. Order Confirmation (تأكيد الطلب)
 * 2. Out for Delivery / Courier info (الشحنة خرجت مع المندوب)
 * 3. Rescue & Reschedule Stalled Shipment (إنقاذ وجدولة موعد)
 * 4. Delivery Completed & Feedback (تم التسليم)
 * 5. Custom notification with variable tags
 */

export type WhatsAppTemplateId =
  | "order_confirmation"
  | "out_for_delivery"
  | "rescue_reschedule"
  | "delivered"
  | "custom";

export interface WhatsAppTemplateData {
  customerName?: string;
  orderNumber?: string;
  itemsSummary?: string;
  itemsList?: Array<{ name: string; quantity: number; price?: number }>;
  address?: string;
  zoneName?: string;
  carrierName?: string;
  carrierPhone?: string;
  total?: number;
  codAmount?: number;
  shippingCost?: number;
  trackingUrl?: string;
  storeName?: string;
  reason?: string;
  notes?: string;
  customerPhone?: string;
}

export interface WhatsAppTemplateDef {
  id: WhatsAppTemplateId;
  name: string;
  category: "order" | "shipping" | "rescue" | "general";
  iconName: string;
  description: string;
  defaultTemplate: string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplateDef[] = [
  {
    id: "order_confirmation",
    name: "تأكيد استلام الطلب",
    category: "order",
    iconName: "CheckCircle2",
    description: "إرسال تفاصيل الطلب والعنوان ورابط التتبع للعميل بعد إتمام الطلب",
    defaultTemplate: `أهلاً بك يا {customer_name} 🌸
شكراً لطلبك من {store_name}!

📦 *تفاصيل طلبك:*
• رقم الطلب: #{order_number}
• الأصناف:
{items_list}
• عنوان التوصيل: {address}

💰 *إجمالي المبلغ المطلوب:* {total} ج.م (الدفع عند الاستلام COD)

🚚 *رابط التتبع المباشر لطلبك:*
{tracking_url}

سعداء بخدمتك وفي انتظار شحن طلبك قريباً! 🌟`,
  },
  {
    id: "out_for_delivery",
    name: "الشحنة خرجت مع المندوب",
    category: "shipping",
    iconName: "Truck",
    description: "إشعار العميل بأن الشحنة في الطريق مع بيانات المندوب للتنسيق",
    defaultTemplate: `مرحباً {customer_name} 🚚✨

شحنتك رقم #{order_number} من *{store_name}* خرجت الآن للتوصيل!

👤 *مندوب التوصيل:* {carrier_name}
📞 *هاتف المندوب للتنسيق:* {carrier_phone}
📍 *العنوان:* {address}
💵 *المبلغ المطلوب عند الاستلام:* {total} ج.م

🔗 *رابط التتبع المباشر:*
{tracking_url}

يرجى التأكد من التواجد والرد على المندوب لسرعة الاستلام 🙏`,
  },
  {
    id: "rescue_reschedule",
    name: "إنقاذ شحنة معلقة وجدولة موعد",
    category: "rescue",
    iconName: "AlertTriangle",
    description: "مراسلة العميل عند تعذر التسليم لإعادة جدولة موعد أو تعديل العنوان",
    defaultTemplate: `عناية العميل المحترم {customer_name} ⚠️

بخصوص طلبك رقم #{order_number} من *{store_name}*:
تعذر تسليم الشحنة بسبب: *{reason}*.

حرصاً منا على استلام طلبك بأفضل صورة، يسعدنا إعادة جدولة موعد التوصيل أو تحديث العنوان 🗓️

📍 *العنوان المسجل:* {address}
💵 *المبلغ الإجمالي:* {total} ج.م

📲 *يمكنك الرد على هذه الرسالة بموعد الاستلام المناسب لك، أو متابعة التتبع عبر:*
{tracking_url}

فريق خدمة العملاء في خدمتك دائماً! 🌸`,
  },
  {
    id: "delivered",
    name: "تم التسليم وشكر العميل",
    category: "shipping",
    iconName: "Gift",
    description: "تهنئة العميل بالاستلام وطلب تقييم التجربة وتقديم الدعم",
    defaultTemplate: `أهلاً {customer_name} 🎉

تم تسليم طلبك رقم #{order_number} بنجاح!
نتمنى أن تنال منتجاتنا إعجابك ورضاك 🌟

إذا كان لديك أي استفسار أو تحتاج مساعدة، لا تتردد في التواصل معنا.
شكراً لثقتك في *{store_name}* ❤️`,
  },
  {
    id: "custom",
    name: "رسالة مخصصة",
    category: "general",
    iconName: "MessageSquare",
    description: "كتابة نص حر مع إمكانية إدراج المتغيرات تلقائياً",
    defaultTemplate: `مرحباً {customer_name}،
بخصوص طلبك رقم #{order_number} من {store_name}:

{notes}

رابط التتبع: {tracking_url}`,
  },
];

/**
 * Format phone number for international WhatsApp URL
 * Supports Egyptian numbers starting with 01..., 0020..., +20..., etc.
 */
export function formatWhatsAppPhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }
  // If local Egyptian number (010, 011, 012, 015)
  if (cleaned.startsWith("01") && cleaned.length === 11) {
    cleaned = "20" + cleaned.substring(1);
  } else if (cleaned.length === 10 && cleaned.startsWith("1")) {
    cleaned = "20" + cleaned;
  }
  return cleaned;
}

/**
 * Build Direct Live Tracking URL for customer
 */
export function buildTrackingUrl(orderNumber: string, customerPhone?: string): string {
  const origin = typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "";
  const params = new URLSearchParams();
  if (orderNumber) params.set("number", orderNumber.trim());
  if (customerPhone) {
    // Keep local format or clean phone for easy lookup
    const rawClean = customerPhone.replace(/[^\d]/g, "");
    params.set("phone", rawClean);
  }
  return `${origin}/order-tracking?${params.toString()}`;
}

/**
 * Replace placeholders in template with actual data
 */
export function renderWhatsAppMessage(
  templateText: string,
  data: WhatsAppTemplateData
): string {
  const storeName = data.storeName || "متجرنا";
  const customerName = data.customerName || "عميلنا العزيز";
  const orderNumber = data.orderNumber || "---";
  const address = data.address || (data.zoneName ? `منطقة ${data.zoneName}` : "العنوان المسجل");
  const carrierName = data.carrierName || "مندوب الشحن";
  const carrierPhone = data.carrierPhone || "غير مسجل";
  const total = Number(data.total ?? data.codAmount ?? 0).toLocaleString("ar-EG");
  const reason = data.reason || "تعذر الوصول في الموعد";
  const notes = data.notes || "";
  const trackingUrl = data.trackingUrl || buildTrackingUrl(orderNumber, data.customerPhone);

  let itemsListText = "";
  if (data.itemsList && data.itemsList.length > 0) {
    itemsListText = data.itemsList
      .map((it) => `  - ${it.name} (عدد ${it.quantity})${it.price ? ` - ${it.price} ج.م` : ""}`)
      .join("\n");
  } else if (data.itemsSummary) {
    itemsListText = `  - ${data.itemsSummary}`;
  } else {
    itemsListText = "  - أصناف الفاتورة المسجلة";
  }

  let text = templateText;
  text = text.replace(/{customer_name}/g, customerName);
  text = text.replace(/{order_number}/g, orderNumber);
  text = text.replace(/{items_list}/g, itemsListText);
  text = text.replace(/{address}/g, address);
  text = text.replace(/{carrier_name}/g, carrierName);
  text = text.replace(/{carrier_phone}/g, carrierPhone);
  text = text.replace(/{total}/g, total);
  text = text.replace(/{tracking_url}/g, trackingUrl);
  text = text.replace(/{store_name}/g, storeName);
  text = text.replace(/{reason}/g, reason);
  text = text.replace(/{notes}/g, notes);

  return text;
}

/**
 * Generate full wa.me link
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
