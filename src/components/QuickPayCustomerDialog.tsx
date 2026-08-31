import { useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Banknote,
  CreditCard,
  CheckCircle,
  MessageCircle,
  Receipt,
  Sparkles,
  ArrowDownLeft,
} from "lucide-react";
import { db, fmt, type Customer, type Invoice, type DBState } from "@/lib/store";
import { getCustomerCode } from "@/lib/customer-utils";
import { toArabicDigits } from "@/lib/arabic-digits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuickPayCustomerDialogProps {
  customer: Customer | null;
  invoices: Invoice[];
  balance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickPayCustomerDialog({
  customer,
  invoices,
  balance,
  open,
  onOpenChange,
}: QuickPayCustomerDialogProps) {
  const customerId = customer?.id;

  const openInvoices = useMemo(
    () =>
      !customerId
        ? []
        : invoices
            .filter((i) => i.customerId === customerId && (i.paid || 0) < i.total)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [invoices, customerId],
  );

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("auto");
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive suggested installment amount if available
  const suggestedMonthly = useMemo(() => {
    const activeInv = openInvoices.find((i) => i.monthlyInstallment > 0);
    return activeInv ? activeInv.monthlyInstallment : 0;
  }, [openInvoices]);

  if (!customer) return null;

  const numAmount = Number(amount) || 0;
  const newBalance = Math.max(0, balance - numAmount);

  const handleQuickAmount = (val: number) => {
    setAmount(String(Math.round(val)));
  };

  const handleSubmit = async () => {
    if (!numAmount || numAmount <= 0) {
      toast.error("يرجى إدخال مبلغ دفع صحيح");
      return;
    }

    setIsSubmitting(true);
    try {
      let remainingToAllocate = numAmount;

      if (selectedInvoiceId !== "auto") {
        // Pay specific invoice
        const target = openInvoices.find((i) => i.id === selectedInvoiceId);
        if (target) {
          const invRem = Math.max(0, target.total - target.paid);
          const payAmt = Math.min(remainingToAllocate, invRem);
          await db.recordPayment(target.id, payAmt);
        }
      } else if (openInvoices.length > 0) {
        // Auto distribute across oldest unpaid invoices
        for (const inv of openInvoices) {
          if (remainingToAllocate <= 0) break;
          const invRem = Math.max(0, inv.total - inv.paid);
          if (invRem > 0) {
            const payAmt = Math.min(remainingToAllocate, invRem);
            await db.recordPayment(inv.id, payAmt);
            remainingToAllocate -= payAmt;
          }
        }
      }

      // Record a voucher or note if needed
      await db.addPaymentVoucher({
        customerId: customer.id,
        supplierId: null,
        amount: numAmount,
        type: "receipt",
        paymentMethod:
          paymentMethod === "cash"
            ? "نقدي"
            : paymentMethod === "vodafone"
              ? "فودافون كاش"
              : paymentMethod === "instapay"
                ? "إنستاباي"
                : "تحويل بنكي",
        partyName: customer.name,
        partyPhone: customer.phone,
        description: notes || `تحصيل دفعة نقدية - كود العميل ${getCustomerCode(customer)}`,
        voucherDate: new Date().toISOString().slice(0, 10),
      });

      toast.success(`تم تسجيل دفعة بقيمة ${fmt(numAmount)} ج.م بنجاح`);

      // WhatsApp receipt generation helper
      const waPhone = customer.phone.replace(/^0/, "20");
      const waMessage = `تم استلام دفعة مالية بقيمة ${fmt(numAmount)} ج.م.
شكراً لك يا ${customer.name} على التزامك، متبقي على حسابك: ${fmt(newBalance)} ج.م.
— تحياتنا وتمنياتنا لك بالتوفيق`;

      const shouldSendWa = window.confirm(
        `تم حفظ الدفعة بنجاح! الرصيد المتبقي: ${fmt(newBalance)} ج.م.\n\nهل ترغب في فتح واتساب لإرسال إيصال وتأكيد الاستلام للعميل؟`,
      );

      if (shouldSendWa) {
        window.open(
          `https://wa.me/${waPhone}?text=${encodeURIComponent(toArabicDigits(waMessage))}`,
          "_blank",
        );
      }

      setAmount("");
      setNotes("");
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "حدث خطأ أثناء تسجيل الدفعة");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center justify-end gap-2 text-xl font-bold">
            تسجيل دفعة سريعة
            <CreditCard className="w-5 h-5 text-success" />
          </DialogTitle>
          <DialogDescription className="text-right">
            تحصيل قسط أو دفعة من حساب العميل مع التحديث الفوري للرصيد.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-right my-2">
          {/* Customer Summary Card */}
          <div className="p-4 rounded-2xl bg-foreground/[0.035] border border-border/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20">
                {getCustomerCode(customer)}
              </span>
              <div className="font-bold text-base">{customer.name}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
              <div className="bg-background/80 p-2.5 rounded-xl border border-border/40">
                <div className="text-[11px] text-muted-foreground">المديونية الحالية</div>
                <div className="text-base font-extrabold text-danger mt-0.5">
                  {fmt(balance)} ج.م
                </div>
              </div>
              <div className="bg-background/80 p-2.5 rounded-xl border border-border/40">
                <div className="text-[11px] text-muted-foreground">الرصيد بعد السداد</div>
                <div
                  className={cn(
                    "text-base font-extrabold mt-0.5",
                    newBalance <= 0 ? "text-success" : "text-foreground",
                  )}
                >
                  {fmt(newBalance)} ج.م
                </div>
              </div>
            </div>
          </div>

          {/* Amount input & quick buttons */}
          <div className="space-y-2">
            <Label className="text-sm font-bold">المبلغ المحصل (ج.م) *</Label>
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={balance > 0 ? balance * 2 : 999999}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="أدخل المبلغ..."
                className="text-lg font-bold pr-4 h-12"
                dir="ltr"
                autoFocus
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                ج.م
              </span>
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {suggestedMonthly > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs rounded-full bg-primary/5 hover:bg-primary/15 text-primary border-primary/30"
                  onClick={() => handleQuickAmount(suggestedMonthly)}
                >
                  قسط شهري ({fmt(suggestedMonthly)})
                </Button>
              )}
              {balance > 0 && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-full hover:bg-foreground/[0.05]"
                    onClick={() => handleQuickAmount(Math.round(balance / 2))}
                  >
                    نصف المتبقي ({fmt(Math.round(balance / 2))})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-full bg-success/10 hover:bg-success/20 text-success border-success/30 font-bold"
                    onClick={() => handleQuickAmount(balance)}
                  >
                    كامل المتبقي ({fmt(balance)})
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Invoice allocation */}
          {openInvoices.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">توزيع الدفعة على</Label>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="auto">توزيع تلقائي على أقدم الأقساط والفواتير</SelectItem>
                  {openInvoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.notes || "فاتورة تقسيط"} — متبقي {fmt(inv.total - inv.paid)} ج.م
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">طريقة الدفع</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="cash">نقدي (كاش بالخزينة)</SelectItem>
                <SelectItem value="vodafone">فودافون كاش / محفظة إلكترونية</SelectItem>
                <SelectItem value="instapay">إنستاباي (InstaPay)</SelectItem>
                <SelectItem value="bank">تحويل بنكي مباشر</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">ملاحظات (اختياري)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: سداد قسط شهر مارس..."
              maxLength={150}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 border-t border-border/30 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!numAmount || numAmount <= 0 || isSubmitting}
            className="gap-2 bg-success hover:bg-success/90 text-white font-bold"
          >
            <CheckCircle className="w-4 h-4" />
            {isSubmitting ? "جاري التسجيل..." : `تأكيد استلام ${fmt(numAmount || 0)} ج.م`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
