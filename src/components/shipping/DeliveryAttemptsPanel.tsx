import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  ATTEMPT_LABELS,
  addDeliveryAttempt,
  deleteDeliveryAttempt,
  loadDeliveryAttempts,
  type AttemptOutcome,
  type DeliveryAttempt,
} from "@/lib/delivery-attempts";
import { usePrivacy } from "@/lib/privacy";

const egp = (n: number) => `${Number(n || 0).toLocaleString("ar-EG")} ج.م`;

/** سجل محاولات التسليم لشحنة واحدة: تسليم جزئي، سبب الفشل، وإعادة الجدولة. */
export function DeliveryAttemptsPanel({ shipmentId }: { shipmentId: string }) {
  const { privacy } = usePrivacy();
  const [attempts, setAttempts] = useState<DeliveryAttempt[]>([]);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<AttemptOutcome>("no_answer");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [nextAt, setNextAt] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setAttempts(await loadDeliveryAttempts(shipmentId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تحميل المحاولات");
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  const nextNumber = useMemo(
    () => attempts.reduce((max, a) => Math.max(max, a.attemptNumber), 0) + 1,
    [attempts],
  );

  const save = async () => {
    setBusy(true);
    try {
      await addDeliveryAttempt({
        shipmentId,
        attemptNumber: nextNumber,
        outcome,
        reason: reason.trim() || undefined,
        deliveredAmount: Number(amount) || 0,
        nextAttemptAt: nextAt || null,
      });
      toast.success(`تم تسجيل المحاولة رقم ${nextNumber}`);
      setOpen(false);
      setReason("");
      setAmount("");
      setNextAt("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold">محاولات التسليم ({attempts.length})</h4>
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> محاولة جديدة
        </Button>
      </div>

      {open && (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-3">
          <div className="space-y-1">
            <Label className="text-xs">نتيجة المحاولة</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as AttemptOutcome)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ATTEMPT_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">المبلغ المُحصَّل</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 text-xs" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">إعادة الجدولة</Label>
              <Input type="date" value={nextAt} onChange={(e) => setNextAt(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">السبب / ملاحظات</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 text-xs" placeholder="مثال: العميل طلب التأجيل" />
          </div>
          <Button size="sm" className="w-full text-xs" disabled={busy} onClick={() => void save()}>
            حفظ المحاولة رقم {nextNumber}
          </Button>
        </div>
      )}

      {attempts.length === 0 ? (
        <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">لا توجد محاولات تسليم مسجلة.</p>
      ) : (
        <div className="space-y-2">
          {attempts.map((a) => (
            <div key={a.id} className="rounded-xl border border-border/60 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">#{a.attemptNumber} — {ATTEMPT_LABELS[a.outcome]}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => void deleteDeliveryAttempt(a.id).then(refresh)}
                  aria-label="حذف المحاولة"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {a.reason && <p className="mt-1 text-muted-foreground">{a.reason}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span>{format(new Date(a.createdAt), "dd MMM yyyy — hh:mm a", { locale: ar })}</span>
                {a.deliveredAmount > 0 && (
                  <span className={privacy ? "privacy-blur" : ""}>محصّل: {egp(a.deliveredAmount)}</span>
                )}
                {a.nextAttemptAt && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <RotateCcw className="h-3 w-3" /> إعادة: {a.nextAttemptAt}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
