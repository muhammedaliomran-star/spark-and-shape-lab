import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useShopSettings, type Shipment, type ShipmentCarrier } from "@/lib/store";
import {
  waLink, renderShipmentOutForDelivery, renderTrackingTimeline, renderRescuePending,
  buildTimeline, type ShopInfo,
} from "@/lib/whatsapp-templates";
import { MessageCircle, Copy } from "lucide-react";

const egp = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

export function WhatsAppMenu({
  open,
  onOpenChange,
  shipment,
  carrier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: Shipment;
  carrier?: ShipmentCarrier;
}) {
  const { settings } = useShopSettings();
  const shop: ShopInfo = {
    shopName: settings.shopName || "متجرنا",
    shopPhone: settings.phone || undefined,
    whatsapp: settings.whatsapp || undefined,
  };

  const phone = shipment.recipientPhone ?? "";
  const tracking = shipment.trackingNumber ?? shipment.id;

  const messages = [
    {
      key: "out",
      label: "الشحنة خرجت مع المندوب",
      text: renderShipmentOutForDelivery({
        shop,
        recipientName: shipment.recipientName ?? "عميلنا العزيز",
        recipientPhone: phone,
        trackingNumber: tracking,
        carrierName: carrier?.name,
        carrierPhone: carrier?.phone ?? undefined,
        deliveryAddress: shipment.deliveryAddress ?? "—",
        codAmount: egp(shipment.codAmount),
      }),
    },
    {
      key: "timeline",
      label: "رابط التتبع + الحالة",
      text: renderTrackingTimeline({
        shop,
        publicNumber: tracking,
        customerName: shipment.recipientName ?? undefined,
        statusLabel: shipment.status,
        timeline: buildTimeline(shipment.status, { createdAt: shipment.createdAt }),
        total: egp(shipment.codAmount),
      }),
    },
    {
      key: "rescue",
      label: "متابعة شحنة متعثرة",
      text: renderRescuePending({
        shop,
        customer: shipment.recipientName ?? "عميلنا العزيز",
        phone,
        number: tracking,
        statusLabel: shipment.status,
        reason: "لم يتم التوصيل بعد",
        ageDays: Math.max(0, Math.round((Date.now() - new Date(shipment.createdAt).getTime()) / 86400000)),
        address: shipment.deliveryAddress ?? undefined,
        total: egp(shipment.codAmount),
      }),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-500" /> رسائل واتساب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!phone && <p className="text-sm text-amber-500">لا يوجد رقم هاتف للمستلم — يمكنك نسخ الرسالة فقط.</p>}
          {messages.map((m) => (
            <div key={m.key} className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{m.label}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(m.text);
                      toast.success("تم نسخ الرسالة");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" disabled={!phone} asChild={!!phone}>
                    {phone ? (
                      <a href={waLink(phone, m.text, { arabicDigits: false })} target="_blank" rel="noreferrer">إرسال</a>
                    ) : (
                      <span>إرسال</span>
                    )}
                  </Button>
                </div>
              </div>
              <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">{m.text}</pre>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WhatsAppMenu;
