import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useDB,
  fmt,
  useShopSettings,
} from "@/lib/store";
import {
  getActiveShift,
  startShift,
  closeShift,
  calculateShiftMetrics,
  getAllShifts,
  type CashierShift,
  type ShiftCalculatedMetrics,
} from "@/lib/cashier-shifts";
import { pdfDocument, openPdfDocument, esc } from "@/lib/pdf-doc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Clock,
  Coins,
  Receipt,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  History,
  TrendingUp,
  TrendingDown,
  Wallet,
  Store,
} from "lucide-react";

interface ShiftManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShiftUpdated?: () => void;
}

export function ShiftManagerDialog({ open, onOpenChange, onShiftUpdated }: ShiftManagerDialogProps) {
  const dbData = useDB();
  const { settings: shop } = useShopSettings();
  const [activeShift, setActiveShift] = useState<CashierShift | null>(() => getActiveShift());
  const [shiftsHistory, setShiftsHistory] = useState<CashierShift[]>(() => getAllShifts());
  const [viewTab, setViewTab] = useState<"current" | "history">("current");

  // Open Shift Form State
  const [openingCashInput, setOpeningCashInput] = useState<string>("0");
  const [cashierNameInput, setCashierNameInput] = useState<string>("الكاشير العام");

  // Close Shift Form State
  const [actualCashInput, setActualCashInput] = useState<string>("");
  const [closeNotes, setCloseNotes] = useState<string>("");

  const refreshState = () => {
    setActiveShift(getActiveShift());
    setShiftsHistory(getAllShifts());
    onShiftUpdated?.();
  };

  useEffect(() => {
    if (open) {
      refreshState();
    }
  }, [open]);

  useEffect(() => {
    const handleShiftEvent = () => refreshState();
    window.addEventListener("segilly:shift_changed", handleShiftEvent);
    return () => window.removeEventListener("segilly:shift_changed", handleShiftEvent);
  }, []);

  // Calculate live metrics for active shift
  const liveMetrics: ShiftCalculatedMetrics | null = activeShift
    ? calculateShiftMetrics(activeShift, {
        invoices: dbData.invoices,
        payments: dbData.payments,
        expenses: dbData.expenses,
        returns: dbData.returns,
      })
    : null;

  const handleStartShift = () => {
    const opening = Number(openingCashInput);
    if (isNaN(opening) || opening < 0) {
      toast.error("يرجى إدخال مبلغ عهدة افتتاحية صحيح");
      return;
    }

    startShift(opening, cashierNameInput.trim() || "الكاشير العام");
    toast.success("تم فتح الوردية وبدء تسجيل حركات اليومية");
    refreshState();
  };

  const handleCloseShift = () => {
    if (!activeShift || !liveMetrics) return;
    const actual = Number(actualCashInput);
    if (actualCashInput === "" || isNaN(actual) || actual < 0) {
      toast.error("يرجى إدخال المبلغ الفعلي الموجود في الدرج");
      return;
    }

    const closed = closeShift(activeShift.id, actual, liveMetrics, closeNotes);
    toast.success("تم تقفيل الوردية وإصدار تقرير Z-Report بنجاح");
    refreshState();
    setActualCashInput("");
    setCloseNotes("");

    // Ask to print Z-Report
    printShiftZReport(closed, shop.shopName, shop.phone);
  };

  const printShiftZReport = (shift: CashierShift, shopName: string, phone?: string) => {
    const cur = "ج.م";
    const sum = shift.summary || {
      cashSales: 0,
      installmentDownPayments: 0,
      collectedInstallments: 0,
      cashExpenses: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      ordersCount: 0,
    };

    const diff = shift.difference ?? 0;
    const diffStatus =
      diff === 0 ? "متطابق تماماً ✅" : diff > 0 ? `زيادة بالدرج (+${fmt(diff)} ${cur}) 🟢` : `عجز بالدرج (-${fmt(Math.abs(diff))} ${cur}) 🔴`;

    const html = pdfDocument({
      docTitle: `تقرير تقفيل وردية Z-Report — ${shift.id}`,
      badge: "Z-Report وردية كاشير",
      title: `تقرير تقفيل وردية (${shift.cashierName})`,
      lede: `الفترة من ${format(new Date(shift.openedAt), "dd/MM/yyyy hh:mm a")} إلى ${
        shift.closedAt ? format(new Date(shift.closedAt), "dd/MM/yyyy hh:mm a") : "الآن"
      }`,
      meta: [
        { label: "المحل", value: shopName || "سِجلّي" },
        { label: "الكاشير", value: shift.cashierName },
        { label: "رقم الوردية", value: shift.id.slice(-8) },
        { label: "الحالة", value: shift.status === "closed" ? "مقفلة" : "مفتوحة" },
      ],
      body: `
        <div style="font-size: 13px; line-height: 1.6;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="background: #f4f4f5; text-align: right;">
                <th style="padding: 8px; border: 1px solid #e4e4e7;">البند</th>
                <th style="padding: 8px; border: 1px solid #e4e4e7; text-align: left;">القيمة (${cur})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 8px; border: 1px solid #e4e4e7;">العهدة الافتتاحية (الفكة)</td>
                <td style="padding: 8px; border: 1px solid #e4e4e7; font-weight: bold; text-align: left;">${fmt(shift.openingCash)}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e4e4e7;">المبيعات النقدية الفورية (${sum.ordersCount} فاتورة)</td>
                <td style="padding: 8px; border: 1px solid #e4e4e7; font-weight: bold; color: #16a34a; text-align: left;">+ ${fmt(sum.cashSales)}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e4e4e7;">المقدمات المحصلة لتقسيط</td>
                <td style="padding: 8px; border: 1px solid #e4e4e7; font-weight: bold; color: #16a34a; text-align: left;">+ ${fmt(sum.installmentDownPayments)}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e4e4e7;">الأقساط المحصلة خلال الوردية</td>
                <td style="padding: 8px; border: 1px solid #e4e4e7; font-weight: bold; color: #16a34a; text-align: left;">+ ${fmt(sum.collectedInstallments)}</td>
              </tr>
              <tr style="background: #fafafa;">
                <td style="padding: 8px; border: 1px solid #e4e4e7;">المصروفات والمسحوبات النقدية</td>
                <td style="padding: 8px; border: 1px solid #e4e4e7; font-weight: bold; color: #dc2626; text-align: left;">- ${fmt(sum.cashExpenses)}</td>
              </tr>
              <tr style="background: #f4f4f5; font-weight: bold;">
                <td style="padding: 10px; border: 1px solid #e4e4e7;">إجمالي النقدية المفترضة بالدرج</td>
                <td style="padding: 10px; border: 1px solid #e4e4e7; font-size: 15px; text-align: left;">${fmt(shift.expectedCash ?? 0)} ${cur}</td>
              </tr>
              <tr style="background: #f4f4f5; font-weight: bold;">
                <td style="padding: 10px; border: 1px solid #e4e4e7;">النقدية الفعلية المحصية بالدرج</td>
                <td style="padding: 10px; border: 1px solid #e4e4e7; font-size: 15px; color: #2563eb; text-align: left;">${fmt(shift.actualCash ?? 0)} ${cur}</td>
              </tr>
              <tr style="background: #e0f2fe; font-weight: bold;">
                <td style="padding: 10px; border: 1px solid #bae6fd;">حالة المطابقة (العجز / الزيادة)</td>
                <td style="padding: 10px; border: 1px solid #bae6fd; font-size: 14px; text-align: left;">${diffStatus}</td>
              </tr>
            </tbody>
          </table>

          ${shift.notes ? `<div style="margin-top: 10px; padding: 8px; background: #fafafa; border-radius: 6px;"><strong>ملاحظات:</strong> ${esc(shift.notes)}</div>` : ""}

          <div style="margin-top: 24px; border-top: 1px dashed #ccc; padding-top: 12px; display: flex; justify-content: space-between;">
            <div>توقيع الكاشير: ........................</div>
            <div>توقيع المدير / المراجع: ........................</div>
          </div>
        </div>
      `,
    });

    openPdfDocument(html);
  };

  const actualNum = Number(actualCashInput) || 0;
  const liveDiff = liveMetrics ? actualNum - liveMetrics.expectedCashInDrawer : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Store className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">إدارة وردية الكاشير وتقفيل اليومية (Z-Report)</DialogTitle>
                <DialogDescription className="text-xs">
                  متابعة العهدة النقدية، حركات الدرج، وحساب العجز والزيادة
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-muted/60 p-1 text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setViewTab("current")}
            className={cn(
              "flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
              viewTab === "current" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-4 w-4" />
            <span>الوردية الحالية</span>
            {activeShift ? (
              <Badge variant="outline" className="h-4 px-1.5 bg-success/15 text-success border-success/30 text-[10px]">
                مفتوحة
              </Badge>
            ) : (
              <Badge variant="outline" className="h-4 px-1.5 bg-muted text-muted-foreground text-[10px]">
                مغلقة
              </Badge>
            )}
          </button>
          <button
            type="button"
            onClick={() => setViewTab("history")}
            className={cn(
              "flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
              viewTab === "history" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-4 w-4" />
            <span>سجل الورديات السابقة ({shiftsHistory.length})</span>
          </button>
        </div>

        {viewTab === "current" ? (
          <div>
            {!activeShift ? (
              /* No Active Shift -> Start Shift Form */
              <div className="p-6 rounded-2xl border border-dashed border-border bg-card/50 flex flex-col items-center text-center gap-4 my-2">
                <div className="p-4 rounded-full bg-amber-500/10 text-amber-500">
                  <Lock className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">لا توجد وردية مفتوحة حالياً</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    ابدأ بفتح الدرج وتسجيل العهدة النقدية الافتتاحية لمطابقة المبيعات وحركات الكاشير بدقة.
                  </p>
                </div>

                <div className="w-full max-w-md space-y-3 text-right mt-2">
                  <div>
                    <Label className="text-xs font-semibold">اسم الكاشير / المسؤول</Label>
                    <Input
                      value={cashierNameInput}
                      onChange={(e) => setCashierNameInput(e.target.value)}
                      placeholder="الكاشير العام"
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">العهدة الافتتاحية النقدية بالدرج (ج.م)</Label>
                    <div className="relative mt-1">
                      <Input
                        type="number"
                        min="0"
                        value={openingCashInput}
                        onChange={(e) => setOpeningCashInput(e.target.value)}
                        placeholder="0.00"
                        className="rounded-xl pl-12 font-bold text-base"
                      />
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">ج.م</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[0, 100, 200, 500, 1000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setOpeningCashInput(String(val))}
                          className="px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted text-[11px] font-semibold"
                        >
                          {val === 0 ? "بدون عهدة" : `${val} ج.م`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleStartShift} className="w-full rounded-xl gap-2 font-bold mt-4 shadow-sm">
                    <Unlock className="h-4 w-4" />
                    <span>فتح الوردية وبدء التشغيل</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Active Shift Active -> Summary & Close Form */
              <div className="space-y-4 my-2">
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-success animate-pulse" />
                    <div>
                      <div className="text-sm font-bold text-foreground">
                        وردية مفتوحة: {activeShift.cashierName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        بدأت في: {format(new Date(activeShift.openedAt), "dd MMMM yyyy - hh:mm a", { locale: ar })}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-background text-foreground font-mono font-bold text-xs">
                    عهدة البداية: {fmt(activeShift.openingCash)} ج.م
                  </Badge>
                </div>

                {liveMetrics && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-card border border-border text-right">
                      <div className="text-[11px] text-muted-foreground font-medium">مبيعات الكاش الفورية</div>
                      <div className="text-base font-extrabold text-success mt-1">
                        {fmt(liveMetrics.cashSales)} <span className="text-[10px]">ج.م</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{liveMetrics.ordersCount} طلب</div>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border text-right">
                      <div className="text-[11px] text-muted-foreground font-medium">مقدمات وأقساط محصلة</div>
                      <div className="text-base font-extrabold text-success mt-1">
                        {fmt(liveMetrics.installmentDownPayments + liveMetrics.collectedInstallments)} <span className="text-[10px]">ج.م</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border text-right">
                      <div className="text-[11px] text-muted-foreground font-medium">مصروفات نقدية</div>
                      <div className="text-base font-extrabold text-danger mt-1">
                        {fmt(liveMetrics.cashExpenses)} <span className="text-[10px]">ج.م</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-right">
                      <div className="text-[11px] text-primary font-bold">المفترض وجوده بالدرج</div>
                      <div className="text-lg font-black text-primary mt-1">
                        {fmt(liveMetrics.expectedCashInDrawer)} <span className="text-xs">ج.م</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Close shift form */}
                <div className="p-4 rounded-2xl border border-border bg-card/60 space-y-3 text-right">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-primary" />
                    <span>تقفيل الوردية ومطابقة الدرج (Z-Report)</span>
                  </h4>

                  <div className="grid sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <Label className="text-xs font-semibold">المبلغ الفعلي المعدود بالدرج (ج.م) *</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          value={actualCashInput}
                          onChange={(e) => setActualCashInput(e.target.value)}
                          placeholder="أدخل النقدية الفعلية..."
                          className="rounded-xl pl-12 font-bold text-base"
                        />
                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">ج.م</span>
                      </div>
                    </div>

                    {liveMetrics && actualCashInput !== "" && (
                      <div
                        className={cn(
                          "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between",
                          liveDiff === 0
                            ? "bg-success/10 border-success/30 text-success"
                            : liveDiff > 0
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                            : "bg-danger/10 border-danger/30 text-danger"
                        )}
                      >
                        <span>نتيجة الجرد:</span>
                        <span>
                          {liveDiff === 0
                            ? "متطابق تماماً (0 ج.م)"
                            : liveDiff > 0
                            ? `زيادة بالدرج (+${fmt(liveDiff)} ج.م)`
                            : `عجز بالدرج (-${fmt(Math.abs(liveDiff))} ج.م)`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">ملاحظات التقفيل (اختياري)</Label>
                    <Input
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      placeholder="أسباب العجز/الزيادة أو ملاحظات التسليم..."
                      className="mt-1 rounded-xl text-xs"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleCloseShift}
                      className="flex-1 rounded-xl font-bold bg-danger hover:bg-danger/90 text-danger-foreground gap-2"
                    >
                      <Lock className="h-4 w-4" />
                      <span>تقفيل الوردية وطباعة تقرير Z-Report</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* History Tab */
          <div className="space-y-3 my-2">
            {shiftsHistory.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">لا يوجد سجل ورديات سابق</div>
            ) : (
              shiftsHistory.map((s) => {
                const diff = s.difference ?? 0;
                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{s.cashierName}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] h-4 px-1.5",
                            s.status === "open" ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {s.status === "open" ? "مفتوحة حالياً" : "مقفلة"}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {format(new Date(s.openedAt), "dd/MM/yyyy - hh:mm a")}
                        {s.closedAt && ` ⇦ ${format(new Date(s.closedAt), "hh:mm a")}`}
                      </div>
                      {s.notes && <div className="text-[10px] text-muted-foreground mt-1">ملاحظة: {s.notes}</div>}
                    </div>

                    <div className="flex items-center gap-4">
                      {s.status === "closed" && (
                        <div className="text-left text-xs">
                          <div className="text-muted-foreground text-[10px]">الفعلي / المفترض</div>
                          <div className="font-bold">
                            {fmt(s.actualCash ?? 0)} / {fmt(s.expectedCash ?? 0)} ج.م
                          </div>
                          <div
                            className={cn(
                              "text-[10px] font-bold",
                              diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-success" : "text-danger"
                            )}
                          >
                            {diff === 0 ? "متطابق" : diff > 0 ? `+${fmt(diff)} زيادة` : `-${fmt(Math.abs(diff))} عجز`}
                          </div>
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => printShiftZReport(s, shop.shopName, shop.phone)}
                        className="rounded-xl text-xs gap-1 h-8"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>تقرير</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="outline" className="w-full sm:w-auto rounded-xl text-xs" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
