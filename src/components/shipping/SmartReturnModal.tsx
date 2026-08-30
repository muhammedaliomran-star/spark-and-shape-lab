import * as React from "react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { db, Shipment, useDB } from "@/lib/store";
import { saveCarrierTransaction } from "@/lib/carrier-ledger";
import { toast } from "sonner";
import { RotateCcw, PackageCheck, AlertCircle, ShieldAlert, Truck, UserX, Store } from "lucide-react";

interface SmartReturnModalProps {
  shipment: Shipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => Promise<void>;
}

export function SmartReturnModal({
  shipment,
  open,
  onOpenChange,
  onSuccess,
}: SmartReturnModalProps) {
  const { invoiceItems, stockItems, carriers } = useDB();
  const [productCondition, setProductCondition] = useState<"intact" | "damaged">("intact");
  const [restockToInventory, setRestockToInventory] = useState(true);
  const [shippingPayer, setShippingPayer] = useState<"store" | "customer" | "carrier">("store");
  const [returnReason, setReturnReason] = useState("العميل رفض الاستلام / غير متواجد");
  const [customNotes, setCustomNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!shipment) return null;

  const currentCarrier = carriers.find((c) => c.id === shipment.carrierId);
  const matchedInvoiceItems = invoiceItems.filter((it) => it.invoiceId === shipment.invoiceId);

  const quickReasons = [
    "العميل رفض الاستلام / غير متواجد",
    "المنتج غير مطابق للمواصفات",
    "تأخر التوصيل من المندوب",
    "العميل مغلق ولا يرد",
    "العنوان غير صحيح / خارج النطاق",
    "تلف الطرد أثناء الشحن",
    "طلب إلغاء من العميل",
  ];

  const handleConfirmReturn = async () => {
    setSubmitting(true);
    try {
      const fullReason = `${returnReason}${customNotes ? ` — ${customNotes}` : ""} [تحمل الشحن: ${
        shippingPayer === "store" ? "المتجر" : shippingPayer === "customer" ? "العميل" : "المندوب"
      } | حالة البضاعة: ${productCondition === "intact" ? "سليمة" : "تالفة"}]`;

      // 1. Update Shipment Status to returned
      await db.updateShipmentStatus(shipment.id, "returned", fullReason);

      // 2. Restock Inventory if product is intact & requested
      let restockedCount = 0;
      if (productCondition === "intact" && restockToInventory && matchedInvoiceItems.length > 0) {
        for (const item of matchedInvoiceItems) {
          const matchedStock = stockItems.find(
            (s) => s.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          );
          if (matchedStock) {
            await db.updateStockItem(matchedStock.id, {
              quantity: (matchedStock.quantity || 0) + (item.quantity || 1),
            });
            restockedCount += item.quantity || 1;
          }
        }
      }

      // 3. Handle Shipping Cost Liability
      if (shippingPayer === "carrier" && shipment.carrierId) {
        // Record deduction from carrier
        saveCarrierTransaction({
          carrierId: shipment.carrierId,
          type: "return_penalty",
          amount: shipment.shippingCost || 0,
          date: new Date().toISOString(),
          paymentMethod: "other",
          referenceNumber: shipment.trackingNumber || shipment.id.slice(0, 8),
          notes: `خصم مصاريف شحن لمرتجع الشحنة #${shipment.trackingNumber || shipment.id.slice(0, 8)} (${returnReason})`,
        });
      } else if (shippingPayer === "store") {
        // Can record as general transport expense
        await db.addExpense({
          amount: shipment.shippingCost || 0,
          category: "transport",
          expenseDate: new Date().toISOString().slice(0, 10),
          notes: `تكلفة شحن مرتجع للشحنة #${shipment.trackingNumber || shipment.id.slice(0, 8)}`,
        });
      }

      toast.success(
        `تم تسجيل الشحنة كمرتجع بنجاح! ${
          restockedCount > 0 ? `(تمت إعادة ${restockedCount} قطعة للمخزون تلقائياً)` : ""
        }`
      );

      if (onSuccess) await onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "تعذر إتمام عملية الإرجاع");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-5" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <RotateCcw className="h-6 w-6" />
            <DialogTitle className="text-lg font-bold">الإدارة المتقدمة للمرتجع وإعادة التخزين</DialogTitle>
          </div>
          <DialogDescription>
            تحديد حالة البضاعة المسترجعة والمسؤولية المالية لمصاريف الشحن قبل تأكيد الارتجاع.
          </DialogDescription>
        </DialogHeader>

        {/* Shipment Overview Box */}
        <div className="p-3 bg-muted/40 rounded-lg border text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">رقم الشحنة/التتبع:</span>
            <span className="font-mono font-bold">{shipment.trackingNumber || shipment.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">العميل والموبايل:</span>
            <span className="font-bold">{shipment.recipientName} ({shipment.recipientPhone || "-"})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">المندوب / الشركة:</span>
            <span>{currentCarrier?.name || "غير محدد"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">مبلغ التحصيل (COD):</span>
            <span className="font-bold">{shipment.codAmount || 0} ج.م</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">تكلفة الشحن:</span>
            <span className="font-bold text-destructive">{shipment.shippingCost || 0} ج.م</span>
          </div>
        </div>

        <div className="space-y-4 pt-1">
          {/* 1. Condition & Restock */}
          <div className="space-y-2">
            <Label className="text-sm font-bold flex items-center gap-1.5">
              <PackageCheck className="h-4 w-4 text-primary" />
              1. حالة المنتج والمخزون
            </Label>
            <RadioGroup
              value={productCondition}
              onValueChange={(val: "intact" | "damaged") => {
                setProductCondition(val);
                if (val === "damaged") setRestockToInventory(false);
                else setRestockToInventory(true);
              }}
              className="grid grid-cols-2 gap-2"
            >
              <div
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${
                  productCondition === "intact" ? "border-success bg-success/10 font-bold" : "bg-card"
                }`}
                onClick={() => {
                  setProductCondition("intact");
                  setRestockToInventory(true);
                }}
              >
                <RadioGroupItem value="intact" id="r_intact" />
                <Label htmlFor="r_intact" className="cursor-pointer">
                  المنتج سليم وقابل للبيع ✅
                </Label>
              </div>

              <div
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${
                  productCondition === "damaged" ? "border-destructive bg-destructive/10 font-bold" : "bg-card"
                }`}
                onClick={() => {
                  setProductCondition("damaged");
                  setRestockToInventory(false);
                }}
              >
                <RadioGroupItem value="damaged" id="r_damaged" />
                <Label htmlFor="r_damaged" className="cursor-pointer">
                  المنتج تالف / معيب ❌
                </Label>
              </div>
            </RadioGroup>

            {productCondition === "intact" && (
              <div className="flex items-center gap-2 p-2 bg-muted/20 rounded border text-xs">
                <Checkbox
                  id="chk_restock"
                  checked={restockToInventory}
                  onCheckedChange={(checked) => setRestockToInventory(Boolean(checked))}
                />
                <Label htmlFor="chk_restock" className="cursor-pointer font-medium text-foreground">
                  إعادة الأصناف تلقائياً إلى كمية المخزون في المستودع
                </Label>
              </div>
            )}
          </div>

          {/* 2. Shipping Fee Liability */}
          <div className="space-y-2">
            <Label className="text-sm font-bold flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-warning" />
              2. من يتحمل مصاريف الشحن ({shipment.shippingCost || 0} ج.م)؟
            </Label>
            <RadioGroup
              value={shippingPayer}
              onValueChange={(v: "store" | "customer" | "carrier") => setShippingPayer(v)}
              className="space-y-1.5"
            >
              <div
                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${
                  shippingPayer === "store" ? "border-primary bg-primary/10 font-bold" : "bg-card"
                }`}
                onClick={() => setShippingPayer("store")}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="store" id="p_store" />
                  <Label htmlFor="p_store" className="cursor-pointer flex items-center gap-1.5">
                    <Store className="h-4 w-4 text-primary" />
                    المتجر يتحملها (تسجل كمصروف نقل)
                  </Label>
                </div>
                <span className="text-xs text-muted-foreground">خسارة تشغيلية</span>
              </div>

              <div
                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${
                  shippingPayer === "customer" ? "border-primary bg-primary/10 font-bold" : "bg-card"
                }`}
                onClick={() => setShippingPayer("customer")}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="customer" id="p_customer" />
                  <Label htmlFor="p_customer" className="cursor-pointer flex items-center gap-1.5">
                    <UserX className="h-4 w-4 text-destructive" />
                    العميل يتحملها (قيد على حسابه)
                  </Label>
                </div>
                <span className="text-xs text-muted-foreground">مطالبة لاحقة</span>
              </div>

              <div
                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${
                  shippingPayer === "carrier" ? "border-primary bg-primary/10 font-bold" : "bg-card"
                }`}
                onClick={() => setShippingPayer("carrier")}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="carrier" id="p_carrier" />
                  <Label htmlFor="p_carrier" className="cursor-pointer flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-warning" />
                    المندوب يتحملها (خصم من كشف حسابه)
                  </Label>
                </div>
                <span className="text-xs text-muted-foreground">بسبب إهمال أو تأخير</span>
              </div>
            </RadioGroup>
          </div>

          {/* 3. Return Reason */}
          <div className="space-y-2">
            <Label className="text-sm font-bold">3. سبب الارتجاع:</Label>
            <div className="flex flex-wrap gap-1.5">
              {quickReasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReturnReason(r)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    returnReason === r
                      ? "bg-primary text-primary-foreground border-primary font-bold"
                      : "bg-muted/40 hover:bg-muted text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Input
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="ملاحظات وتفاصيل إضافية عن المرتجع (اختياري)..."
              className="text-xs mt-2"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmReturn}
            disabled={submitting}
            className="gap-1.5 font-bold"
          >
            <RotateCcw className="h-4 w-4" />
            {submitting ? "جاري المعالجة..." : "تأكيد المرتجع والضبط المالي"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
