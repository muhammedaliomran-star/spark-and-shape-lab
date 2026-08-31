import { useState, useRef } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  Download,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Loader2,
} from "lucide-react";
import { exportToExcel, parseExcelFile } from "@/lib/excel-helper";
import { db, fmt, type StockItem } from "@/lib/store";
import { toast } from "sonner";

interface InventoryExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockItems: StockItem[];
}

export function InventoryExcelDialog({
  open,
  onOpenChange,
  stockItems,
}: InventoryExcelDialogProps) {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    total: number;
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = stockItems.map((item) => ({
      "اسم المنتج": item.name,
      "كود الباركود": item.barcode || "",
      "الكمية الحالية": item.quantity || 0,
      "سعر البيع": item.salePrice || 0,
      "سعر التكلفة": item.lastUnitCost || 0,
      "حد الطلب الأدنى": item.lowStockAlert || 5,
      "الموسم": item.season || "",
      "التصنيف": item.category || "",
      "ملاحظات": item.notes || "",
    }));

    exportToExcel(
      [{ sheetName: "المخزون والمنتجات", data }],
      `مخزون_المتجر_${new Date().toISOString().slice(0, 10)}`
    );
    toast.success("تم تصدير ملف إكسيل للمخزون بنجاح ✓");
    onOpenChange(false);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "اسم المنتج": "قميص قطن أبيض",
        "كود الباركود": "6221234567890",
        "الكمية الحالية": 20,
        "سعر البيع": 350,
        "سعر التكلفة": 220,
        "حد الطلب الأدنى": 5,
        "الموسم": "summer",
        "التصنيف": "clothing",
        "ملاحظات": "خامة عالية الجودة",
      },
      {
        "اسم المنتج": "بنطلون جينز كحلي",
        "كود الباركود": "6221234567891",
        "الكمية الحالية": 15,
        "سعر البيع": 450,
        "سعر التكلفة": 300,
        "حد الطلب الأدنى": 3,
        "الموسم": "all",
        "التصنيف": "clothing",
        "ملاحظات": "",
      },
    ];

    exportToExcel(
      [{ sheetName: "نموذج_استيراد_المنتجات", data: templateData }],
      "نموذج_استيراد_منتجات_المخزن"
    );
    toast.success("تم تنزيل قالب إكسيل النموذجي ✓");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResults(null);

    try {
      const rows = await parseExcelFile(file);
      if (rows.length === 0) {
        toast.error("الملف فارغ أو لا يحتوي على صفوف بيانات صالحة");
        setImporting(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const errMsgs: string[] = [];

      for (const row of rows) {
        // Find property names loosely
        const name =
          row["اسم المنتج"] || row["الاسم"] || row["name"] || row["Name"] || row["Product"];
        const barcode =
          row["كود الباركود"] || row["الباركود"] || row["barcode"] || row["Barcode"] || "";
        const qty = Number(
          row["الكمية الحالية"] || row["الكمية"] || row["quantity"] || row["Qty"] || 0
        );
        const salePrice = Number(
          row["سعر البيع"] || row["السعر"] || row["sale_price"] || row["Price"] || 0
        );
        const costPrice = Number(
          row["سعر التكلفة"] || row["التكلفة"] || row["cost"] || row["Cost"] || 0
        );
        const lowStock = Number(row["حد الطلب الأدنى"] || row["حد الطلب"] || row["low_stock"] || 5);
        const notes = row["ملاحظات"] || row["notes"] || "";

        if (!name || String(name).trim() === "") {
          failCount++;
          errMsgs.push("صف بدون اسم منتج تم تخطيه");
          continue;
        }

        try {
          // Check if item already exists by barcode or name
          const existing = stockItems.find(
            (s) => (barcode && s.barcode === String(barcode).trim()) || s.name === String(name).trim()
          );

          if (existing) {
            await db.updateStockItem(existing.id, {
              quantity: existing.quantity + qty,
              salePrice: salePrice || existing.salePrice,
              lastUnitCost: costPrice || existing.lastUnitCost,
            });
          } else {
            await db.addStockItem({
              name: String(name).trim(),
              barcode: barcode ? String(barcode).trim() : undefined,
              quantity: qty,
              salePrice,
              lastUnitCost: costPrice,
              lowStockAlert: lowStock,
              notes: String(notes),
            });
          }
          successCount++;
        } catch (err: any) {
          failCount++;
          errMsgs.push(`تعذر حفظ (${name}): ${err?.message || "خطأ غير معروف"}`);
        }
      }

      setImportResults({
        total: rows.length,
        success: successCount,
        failed: failCount,
        errors: errMsgs,
      });

      if (successCount > 0) {
        toast.success(`تم استيراد ${successCount} منتج بنجاح إلى المخزن ✓`);
      }
    } catch (err: any) {
      toast.error(err?.message || "فشل قراءة ملف الإكسيل");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader className="text-right space-y-1">
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            استيراد وتصدير بيانات المخزون (Excel / CSV)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            تصدير المخزون الحالي بالكامل أو استيراد وتحديث المنتجات دفعة واحدة من ملف إكسيل.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2 text-right">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
            <TabsList className="grid grid-cols-2 h-10 rounded-2xl bg-foreground/[0.04] p-1">
              <TabsTrigger value="export" className="rounded-xl text-xs font-bold gap-1.5">
                <Download className="w-3.5 h-3.5" />
                تصدير لملف إكسيل
              </TabsTrigger>
              <TabsTrigger value="import" className="rounded-xl text-xs font-bold gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                استيراد من إكسيل
              </TabsTrigger>
            </TabsList>

            <TabsContent value="export" className="space-y-4 pt-3">
              <div className="p-4 rounded-2xl bg-emerald-500/[0.05] border border-emerald-500/20 text-xs space-y-2">
                <div className="font-bold text-emerald-700 dark:text-emerald-400">
                  تصدير ({stockItems.length}) منتج مسجل:
                </div>
                <div className="text-muted-foreground leading-relaxed">
                  سيتم إنشاء ملف XLSX يحتوي على الأسماء، الباركود، الكميات، أسعار البيع والتكلفة وحد الطلب.
                </div>
              </div>

              <Button
                onClick={handleExport}
                className="w-full h-11 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Download className="w-4 h-4" />
                تحميل ملف إكسيل الآن
              </Button>
            </TabsContent>

            <TabsContent value="import" className="space-y-4 pt-3">
              <div className="p-3 rounded-2xl bg-foreground/[0.03] border border-foreground/10 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold">قالب إكسيل النموذجي:</div>
                  <div className="text-muted-foreground text-[11px]">حمل القالب لتعبئة بياناتك بشكل صحيح</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="rounded-xl h-8 text-xs gap-1"
                >
                  <FileDown className="w-3.5 h-3.5" /> تحميل القالب
                </Button>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-foreground/20 hover:border-primary/50 transition-colors p-6 rounded-2xl text-center space-y-2 bg-foreground/[0.01]"
              >
                <Upload className="w-7 h-7 mx-auto text-muted-foreground" />
                <div className="text-xs font-bold">اضغط هنا لاختيار ملف Excel / CSV</div>
                <div className="text-[11px] text-muted-foreground">صيغ .xlsx أو .xls أو .csv</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {importing && (
                <div className="flex items-center justify-center gap-2 p-3 text-xs text-primary font-bold">
                  <Loader2 className="w-4 h-4 animate-spin" /> جاري معالجة وحفظ المنتجات...
                </div>
              )}

              {importResults && (
                <div className="p-3.5 rounded-2xl bg-foreground/[0.03] border border-foreground/10 text-xs space-y-1.5">
                  <div className="font-bold text-foreground">نتائج الاستيراد:</div>
                  <div className="flex items-center gap-3">
                    <span className="text-success font-bold">✓ نجح: {importResults.success}</span>
                    <span className="text-danger font-bold">✗ فشل: {importResults.failed}</span>
                  </div>
                  {importResults.errors.length > 0 && (
                    <div className="text-[10px] text-danger max-h-20 overflow-y-auto space-y-0.5 pt-1">
                      {importResults.errors.slice(0, 3).map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-2xl text-xs h-10"
          >
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
