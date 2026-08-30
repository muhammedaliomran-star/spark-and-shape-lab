import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Wallet,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Clock,
  Printer,
  Share2,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export interface ShiftRecord {
  id: string;
  date: string;
  shiftType: "morning" | "evening" | "full_day";
  cashierName: string;
  systemExpectedCash: number;
  actualCountedCash: number;
  variance: number;
  denominations: Record<string, number>;
  notes: string;
  status: "approved" | "pending_review";
  approvedAt: string;
  approvedBy: string;
}

interface ShiftCloseoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedCash: number;
  todaySales: number;
  todayExpenses: number;
  todayCollections: number;
}

const DENOMINATIONS = [
  { value: 200, label: "فئة 200 ج.م", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  { value: 100, label: "فئة 100 ج.م", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  { value: 50, label: "فئة 50 ج.م", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  { value: 20, label: "فئة 20 ج.م", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  { value: 10, label: "فئة 10 ج.م", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30" },
  { value: 5, label: "فئة 5 ج.م", color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30" },
  { value: 1, label: "فكة ونقود معدنية", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30" },
];

const LOCAL_STORAGE_SHIFTS_KEY = "segilly_closed_shifts_v1";

export function ShiftCloseoutModal({
  open,
  onOpenChange,
  expectedCash,
  todaySales,
  todayExpenses,
  todayCollections,
}: ShiftCloseoutModalProps) {
  const [shiftType, setShiftType] = useState<"morning" | "evening" | "full_day">("full_day");
  const [cashierName, setCashierName] = useState<string>("الكاشير المسؤول");
  const [counts, setCounts] = useState<Record<number, number>>({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    1: 0,
  });
  const [notes, setNotes] = useState<string>("");
  const [history, setHistory] = useState<ShiftRecord[]>([]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SHIFTS_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const totalCounted = useMemo(() => {
    return Object.entries(counts).reduce((sum, [val, count]) => {
      return sum + Number(val) * (Number(count) || 0);
    }, 0);
  }, [counts]);

  const variance = totalCounted - expectedCash;

  const handleCountChange = (denom: number, countStr: string) => {
    const val = parseInt(countStr, 10);
    setCounts((prev) => ({
      ...prev,
      [denom]: isNaN(val) || val < 0 ? 0 : val,
    }));
  };

  const handleApproveShift = () => {
    const newRecord: ShiftRecord = {
      id: `shift-${Date.now()}`,
      date: new Date().toISOString(),
      shiftType,
      cashierName: cashierName.trim() || "الكاشير المسؤول",
      systemExpectedCash: expectedCash,
      actualCountedCash: totalCounted,
      variance,
      denominations: counts as any,
      notes,
      status: "approved",
      approvedAt: new Date().toISOString(),
      approvedBy: "المالك (سِجلّي Boss)",
    };

    const updated = [newRecord, ...history];
    setHistory(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_SHIFTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    toast.success("تم اعتماد تقفيل الوردية واستلام الإيراد بنجاح! 💸");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-foreground">
            <Wallet className="h-6 w-6 text-emerald-500" />
            <span>تقفيل الوردية اليومية واعتماد الكاشير</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            عد النقدية بالدرج حسب الفئات ومطابقتها مع الحسابات المسجلة بالسيستم لكشف أي عجز أو زيادة فوراً.
          </p>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Shift Details Selector */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">اسم الكاشير أو المسؤول</label>
              <input
                type="text"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                placeholder="أدخل اسم الكاشير..."
                className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">نوع الوردية</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "morning", label: "صباحية" },
                  { id: "evening", label: "مسائية" },
                  { id: "full_day", label: "يوم كامل" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setShiftType(s.id as any)}
                    className={cn(
                      "h-10 rounded-xl text-xs font-bold transition-all border",
                      shiftType === s.id
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* System Summary vs Counted Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card/60 p-4 text-center">
              <span className="text-xs text-muted-foreground font-medium">المتوقع في السيستم (كاش)</span>
              <div className="text-xl font-black text-foreground mt-1">{fmt(expectedCash)} ج.م</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                مبيعات: {fmt(todaySales)} | مصاريف: {fmt(todayExpenses)}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">الفعلي المحسوب بالدرج</span>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {fmt(totalCounted)} ج.م
              </div>
              <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                إجمالي عد الفئات أدناه
              </div>
            </div>

            <div
              className={cn(
                "rounded-2xl border p-4 text-center",
                variance === 0
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : variance > 0
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              <span className="text-xs font-bold">
                {variance === 0 ? "حالة الدرج" : variance > 0 ? "زيادة في الدرج" : "عجز في الدرج"}
              </span>
              <div className="text-xl font-black mt-1">
                {variance === 0 ? "متطابق تماماً ✨" : `${fmt(Math.abs(variance))} ج.م`}
              </div>
              <div className="text-[10px] opacity-80 mt-1">
                {variance === 0 ? "لا يوجد أي فروقات" : variance > 0 ? "فائض نقدية" : "مبلغ مفقود من الدرج"}
              </div>
            </div>
          </div>

          {/* Cash Denomination Calculator */}
          <div className="rounded-2xl border border-border/80 bg-card/60 p-4 space-y-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <span>جدول فئات النقدية (عد الأوراق النقدية)</span>
            </h4>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {DENOMINATIONS.map((denom) => {
                const count = counts[denom.value] || 0;
                const subtotal = count * denom.value;
                return (
                  <div
                    key={denom.value}
                    className={cn("flex items-center justify-between rounded-xl border p-2.5", denom.color)}
                  >
                    <div>
                      <span className="text-xs font-black block">{denom.label}</span>
                      <span className="text-[11px] opacity-80">= {fmt(subtotal)} ج.م</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={count === 0 ? "" : count}
                        onChange={(e) => handleCountChange(denom.value, e.target.value)}
                        placeholder="0"
                        className="w-16 h-8 text-center rounded-lg border border-border bg-background text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[10px] text-muted-foreground">ورقة</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">ملاحظات تسليم الوردية للمالك</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب أي ملاحظة عن الوردية (مثلاً: تم سداد بضاعة كاش من الدرج أو باقي سداد عميل)..."
              className="w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleApproveShift}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>اعتماد استلام الإيراد وإغلاق الوردية</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
