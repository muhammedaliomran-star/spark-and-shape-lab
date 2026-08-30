import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Coins,
  CreditCard,
  Smartphone,
  Layers,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Calculator,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

export interface SplitPaymentDetail {
  cash: number;
  instapay: number;
  wallet: number; // vodafone cash etc.
  card: number; // visa / pos machine
  credit: number; // on account / unpaid
  paidTotal: number;
  changeDue: number;
  referenceNotes?: string;
}

interface PosSplitPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  customerName?: string;
  onConfirm: (split: SplitPaymentDetail) => void;
}

export function PosSplitPaymentModal({
  open,
  onOpenChange,
  totalAmount,
  customerName,
  onConfirm,
}: PosSplitPaymentModalProps) {
  const [cash, setCash] = useState<string>("");
  const [instapay, setInstapay] = useState<string>("");
  const [wallet, setWallet] = useState<string>("");
  const [card, setCard] = useState<string>("");
  const [credit, setCredit] = useState<string>("");
  const [referenceNotes, setReferenceNotes] = useState<string>("");

  useEffect(() => {
    if (open) {
      // By default, prefill all in cash or split
      setCash(String(totalAmount));
      setInstapay("");
      setWallet("");
      setCard("");
      setCredit("");
      setReferenceNotes("");
    }
  }, [open, totalAmount]);

  const cashVal = Number(cash) || 0;
  const instapayVal = Number(instapay) || 0;
  const walletVal = Number(wallet) || 0;
  const cardVal = Number(card) || 0;
  const creditVal = Number(credit) || 0;

  const totalAllocated = cashVal + instapayVal + walletVal + cardVal + creditVal;
  const diff = totalAllocated - totalAmount;
  const isExactOrSurplus = totalAllocated >= totalAmount;
  const remainingNeeded = Math.max(0, totalAmount - totalAllocated);
  const changeDue = Math.max(0, totalAllocated - totalAmount);

  const handleApplyPreset = (type: "all_cash" | "all_instapay" | "all_card" | "all_wallet" | "half_cash_half_instapay") => {
    if (type === "all_cash") {
      setCash(String(totalAmount));
      setInstapay("");
      setWallet("");
      setCard("");
      setCredit("");
    } else if (type === "all_instapay") {
      setCash("");
      setInstapay(String(totalAmount));
      setWallet("");
      setCard("");
      setCredit("");
    } else if (type === "all_card") {
      setCash("");
      setInstapay("");
      setWallet("");
      setCard(String(totalAmount));
      setCredit("");
    } else if (type === "all_wallet") {
      setCash("");
      setInstapay("");
      setWallet(String(totalAmount));
      setCard("");
      setCredit("");
    } else if (type === "half_cash_half_instapay") {
      const half = Math.round((totalAmount / 2) * 100) / 100;
      setCash(String(half));
      setInstapay(String(totalAmount - half));
      setWallet("");
      setCard("");
      setCredit("");
    }
  };

  const handleFillRemaining = (target: "cash" | "instapay" | "card" | "wallet" | "credit") => {
    if (remainingNeeded <= 0) return;
    if (target === "cash") setCash(String((Number(cash) || 0) + remainingNeeded));
    if (target === "instapay") setInstapay(String((Number(instapay) || 0) + remainingNeeded));
    if (target === "card") setCard(String((Number(card) || 0) + remainingNeeded));
    if (target === "wallet") setWallet(String((Number(wallet) || 0) + remainingNeeded));
    if (target === "credit") setCredit(String((Number(credit) || 0) + remainingNeeded));
  };

  const handleFinish = () => {
    if (!isExactOrSurplus && creditVal === 0) {
      toast.error(`المبلغ المدفوع غير مكتمل! متبقي ${fmt(remainingNeeded)} ج.م`);
      return;
    }

    onConfirm({
      cash: cashVal,
      instapay: instapayVal,
      wallet: walletVal,
      card: cardVal,
      credit: creditVal,
      paidTotal: totalAllocated - changeDue,
      changeDue,
      referenceNotes: referenceNotes.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-extrabold text-foreground">
                تعدد طرق الدفع للفاتورة (Split Payment)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                تقسيم الحساب بين نقدي، إنستاباي، محافظ إلكترونية، شبكة أو آجل
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Invoice Total Banner */}
        <div className="p-4 rounded-2xl bg-card border border-border/70 flex items-center justify-between flex-wrap gap-2 shadow-xs">
          <div>
            <div className="text-xs text-muted-foreground font-semibold">إجمالي الفاتورة المطلوب</div>
            <div className="text-2xl font-black text-foreground mt-0.5 font-mono">
              {fmt(totalAmount)} <span className="text-sm font-bold text-muted-foreground">ج.م</span>
            </div>
          </div>
          {customerName && (
            <Badge variant="outline" className="px-2.5 py-1 text-xs bg-muted/50 text-foreground">
              العميل: {customerName}
            </Badge>
          )}
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => handleApplyPreset("all_cash")}
            className="px-2.5 py-1 rounded-xl border border-border bg-muted/40 hover:bg-muted font-bold text-[11px] transition-colors"
          >
            💵 الكل كاش
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("all_instapay")}
            className="px-2.5 py-1 rounded-xl border border-border bg-muted/40 hover:bg-muted font-bold text-[11px] transition-colors"
          >
            ⚡ الكل إنستاباي
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("all_card")}
            className="px-2.5 py-1 rounded-xl border border-border bg-muted/40 hover:bg-muted font-bold text-[11px] transition-colors"
          >
            💳 الكل فيزا/شبكة
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("half_cash_half_instapay")}
            className="px-2.5 py-1 rounded-xl border border-border bg-muted/40 hover:bg-muted font-bold text-[11px] transition-colors"
          >
            ⚖️ 50% كاش + 50% إنستاباي
          </button>
        </div>

        {/* Payment Channels Form */}
        <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
          {/* 1. Cash */}
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border/50">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
              <Banknote className="h-4 w-4" />
            </div>
            <div className="flex-1 text-right">
              <Label className="text-xs font-bold text-foreground">نقدي (كاش بالدرج)</Label>
            </div>
            <div className="relative w-36">
              <Input
                type="number"
                min="0"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                placeholder="0.00"
                className="h-9 rounded-xl pl-8 font-bold text-right font-mono"
              />
              <span className="absolute left-2.5 top-2.5 text-[10px] text-muted-foreground font-bold">ج.م</span>
            </div>
            {remainingNeeded > 0 && (
              <button
                type="button"
                onClick={() => handleFillRemaining("cash")}
                className="text-[10px] font-bold text-primary hover:underline shrink-0"
              >
                + المتبقي
              </button>
            )}
          </div>

          {/* 2. InstaPay */}
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border/50">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 text-right">
              <Label className="text-xs font-bold text-foreground">إنستاباي (InstaPay)</Label>
            </div>
            <div className="relative w-36">
              <Input
                type="number"
                min="0"
                value={instapay}
                onChange={(e) => setInstapay(e.target.value)}
                placeholder="0.00"
                className="h-9 rounded-xl pl-8 font-bold text-right font-mono"
              />
              <span className="absolute left-2.5 top-2.5 text-[10px] text-muted-foreground font-bold">ج.م</span>
            </div>
            {remainingNeeded > 0 && (
              <button
                type="button"
                onClick={() => handleFillRemaining("instapay")}
                className="text-[10px] font-bold text-primary hover:underline shrink-0"
              >
                + المتبقي
              </button>
            )}
          </div>

          {/* 3. Electronic Wallet (Vodafone / Orange / Etisalat / Telda) */}
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border/50">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-600 shrink-0">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="flex-1 text-right">
              <Label className="text-xs font-bold text-foreground">محفظة إلكترونية (فودافون كاش / غيرها)</Label>
            </div>
            <div className="relative w-36">
              <Input
                type="number"
                min="0"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="0.00"
                className="h-9 rounded-xl pl-8 font-bold text-right font-mono"
              />
              <span className="absolute left-2.5 top-2.5 text-[10px] text-muted-foreground font-bold">ج.م</span>
            </div>
            {remainingNeeded > 0 && (
              <button
                type="button"
                onClick={() => handleFillRemaining("wallet")}
                className="text-[10px] font-bold text-primary hover:underline shrink-0"
              >
                + المتبقي
              </button>
            )}
          </div>

          {/* 4. POS Terminal / Visa Card */}
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border/50">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 shrink-0">
              <CreditCard className="h-4 w-4" />
            </div>
            <div className="flex-1 text-right">
              <Label className="text-xs font-bold text-foreground">بطاقة بنكية / ماكينة فيزا (POS)</Label>
            </div>
            <div className="relative w-36">
              <Input
                type="number"
                min="0"
                value={card}
                onChange={(e) => setCard(e.target.value)}
                placeholder="0.00"
                className="h-9 rounded-xl pl-8 font-bold text-right font-mono"
              />
              <span className="absolute left-2.5 top-2.5 text-[10px] text-muted-foreground font-bold">ج.م</span>
            </div>
            {remainingNeeded > 0 && (
              <button
                type="button"
                onClick={() => handleFillRemaining("card")}
                className="text-[10px] font-bold text-primary hover:underline shrink-0"
              >
                + المتبقي
              </button>
            )}
          </div>

          {/* 5. Credit / On Account */}
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border/50">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
              <Coins className="h-4 w-4" />
            </div>
            <div className="flex-1 text-right">
              <Label className="text-xs font-bold text-foreground">آجل / متبقي على حساب العميل</Label>
            </div>
            <div className="relative w-36">
              <Input
                type="number"
                min="0"
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
                placeholder="0.00"
                className="h-9 rounded-xl pl-8 font-bold text-right font-mono text-amber-600"
              />
              <span className="absolute left-2.5 top-2.5 text-[10px] text-muted-foreground font-bold">ج.م</span>
            </div>
            {remainingNeeded > 0 && (
              <button
                type="button"
                onClick={() => handleFillRemaining("credit")}
                className="text-[10px] font-bold text-amber-600 hover:underline shrink-0"
              >
                + المتبقي
              </button>
            )}
          </div>
        </div>

        {/* Reference / Transaction Note */}
        <div>
          <Input
            value={referenceNotes}
            onChange={(e) => setReferenceNotes(e.target.value)}
            placeholder="ملاحظات مرجعية (رقم عملية إنستاباي / إيصال الفيزا - اختياري)..."
            className="rounded-xl text-xs h-8"
          />
        </div>

        {/* Status / Balance Calculation Summary */}
        <div
          className={cn(
            "p-3 rounded-2xl border text-xs font-bold flex items-center justify-between",
            diff === 0
              ? "bg-success/10 border-success/30 text-success"
              : diff > 0
              ? "bg-blue-500/10 border-blue-500/30 text-blue-600"
              : "bg-danger/10 border-danger/30 text-danger"
          )}
        >
          <div className="flex items-center gap-1.5">
            {diff >= 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>إجمالي الموزع: {fmt(totalAllocated)} ج.م</span>
          </div>

          <div>
            {diff === 0 ? (
              <span>المبلغ متطابق تماماً ✓</span>
            ) : diff > 0 ? (
              <span>الباقي للعميل (فكة): {fmt(diff)} ج.م</span>
            ) : (
              <span>متبقي لم يُوزّع: {fmt(Math.abs(diff))} ج.م</span>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
            إلغاء
          </Button>
          <Button
            onClick={handleFinish}
            disabled={!isExactOrSurplus && creditVal === 0}
            className="rounded-xl font-bold gap-2 text-xs flex-1"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>تأكيد وطباعة الفاتورة ({fmt(totalAmount)} ج.م)</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
