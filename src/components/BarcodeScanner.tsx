import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanLine, Camera, Keyboard, X, Loader2, CheckCircle2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { playScanBeep } from "@/lib/barcode";

/**
 * BarcodeScanner — supports:
 *  - USB physical scanners (act as keyboards): focused input field captures input + Enter.
 *  - Device camera: uses @zxing/browser to decode common 1D/2D codes (EAN, UPC, Code128, QR).
 *
 * Auto-detects mobile and starts on camera tab; desktop opens with keyboard tab.
 */
export function BarcodeScanner({
  open,
  onClose,
  onDetected,
  title = "مسح الباركود",
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
}) {
  const isMobile = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const [tab, setTab] = useState<"camera" | "manual">(isMobile ? "camera" : "manual");
  const [manual, setManual] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [starting, setStarting] = useState(false);
  const [cameraErr, setCameraErr] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  // Auto-submit detection: USB scanners type fast (<30ms/char) and end with Enter.
  const lastKeyAt = useRef<number>(0);
  const fastBurstChars = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    setManual("");
    setCameraErr(null);
    if (tab === "manual") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, tab]);

  // Camera lifecycle
  useEffect(() => {
    if (!open || tab !== "camera") return;
    let cancelled = false;
    setStarting(true);
    setCameraErr(null);
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        // Prefer back camera on mobile
        const back = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          back?.deviceId,
          videoRef.current,
          (result, _err, ctrls) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              setFlash(true);
              playScanBeep(true);
              ctrls.stop();
              setTimeout(() => {
                onDetected(text);
                setFlash(false);
              }, 180);
            }
          },
        );
        controlsRef.current = controls;
        if (cancelled) controls.stop();
      } catch (e: any) {
        if (!cancelled) setCameraErr(e?.message ?? "تعذر تشغيل الكاميرا");
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      try { controlsRef.current?.stop(); } catch {}
      controlsRef.current = null;
    };
  }, [open, tab, onDetected]);

  const submitManual = (val?: string) => {
    const v = (val ?? manual).trim();
    if (!v) { toast.error("اكتب أو امسح الكود"); return; }
    playScanBeep(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    onDetected(v);
    setManual("");
    fastBurstChars.current = 0;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-right flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-right text-xs">
            استخدم كاميرا الجهاز أو قارئ USB أو اكتب الكود يدويًا.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTab("camera")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-2 text-xs font-bold transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
              tab === "camera" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
            )}
          >
            <Camera className="w-4 h-4" /> الكاميرا
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-2 text-xs font-bold transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
              tab === "manual" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
            )}
          >
            <Keyboard className="w-4 h-4" /> USB / يدوي
          </button>
        </div>

        {tab === "camera" ? (
          <div className="p-4 space-y-2">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              {/* Frame */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-6 border-2 border-white/40 rounded-2xl">
                  {/* Corner accents */}
                  <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  {/* Scan line */}
                  <div className="absolute inset-x-2 h-0.5 bg-primary shadow-[0_0_12px_var(--primary)] animate-scan-line" />
                </div>
              </div>
              {flash && (
                <div className="absolute inset-0 bg-success/60 flex items-center justify-center animate-[fade-in_0.15s_ease-out]">
                  <CheckCircle2 className="w-16 h-16 text-foreground" />
                </div>
              )}
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-foreground text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> جاري تشغيل الكاميرا...
                </div>
              )}
              {cameraErr && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-danger text-xs p-4 text-center">
                  {cameraErr} — استخدم الإدخال اليدوي.
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              وجّه الكاميرا نحو الباركود حتى يتم التعرف تلقائيًا.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">الكود (امسح بقارئ USB أو اكتب يدويًا)</Label>
              <Input
                ref={inputRef}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  const now = performance.now();
                  const dt = now - lastKeyAt.current;
                  lastKeyAt.current = now;
                  if (e.key.length === 1 && dt < 35) fastBurstChars.current += 1;
                  else if (e.key.length === 1) fastBurstChars.current = 1;
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitManual();
                  }
                }}
                placeholder="..."
                autoFocus
                className="text-lg font-mono text-center"
                dir="ltr"
              />
            </div>
            <Button onClick={() => submitManual()} className="w-full gap-2">
              <ScanLine className="w-4 h-4" /> تأكيد
            </Button>
            <p className="text-[11px] text-muted-foreground text-center inline-flex items-center justify-center gap-1">
              <Zap className="w-3 h-3 text-success" />
              قارئات USB تكتب الكود وتُرسله تلقائيًا — اترك الحقل في وضع التركيز.
            </p>
          </div>
        )}

        <div className="px-4 pb-4">
          <Button variant="ghost" onClick={onClose} className="w-full gap-1.5 text-muted-foreground">
            <X className="w-4 h-4" /> إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
