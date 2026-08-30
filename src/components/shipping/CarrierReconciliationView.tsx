import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ShipmentCarrier,
  Shipment,
  useDB,
} from "@/lib/store";
import {
  loadCarrierTransactions,
  saveCarrierTransaction,
  deleteCarrierTransaction,
  calculateCarrierSummary,
  printCarrierReconciliationReport,
  exportCarrierLedgerToExcel,
  CarrierSettlementTransaction,
} from "@/lib/carrier-ledger";
import { toast } from "sonner";
import {
  Calculator,
  Printer,
  FileSpreadsheet,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Search,
  Filter,
} from "lucide-react";

interface CarrierReconciliationViewProps {
  carriers: ShipmentCarrier[];
  shipments: Shipment[];
  onRefresh?: () => Promise<void>;
}

export function CarrierReconciliationView({
  carriers,
  shipments,
  onRefresh,
}: CarrierReconciliationViewProps) {
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>(carriers[0]?.id || "");
  const [transactions, setTransactions] = useState<CarrierSettlementTransaction[]>([]);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form states for new settlement
  const [settleAmount, setSettleAmount] = useState<number | "">("");
  const [settleType, setSettleType] = useState<"settlement" | "partial_payment">("settlement");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "instapay" | "vodafone_cash" | "bank_transfer" | "other">("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const refreshTransactions = () => {
    setTransactions(loadCarrierTransactions());
  };

  useEffect(() => {
    refreshTransactions();
  }, []);

  useEffect(() => {
    if (carriers.length > 0 && !selectedCarrierId) {
      setSelectedCarrierId(carriers[0].id);
    }
  }, [carriers, selectedCarrierId]);

  const selectedCarrier = useMemo(() => {
    return carriers.find((c) => c.id === selectedCarrierId) || carriers[0];
  }, [carriers, selectedCarrierId]);

  const summary = useMemo(() => {
    if (!selectedCarrier) return null;
    return calculateCarrierSummary(selectedCarrier, shipments, transactions);
  }, [selectedCarrier, shipments, transactions]);

  const carrierShipments = useMemo(() => {
    if (!selectedCarrier) return [];
    let list = shipments.filter((s) => s.carrierId === selectedCarrier.id);

    if (statusFilter !== "all") {
      list = list.filter((s) => s.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.trackingNumber && s.trackingNumber.toLowerCase().includes(q)) ||
          (s.recipientName && s.recipientName.toLowerCase().includes(q)) ||
          (s.recipientPhone && s.recipientPhone.includes(q)) ||
          s.id.toLowerCase().includes(q)
      );
    }

    return list;
  }, [shipments, selectedCarrier, statusFilter, searchQuery]);

  const carrierTransactions = useMemo(() => {
    if (!selectedCarrier) return [];
    return transactions.filter((t) => t.carrierId === selectedCarrier.id);
  }, [transactions, selectedCarrier]);

  const handleOpenSettleModal = (type: "full" | "partial") => {
    if (!summary) return;
    if (type === "full") {
      setSettleAmount(summary.currentOutstandingBalance);
      setSettleType("settlement");
    } else {
      setSettleAmount("");
      setSettleType("partial_payment");
    }
    setSettlementModalOpen(true);
  };

  const handleSaveSettlement = () => {
    if (!selectedCarrier || !settleAmount || Number(settleAmount) <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح للتوريد والتسوية");
      return;
    }

    saveCarrierTransaction({
      carrierId: selectedCarrier.id,
      type: settleType,
      amount: Number(settleAmount),
      date: new Date().toISOString(),
      paymentMethod,
      referenceNumber,
      notes,
    });

    toast.success(`تم تسجيل توريد بمبلغ ${Number(settleAmount).toLocaleString("ar-EG")} ج.م بنجاح`);
    setSettlementModalOpen(false);
    refreshTransactions();
    if (onRefresh) onRefresh();
  };

  const handleDeleteTx = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذه الحركة من كشف الحساب؟")) {
      deleteCarrierTransaction(id);
      refreshTransactions();
      toast.success("تم حذف حركة التوريد");
    }
  };

  if (!selectedCarrier || carriers.length === 0) {
    return (
      <BezelCard className="p-8 text-center text-muted-foreground">
        <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="font-bold">لا يوجد مناديب أو شركات شحن مسجلة بعد.</p>
        <p className="text-xs mt-1">أضف مندوباً من تبويب (المناديب) لبدء متابعة المطابقات والتسويات المالية.</p>
      </BezelCard>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header & Carrier Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">كشف حساب ومطابقة مالية لشركات الشحن</h2>
            <p className="text-xs text-muted-foreground">
              تصفية التحصيلات (COD)، عمولات الشحن، وخصومات المرتجعات مع كشف حساب تفصيلي.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Select value={selectedCarrierId} onValueChange={setSelectedCarrierId}>
            <SelectTrigger className="w-full sm:w-56 font-bold bg-background">
              <SelectValue placeholder="اختر المندوب..." />
            </SelectTrigger>
            <SelectContent>
              {carriers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => summary && exportCarrierLedgerToExcel(summary, shipments, transactions)}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            تصدير Excel
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => summary && printCarrierReconciliationReport(summary, shipments, transactions)}
          >
            <Printer className="h-4 w-4" />
            طباعة المطابقة PDF
          </Button>
        </div>
      </div>

      {/* Financial KPIs Overview */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <BezelCard className="p-3.5 bg-card">
            <span className="text-xs text-muted-foreground">شحنات مسلّمة</span>
            <p className="text-xl font-black text-foreground mt-1">
              {summary.deliveredCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">/ {summary.totalShipments}</span>
            </p>
          </BezelCard>

          <BezelCard className="p-3.5 bg-card">
            <span className="text-xs text-muted-foreground">إجمالي محصّل COD</span>
            <p className="text-xl font-black text-emerald-600 mt-1">
              {summary.totalCodCollected.toLocaleString("ar-EG")}{" "}
              <span className="text-[10px] font-normal">ج.م</span>
            </p>
          </BezelCard>

          <BezelCard className="p-3.5 bg-card">
            <span className="text-xs text-muted-foreground">عمولة الشحن المستحقة (-)</span>
            <p className="text-xl font-black text-destructive mt-1">
              - {summary.totalCarrierFees.toLocaleString("ar-EG")}{" "}
              <span className="text-[10px] font-normal">ج.م</span>
            </p>
          </BezelCard>

          <BezelCard className="p-3.5 bg-card">
            <span className="text-xs text-muted-foreground">صافي مستحق المتجر</span>
            <p className="text-xl font-black text-primary mt-1">
              {summary.netStoreDue.toLocaleString("ar-EG")}{" "}
              <span className="text-[10px] font-normal">ج.م</span>
            </p>
          </BezelCard>

          <BezelCard className="p-3.5 bg-card">
            <span className="text-xs text-muted-foreground">المبالغ المورّدة سابقاً</span>
            <p className="text-xl font-black text-emerald-600 mt-1">
              {summary.totalSettledAmount.toLocaleString("ar-EG")}{" "}
              <span className="text-[10px] font-normal">ج.م</span>
            </p>
          </BezelCard>

          <BezelCard
            className={`p-3.5 ${
              summary.currentOutstandingBalance > 0
                ? "bg-warning/15 border-warning/40"
                : "bg-success/15 border-success/40"
            }`}
          >
            <span className="text-xs font-bold text-muted-foreground">الرصيد المعلق المتبقي</span>
            <p
              className={`text-xl font-black mt-1 ${
                summary.currentOutstandingBalance > 0 ? "text-warning" : "text-success"
              }`}
            >
              {summary.currentOutstandingBalance.toLocaleString("ar-EG")}{" "}
              <span className="text-[10px] font-normal">ج.م</span>
            </p>
          </BezelCard>
        </div>
      )}

      {/* Action Bar for Settlements */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">تسوية وتوريد مالي للمندوب:</span>
          <Button
            size="sm"
            onClick={() => handleOpenSettleModal("full")}
            disabled={!summary || summary.currentOutstandingBalance <= 0}
            className="gap-1.5 font-bold"
          >
            <CheckCircle2 className="h-4 w-4" />
            تصفية وتسوية كامل المبلغ ({summary?.currentOutstandingBalance.toLocaleString("ar-EG")} ج.م)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenSettleModal("partial")}
            className="gap-1.5 font-bold"
          >
            <PlusCircle className="h-4 w-4 text-primary" />
            تسجيل دفعة / توريد جزئي
          </Button>
        </div>
      </div>

      {/* Settlements & Transactions Log */}
      {carrierTransactions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
            سجل التوريدات والمدفوعات المسجلة لهذا المندوب ({carrierTransactions.length})
          </h3>
          <div className="overflow-x-auto border rounded-xl bg-card">
            <table className="w-full text-xs text-right">
              <thead className="bg-muted/50 text-muted-foreground border-b">
                <tr>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3">نوع الحركة</th>
                  <th className="p-3">المبلغ</th>
                  <th className="p-3">طريقة الدفع</th>
                  <th className="p-3">رقم المرجع / ملاحظات</th>
                  <th className="p-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {carrierTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/20">
                    <td className="p-3">{new Date(t.date).toLocaleDateString("ar-EG")}</td>
                    <td className="p-3">
                      <Badge
                        variant={t.type === "return_penalty" ? "destructive" : "default"}
                        className="text-[10px]"
                      >
                        {t.type === "settlement"
                          ? "تصفية كاملة"
                          : t.type === "partial_payment"
                          ? "توريد جزئي"
                          : "خصم مرتجع"}
                      </Badge>
                    </td>
                    <td className="p-3 font-bold text-foreground">
                      {t.amount.toLocaleString("ar-EG")} ج.م
                    </td>
                    <td className="p-3">
                      {t.paymentMethod === "instapay"
                        ? "إنستاباي (InstaPay)"
                        : t.paymentMethod === "vodafone_cash"
                        ? "محفظة كاش"
                        : t.paymentMethod === "bank_transfer"
                        ? "تحويل بنكي"
                        : "نقدي (كاش)"}
                    </td>
                    <td className="p-3 text-muted-foreground">{t.referenceNumber || t.notes || "-"}</td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteTx(t.id)}
                        title="حذف الحركة"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Shipments Breakdown */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            شحنات المندوب المضمنة في المطابقة ({carrierShipments.length})
          </h3>

          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالتتبع أو العميل..."
                className="pr-8 h-8 text-xs"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="delivered">مسلّمة (Delivered)</SelectItem>
                <SelectItem value="returned">مرتجعة (Returned)</SelectItem>
                <SelectItem value="shipped">مع المندوب (Shipped)</SelectItem>
                <SelectItem value="processing">قيد التجهيز</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-xl bg-card">
          <table className="w-full text-xs text-right">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">رقم التتبع</th>
                <th className="p-3">المستلم والموبايل</th>
                <th className="p-3">العنوان</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">مبلغ التحصيل (COD)</th>
                <th className="p-3">أجرة الشحن</th>
                <th className="p-3">صافي المتجر</th>
                <th className="p-3">تاريخ الإنشاء</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {carrierShipments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    لا توجد شحنات تطابق الفلتر لهذا المندوب.
                  </td>
                </tr>
              ) : (
                carrierShipments.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="p-3 text-muted-foreground">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-primary">
                      #{s.trackingNumber || s.id.slice(0, 8)}
                    </td>
                    <td className="p-3">
                      <div className="font-bold">{s.recipientName || "عميل"}</div>
                      <div className="text-[10px] text-muted-foreground">{s.recipientPhone || "-"}</div>
                    </td>
                    <td className="p-3 text-muted-foreground max-w-[180px] truncate">
                      {s.deliveryAddress || "-"}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          s.status === "delivered"
                            ? "default"
                            : s.status === "returned"
                            ? "destructive"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {s.status === "delivered"
                          ? "تم التسليم"
                          : s.status === "returned"
                          ? "مرتجع"
                          : s.status === "shipped"
                          ? "خرجت للتوصيل"
                          : s.status === "processing"
                          ? "قيد التجهيز"
                          : s.status}
                      </Badge>
                    </td>
                    <td className="p-3 font-bold text-emerald-600">{s.codAmount || 0} ج.م</td>
                    <td className="p-3 text-destructive">{s.shippingCost || 0} ج.م</td>
                    <td className="p-3 font-black text-foreground">
                      {(s.codAmount || 0) - (s.shippingCost || 0)} ج.م
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {s.createdAt ? new Date(s.createdAt).toLocaleDateString("ar-EG") : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Settlement Modal */}
      <Dialog open={settlementModalOpen} onOpenChange={setSettlementModalOpen}>
        <DialogContent className="max-w-md p-5" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              تسجيل توريد وتسوية نقدية للمندوب
            </DialogTitle>
            <DialogDescription>
              تسجيل المبالغ النقدية المحصلة من المندوب وتوريدها لحساب المتجر.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">المندوب:</Label>
              <Input value={selectedCarrier.name} disabled className="bg-muted font-bold mt-1" />
            </div>

            <div>
              <Label className="text-xs">نوع التسوية:</Label>
              <Select
                value={settleType}
                onValueChange={(v: "settlement" | "partial_payment") => setSettleType(v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="settlement">تصفية كاملة للرصيد</SelectItem>
                  <SelectItem value="partial_payment">توريد / دفعة جزئية</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">المبلغ المورد (ج.م) *</Label>
              <Input
                type="number"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value ? Number(e.target.value) : "")}
                placeholder="أدخل المبلغ..."
                className="font-bold text-lg mt-1"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs">طريقة الاستلام:</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v: any) => setPaymentMethod(v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي (كاش باليد)</SelectItem>
                  <SelectItem value="instapay">إنستاباي (InstaPay)</SelectItem>
                  <SelectItem value="vodafone_cash">محفظة فودافون / كاش</SelectItem>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">رقم المرجع / الإيصال (اختياري):</Label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="مثال: رقم تحويل انستاباي أو إيصال استلام..."
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">ملاحظات إضافية:</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي تفاصيل عن التوريد..."
                className="text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setSettlementModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSaveSettlement} className="font-bold gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              حفظ التوريد والتسوية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
