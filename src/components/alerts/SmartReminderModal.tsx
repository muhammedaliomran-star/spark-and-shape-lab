import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Customer, Invoice, fmt, useShopSettings } from "@/lib/store";
import { generateSmartReminderText, SmartReminderTone } from "@/lib/collection-docs";
import { MessageSquare, Send, Copy, Sparkles, Check, QrCode, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toArabicDigits } from "@/lib/arabic-digits";

interface SmartReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  customer: Customer | null;
  daysLate: number;
  totalBalance: number;
  promiseDate?: string | null;
}

const PAYMENT_CHANNELS_KEY = "segilly:alerts:payment_channels";

interface PaymentChannels {
  instaPay: string;
  vodafoneCash: string;
}

function getStoredChannels(): PaymentChannels {
  try {
    return JSON.parse(localStorage.getItem(PAYMENT_CHANNELS_KEY) || '{"instaPay":"","vodafoneCash":""}');
  } catch {
    return { instaPay: "", vodafoneCash: "" };
  }
}

export function SmartReminderModal({
  open,
  onOpenChange,
  invoice,
  customer,
  daysLate,
  totalBalance,
  promiseDate,
}: SmartReminderModalProps) {
  const { settings } = useShopSettings();
  const [tone, setTone] = useState<SmartReminderTone>("friendly");
  const [channels, setChannels] = useState<PaymentChannels>(() => getStoredChannels());
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [customText, setCustomText] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (open && invoice && customer) {
      const remaining = invoice.total - invoice.paid;
      const dueAmount = Math.min(invoice.monthlyInstallment || remaining, remaining);
      const generated = generateSmartReminderText({
        tone,
        customerName: customer.name,
        amount: dueAmount,
        totalBalance,
        daysLate,
        invoiceNo: invoice.invoiceNumber || invoice.id.slice(0, 6),
        shopName: settings.shopName || "سِجلّي",
        paymentChannels: {
          instaPay: channels.instaPay || settings.phone || undefined,
          vodafoneCash: channels.vodafoneCash || settings.phone || undefined,
        },
        promiseDate: promiseDate || undefined,
      });
      setCustomText(generated);
    }
  }, [open, invoice, customer, tone, channels, settings, daysLate, totalBalance, promiseDate]);

  if (!invoice || !customer) return null;

  const tonesList: Array<{
    id: SmartReminderTone;
    label: string;
    sub: string;
    color: string;
    border: string;
  }> = [
    {
      id: "friendly",
      label: "🌿 تذكير ودي",
      sub: "تذكير لطيف للأقساط المستحقة حديثاً",
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/30",
    },
    {
      id: "formal",
      label: "📜 مطالبة رسمية",
      sub: "نص احترافي للمتأخرات المتوسطة",
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      border: "border-amber-500/30",
    },
    {
      id: "final_warning",
      label: "🚨 إنذار نهائي",
      sub: "مهلة 7 أيام وتلويح بالإجراءات القانونية",
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      border: "border-rose-500/30",
    },
    {
      id: "promise_reminder",
      label: "🤝 تذكير بوعد السداد",
      sub: "متابعة الموعد المتفق عليه مع العميل",
      color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      border: "border-sky-500/30",
    },
    {
      id: "instant_pay",
      label: "⚡ دفع فوري (إنستاباي/كاش)",
      sub: "دمج حسابات الدفع السريع بالرسالة",
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      border: "border-purple-500/30",
    },
  ];

  const handleSaveChannels = () => {
    localStorage.setItem(PAYMENT_CHANNELS_KEY, JSON.stringify(channels));
    setShowChannelSettings(false);
    toast.success("تم حفظ بيانات الدفع السريع");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    toast.success("تم نسخ نص الرسالة للحافظة");
  };

  const handleSendWhatsApp = () => {
    if (!customer.phone) {
      toast.error("لا يوجد رقم هاتف مسجل لهذا العميل");
      return;
    }
    const phone = customer.phone.replace(/\D/g, "").replace(/^0/, "20");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(toArabicDigits(customText))}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="text-right">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="w-5 h-5 text-amber-500" />
              منشئ الرسائل والتذكيرات الذكية
            </DialogTitle>
            <button
              type="button"
              onClick={() => setShowChannelSettings(!showChannelSettings)}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <Smartphone className="w-3.5 h-3.5" />
              {showChannelSettings ? "إخفاء قنوات الدفع" : "إعدادات إنستاباي والمحفظة"}
            </button>
          </div>
          <DialogDescription className="text-right">
            توليد رسالة مخصصة للعميل <b>{customer.name}</b> مع إمكانية التعديل قبل الإرسال.
          </DialogDescription>
        </DialogHeader>

        {/* Quick Channel settings accordion */}
        {showChannelSettings && (
          <div className="p-3.5 bg-muted/50 border rounded-xl space-y-2.5 text-right">
            <div className="text-xs font-bold text-foreground">بيانات الدفع السريع للرسائل:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">معرّف إنستاباي (InstaPay IPA / رقم):</Label>
                <Input
                  value={channels.instaPay}
                  onChange={(e) => setChannels({ ...channels, instaPay: e.target.value })}
                  placeholder="name@instapay أو 010xxxx"
                  className="text-right text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">رقم فودافون / أورنج كاش:</Label>
                <Input
                  value={channels.vodafoneCash}
                  onChange={(e) => setChannels({ ...channels, vodafoneCash: e.target.value })}
                  placeholder="010xxxxxxxx"
                  className="text-right text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveChannels} className="text-xs h-7">
                حفظ البيانات
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3.5 pt-1">
          {/* Tone Selector */}
          <div className="space-y-1.5 text-right">
            <Label className="text-xs font-bold text-muted-foreground">اختر نبرة التذكير المناسبة:</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {tonesList.map((t) => {
                const isSelected = tone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTone(t.id);
                      setIsEditing(false);
                    }}
                    className={cn(
                      "p-2 rounded-xl border text-right transition-all flex flex-col justify-between",
                      t.border,
                      t.color,
                      isSelected ? "ring-2 ring-primary ring-offset-1 font-bold shadow-xs scale-[1.01]" : "opacity-70 hover:opacity-100"
                    )}
                  >
                    <span className="text-xs font-bold">{t.label}</span>
                    <span className="text-[10px] opacity-75 mt-0.5">{t.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message preview / edit box */}
          <div className="space-y-1.5 text-right">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-muted-foreground">نص الرسالة المجهز:</Label>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-[11px] text-primary hover:underline"
              >
                {isEditing ? "معاينة عادية" : "تعديل النص يدوياً"}
              </button>
            </div>

            <Textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={6}
              className="text-right leading-relaxed bg-card/70 font-sans text-xs sm:text-sm border-2 border-primary/20 focus:border-primary"
              dir="rtl"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row-reverse items-center justify-between gap-2 pt-2 border-t mt-2">
          <div className="flex gap-2">
            <Button
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={handleSendWhatsApp}
            >
              <Send className="w-4 h-4" /> فتح وإرسال واتساب
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={handleCopy}>
              <Copy className="w-4 h-4" /> نسخ النص
            </Button>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
