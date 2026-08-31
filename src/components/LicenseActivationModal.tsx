import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldCheck, Sparkles, MessageSquare, PhoneCall } from "lucide-react";
import { activateLicenseKey, type LicenseRecord } from "@/lib/licensing";
import { toast } from "sonner";

interface LicenseActivationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivated?: (license: LicenseRecord) => void;
}

export function LicenseActivationModal({
  open,
  onOpenChange,
  onActivated,
}: LicenseActivationModalProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [shopName, setShopName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleActivate = () => {
    if (!licenseKey.trim()) {
      toast.error("يرجى إدخال مفتاح التفعيل أولاً");
      return;
    }

    setBusy(true);
    try {
      const res = activateLicenseKey(licenseKey, {
        name: clientName,
        phone: clientPhone,
        shopName,
      });

      if (res.success && res.license) {
        toast.success(res.message);
        onActivated?.(res.license);
        onOpenChange(false);
        setLicenseKey("");
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "فشل تفعيل الترخيص");
    } finally {
      setBusy(false);
    }
  };

  const handleContactSupport = () => {
    const text = encodeURIComponent(
      "مرحباً فريق سِجلّي، أرغب في شراء أو تجديد ترخيص البرنامج وتفعيل النسخة الرسمية."
    );
    window.open(`https://wa.me/201000000000?text=${text}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 text-right" dir="rtl">
        <DialogHeader className="text-right space-y-1">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              تفعيل ترخيص سِجلّي التجاري
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            أدخل مفتاح الترخيص الرسمي (License Key) لتفعيل كافة إمكانيات وموديولات النظام مدى الحياة أو حسب باقتك.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 my-2 text-right">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              مفتاح التفعيل (License Key):
            </Label>
            <Input
              placeholder="مثال: SEG-PRO-9842-7719-B31A"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              className="h-11 rounded-2xl font-mono text-center text-sm font-black tracking-wider uppercase bg-foreground/[0.02]"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">اسم المنشأة / المحل:</Label>
              <Input
                placeholder="اسم محلك"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">هاتف المسؤول:</Label>
              <Input
                placeholder="010xxxxxxx"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="h-9 rounded-xl text-xs font-mono text-right"
              />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-primary/[0.04] border border-primary/20 text-xs space-y-1">
            <div className="font-bold text-primary flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              مزايا التفعيل الرسمي:
            </div>
            <div className="text-muted-foreground text-[11px] leading-relaxed">
              فتح كافة موديولات نقاط البيع السريعة، المخزن المتعدد، نظام الأقساط، طباعة الاستيكرات، ورسائل الواتساب بدون قيود.
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleContactSupport}
            className="rounded-2xl text-xs h-10 gap-1.5 text-muted-foreground hover:text-[#25D366]"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
            طلب شراء ترخيص
          </Button>

          <Button
            type="button"
            disabled={busy}
            onClick={handleActivate}
            className="rounded-2xl gap-2 text-xs font-bold h-10 px-6 bg-primary text-black hover:bg-primary/90"
          >
            <ShieldCheck className="w-4 h-4" />
            تفعيل الآن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
