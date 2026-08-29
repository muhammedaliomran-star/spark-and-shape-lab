import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { db, type Shipment, type ShipmentCarrier, type ShipmentStatus, type ShippingZone } from "@/lib/store";
import { FileSpreadsheet, Download } from "lucide-react";

const statusFromArabic: Record<string, ShipmentStatus> = {
  "قيد الانتظار": "pending",
  "جاري التجهيز": "processing",
  "تم الشحن": "shipped",
  "تم التوصيل": "delivered",
  "مرتجع": "returned",
  "ملغي": "cancelled",
};

const csvEscape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function CarrierExcelIntegrationModal({
  open,
  onOpenChange,
  carriers,
  zones,
  shipments,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carriers: ShipmentCarrier[];
  zones: ShippingZone[];
  shipments: Shipment[];
  onRefresh?: () => Promise<void> | void;
}) {
  const [exportCarrier, setExportCarrier] = useState("all");
  const [pasted, setPasted] = useState("");
  const [importing, setImporting] = useState(false);

  const carrierById = useMemo(() => new Map(carriers.map((c) => [c.id, c])), [carriers]);
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const byTracking = useMemo(() => {
    const map = new Map<string, Shipment>();
    shipments.forEach((s) => { if (s.trackingNumber) map.set(String(s.trackingNumber).trim().toLowerCase(), s); });
    return map;
  }, [shipments]);

  const exportCsv = () => {
    const rows = shipments.filter((s) => exportCarrier === "all" || s.carrierId === exportCarrier);
    if (rows.length === 0) return toast.error("لا توجد شحنات للتصدير");
    const header = ["tracking_number", "recipient_name", "recipient_phone", "address", "zone", "carrier", "cod_amount", "shipping_cost", "status"];
    const body = rows.map((s) => [
      s.trackingNumber, s.recipientName, s.recipientPhone, s.deliveryAddress,
      s.zoneId ? zoneById.get(s.zoneId)?.name : "",
      s.carrierId ? carrierById.get(s.carrierId)?.name : "",
      Number(s.codAmount || 0), Number(s.shippingCost || 0), s.status,
    ].map(csvEscape).join(","));
    const csv = "\uFEFF" + [header.join(","), ...body].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير ${rows.length} شحنة`);
  };

  const importStatuses = async () => {
    const lines = pasted.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return toast.error("الصق بيانات أولاً");
    setImporting(true);
    let ok = 0;
    let failed = 0;
    for (const line of lines) {
      const [rawCode, rawStatus] = line.split(/[,;\t]/).map((p) => p?.trim());
      const shipment = rawCode ? byTracking.get(rawCode.toLowerCase()) : undefined;
      const status = rawStatus ? (statusFromArabic[rawStatus] ?? (rawStatus as ShipmentStatus)) : undefined;
      if (!shipment || !status) { failed++; continue; }
      try {
        await db.updateShipmentStatus(shipment.id, status);
        ok++;
      } catch { failed++; }
    }
    setImporting(false);
    setPasted("");
    await onRefresh?.();
    toast[failed ? "warning" : "success"](`تم تحديث ${ok} شحنة${failed ? ` — فشل ${failed}` : ""}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> تكامل إكسيل شركات الشحن
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="export">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">تصدير</TabsTrigger>
            <TabsTrigger value="import">استيراد الحالات</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>شركة الشحن</Label>
              <Select value={exportCarrier} onValueChange={setExportCarrier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الشركات</SelectItem>
                  {carriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={exportCsv} className="w-full">
              <Download className="ml-2 h-4 w-4" /> تصدير ملف CSV
            </Button>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>الصق الأعمدة: رقم التتبع, الحالة</Label>
              <Textarea
                rows={8}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={"TRK-1001, تم التوصيل\nTRK-1002, مرتجع"}
              />
            </div>
            <Button onClick={() => void importStatuses()} disabled={importing} className="w-full">
              {importing ? "جارٍ التحديث..." : "تحديث الحالات"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default CarrierExcelIntegrationModal;
