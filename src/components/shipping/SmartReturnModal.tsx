import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { db, type Shipment } from "@/lib/store";
import { Undo2 } from "lucide-react";

export function SmartReturnModal({
  open,
  onOpenChange,
  shipment,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: Shipment | null;
  onSuccess?: () => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setRestock(true);
    }
  }, [open]);

  const submit = async () => {
    if (!shipment) return;
    if (!reason.trim()) return toast.error("سبب المرتجع مطلوب");
    setSaving(true);
    try {
      await db.updateShipmentStatus(shipment.id, "returned", reason.trim());
      if (restock && shipment.invoiceId) {
        await db.addReturn({
          invoiceId: shipment.invoiceId,
          type: "sale",
          totalAmount: Number(shipment.codAmount || 0),
          reason: reason.trim(),
          notes: `مرتجع شحنة ${shipment.trackingNumber ?? shipment.id}`,
          items: [],
        });
      }
      toast.success("تم تسجيل المرتجع");
      await onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تسجيل المرتجع");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5" /> مرتجع ذكي
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {shipment && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">رقم التتبع</span><span className="font-mono">{shipment.trackingNumber ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">المستلم</span><span>{shipment.recipientName ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">مبلغ التحصيل</span><span>{Number(shipment.codAmount || 0).toLocaleString("en-US")} ج.م</span></div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>سبب المرتجع</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="رفض الاستلام، عنوان خاطئ، ..." />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={restock} onCheckedChange={(v) => setRestock(Boolean(v))} />
            إعادة المنتجات للمخزون وتسجيل مرتجع على الفاتورة
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={saving || !shipment}>{saving ? "جارٍ الحفظ..." : "تأكيد المرتجع"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SmartReturnModal;
