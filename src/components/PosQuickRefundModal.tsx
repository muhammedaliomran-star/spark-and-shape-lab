import { useState, useMemo } from "react";
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
import { useDB, db, fmt, useShopSettings } from "@/lib/store";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Undo2,
  Search,
  Receipt,
  Package,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Trash2,
  Plus,
  Coins,
  Banknote,
} from "lucide-react";

interface PosQuickRefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefundCompleted?: () => void;
}

export function PosQuickRefundModal({
  open,
  onOpenChange,
  onRefundCompleted,
}: PosQuickRefundModalProps) {
  const data = useDB();
  const { settings: shop } = useShopSettings();

  const [mode, setMode] = useState<"by_invoice" | "by_item">("by_invoice");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<
    Array<{ stockId?: string; name: string; unitPrice: number; quantity: number; maxQty?: number }>
  >([]);
  const [refundType, setRefundType] = useState<"cash" | "account">("cash");
  const [refundReason, setRefundReason] = useState("رغبة العميل / استرجاع سريع للكاشير");
  const [saving, setSaving] = useState(false);

  // Filter recent cash invoices (last 50)
  const recentInvoices = useMemo(() => {
    const term = searchInvoice.trim().toLowerCase();
    return data.invoices
      .filter((inv) => inv.status !== "cancelled")
      .slice(0, 40)
      .filter((inv) => {
        if (!term) return true;
        const cust = data.customers.find((c) => c.id === inv.customerId);
        return (
          inv.id.toLowerCase().includes(term) ||
          inv.notes?.toLowerCase().includes(term) ||
          (cust?.name.toLowerCase().includes(term) ?? false) ||
          (cust?.phone.includes(term) ?? false)
        );
      });
  }, [data.invoices, data.customers, searchInvoice]);

  const selectedInvoice = useMemo(() => {
    return data.invoices.find((i) => i.id === selectedInvoiceId) || null;
  }, [data.invoices, selectedInvoiceId]);

  const selectedInvoiceItems = useMemo(() => {
    if (!selectedInvoiceId) return [];
    return data.invoiceItems.filter((it) => it.invoiceId === selectedInvoiceId);
  }, [data.invoiceItems, selectedInvoiceId]);

  const handleSelectInvoice = (inv: (typeof data.invoices)[0]) => {
    setSelectedInvoiceId(inv.id);
    const items = data.invoiceItems.filter((it) => it.invoiceId === inv.id);
    if (items.length > 0) {
      setReturnItems(
        items.map((it) => ({
          name: it.name,
          unitPrice: it.price,
          quantity: it.quantity,
          maxQty: it.quantity,
        }))
      );
    }
  };

  const totalRefundAmount = returnItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);

  const handleExecuteRefund = async () => {
    if (returnItems.length === 0) {
      toast.error("يرجى اختيار أصناف للاسترجاع");
      return;
    }
    if (totalRefundAmount <= 0) {
      toast.error("مبلغ المرتجع يجب أن يكون أكبر من الصفر");
      return;
    }

    try {
      setSaving(true);

      // 1. Record Return in DB
      await db.addReturn({
        invoiceId: selectedInvoiceId || null,
        type: "sale",
        totalAmount: totalRefundAmount,
        reason: refundReason,
        notes: `استرجاع POS نقدي سريع — طريقة الرد: ${refundType === "cash" ? "نقداً من الدرج" : "رصيد دائن للعميل"}`,
        items: returnItems.map((it) => ({
          name: it.name,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
        })),
      });

      // 2. Restore Stock Quantity
      const stockUpdates: Array<{ name: string; quantity: number; unitCost: number }> = [];
      returnItems.forEach((it) => {
        const matchedStock = data.stockItems.find((s) => s.name === it.name || s.id === it.stockId);
        stockUpdates.push({
          name: it.name,
          quantity: it.quantity,
          unitCost: matchedStock?.lastUnitCost || 0,
        });
      });

      if (stockUpdates.length > 0) {
        await db.upsertStockDeltas(stockUpdates);
      }

      // 3. Dispatch shift change notification so Z-Report metrics update
      window.dispatchEvent(new CustomEvent("segilly:shift_changed"));

      toast.success(`تم استرجاع الأصناف ورد مبلغ ${fmt(totalRefundAmount)} ج.م بنجاح ✓`);

      // Print Refund Receipt
      printRefundReceipt({
        refundId: "REF-" + Date.now().toString().slice(-6),
        invoiceId: selectedInvoiceId,
        items: returnItems,
        total: totalRefundAmount,
        refundType,
        reason: refundReason,
        customerName: selectedInvoice ? data.customers.find((c) => c.id === selectedInvoice.customerId)?.name : undefined,
      });

      // Reset & close
      setSelectedInvoiceId(null);
      setReturnItems([]);
      onRefundCompleted?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "تعذر إتمام عملية الاسترجاع");
    } finally {
      setSaving(false);
    }
  };

  const printRefundReceipt = (opts: {
    refundId: string;
    invoiceId?: string | null;
    items: typeof returnItems;
    total: number;
    refundType: "cash" | "account";
    reason: string;
    customerName?: string;
  }) => {
    const cur = "ج.م";
    const html = pdfDocument({
      docTitle: `إيصال مرتجع نقدي — ${opts.refundId}`,
      badge: "إيصال مرتجع كاشير",
      title: "إيصال استرجاع بضاعة ونقدية",
      lede: `تم استرجاع البضاعة وتأكيد رد المبلغ من الخزينة بتاريخ ${format(new Date(), "dd/MM/yyyy hh:mm a")}`,
      meta: [
        { label: "المحل", value: shop.shopName || "سِجلّي" },
        { label: "رقم المرتجع", value: opts.refundId },
        { label: "الفاتورة الأصلية", value: opts.invoiceId ? opts.invoiceId.slice(-8) : "مباشر" },
        { label: "طريقة الرد", value: opts.refundType === "cash" ? "نقداً من الدرج (كاش)" : "حساب العميل" },
        ...(opts.customerName ? [{ label: "العميل", value: opts.customerName }] : []),
      ],
      body: `
        <div style="font-size: 13px; line-height: 1.6;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="background: #f4f4f5; text-align: right;">
                <th style="padding: 8px; border: 1px solid #e4e4e7;">الصنف المسترجع</th>
                <th style="padding: 8px; border: 1px solid #e4e4e7; text-align: center;">الكمية</th>
                <th style="padding: 8px; border: 1px solid #e4e4e7; text-align: left;">سعر الوحدة</th>
                <th style="padding: 8px; border: 1px solid #e4e4e7; text-align: left;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${opts.items
                .map(
                  (it) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #e4e4e7;">${it.name}</td>
                  <td style="padding: 8px; border: 1px solid #e4e4e7; text-align: center;">${it.quantity}</td>
                  <td style="padding: 8px; border: 1px solid #e4e4e7; text-align: left;">${fmt(it.unitPrice)} ${cur}</td>
                  <td style="padding: 8px; border: 1px solid #e4e4e7; text-align: left; font-weight: bold;">${fmt(it.unitPrice * it.quantity)} ${cur}</td>
                </tr>
              `
                )
                .join("")}
              <tr style="background: #fee2e2; font-weight: bold;">
                <td colspan="3" style="padding: 10px; border: 1px solid #fca5a5; font-size: 14px;">إجمالي المبلغ المسترد للعميل</td>
                <td style="padding: 10px; border: 1px solid #fca5a5; text-align: left; font-size: 16px; color: #dc2626;">- ${fmt(opts.total)} ${cur}</td>
              </tr>
            </tbody>
          </table>

          <div style="padding: 8px 12px; background: #fafafa; border-radius: 6px; margin-bottom: 16px;">
            <strong>سبب المرتجع:</strong> ${opts.reason}
          </div>

          <div style="border-top: 1px dashed #ccc; padding-top: 12px; display: flex; justify-content: space-between; font-size: 12px;">
            <div>توقيع المستلم (العميل): ...................</div>
            <div>توقيع الكاشير: ...................</div>
          </div>
        </div>
      `,
    });

    openPdfDocument(html);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-danger/10 text-danger">
              <Undo2 className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-extrabold text-foreground">
                مرتجع كاشير سريع (POS Refund)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                إرجاع الأصناف للمخزن ورد المبلغ للعميل مع توثيق الحركة في الوردية
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step 1: Select Invoice or Item */}
        {!selectedInvoiceId ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                placeholder="ابحث برقم الفاتورة أو اسم العميل أو هاتفه..."
                className="pr-9 rounded-2xl h-10 text-xs"
              />
            </div>

            <div className="text-xs font-bold text-muted-foreground">أحدث فواتير البيع:</div>

            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {recentInvoices.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border rounded-2xl border-dashed">
                  لا توجد فواتير مطابقة للبحث
                </div>
              ) : (
                recentInvoices.map((inv) => {
                  const cust = data.customers.find((c) => c.id === inv.customerId);
                  return (
                    <div
                      key={inv.id}
                      onClick={() => handleSelectInvoice(inv)}
                      className="p-3 rounded-2xl border border-border/70 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            #{inv.id.slice(-6)}
                          </Badge>
                          <span className="font-bold text-foreground">{cust?.name || "عميل نقدي"}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {format(new Date(inv.createdAt), "dd/MM hh:mm a")}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1">
                          {inv.notes || "فاتورة بيع نقدي"}
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className="font-black text-sm text-foreground font-mono">{fmt(inv.total)} ج.م</div>
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] text-primary gap-1 px-2">
                          اختيار للاسترجاع <Undo2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Step 2: Configure Return Items and Quantities */
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border text-xs">
              <div>
                <span className="text-muted-foreground">الفاتورة المحددة: </span>
                <span className="font-bold font-mono">#{selectedInvoiceId.slice(-8)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedInvoiceId(null);
                  setReturnItems([]);
                }}
                className="h-7 text-xs text-danger"
              >
                تغيير الفاتورة
              </Button>
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">الأصناف المراد استرجاعها:</Label>
              <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                {returnItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border border-border/60 bg-card flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1">
                      <div className="font-bold text-foreground">{it.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        سعر الوحدة: {fmt(it.unitPrice)} ج.م
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] text-muted-foreground">الكمية:</Label>
                        <Input
                          type="number"
                          min="1"
                          max={it.maxQty || 999}
                          value={it.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(Number(e.target.value) || 1, it.maxQty || 999));
                            const updated = [...returnItems];
                            updated[idx].quantity = val;
                            setReturnItems(updated);
                          }}
                          className="w-16 h-8 text-center font-bold text-xs rounded-xl"
                        />
                      </div>

                      <div className="w-20 text-left font-black text-sm text-danger font-mono">
                        {fmt(it.unitPrice * it.quantity)} ج.م
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setReturnItems(returnItems.filter((_, i) => i !== idx));
                        }}
                        className="h-7 w-7 text-muted-foreground hover:text-danger rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Refund Method & Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-foreground mb-1 block">طريقة رد المبلغ:</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundType("cash")}
                    className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      refundType === "cash"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Banknote className="h-4 w-4" /> نقداً من الدرج
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundType("account")}
                    className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      refundType === "account"
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Coins className="h-4 w-4" /> رصيد للعميل
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground mb-1 block">سبب الاسترجاع:</Label>
                <Input
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="سبب الاسترجاع..."
                  className="rounded-2xl h-10 text-xs"
                />
              </div>
            </div>

            {/* Total Refund Banner */}
            <div className="p-4 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-danger">إجمالي المبلغ المسترد</div>
                <div className="text-xl font-black text-danger font-mono mt-0.5">
                  - {fmt(totalRefundAmount)} <span className="text-xs">ج.م</span>
                </div>
              </div>
              <Badge className="bg-danger text-white hover:bg-danger text-xs font-bold">
                {refundType === "cash" ? "يخصم من درج الوردية" : "يضاف لحساب العميل"}
              </Badge>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
            إلغاء
          </Button>
          {selectedInvoiceId && (
            <Button
              onClick={handleExecuteRefund}
              disabled={saving || returnItems.length === 0}
              className="rounded-xl font-bold gap-2 text-xs bg-danger hover:bg-danger/90 text-white flex-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>تأكيد المرتجع وطباعة الإيصال ({fmt(totalRefundAmount)} ج.م)</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
