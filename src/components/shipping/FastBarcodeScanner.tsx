import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { db, type Shipment, type ShipmentCarrier, type ShipmentStatus } from "@/lib/store";
import { CheckCircle2, XCircle, QrCode } from "lucide-react";

const statusOptions: Array<{ value: ShipmentStatus; label: string }> = [
  { value: "processing", label: "جاري التجهيز" },
  { value: "shipped", label: "تم الشحن" },
  { value: "delivered", label: "تم التوصيل" },
  { value: "returned", label: "مرتجع" },
];

type LogEntry = { code: string; ok: boolean; message: string; at: string };

export function FastBarcodeScanner({
  open,
  onOpenChange,
  carriers,
  shipments,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carriers: ShipmentCarrier[];
  shipments: Shipment[];
  onRefresh?: () => Promise<void> | void;
}) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<ShipmentStatus>("shipped");
  const [carrierId, setCarrierId] = useState<string>("none");
  const [log, setLog] = useState<LogEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
    else setLog([]);
  }, [open]);

  const byTracking = useMemo(() => {
    const map = new Map<string, Shipment>();
    shipments.forEach((s) => {
      if (s.trackingNumber) map.set(String(s.trackingNumber).trim().toLowerCase(), s);
      map.set(s.id.toLowerCase(), s);
    });
    return map;
  }, [shipments]);

  const pushLog = (entry: LogEntry) => setLog((prev) => [entry, ...prev].slice(0, 40));

  const handleScan = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setCode("");
    const shipment = byTracking.get(value.toLowerCase());
    const at = new Date().toLocaleTimeString("en-US");
    if (!shipment) {
      pushLog({ code: value, ok: false, message: "لا توجد شحنة بهذا الرقم", at });
      toast.error(`غير موجود: ${value}`);
      return;
    }
    try {
      await db.updateShipmentStatus(shipment.id, status);
      if (carrierId !== "none" && shipment.carrierId !== carrierId) {
        await db.bulkAssignCarrier([shipment.id], carrierId);
      }
      pushLog({ code: value, ok: true, message: `تم التحديث إلى ${statusOptions.find((o) => o.value === status)?.label}`, at });
      toast.success(`تم تحديث ${value}`);
      await onRefresh?.();
    } catch (err) {
      pushLog({ code: value, ok: false, message: err instanceof Error ? err.message : "فشل التحديث", at });
      toast.error("فشل تحديث الشحنة");
    }
  };

  const successCount = log.filter((l) => l.ok).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> المسح السريع للشحنات
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>الحالة بعد المسح</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ShipmentStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>إسناد شركة شحن (اختياري)</Label>
              <Select value={carrierId} onValueChange={setCarrierId}>
                <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون تغيير</SelectItem>
                  {carriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>رقم التتبع / الباركود</Label>
            <Input
              ref={inputRef}
              value={code}
              placeholder="امسح الباركود أو اكتب رقم التتبع ثم Enter"
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleScan(code);
                }
              }}
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>سجل المسح</span>
              <span>ناجح: {successCount} / {log.length}</span>
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {log.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لم يتم مسح أي شحنة بعد</p>}
              {log.map((entry, i) => (
                <div key={`${entry.code}-${i}`} className="flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2 text-sm">
                  {entry.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                  <span className="font-mono">{entry.code}</span>
                  <span className="text-muted-foreground">— {entry.message}</span>
                  <span className="ms-auto text-xs text-muted-foreground">{entry.at}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FastBarcodeScanner;
