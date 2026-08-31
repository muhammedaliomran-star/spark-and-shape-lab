import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { type Invoice, type Customer, type InvoiceItem, type ShipmentCarrier, type ShippingZone, db, fmt } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, MapPin, Phone, User, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export function CreateInvoiceShipmentDialog({
  inv,
  customer,
  items,
  carriers,
  zones,
  onClose,
}: {
  inv: Invoice | null;
  customer: Customer | null;
  items: InvoiceItem[];
  carriers: ShipmentCarrier[];
  zones: ShippingZone[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [carrierId, setCarrierId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [codAmount, setCodAmount] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const invItems = useMemo(() => {
    if (!inv) return [];
    return items.filter((it) => it.invoiceId === inv.id);
  }, [inv, items]);

  useEffect(() => {
    if (inv && customer) {
      setRecipientName(customer.name || "");
      setRecipientPhone(customer.phone || "");
      setDeliveryAddress(customer.address || "");
      const remaining = Math.max(0, inv.total - inv.paid);
      setCodAmount(String(remaining));
      
      const activeCarriers = carriers.filter((c) => c.active);
      const defaultCarrier = activeCarriers[0]?.id || "";
      setCarrierId(defaultCarrier);
      
      const randTracking = `TRK-${inv.id.slice(0, 5).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      setTrackingNumber(randTracking);

      const itemsSummary = invItems.map((i) => `${i.name} (×${i.quantity || 1})`).join("، ");
      setNotes(`فاتورة مبيعات #${inv.id.slice(0, 6)}: ${itemsSummary || inv.notes || "بضاعة"}`);
    }
  }, [inv, customer, carriers, invItems]);

  const carrierZones = useMemo(() => {
    if (!carrierId) return [];
    return zones.filter((z) => z.carrierId === carrierId);
  }, [carrierId, zones]);

  useEffect(() => {
    if (carrierZones.length > 0) {
      setZoneId(carrierZones[0].id);
      setShippingCost(String(carrierZones[0].deliveryCost || 0));
    } else {
      setZoneId("");
      const selectedCarrier = carriers.find((c) => c.id === carrierId);
      setShippingCost(String(selectedCarrier?.baseCost || 0));
    }
  }, [carrierId, carrierZones, carriers]);

  if (!inv || !customer) return null;

  const handleSubmit = async () => {
    if (!recipientName.trim()) return toast.error("أدخل اسم المستلم");
    if (!recipientPhone.trim()) return toast.error("أدخل رقم هاتف المستلم");
    if (!deliveryAddress.trim()) return toast.error("أدخل عنوان التوصيل");
    if (!carrierId) return toast.error("اختر شركة الشحن");

    setLoading(true);
    try {
      await db.addShipment({
        invoiceId: inv.id,
        carrierId: carrierId || null,
        zoneId: zoneId || null,
        trackingNumber: trackingNumber.trim() || null,
        status: "pending",
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        shippingCost: Number(shippingCost || 0),
        codAmount: Number(codAmount || 0),
        collectionStatus: "uncollected",
        notes: notes.trim() || null,
        actualDeliveryDate: null,
        processingAt: null,
        shippedAt: null,
        deliveredAt: null,
        returnedAt: null,
        statusUpdatedBy: "النظام",
        collectedAt: null,
        settledAt: null,
      });

      toast.success(`تم إنشاء بوليصة شحن رقم ${trackingNumber} بنجاح`, {
        action: {
          label: "عرض في الشحن",
          onClick: () => navigate({ to: "/shipping" }),
        },
      });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "تعذر إنشاء الشحنة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end text-right">
            تحويل الفاتورة إلى شحنة / بوليصة توصيل
            <Truck className="w-5 h-5 text-primary" />
          </DialogTitle>
          <DialogDescription className="text-right">
            إنشاء بوليصة شحن سريعة للفاتورة #{inv.id.slice(0, 6)} وربطها بشركة الشحن ومتابعة التحصيل.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-right">
          {/* بطاقة ملخص الفاتورة */}
          <div className="p-3 rounded-2xl bg-foreground/[0.03] border border-border/60 flex items-center justify-between">
            <div className="text-left">
              <span className="text-xs text-muted-foreground block">مبلغ التحصيل المقترح (المتبقي):</span>
              <span className="font-extrabold text-sm text-danger tabular-nums">
                {fmt(Math.max(0, inv.total - inv.paid))} ج.م
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">العميل: {customer.name}</span>
              <span className="text-xs font-bold text-foreground">
                {invItems.length} صنف مسجل في الفاتورة
              </span>
            </div>
          </div>

          {/* اختيار شركة الشحن والمنطقة */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold">شركة الشحن أو مندوب التوصيل</Label>
              <Select value={carrierId} onValueChange={setCarrierId}>
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="اختر شركة الشحن..." />
                </SelectTrigger>
                <SelectContent>
                  {carriers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold">منطقة / محافظة الشحن</Label>
              <Select
                value={zoneId}
                onValueChange={(val) => {
                  setZoneId(val);
                  const z = carrierZones.find((x) => x.id === val);
                  if (z) setShippingCost(String(z.deliveryCost));
                }}
                disabled={carrierZones.length === 0}
              >
                <SelectTrigger className="text-right">
                  <SelectValue placeholder={carrierZones.length === 0 ? "لا توجد مناطق مخصصة" : "اختر المنطقة..."} />
                </SelectTrigger>
                <SelectContent>
                  {carrierZones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name} ({fmt(z.deliveryCost)} ج.م - {z.estimatedDays} أيام)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* بيانات المستلم */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold">اسم المستلم</Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="اسم المستلم الكامل"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">رقم هاتف المستلم (للتواصل)</Label>
              <Input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="010XXXXXXXX"
                dir="ltr"
                className="text-right"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">عنوان التوصيل بالتفصيل</Label>
            <Input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="المحافظة، المدينة، الشارع، رقم العمارة / الشقة"
            />
          </div>

          {/* المبالغ والتتبع */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-bold">مبلغ التحصيل (COD ج.م)</Label>
              <Input
                type="number"
                value={codAmount}
                onChange={(e) => setCodAmount(e.target.value)}
                placeholder="0"
                className="font-bold text-center"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                المبلغ المطلوب تحصيله من العميل
              </p>
            </div>

            <div>
              <Label className="text-xs font-bold">تكلفة الشحن (ج.م)</Label>
              <Input
                type="number"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                placeholder="0"
                className="text-center"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                رسوم شركة الشحن
              </p>
            </div>

            <div>
              <Label className="text-xs font-bold">رقم بوليصة الشحن (Tracking #)</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="TRK-XXXXX"
                dir="ltr"
                className="text-center font-mono text-xs"
              />
            </div>
          </div>

          {/* الوزن والقطع والتسعير التلقائي */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-bold">الوزن (كجم)</Label>
              <Input
                type="number"
                min={0}
                step="0.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="0"
                className="text-center"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">عدد القطع</Label>
              <Input
                type="number"
                min={1}
                value={pieces}
                onChange={(e) => setPieces(e.target.value)}
                placeholder="1"
                className="text-center"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">التسليم المتوقع</Label>
              <Input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="text-center text-xs"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span>التسعير التلقائي</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 text-[10px]"
                onClick={() => setShippingCost(String(pricing.total))}
              >
                تطبيق ({fmt(pricing.total)})
              </Button>
            </div>
            {pricing.lines.map((l) => (
              <div key={l.label} className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{l.label}</span>
                <span className="font-mono">{fmt(l.value)}</span>
              </div>
            ))}
          </div>


          <div>
            <Label className="text-xs font-bold">ملاحظات الشحن / محتويات الطرد</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات المندوب أو وصف الطرد..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !carrierId}
            className="gap-1.5 bg-primary text-primary-foreground font-bold"
          >
            <Truck className="w-4 h-4" /> حفظ وإنشاء بوليصة الشحن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
