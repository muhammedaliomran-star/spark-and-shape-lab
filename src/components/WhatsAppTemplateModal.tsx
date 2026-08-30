import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  WHATSAPP_TEMPLATES,
  renderWhatsAppMessage,
  generateWhatsAppLink,
  type WhatsAppTemplateId,
  type WhatsAppTemplateData,
} from "@/lib/whatsapp";

interface WhatsAppTemplateModalProps {
  open: boolean;
  onClose: () => void;
  data: WhatsAppTemplateData;
  initialTemplate?: WhatsAppTemplateId;
}

export function WhatsAppTemplateModal({
  open,
  onClose,
  data,
  initialTemplate = "out_for_delivery",
}: WhatsAppTemplateModalProps) {
  const [templateId, setTemplateId] = useState<WhatsAppTemplateId>(initialTemplate);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const template = useMemo(
    () => WHATSAPP_TEMPLATES.find((t) => t.id === templateId) || WHATSAPP_TEMPLATES[0],
    [templateId],
  );

  useEffect(() => {
    if (open) setTemplateId(initialTemplate);
  }, [open, initialTemplate]);

  useEffect(() => {
    if (!open || !template) return;
    setText(renderWhatsAppMessage(template.defaultTemplate, data));
    setCopied(false);
  }, [open, template, data]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("تم نسخ نص الرسالة");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذر نسخ النص");
    }
  };

  const handleSend = () => {
    const phone = data.customerPhone;
    if (!phone) {
      toast.error("رقم هاتف العميل غير متوفر");
      return;
    }
    window.open(generateWhatsAppLink(phone, text), "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-xl max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600">
            <MessageSquare className="h-5 w-5" />
            <DialogTitle className="text-base font-bold">إرسال رسالة واتساب</DialogTitle>
          </div>
          <DialogDescription>
            {data.customerName || "العميل"} — {data.customerPhone || "بدون رقم"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          {WHATSAPP_TEMPLATES.map((t) => (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={templateId === t.id ? "default" : "outline"}
              className="h-10 text-[11px] font-bold"
              onClick={() => setTemplateId(t.id)}
            >
              {t.name}
            </Button>
          ))}
        </div>

        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>نص الرسالة (قابل للتعديل):</span>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 gap-1 text-xs font-bold">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "تم النسخ" : "نسخ"}
            </Button>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="text-xs leading-relaxed"
          />
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSend} disabled={!data.customerPhone} className="gap-2 font-bold">
            <Send className="h-4 w-4" />
            فتح واتساب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WhatsAppTemplateModal;
