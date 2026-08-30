import * as React from "react";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Shipment,
  ShipmentCarrier,
  ShippingZone,
  useDB,
  db,
} from "@/lib/store";
import {
  exportShipmentsToExcel,
  parseCarrierExcelReport,
  ExcelCarrierFormat,
  ImportedStatusRecord,
} from "@/lib/shipping-excel";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Layers,
} from "lucide-react";

interface CarrierExcelIntegrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carriers: ShipmentCarrier[];
  zones: ShippingZone[];
  shipments: Shipment[];
  onRefresh?: () => Promise<void>;
}

export function CarrierExcelIntegrationModal({
  open,
  onOpenChange,
  carriers,
  zones,
  shipments,
  onRefresh,
}: CarrierExcelIntegrationModalProps) {
  const { invoices, invoiceItems } = useDB();
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");

  // Export States
  const [exportFormat, setExportFormat] = useState<ExcelCarrierFormat>("bosta");
  const [statusFilter, setStatusFilter] = useState<string>("processing");
  const [carrierFilter, setCarrierFilter] = useState<string>("all");

  // Import States
  const [importing, setImporting] = useState(false);
  const [importedRecords, setImportedRecords] = useState<ImportedStatusRecord[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [applyingUpdates, setApplyingUpdates] = useState(false);
  const [fileName, setFileName] = useState("");

  const shipmentsToExport = useMemo(() => {
    let list = shipments;
    if (statusFilter !== "all") {
      list = list.filter((s) => s.status === statusFilter);
    }
    if (carrierFilter !== "all") {
      list = list.filter((s) => s.carrierId === carrierFilter);
    }
    return list.map((shipment) => {
      const carrier = carriers.find((c) => c.id === shipment.carrierId);
      const zone = zones.find((z) => z.id === shipment.zoneId);
      const invoice = invoices.find((inv) => inv.id === shipment.invoiceId);
      const items = invoiceItems.filter((it) => it.invoiceId === shipment.invoiceId);
      return { shipment, carrier, zone, invoice, items };
    });
  }, [shipments, statusFilter, carrierFilter, carriers, zones, invoices, invoiceItems]);

  const handleExport = () => {
    if (shipmentsToExport.length === 0) {
      toast.error("لا توجد شحنات مطابقة للفلاتر لتصديرها");
      return;
    }
    exportShipmentsToExcel(shipmentsToExport, exportFormat);
    toast.success(`تم تصدير ${shipmentsToExport.length} شحنة بصيغة ${exportFormat.toUpperCase()} بنجاح!`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImporting(true);
    try {
      const result = await parseCarrierExcelReport(file, shipments);
      setImportedRecords(result.records);
      setUnmatchedCount(result.unmatchedCount);
      toast.success(`تم قراءة ملف الإكسيل وتحليل ${result.records.length} شحنة`);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء قراءة ملف الإكسيل");
    } finally {
      setImporting(false);
    }
  };

  const handleApplyUpdates = async () => {
    const matched = importedRecords.filter((r) => r.matchedShipment);
    if (matched.length === 0) {
      toast.error("لا توجد شحنات متطابقة لتحديثها");
      return;
    }

    setApplyingUpdates(true);
    let successCount = 0;
    try {
      for (const rec of matched) {
        if (rec.matchedShipment) {
          await db.updateShipmentStatus(
            rec.matchedShipment.id,
            rec.status,
            rec.notes || `تحديث تلقائي عبر استيراد إكسيل (${rec.statusTextRaw || rec.status})`
          );
          successCount++;
        }
      }

      toast.success(`تم تحديث ${successCount} شحنة بنجاح في قاعدة البيانات!`);
      if (onRefresh) await onRefresh();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "تعذر إكمال بعض التحديثات");
    } finally {
      setApplyingUpdates(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-5" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">التكامل مع شركات الشحن عبر الإكسيل</DialogTitle>
              <DialogDescription>
                تصدير شحنات المتجر بصيغ بوسطة، J&T، أرامكس، ومايلرز، واستيراد تقارير الحالات وتحديثها بنقرة واحدة.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="export" className="gap-2 font-bold">
              <Download className="h-4 w-4" />
              تصدير شحنات لشركة الشحن
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2 font-bold">
              <Upload className="h-4 w-4" />
              استيراد تقرير وتحديث الحالات
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: EXPORT */}
          <TabsContent value="export" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/30 p-3 rounded-lg border">
              <div>
                <span className="text-xs font-bold block mb-1">صيغة وقالب شركة الشحن:</span>
                <Select value={exportFormat} onValueChange={(v: ExcelCarrierFormat) => setExportFormat(v)}>
                  <SelectTrigger className="bg-background font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bosta">بوسطة (Bosta Template)</SelectItem>
                    <SelectItem value="jt">J&T Express Template</SelectItem>
                    <SelectItem value="mylerz">مايلرز (Mylerz Template)</SelectItem>
                    <SelectItem value="aramex">أرامكس (Aramex Template)</SelectItem>
                    <SelectItem value="generic">قالب تفصيلي عام (Generic Master)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <span className="text-xs font-bold block mb-1">تصفية حسب الحالة:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="processing">قيد التجهيز (جاهزة للتسليم)</SelectItem>
                    <SelectItem value="pending">جديدة (قيد الانتظار)</SelectItem>
                    <SelectItem value="shipped">خرجت مع المندوب</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <span className="text-xs font-bold block mb-1">تصفية حسب المندوب:</span>
                <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المناديب والشركات</SelectItem>
                    {carriers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview Count & Info */}
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <FileCheck className="h-5 w-5 text-primary" />
                <span>
                  عدد الشحنات الجاهزة للتصدير في هذا الملف:{" "}
                  <strong className="text-primary text-base font-black">{shipmentsToExport.length}</strong> شحنة
                </span>
              </div>
              <Button onClick={handleExport} className="gap-2 font-bold bg-emerald-600 hover:bg-emerald-700">
                <Download className="h-4 w-4" />
                تحميل ملف Excel الآن
              </Button>
            </div>

            {/* Preview Table */}
            <div className="max-h-52 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/60 text-muted-foreground border-b sticky top-0">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">المستلم</th>
                    <th className="p-2">الموبايل</th>
                    <th className="p-2">المنطقة / العنوان</th>
                    <th className="p-2">التحصيل (COD)</th>
                    <th className="p-2">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-card">
                  {shipmentsToExport.slice(0, 15).map((row, i) => (
                    <tr key={row.shipment.id} className="hover:bg-muted/20">
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2 font-bold">{row.shipment.recipientName || "عميل"}</td>
                      <td className="p-2 text-muted-foreground">{row.shipment.recipientPhone || "-"}</td>
                      <td className="p-2 truncate max-w-[150px]">{row.shipment.deliveryAddress || "-"}</td>
                      <td className="p-2 font-bold text-emerald-600">{row.shipment.codAmount || 0} ج.م</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-[10px]">
                          {row.shipment.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TAB 2: IMPORT */}
          <TabsContent value="import" className="space-y-4 pt-3">
            <div className="p-6 border-2 border-dashed rounded-xl text-center bg-muted/20 hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-2">
              <Upload className="h-8 w-8 text-primary/70" />
              <div>
                <p className="font-bold text-sm">ارفع ملف إكسيل تقرير شركة الشحن</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  يدعم تقارير Bosta, J&T, Aramex, Mylerz أو أي شيت إكسيل يحتوي على أرقام التتبع والحالات.
                </p>
              </div>
              <label className="cursor-pointer mt-2">
                <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-all">
                  <FileSpreadsheet className="h-4 w-4" />
                  اختر ملف الإكسيل (.xlsx / .xls)
                </span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {fileName && <span className="text-xs font-mono font-bold text-primary mt-1">الملف: {fileName}</span>}
            </div>

            {/* Import Results Table */}
            {importedRecords.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    تم التعرف على {importedRecords.filter((r) => r.matchedShipment).length} شحنة متطابقة في النظام
                  </span>
                  {unmatchedCount > 0 && (
                    <span className="text-warning flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {unmatchedCount} شحنات غير متطابقة
                    </span>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto border rounded-lg bg-card">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-muted/60 text-muted-foreground border-b sticky top-0">
                      <tr>
                        <th className="p-2">رقم التتبع في الملف</th>
                        <th className="p-2">المستلم</th>
                        <th className="p-2">الحالة الحالية ⬅️ الجديدة</th>
                        <th className="p-2">مبلغ COD</th>
                        <th className="p-2">التطابق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importedRecords.map((rec, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="p-2 font-mono font-bold">{rec.trackingNumber}</td>
                          <td className="p-2">{rec.matchedShipment?.recipientName || rec.recipientName || "-"}</td>
                          <td className="p-2">
                            <span className="text-muted-foreground">
                              {rec.matchedShipment?.status || "غير مسجل"}
                            </span>{" "}
                            ➡️{" "}
                            <Badge
                              variant={
                                rec.status === "delivered"
                                  ? "default"
                                  : rec.status === "returned"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {rec.status === "delivered"
                                ? "تم التسليم"
                                : rec.status === "returned"
                                ? "مرتجع"
                                : rec.status === "shipped"
                                ? "خرجت للتوصيل"
                                : rec.status}
                            </Badge>
                          </td>
                          <td className="p-2 font-bold">{rec.collectedAmount ?? "-"} ج.م</td>
                          <td className="p-2">
                            {rec.matchedShipment ? (
                              <Badge className="bg-success/20 text-success text-[10px]">متطابقة ✅</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                غير مسجلة ⚠️
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    onClick={handleApplyUpdates}
                    disabled={applyingUpdates || importedRecords.filter((r) => r.matchedShipment).length === 0}
                    className="gap-2 font-bold bg-primary"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {applyingUpdates
                      ? "جاري تطبيق التحديثات..."
                      : `تطبيق التحديثات على (${
                          importedRecords.filter((r) => r.matchedShipment).length
                        }) شحنة متطابقة`}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
