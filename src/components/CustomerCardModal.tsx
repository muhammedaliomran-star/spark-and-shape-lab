import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, QrCode, Phone, MapPin, Calendar, Check, Star, ShieldCheck } from "lucide-react";
import { fmt, type Customer } from "@/lib/store";
import { getCustomerCode, isoToDDMMYYYY } from "@/lib/customer-utils";
import { useState } from "react";
import { toast } from "sonner";

interface CustomerCardModalProps {
  customer: Customer | null;
  balance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerCardModal({
  customer,
  balance,
  open,
  onOpenChange,
}: CustomerCardModalProps) {
  const [copied, setCopied] = useState(false);

  if (!customer) return null;

  const code = getCustomerCode(customer);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(`تم نسخ كود العميل: ${code}`);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate an SVG QR code or clean URL for WhatsApp/ID
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    `CUST:${code}|NAME:${customer.name}|TEL:${customer.phone}`,
  )}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-6 text-center">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-lg font-bold">
            بطاقة العميل الرقمية
            <QrCode className="w-5 h-5 text-primary" />
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            رمز الاستجابة السريع (QR) والكود التعريفي للعميل.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 my-2 p-5 rounded-2xl bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] border border-border/60 shadow-sm">
          {/* QR image */}
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-neutral-200 inline-block">
            <img
              src={qrUrl}
              alt={`QR Code for ${customer.name}`}
              className="w-36 h-36 object-contain"
              loading="lazy"
            />
          </div>

          {/* Code badge with copy */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="px-3.5 py-1 text-sm font-mono font-bold bg-primary/10 text-primary border-primary/30 tracking-wider"
            >
              {code}
            </Badge>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full"
              onClick={handleCopyCode}
              title="نسخ الكود"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {/* Customer info */}
          <div className="space-y-1 w-full text-center">
            <h3 className="text-base font-bold">{customer.name}</h3>
            <p className="text-xs text-muted-foreground font-mono" dir="ltr">
              {customer.phone}
            </p>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-2 w-full pt-2 border-t border-border/30 text-xs">
            <div className="p-2 rounded-xl bg-background/80 border border-border/30">
              <span className="text-muted-foreground block text-[10px]">المديونية</span>
              <span className="font-extrabold text-danger text-sm">{fmt(balance)} ج.م</span>
            </div>
            <div className="p-2 rounded-xl bg-background/80 border border-border/30">
              <span className="text-muted-foreground block text-[10px]">نوع الحساب</span>
              <span className="font-bold text-foreground">
                {customer.customerType === "cash" ? "فوري (نقدي)" : `أقساط (يوم ${customer.dueDay})`}
              </span>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => onOpenChange(false)}
        >
          إغلاق
        </Button>
      </DialogContent>
    </Dialog>
  );
}
