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
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Banknote,
  Calculator,
  Printer,
  CheckCircle2,
  AlertTriangle,
  History,
  ArrowRightLeft,
  User,
  FileSpreadsheet,
  Coins,
} from "lucide-react";
import {
  useShifts,
  calculateShiftStats,
  printShiftReport,
  type CashShift,
} from "@/lib/shifts";
import { useDB, useShopSettings, fmt } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShiftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "open" | "close" | "history" | "status";
}

export function ShiftModal({ open, onOpenChange, mode = "status" }: ShiftModalProps) {
  const { activeShift, history, openShift, closeShift } = useShifts();
  const dbData = useDB();
  const { settings: shop } = useShopSettings();

  const [activeTab, setActiveTab] = useState<"status" | "open" | "close" | "history">(
    mode === "open" && !activeShift
      ? "open"
      : mode === "close" && activeShift
        ? "close"
        : mode === "history"
          ? "history"
          : activeShift
            ? "status"
            : "open",
  );

  // Form states for opening shift
  const [cashierName, setCashierName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openNotes, setOpenNotes] = useState("");

  // Form states for closing shift
  const [cashCount, setCashCount] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  // Cash breakdown counter helper (فئات النقود)
  const [showDenominations, setShowDenominations] = useState(false);
  const [denoms, setDenoms] = useState<{ [key: number]: number }>({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    1: 0,
  });

  const calculatedFromDenoms = useMemo(() => {
    return Object.entries(denoms).reduce((sum, [val, count]) => sum + Number(val) * Number(count || 0), 0);
  }, [denoms]);

  const applyDenomsToCount = () => {
    setCashCount(String(calculatedFromDenoms));
    setShowDenominations(false);
    toast.success(`تم تحديث مبلغ العد: ${fmt(calculatedFromDenoms)} ج.م`);
  };

  const currentStats = useMemo(() => {
    if (!activeShift) return null;
    return calculateShiftStats(activeShift, dbData);
  }, [activeShift, dbData]);

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierName.trim()) {
      toast.error("يرجى إدخال اسم الكاشير المسؤول");
      return;
    }
    try {
      const shift = openShift({
        cashierName: cashierName.trim(),
        openingBalance: Math.max(0, Number(openingBalance) || 0),
        notes: openNotes.trim() || undefined,
      });
      toast.success(`تم فتح الوردية رقم #${shift.shiftNumber} بنجاح`);
      setCashierName("");
      setOpeningBalance("0");
      setOpenNotes("");
      setActiveTab("status");
    } catch (err: any) {
      toast.error(err.message || "فشل فتح الوردية");
    }
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || !currentStats) return;
    const actualCountNum = Number(cashCount);
    if (isNaN(actualCountNum) || actualCountNum < 0) {
      toast.error("يرجى إدخال المبلغ الفعلي في الدرج");
      return;
    }

    try {
      const closed = closeShift({
        shiftId: activeShift.id,
        closingCashCount: actualCountNum,
        stats: currentStats,
        notes: closeNotes.trim() || undefined,
      });

      const updatedStats = {
        ...currentStats,
        actualCount: actualCountNum,
        variance: actualCountNum - currentStats.expectedCashInDrawer,
      };

      toast.success(`تم إغلاق الوردية #${closed.shiftNumber} بنجاح`);
      printShiftReport(closed, updatedStats, shop, true);
      setCashCount("");
      setCloseNotes("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "فشل إغلاق الوردية");
    }
  };

  const printXReport = () => {
    if (!activeShift || !currentStats) return;
    printShiftReport(activeShift, currentStats, shop, false);
    toast.success("تم إرسال تقرير الجرد المؤقت (X-Report) للطباعة");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto text-right">
        <DialogHeader>
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-1">
              <Button
                variant={activeTab === "status" ? "default" : "ghost"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setActiveTab("status")}
              >
                الوردية الحالية
              </Button>
              {activeShift && (
                <Button
                  variant={activeTab === "close" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-8 text-danger hover:text-danger"
                  onClick={() => setActiveTab("close")}
                >
                  تقفيل الوردية
                </Button>
              )}
              {!activeShift && (
                <Button
                  variant={activeTab === "open" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-8 text-primary hover:text-primary"
                  onClick={() => setActiveTab("open")}
                >
                  فتح وردية
                </Button>
              )}
              <Button
                variant={activeTab === "history" ? "default" : "ghost"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setActiveTab("history")}
              >
                سجل الورديات ({history.length})
              </Button>
            </div>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              إدارة الورديات وتقفيل الدرج
              <Clock className="w-5 h-5 text-primary" />
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* TAB 1: CURRENT SHIFT STATUS */}
        {activeTab === "status" && (
          <div className="space-y-4 py-2">
            {activeShift && currentStats ? (
              <>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/10 border border-primary/20">
                  <div className="text-left">
                    <Badge className="bg-success text-success-foreground hover:bg-success">
                      وردية مفتوحة
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1" dir="ltr">
                      منذ: {new Date(activeShift.openedAt).toLocaleTimeString("ar-EG")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold flex items-center gap-1.5 justify-end">
                      {activeShift.cashierName}
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      وردية رقم #{activeShift.shiftNumber}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-card/60 border">
                    <div className="text-[11px] text-muted-foreground">رصيد البداية (الفكة)</div>
                    <div className="text-base font-bold mt-0.5">
                      {fmt(activeShift.openingBalance)} {shop.currency}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-success/10 border border-success/20">
                    <div className="text-[11px] text-success font-medium">مبيعات كاش محصلة</div>
                    <div className="text-base font-bold text-success mt-0.5">
                      {fmt(currentStats.cashSalesAmount + currentStats.splitCashAmount)} {shop.currency}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-card/60 border">
                    <div className="text-[11px] text-muted-foreground">مبيعات إلكترونية (فيزا)</div>
                    <div className="text-base font-bold mt-0.5">
                      {fmt(currentStats.electronicSalesAmount)} {shop.currency}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-danger/10 border border-danger/20">
                    <div className="text-[11px] text-danger font-medium">مصروفات ونثريات</div>
                    <div className="text-base font-bold text-danger mt-0.5">
                      {fmt(currentStats.expensesAmount)} {shop.currency}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-card/60 border">
                    <div className="text-[11px] text-muted-foreground">مشتريات ومرتجعات</div>
                    <div className="text-base font-bold mt-0.5">
                      {fmt(currentStats.purchasesAmount + currentStats.returnsAmount)} {shop.currency}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/15 border border-primary/30">
                    <div className="text-[11px] text-primary font-bold">المفترض حالياً بالدرج</div>
                    <div className="text-lg font-black text-primary mt-0.5">
                      {fmt(currentStats.expectedCashInDrawer)} {shop.currency}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={printXReport}
                  >
                    <Printer className="w-4 h-4 text-muted-foreground" />
                    طباعة جرد مؤقت (X-Report)
                  </Button>
                  <Button
                    className="flex-1 gap-1.5 bg-danger hover:bg-danger/90 text-danger-foreground"
                    onClick={() => setActiveTab("close")}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    تسليم وتقفيل الوردية (Z-Report)
                  </Button>
                </div>
              </>
            ) : (
              <div className="py-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto text-muted-foreground">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base">لا توجد وردية مفتوحة حالياً</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    قم بفتح وردية لبدء تسجيل المبيعات وحساب النقدية ومطابقة رصيد الدرج بدقة.
                  </p>
                </div>
                <Button onClick={() => setActiveTab("open")} className="gap-2">
                  فتح وردية جديدة الآن
                </Button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: OPEN NEW SHIFT */}
        {activeTab === "open" && (
          <form onSubmit={handleOpenShift} className="space-y-4 py-2">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold">اسم الكاشير المسؤول *</Label>
                <Input
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  placeholder="مثال: أحمد محمد (شفت صباحي)"
                  autoFocus
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold">
                  الرصيد الافتتاحي في درج الكاشير (الفكة) ({shop.currency})
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  المبلغ المتواجد في الدرج كعهدة فكة قبل بدء عمليات البيع.
                </p>
              </div>

              <div>
                <Label className="text-xs font-bold">ملاحظات الفتح (اختياري)</Label>
                <Input
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  placeholder="أي ملاحظات تخص حالة الدرج أو الجهاز..."
                />
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab("status")}
              >
                إلغاء
              </Button>
              <Button type="submit" className="gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                تأكيد وبدء الوردية
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* TAB 3: CLOSE SHIFT (END OF DAY REGISTER CLOSING) */}
        {activeTab === "close" && activeShift && currentStats && (
          <form onSubmit={handleCloseShift} className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-muted/40 border space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold">{activeShift.cashierName}</span>
                <span className="text-muted-foreground">الكاشير المسلّم:</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-mono font-bold">{fmt(currentStats.expectedCashInDrawer)} {shop.currency}</span>
                <span className="text-muted-foreground">المبلغ المحسوب بالدرج:</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1"
                  onClick={() => setShowDenominations(!showDenominations)}
                >
                  <Coins className="w-3.5 h-3.5" />
                  {showDenominations ? "إخفاء حاسبة الفئات" : "حاسبة عد الفئات"}
                </Button>
                <Label className="text-xs font-bold text-danger">
                  العد الفعلي للنقدية في الدرج (Cash Count) *
                </Label>
              </div>

              {showDenominations && (
                <div className="p-3 rounded-xl border bg-card/70 space-y-2">
                  <div className="text-xs font-bold text-muted-foreground border-b pb-1">
                    أدخل عدد الأوراق لكل فئة:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[200, 100, 50, 20, 10, 5, 1].map((denom) => (
                      <div key={denom} className="space-y-1">
                        <Label className="text-[11px]">{denom} ج.م</Label>
                        <Input
                          type="number"
                          min="0"
                          value={denoms[denom] || ""}
                          onChange={(e) =>
                            setDenoms({ ...denoms, [denom]: Number(e.target.value) || 0 })
                          }
                          placeholder="0"
                          className="h-8 text-xs text-center"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <Button
                      type="button"
                      size="sm"
                      onClick={applyDenomsToCount}
                      className="h-7 text-xs"
                    >
                      تطبيق المجموع ({fmt(calculatedFromDenoms)})
                    </Button>
                    <span className="font-bold">المجموع: {fmt(calculatedFromDenoms)} ج.م</span>
                  </div>
                </div>
              )}

              <Input
                type="number"
                step="any"
                value={cashCount}
                onChange={(e) => setCashCount(e.target.value)}
                placeholder="أدخل المبلغ بعد العد الفعلي..."
                className="text-lg font-bold h-11 text-center"
                autoFocus
                required
              />

              {cashCount !== "" && !isNaN(Number(cashCount)) && (
                <div
                  className={cn(
                    "p-3 rounded-xl border text-xs flex items-center justify-between font-bold",
                    Number(cashCount) === currentStats.expectedCashInDrawer
                      ? "bg-success/15 border-success/30 text-success"
                      : Number(cashCount) > currentStats.expectedCashInDrawer
                        ? "bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-400"
                        : "bg-danger/15 border-danger/30 text-danger",
                  )}
                >
                  <span>
                    {Number(cashCount) === currentStats.expectedCashInDrawer
                      ? "الحساب متطابق تماماً بدون عجز أو زيادة ✓"
                      : Number(cashCount) > currentStats.expectedCashInDrawer
                        ? `يوجد زيادة في الدرج بقيمة +${fmt(Number(cashCount) - currentStats.expectedCashInDrawer)} ${shop.currency}`
                        : `يوجد عجز في الدرج بقيمة ${fmt(Number(cashCount) - currentStats.expectedCashInDrawer)} ${shop.currency}`}
                  </span>
                  <span>حالة الدرج</span>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-bold">ملاحظات التقفيل والتسليم</Label>
              <Input
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="سبب العجز أو الزيادة، اسم المستلم، إلخ..."
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab("status")}
              >
                رجوع
              </Button>
              <Button
                type="submit"
                className="gap-1.5 bg-danger hover:bg-danger/90 text-danger-foreground font-bold"
              >
                <Printer className="w-4 h-4" />
                إغلاق الوردية وطباعة Z-Report
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* TAB 4: SHIFT HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-3 py-2">
            {history.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                لا توجد ورديات سابقة مسجلة.
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {history.map((s) => {
                  const sStats = calculateShiftStats(s, dbData);
                  return (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl border bg-card/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-[11px]"
                        onClick={() => printShiftReport(s, sStats, shop, true)}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        طباعة Z-Report
                      </Button>

                      <div className="text-left font-mono">
                        <div className="font-bold">
                          المحسوب: {fmt(s.expectedCash)} {shop.currency}
                        </div>
                        <div
                          className={cn(
                            "text-[11px]",
                            s.variance === 0
                              ? "text-success"
                              : s.variance && s.variance > 0
                                ? "text-sky-500"
                                : "text-danger font-bold",
                          )}
                        >
                          {s.variance === null
                            ? "مستمرة"
                            : s.variance === 0
                              ? "متطابق"
                              : s.variance > 0
                                ? `+${fmt(s.variance)} زيادة`
                                : `${fmt(s.variance)} عجز`}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold flex items-center gap-1.5 justify-end">
                          <span>{s.cashierName}</span>
                          <Badge variant={s.status === "open" ? "default" : "secondary"}>
                            #{s.shiftNumber}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground" dir="ltr">
                          {new Date(s.openedAt).toLocaleDateString("ar-EG")} -{" "}
                          {s.closedAt
                            ? new Date(s.closedAt).toLocaleTimeString("ar-EG", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "مفتوحة"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
