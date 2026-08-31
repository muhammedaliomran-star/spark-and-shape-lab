import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addCallLog, savePromise, removePromise, PromiseToPay } from "@/lib/collection-store";
import { fmt, Customer, Invoice } from "@/lib/store";
import { Handshake, PhoneCall, Calendar, Check, Trash2, Clock, CheckCircle2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PromiseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  customer: Customer | null;
  existingPromise?: PromiseToPay | null;
  onSuccess?: () => void;
}

const OUTCOMES = [
  { id: "promise", label: "🤝 وعد بالسداد في موعد محدد", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" },
  { id: "grace_period", label: "⏳ طلب مهلة إضافية", color: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" },
  { id: "no_answer", label: "📵 لم يرد على الاتصال", color: "bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400" },
  { id: "switched_off", label: "📴 الهاتف مغلق / غير متاح", color: "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400" },
  { id: "dispute", label: "⚠️ اعتراض على كشف الحساب", color: "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400" },
  { id: "paid", label: "✅ تم الاتفاق والتحصيل الفوري", color: "bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400" },
] as const;

export function PromiseModal({
  open,
  onOpenChange,
  invoice,
  customer,
  existingPromise,
  onSuccess,
}: PromiseModalProps) {
  const [outcome, setOutcome] = useState<typeof OUTCOMES[number]["id"]>("promise");
  const [promisedDate, setPromisedDate] = useState<string>("");
  const [promisedAmount, setPromisedAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      const remaining = invoice.total - invoice.paid;
      const suggested = Math.min(invoice.monthlyInstallment || remaining, remaining);
      if (existingPromise) {
        setOutcome("promise");
        setPromisedDate(existingPromise.promisedDate);
        setPromisedAmount(String(existingPromise.promisedAmount));
        setNotes(existingPromise.note || "");
      } else {
        setOutcome("promise");
        setPromisedDate(format(addDays(new Date(), 3), "yyyy-MM-dd"));
        setPromisedAmount(String(Math.round(suggested)));
        setNotes("");
      }
    }
  }, [open, invoice, existingPromise]);

  if (!invoice || !customer) return null;

  const remaining = invoice.total - invoice.paid;

  const handleSave = () => {
    setSaving(true);
    try {
      const outcomeObj = OUTCOMES.find((o) => o.id === outcome);
      const amt = Number(promisedAmount) || remaining;

      addCallLog({
        invoiceId: invoice.id,
        customerId: customer.id,
        outcome: outcome,
        outcomeLabel: outcomeObj ? outcomeObj.label : "متابعة هاتفية",
        notes: notes.trim(),
        promisedDate: outcome === "promise" ? promisedDate : undefined,
        promisedAmount: outcome === "promise" ? amt : undefined,
      });

      if (outcome === "promise" && promisedDate) {
        savePromise({
          invoiceId: invoice.id,
          customerId: customer.id,
          promisedDate,
          promisedAmount: amt,
          note: notes.trim(),
          createdAt: Date.now(),
          status: "pending",
        });
        toast.success(`تم حفظ وعد السداد ليوم ${promisedDate}`);
      } else {
        toast.success("تم تسجيل المتابعة في سجل الاتصالات");
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePromise = () => {
    if (!invoice) return;
    removePromise(invoice.id);
    toast.success("تم إلغاء وعد السداد");
    onSuccess?.();
    onOpenChange(false);
  };

  const quickDates = [
    { label: "بعد 3 أيام", date: format(addDays(new Date(), 3), "yyyy-MM-dd") },
    { label: "بعد أسبوع", date: format(addDays(new Date(), 7), "yyyy-MM-dd") },
    { label: "نهاية الشهر", date: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold justify-start">
            <PhoneCall className="w-5 h-5 text-primary" />
            تسجيل متابعة اتصال ووعد سداد
          </DialogTitle>
          <DialogDescription className="text-right">
            العميل: <b className="text-foreground">{customer.name}</b> · المتبقي على الفاتورة: <b className="text-rose-600 dark:text-rose-400">{fmt(remaining)} ج.م</b>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Outcome Selection */}
          <div className="space-y-2 text-right">
            <Label className="text-xs font-bold text-muted-foreground">نتيجة المتابعة / الاتصال:</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OUTCOMES.map((o) => {
                const isSelected = outcome === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOutcome(o.id)}
                    className={cn(
                      "text-xs p-2.5 rounded-xl border text-right transition-all font-semibold flex items-center justify-between",
                      o.color,
                      isSelected ? "ring-2 ring-primary ring-offset-1 font-bold" : "opacity-75 hover:opacity-100"
                    )}
                  >
                    <span>{o.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional Promise Date & Amount */}
          {outcome === "promise" && (
            <div className="p-3.5 bg-card/80 border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  تاريخ الوعد بالسداد:
                </Label>
                <div className="flex gap-1.5">
                  {quickDates.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setPromisedDate(q.date)}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground font-medium"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                type="date"
                value={promisedDate}
                onChange={(e) => setPromisedDate(e.target.value)}
                className="text-right font-mono"
              />

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-bold text-muted-foreground">المبلغ الموعود بسداده (ج.م):</Label>
                <Input
                  type="number"
                  value={promisedAmount}
                  onChange={(e) => setPromisedAmount(e.target.value)}
                  placeholder="0"
                  className="text-right font-mono text-base font-bold"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5 text-right">
            <Label className="text-xs font-bold text-muted-foreground">ملاحظات إضافية عن المكالمة / العميل:</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: قال إنه مسافر وسيقوم بتحويل المبلغ عبر إنستاباي يوم الخميس القادم..."
              rows={2}
              className="text-right text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row-reverse items-center justify-between gap-2 pt-2 border-t mt-3">
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> حفظ المتابعة
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
          </div>

          {existingPromise && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemovePromise}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> إلغاء الوعد
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
