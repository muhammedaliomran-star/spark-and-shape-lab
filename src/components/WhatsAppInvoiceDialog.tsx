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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Copy, Sparkles, Check, Phone } from "lucide-react";
import {
  formatWhatsAppPhone,
  generateWhatsAppLink,
} from "@/lib/whatsapp";
import { fmt, type Invoice, type Customer, useShopSettings } from "@/lib/store";
import { toast } from "sonner";

interface WhatsAppInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  customer: Customer | null;
  type?: "receipt" | "reminder" | "general";
}

export function WhatsAppInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  customer,
  type = "receipt",
}: WhatsAppInvoiceDialogProps) {
  const { settings: shop } = useShopSettings();
  const [activeTab, setActiveTab] = useState<string>(type);
  const [copied, setCopied] = useState(false);

  if (!invoice || !customer) return null;

  const phone = customer.phone || "";
  const remaining = Math.max(0, invoice.total - invoice.paid);
  const isCash = invoice.downPayment >= invoice.total || invoice.monthlyInstallment === 0;
  const storeName = shop.shopName || "محلنا";
  const currency = shop.currency || "ج.م";

  const receiptTemplate = `مرحباً بك يا ${customer.name} 🌸
شكراً لتعاملك مع *${storeName}*!

🧾 *تفاصيل الفاتورة:*
• رقم الفاتورة: #${invoice.id.slice(-5)}
• الإجمالي: ${fmt(invoice.total)} ${currency}
• المدفوع: ${fmt(invoice.paid)} ${currency}
${remaining > 0 ? `• المتبقي: ${fmt(remaining)} ${currency}` : "• الحالة: مسددة بالكامل بنجاح ✓"}
${invoice.notes ? `• تفاصيل الأصناف: ${invoice.notes}` : ""}

نسعد دائماً بخدمتكم ورضاكم غايتنا! 🌟`;

  const reminderTemplate = `عناية العميل المحترم ${customer.name} ⏳
تحية طيبة من *${storeName}*،

نود تذكيركم بموعد استحقاق القسط الشهري الخاص بالفاتورة #${invoice.id.slice(-5)}:
• قيمة القسط الشهري: ${fmt(invoice.monthlyInstallment)} ${currency}
• تاريخ الاستحقاق: ${invoice.firstDueDate || "هذا الشهر"}
• إجمالي المتبقي على الفاتورة: ${fmt(remaining)} ${currency}

شاكرين لسيادتكم حسن تعاونكم وحرصكم الدائم على السداد في الموعد 🤝`;

  const generalTemplate = `أهلاً بك يا ${customer.name}،
تحية طيبة من *${storeName}*!

نحن في خدمتكم دائماً لأي استفسار بخصوص فواتيركم ومشترياتكم.
هاتف المتجر: ${shop.phone || "—"}`;

  const currentMessage =
    activeTab === "receipt"
      ? receiptTemplate
      : activeTab === "reminder"
      ? reminderTemplate
      : generalTemplate;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentMessage);
      setCopied(true);
      toast.success("تم نسخ نص الرسالة للحافظة ✓");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذر النسخ");
    }
  };

  const handleSendWhatsApp = () => {
    if (!phone) {
      toast.error("رقم هاتف العميل غير مسجل");
      return;
    }
    const link = generateWhatsAppLink(phone, currentMessage);
    window.open(link, "_blank");
    toast.success("تم فتح محادثة واتساب مع العميل ✓");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-6">
        <DialogHeader className="text-right space-y-1.5">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1 font-mono text-xs">
              <Phone className="w-3 h-3 text-success" />
              {phone || "بدون هاتف"}
            </Badge>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#25D366]" />
              إرسال رسالة واتساب للعميل
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            إرسال إيصال الشراء أو تذكير بموعد القسط مباشرة عبر محادثة واتساب بنقرة واحدة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2 text-right">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 h-10 rounded-2xl bg-foreground/[0.04] p-1">
              <TabsTrigger value="receipt" className="rounded-xl text-xs font-bold">
                إيصال الشراء
              </TabsTrigger>
              <TabsTrigger
                value="reminder"
                disabled={isCash || remaining <= 0}
                className="rounded-xl text-xs font-bold"
              >
                تذكير بالقسط
              </TabsTrigger>
              <TabsTrigger value="general" className="rounded-xl text-xs font-bold">
                تحية عامة
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground">
              معاينة نص الرسالة المنسقة:
            </Label>
            <Textarea
              readOnly
              rows={8}
              value={currentMessage}
              className="resize-none rounded-2xl bg-foreground/[0.02] border-foreground/10 text-xs font-sans leading-relaxed text-right p-3.5"
            />
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            className="rounded-2xl gap-1.5 text-xs h-10 px-4"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            {copied ? "تم النسخ" : "نسخ النص"}
          </Button>

          <Button
            type="button"
            onClick={handleSendWhatsApp}
            className="rounded-2xl gap-2 text-xs font-bold h-10 px-6 bg-[#25D366] hover:bg-[#20ba59] text-white"
          >
            <Send className="w-4 h-4" />
            فتح وإرسال في واتساب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
