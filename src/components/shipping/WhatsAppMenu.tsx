import * as React from "react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Shipment, ShipmentCarrier, useDB } from "@/lib/store";
import {
  waLink,
  trackUrlFor,
  renderOrderConfirmation,
  renderShipmentOutForDelivery,
  renderRescuePending,
  renderTrackingTimeline,
  buildTimeline,
  normalizeEGPhone,
} from "@/lib/whatsapp-templates";
import { toast } from "sonner";
import { MessageSquare, Send, Copy, Check, Truck, AlertTriangle, CheckCircle2, Link2 } from "lucide-react";

export type WhatsAppTemplateType = "confirm" | "out_for_delivery" | "rescue" | "timeline" | "delivered_thanks";

interface WhatsAppMenuProps {
  shipment: Shipment;
  carrier?: ShipmentCarrier;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppMenu({
  shipment,
  carrier,
  open,
  onOpenChange,
}: WhatsAppMenuProps) {
  const { invoices } = useDB();
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateType>("out_for_delivery");
  const [customText, setCustomText] = useState("");
  const [copied, setCopied] = useState(false);

  const currentInvoice = invoices.find((i) => i.id === shipment.invoiceId);
  const shop = { shopName: "سِجلّي", shopPhone: "01000000000", whatsapp: "01000000000" };

  const generateMessage = (type: WhatsAppTemplateType) => {
    const tracking = shipment.trackingNumber || shipment.id.slice(0, 8);
    const trackUrl = trackUrlFor(tracking, shipment.recipientPhone || undefined);

    if (type === "confirm") {
      return renderOrderConfirmation({
        shop,
        customerName: shipment.recipientName || "عميلنا العزيز",
        customerPhone: shipment.recipientPhone || "",
        publicNumber: tracking,
        address: shipment.deliveryAddress || "-",
        total: String(shipment.codAmount || 0),
        shippingFee: String(shipment.shippingCost || 0),
        paymentType: "الدفع عند الاستلام",
      });
    }

    if (type === "out_for_delivery") {
      return renderShipmentOutForDelivery({
        shop,
        recipientName: shipment.recipientName || "عميلنا العزيز",
        recipientPhone: shipment.recipientPhone || "",
        trackingNumber: tracking,
        carrierName: carrier?.name || "مندوب الشحن",
        carrierPhone: carrier?.phone || "",
        deliveryAddress: shipment.deliveryAddress || "-",
        codAmount: String(shipment.codAmount || 0),
        trackUrl,
      });
    }

    if (type === "rescue") {
      return renderRescuePending({
        shop,
        customer: shipment.recipientName || "عميلنا العزيز",
        phone: shipment.recipientPhone || "",
        number: tracking,
        statusLabel: "محاولة تسليم غير مكتملة",
        reason: shipment.notes || "تعذر الوصول في الموعد السابق",
        ageDays: 1,
        total: String(shipment.codAmount || 0),
        address: shipment.deliveryAddress || "-",
        trackUrl,
      });
    }

    if (type === "timeline") {
      const steps = buildTimeline(shipment.status || "processing");
      return renderTrackingTimeline({
        shop,
        publicNumber: tracking,
        customerName: shipment.recipientName || "عميلنا العزيز",
        statusLabel: shipment.status === "delivered" ? "تم التسليم بنجاح" : "جاري الشحن والتوصيل",
        timeline: steps,
        total: String(shipment.codAmount || 0),
        trackUrl,
      });
    }

    // Delivered Thanks Template
    return `مرحباً ${shipment.recipientName || "عميلنا العزيز"} 🌟
تم تسليم طلبك رقم *${tracking}* بنجاح ✅

نتمنى أن تنال المنتجات إعجابك!
رأيك يهمنا جداً — لا تتردد في مراسلتنا لأي استفسار أو تقييم لتجربتك معنا.

شكراً لتعاملك مع ${shop.shopName} 🌿`;
  };

  // Update text when template changes
  React.useEffect(() => {
    if (open) {
      setCustomText(generateMessage(selectedTemplate));
      setCopied(false);
    }
  }, [open, selectedTemplate, shipment, carrier]);

  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    setCopied(true);
    toast.success("تم نسخ نص الرسالة إلى الحافظة!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    if (!shipment.recipientPhone) {
      toast.error("رقم هاتف المستلم غير متوفر");
      return;
    }
    const link = waLink(shipment.recipientPhone, customText, { arabicDigits: false });
    window.open(link, "_blank");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-5" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600">
            <MessageSquare className="h-6 w-6" />
            <DialogTitle className="text-lg font-bold">إرسال إشعار واتساب للعميل</DialogTitle>
          </div>
          <DialogDescription>
            اختر قالباً جاهزاً ومؤتمتاً لإرساله للعميل ({shipment.recipientName} - {shipment.recipientPhone || "بدون هاتف"}).
          </DialogDescription>
        </DialogHeader>

        {/* Template Chooser */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          <Button
            type="button"
            variant={selectedTemplate === "out_for_delivery" ? "default" : "outline"}
            size="sm"
            className="text-xs font-bold gap-1.5 h-10"
            onClick={() => setSelectedTemplate("out_for_delivery")}
          >
            <Truck className="h-3.5 w-3.5" />
            خرجت مع المندوب
          </Button>

          <Button
            type="button"
            variant={selectedTemplate === "confirm" ? "default" : "outline"}
            size="sm"
            className="text-xs font-bold gap-1.5 h-10"
            onClick={() => setSelectedTemplate("confirm")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            تأكيد الطلب والعنوان
          </Button>

          <Button
            type="button"
            variant={selectedTemplate === "rescue" ? "default" : "outline"}
            size="sm"
            className="text-xs font-bold gap-1.5 h-10"
            onClick={() => setSelectedTemplate("rescue")}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            إنقاذ شحنة معلقة
          </Button>

          <Button
            type="button"
            variant={selectedTemplate === "timeline" ? "default" : "outline"}
            size="sm"
            className="text-xs font-bold gap-1.5 h-10"
            onClick={() => setSelectedTemplate("timeline")}
          >
            <Link2 className="h-3.5 w-3.5" />
            رابط التتبع والخط الزمني
          </Button>

          <Button
            type="button"
            variant={selectedTemplate === "delivered_thanks" ? "default" : "outline"}
            size="sm"
            className="text-xs font-bold gap-1.5 h-10 col-span-2 sm:col-span-1"
            onClick={() => setSelectedTemplate("delivered_thanks")}
          >
            <Check className="h-3.5 w-3.5" />
            شكر وتقييم بعد الاستلام
          </Button>
        </div>

        {/* Live Editable Text */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>نص الرسالة (يمكنك التعديل قبل الإرسال):</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 gap-1 text-xs text-primary font-bold hover:bg-primary/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "تم النسخ" : "نسخ النص"}
            </Button>
          </div>

          <Textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={8}
            className="text-xs font-sans leading-relaxed border-emerald-500/30 focus-visible:ring-emerald-500"
          />
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={handleOpenWhatsApp}
            disabled={!shipment.recipientPhone}
            className="gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Send className="h-4 w-4" />
            فتح في واتساب الآن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
