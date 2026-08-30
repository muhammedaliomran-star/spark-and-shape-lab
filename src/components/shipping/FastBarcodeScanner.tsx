import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { db, Shipment, ShipmentCarrier, useDB } from "@/lib/store";
import { printCarrierManifest } from "@/lib/shipping-docs";
import { toast } from "sonner";
import {
  Scan,
  Camera,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Truck,
  RotateCcw,
  PackageCheck,
  Printer,
  Trash2,
  Sparkles,
} from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export type ScanActionType = "dispatch" | "delivered" | "return";

interface FastBarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carriers: ShipmentCarrier[];
  shipments?: Shipment[];
  onRefresh?: () => Promise<void>;
}

// Sound synthesizer using Web Audio API for fast zero-latency feedback
function playSound(type: "success" | "error" | "warn") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "warn") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(349.23, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // ignore audio failure
  }
}

export function FastBarcodeScanner({
  open,
  onOpenChange,
  carriers,
  onRefresh,
}: FastBarcodeScannerProps) {
  const { shipments } = useDB();
  const [actionMode, setActionMode] = useState<ScanActionType>("dispatch");
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>(carriers[0]?.id || "");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [inputCode, setInputCode] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [scannedList, setScannedList] = useState<Array<{ shipment: Shipment; action: string; time: string }>>([]);
  const [lastScanned, setLastScanned] = useState<Shipment | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "warn" } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const zxingControlsRef = useRef<any>(null);

  // Auto focus input
  useEffect(() => {
    if (open && !cameraActive) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, cameraActive, actionMode]);

  // Set default carrier
  useEffect(() => {
    if (carriers.length > 0 && !selectedCarrierId) {
      setSelectedCarrierId(carriers[0].id);
    }
  }, [carriers, selectedCarrierId]);

  // Camera scanner handling
  useEffect(() => {
    if (!open || !cameraActive || !videoRef.current) {
      if (zxingControlsRef.current) {
        zxingControlsRef.current.stop();
        zxingControlsRef.current = null;
      }
      return;
    }

    const codeReader = new BrowserMultiFormatReader();
    codeReader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result) {
          const text = result.getText();
          if (text) {
            handleScanCode(text);
          }
        }
      })
      .then((controls) => {
        zxingControlsRef.current = controls;
      })
      .catch((e) => {
        console.error("Camera scanner error:", e);
        toast.error("تعذر تشغيل الكاميرا للمسح");
        setCameraActive(false);
      });

    return () => {
      if (zxingControlsRef.current) {
        zxingControlsRef.current.stop();
        zxingControlsRef.current = null;
      }
    };
  }, [open, cameraActive]);

  const triggerFeedback = (type: "success" | "error" | "warn", text: string) => {
    setMessage({ text, type });
    if (soundEnabled) playSound(type);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(type === "success" ? [80] : [150, 80, 150]);
    }
  };

  const handleScanCode = useCallback(
    async (code: string) => {
      const clean = code.trim();
      if (!clean) return;

      // Find matching shipment by tracking number, invoice ID or ID
      const target = shipments.find(
        (s) =>
          (s.trackingNumber && s.trackingNumber.trim().toLowerCase() === clean.toLowerCase()) ||
          s.id.toLowerCase() === clean.toLowerCase() ||
          s.id.toLowerCase().startsWith(clean.toLowerCase()) ||
          (s.invoiceId && s.invoiceId.toLowerCase() === clean.toLowerCase())
      );

      if (!target) {
        triggerFeedback("error", `لم يتم العثور على شحنة تطابق الكود: ${clean}`);
        return;
      }

      try {
        if (actionMode === "dispatch") {
          // Assign to carrier and update status to shipped/processing
          await db.updateShipment(target.id, {
            carrierId: selectedCarrierId || target.carrierId || undefined,
          });
          await db.updateShipmentStatus(target.id, "shipped", "تم التسليم للمندوب عبر الماسح السريع");

          const updatedShipment = { ...target, status: "shipped" as const, carrierId: selectedCarrierId || target.carrierId };
          setLastScanned(updatedShipment);
          setScannedList((prev) => [
            { shipment: updatedShipment, action: "تسليم للمندوب", time: new Date().toLocaleTimeString("ar-EG") },
            ...prev,
          ]);
          triggerFeedback("success", `✅ تم تسليم الشحنة #${clean} للمندوب`);
        } else if (actionMode === "delivered") {
          await db.updateShipmentStatus(target.id, "delivered", "تم التسليم عبر الماسح السريع");
          const updatedShipment = { ...target, status: "delivered" as const };
          setLastScanned(updatedShipment);
          setScannedList((prev) => [
            { shipment: updatedShipment, action: "تم التوصيل", time: new Date().toLocaleTimeString("ar-EG") },
            ...prev,
          ]);
          triggerFeedback("success", `✅ تم تحديث الشحنة #${clean} إلى (تم التسليم)`);
        } else if (actionMode === "return") {
          await db.updateShipmentStatus(target.id, "returned", "مرتجع عبر الفرز السريع بالباركود");
          const updatedShipment = { ...target, status: "returned" as const };
          setLastScanned(updatedShipment);
          setScannedList((prev) => [
            { shipment: updatedShipment, action: "مرتجع سريع", time: new Date().toLocaleTimeString("ar-EG") },
            ...prev,
          ]);
          triggerFeedback("warn", `🔄 تم تسجيل الشحنة #${clean} كمرتجع`);
        }

        if (onRefresh) await onRefresh();
      } catch (err: any) {
        triggerFeedback("error", err.message || "حدث خطأ أثناء تحديث حالة الشحنة");
      }
    },
    [shipments, actionMode, selectedCarrierId, soundEnabled, onRefresh]
  );

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode) return;
    handleScanCode(inputCode);
    setInputCode("");
  };

  const handlePrintBatchManifest = () => {
    if (scannedList.length === 0) {
      toast.error("لا توجد شحنات ممسوحة في هذه الجلسة للطباعة");
      return;
    }
    const carrier = carriers.find((c) => c.id === selectedCarrierId);
    printCarrierManifest({
      carrierName: carrier?.name || "المندوب",
      dateLabel: new Date().toLocaleDateString("ar-EG"),
      rows: scannedList.map((item) => ({
        tracking: item.shipment.trackingNumber || item.shipment.id.slice(0, 8),
        recipient: item.shipment.recipientName || "عميل",
        phone: item.shipment.recipientPhone || "-",
        address: item.shipment.deliveryAddress || "-",
        cod: item.shipment.codAmount || 0,
        status: item.action,
      })),
    });
  };

  const totalCodScanned = scannedList.reduce((sum, item) => sum + (item.shipment.codAmount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Scan className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">الماسح السريع للشحن والتسليم</DialogTitle>
                <DialogDescription>
                  امسح بوالص الشحنات وراء بعض بمسدس الليزر أو كاميرا الموبايل للتسليم والفرز الفوري.
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "كتم الصوت" : "تشغيل الصوت"}
            >
              {soundEnabled ? <Volume2 className="h-5 w-5 text-success" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />}
            </Button>
          </div>
        </DialogHeader>

        {/* Action Mode Switcher */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Button
            type="button"
            variant={actionMode === "dispatch" ? "default" : "outline"}
            className="flex items-center justify-center gap-2 h-12 text-sm font-bold"
            onClick={() => setActionMode("dispatch")}
          >
            <Truck className="h-4 w-4" />
            تسليم للمندوب
          </Button>

          <Button
            type="button"
            variant={actionMode === "delivered" ? "default" : "outline"}
            className="flex items-center justify-center gap-2 h-12 text-sm font-bold"
            onClick={() => setActionMode("delivered")}
          >
            <PackageCheck className="h-4 w-4" />
            تأكيد التوصيل (ناجح)
          </Button>

          <Button
            type="button"
            variant={actionMode === "return" ? "default" : "outline"}
            className="flex items-center justify-center gap-2 h-12 text-sm font-bold"
            onClick={() => setActionMode("return")}
          >
            <RotateCcw className="h-4 w-4" />
            فرز المرتجع السريع
          </Button>
        </div>

        {/* Dispatch Carrier Selector */}
        {actionMode === "dispatch" && (
          <div className="bg-muted/40 p-3 rounded-lg border flex flex-col sm:flex-row items-center gap-3">
            <span className="text-sm font-medium shrink-0">المندوب / شركة الشحن المستلمة:</span>
            <Select value={selectedCarrierId} onValueChange={setSelectedCarrierId}>
              <SelectTrigger className="flex-1 bg-background font-bold">
                <SelectValue placeholder="اختر المندوب..." />
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
        )}

        {/* Scan Input & Camera Toggle */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <form onSubmit={handleManualSubmit} className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="امسح الباركود الآن بمسدس الليزر أو اكتب رقم البوليصة..."
                className="pr-10 text-lg font-mono tracking-wider h-12 border-primary/40 focus-visible:ring-primary"
                autoFocus
              />
              <Keyboard className="absolute right-3 top-3.5 h-5 w-5 text-muted-foreground" />
            </form>

            <Button
              type="button"
              variant={cameraActive ? "destructive" : "outline"}
              className="h-12 px-4 gap-2"
              onClick={() => setCameraActive(!cameraActive)}
            >
              <Camera className="h-5 w-5" />
              {cameraActive ? "إغلاق الكاميرا" : "كاميرا الموبايل"}
            </Button>
          </div>

          {/* Camera Viewport */}
          {cameraActive && (
            <div className="relative rounded-xl overflow-hidden border-2 border-primary bg-black aspect-video max-h-56 flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-2 border-dashed border-red-500/70 m-6 rounded-lg pointer-events-none animate-pulse" />
              <p className="absolute bottom-2 text-xs text-white/90 bg-black/60 px-3 py-1 rounded-full">
                وجه الكاميرا نحو الباركود
              </p>
            </div>
          )}

          {/* Feedback Banner */}
          {message && (
            <div
              className={`p-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                message.type === "success"
                  ? "bg-success/15 text-success border border-success/30"
                  : message.type === "warn"
                  ? "bg-warning/15 text-warning border border-warning/30"
                  : "bg-destructive/15 text-destructive border border-destructive/30"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}
        </div>

        {/* Live Batch Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-card border text-center">
            <span className="text-xs text-muted-foreground">عدد الشحنات الممسوحة</span>
            <p className="text-2xl font-black text-primary mt-1">{scannedList.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-card border text-center">
            <span className="text-xs text-muted-foreground">إجمالي مبالغ COD</span>
            <p className="text-2xl font-black text-foreground mt-1">
              {totalCodScanned.toLocaleString("ar-EG")} <span className="text-xs font-normal">ج.م</span>
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 p-2 rounded-xl bg-card border flex items-center justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-full gap-2 font-bold"
              onClick={handlePrintBatchManifest}
              disabled={scannedList.length === 0}
            >
              <Printer className="h-4 w-4" />
              طباعة مانيفست الدفعة
            </Button>
          </div>
        </div>

        {/* Scanned List History */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              سجل الشحنات في هذه الجلسة ({scannedList.length})
            </span>
            {scannedList.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive h-7 gap-1"
                onClick={() => setScannedList([])}
              >
                <Trash2 className="h-3 w-3" />
                تفريغ السجل
              </Button>
            )}
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 border rounded-lg p-2 bg-muted/20">
            {scannedList.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                لم يتم مسح أي شحنات حتى الآن. ابدأ بالمسح بالليزر أو الكاميرا.
              </div>
            ) : (
              scannedList.map((item, idx) => (
                <div
                  key={`${item.shipment.id}-${idx}`}
                  className="flex items-center justify-between p-2 rounded bg-background border text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">
                      #{item.shipment.trackingNumber || item.shipment.id.slice(0, 8)}
                    </span>
                    <span className="font-medium text-foreground">{item.shipment.recipientName || "عميل"}</span>
                    <span className="text-muted-foreground">({item.shipment.recipientPhone || "-"})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {item.action}
                    </Badge>
                    <span className="font-bold">{item.shipment.codAmount || 0} ج.م</span>
                    <span className="text-muted-foreground text-[10px]">{item.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
