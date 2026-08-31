import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSpreadsheet, Upload, Download, CheckCircle2, AlertCircle, Trash2, FileUp } from "lucide-react";
import { db, type Customer, type CustomerStatus, type CustomerType } from "@/lib/store";
import { EG_PHONE_RE, ddmmyyyyToIso } from "@/lib/customer-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ParsedCustomerRow {
  name: string;
  phone: string;
  address: string;
  customerType: CustomerType;
  status: CustomerStatus;
  rating: number;
  openingBalance: number;
  creditLimit: number;
  dueDay: number;
  notes: string;
  joiningDate: string;
  isValid: boolean;
  errorReason?: string;
}

interface CustomerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPhones: Set<string>;
}

export function CustomerImportDialog({
  open,
  onOpenChange,
  existingPhones,
}: CustomerImportDialogProps) {
  const [rows, setRows] = useState<ParsedCustomerRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validCount = rows.filter((r) => r.isValid).length;
  const invalidCount = rows.length - validCount;

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "الاسم (مطلوب)": "أحمد محمود علي",
        "رقم الهاتف (مطلوب)": "01012345678",
        العنوان: "مدينة نصر - القاهرة",
        "نوع العميل (أقساط / فوري)": "أقساط",
        "الرصيد الافتتاحي (ج.م)": 2500,
        "سقف المديونية (ج.م)": 15000,
        "يوم القسط (1-28)": 10,
        "حالة الالتزام (ملتزم / عادي / مماطل)": "ملتزم",
        "التقييم (1-5)": 5,
        "تاريخ الانضمام (DD/MM/YYYY)": "01/01/2026",
        ملاحظات: "عميل قديم محول من الدفاتر الورقية",
      },
      {
        "الاسم (مطلوب)": "محمد إبراهيم حسن",
        "رقم الهاتف (مطلوب)": "01198765432",
        العنوان: "الدقي - الجيزة",
        "نوع العميل (أقساط / فوري)": "فوري",
        "الرصيد الافتتاحي (ج.م)": 0,
        "سقف المديونية (ج.م)": 0,
        "يوم القسط (1-28)": 1,
        "حالة الالتزام (ملتزم / عادي / مماطل)": "ملتزم",
        "التقييم (1-5)": 5,
        "تاريخ الانضمام (DD/MM/YYYY)": "15/02/2026",
        ملاحظات: "مشتريات نقدية فورية",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    // Adjust column widths
    ws["!cols"] = [
      { wch: 22 },
      { wch: 18 },
      { wch: 25 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 22 },
      { wch: 12 },
      { wch: 20 },
      { wch: 30 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "قالب العملاء");
    XLSX.writeFile(wb, "قالب_استيراد_العملاء.xlsx");
    toast.success("تم تنزيل قالب الإكسيل بنجاح");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!data || data.length === 0) {
          toast.error("الملف فارغ أو لا يحتوي على بيانات صحيحة");
          return;
        }

        const todayIso = new Date().toISOString().slice(0, 10);
        const seenPhonesInBatch = new Set<string>();

        const parsed: ParsedCustomerRow[] = data.map((row) => {
          // Normalize field names
          const name = String(
            row["الاسم (مطلوب)"] || row["الاسم"] || row["اسم العميل"] || row["name"] || "",
          ).trim();

          let rawPhone = String(
            row["رقم الهاتف (مطلوب)"] ||
              row["رقم الهاتف"] ||
              row["الهاتف"] ||
              row["phone"] ||
              row["الموبايل"] ||
              "",
          )
            .replace(/\D/g, "")
            .trim();

          // Handle excel auto-stripping leading 0 (e.g. 1012345678 instead of 01012345678)
          if (rawPhone.length === 10 && (rawPhone.startsWith("10") || rawPhone.startsWith("11") || rawPhone.startsWith("12") || rawPhone.startsWith("15"))) {
            rawPhone = `0${rawPhone}`;
          }

          const address = String(row["العنوان"] || row["address"] || "").trim();
          const rawType = String(
            row["نوع العميل (أقساط / فوري)"] || row["نوع العميل"] || row["customerType"] || "",
          ).trim();
          const customerType: CustomerType =
            rawType.includes("فوري") || rawType.toLowerCase() === "cash" ? "cash" : "installment";

          const rawStatus = String(
            row["حالة الالتزام (ملتزم / عادي / مماطل)"] || row["حالة الالتزام"] || row["الحالة"] || row["status"] || "",
          ).trim();
          let status: CustomerStatus = "neutral";
          if (rawStatus.includes("ملتزم") || rawStatus.toLowerCase() === "committed") status = "committed";
          else if (rawStatus.includes("مماطل") || rawStatus.toLowerCase() === "defaulter") status = "defaulter";

          const rating = Math.min(5, Math.max(1, Number(row["التقييم (1-5)"] || row["التقييم"] || row["rating"] || (status === "committed" ? 5 : status === "defaulter" ? 1 : 3))));
          const openingBalance = Math.max(0, Number(row["الرصيد الافتتاحي (ج.م)"] || row["الرصيد الافتتاحي"] || row["openingBalance"] || 0));
          const creditLimit = Math.max(0, Number(row["سقف المديونية (ج.م)"] || row["سقف المديونية"] || row["creditLimit"] || 0));
          const dueDay = Math.min(28, Math.max(1, Number(row["يوم القسط (1-28)"] || row["يوم القسط"] || row["dueDay"] || 1)));
          const notes = String(row["ملاحظات"] || row["notes"] || "").trim();

          const rawJoining = String(row["تاريخ الانضمام (DD/MM/YYYY)"] || row["تاريخ الانضمام"] || row["joiningDate"] || "");
          const parsedJoining = ddmmyyyyToIso(rawJoining) || todayIso;

          // Validation
          let isValid = true;
          let errorReason = "";

          if (!name) {
            isValid = false;
            errorReason = "اسم العميل مفقود";
          } else if (!rawPhone || !EG_PHONE_RE.test(rawPhone)) {
            isValid = false;
            errorReason = "رقم الهاتف غير مطابق للصيغة المصرية (01XXXXXXXXX)";
          } else if (existingPhones.has(rawPhone)) {
            isValid = false;
            errorReason = "رقم الهاتف مسجل لعميل آخر بالفعل";
          } else if (seenPhonesInBatch.has(rawPhone)) {
            isValid = false;
            errorReason = "رقم الهاتف مكرر داخل هذا الملف";
          }

          if (isValid) {
            seenPhonesInBatch.add(rawPhone);
          }

          return {
            name,
            phone: rawPhone,
            address,
            customerType,
            status,
            rating,
            openingBalance,
            creditLimit,
            dueDay,
            notes,
            joiningDate: parsedJoining,
            isValid,
            errorReason,
          };
        });

        setRows(parsed);
        toast.success(`تم قراءة ${parsed.length} صف من الملف`);
      } catch (err: any) {
        console.error(err);
        toast.error("حدث خطأ أثناء قراءة ملف الإكسيل. تأكد من صحة الملف.");
      }
    };

    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("لا توجد صفوف صالحة للاستيراد");
      return;
    }

    setIsProcessing(true);
    let imported = 0;
    try {
      for (const row of validRows) {
        await db.addCustomer({
          name: row.name,
          phone: row.phone,
          address: row.address || null,
          customerType: row.customerType,
          status: row.status,
          rating: row.rating,
          openingBalance: row.openingBalance,
          creditLimit: row.creditLimit,
          dueDay: row.dueDay,
          notes: row.notes || null,
          joiningDate: row.joiningDate,
          frozen: false,
        });
        imported++;
      }

      toast.success(`تم استيراد ${imported} عميل بنجاح إلى قاعدة البيانات`);
      setRows([]);
      setFileName(null);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`تم استيراد ${imported} عميل وحدث خطأ: ${err.message || "فشل الاستيراد"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setRows([]);
    setFileName(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center justify-end gap-2 text-xl font-bold">
            استيراد العملاء من ملف Excel
            <FileSpreadsheet className="w-5 h-5 text-success" />
          </DialogTitle>
          <DialogDescription className="text-right">
            يمكنك رفع شيت إكسيل يحتوي على قائمة عملائك وأرصدتهم السابقة لإضافتهم دفعة واحدة.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden my-2">
          {/* Action header: Template download + Upload trigger */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-foreground/[0.03] border border-border/40">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 text-primary" />
                {fileName ? "تغيير الملف" : "اختر ملف Excel / CSV"}
              </Button>

              {rows.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-danger hover:text-danger hover:bg-danger/10"
                  onClick={handleClear}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  مسح
                </Button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={handleDownloadTemplate}
            >
              <Download className="w-4 h-4 text-success" />
              تحميل نموذج القالب (.xlsx)
            </Button>
          </div>

          {/* Stats bar if file loaded */}
          {rows.length > 0 && (
            <div className="flex items-center justify-between text-xs px-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {validCount} صف صالح للاستيراد
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="outline" className="bg-danger/10 text-danger border-danger/30 gap-1 font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {invalidCount} صف به ملاحظات
                  </Badge>
                )}
              </div>
              <span className="text-muted-foreground font-medium">
                إجمالي: {rows.length} سجل ({fileName})
              </span>
            </div>
          )}

          {/* Dropzone or Preview table */}
          {rows.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-border/70 rounded-2xl cursor-pointer hover:border-primary/50 hover:bg-foreground/[0.02] transition-colors text-center"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 grid place-items-center mb-3">
                <FileUp className="w-7 h-7 text-primary" />
              </div>
              <h4 className="font-bold text-base mb-1">اضغط هنا لرفع ملف Excel أو CSV</h4>
              <p className="text-xs text-muted-foreground max-w-sm mb-4">
                يدعم صيغ .xlsx و .xls و .csv مع كشف أخطاء أرقام الهواتف وتجنب تكرار العملاء تلقائياً.
              </p>
              <Button type="button" size="sm" variant="outline" className="gap-2">
                <Upload className="w-4 h-4" /> اختيار الملف
              </Button>
            </div>
          ) : (
            <ScrollArea className="flex-1 border border-border/40 rounded-2xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-foreground/[0.04] text-muted-foreground sticky top-0 font-medium">
                  <tr>
                    <th className="p-2.5">الحالة</th>
                    <th className="p-2.5">الاسم</th>
                    <th className="p-2.5">الهاتف</th>
                    <th className="p-2.5">النوع</th>
                    <th className="p-2.5">رصيد سابق</th>
                    <th className="p-2.5">سقف المديونية</th>
                    <th className="p-2.5">يوم القسط</th>
                    <th className="p-2.5">العنوان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        "hover:bg-foreground/[0.02] transition-colors",
                        !row.isValid && "bg-danger/[0.04]",
                      )}
                    >
                      <td className="p-2.5">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-success font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> جاهز
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-danger font-bold" title={row.errorReason}>
                            <AlertCircle className="w-3.5 h-3.5" />
                            {row.errorReason}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-bold">{row.name || "—"}</td>
                      <td className="p-2.5" dir="ltr">
                        {row.phone || "—"}
                      </td>
                      <td className="p-2.5">
                        {row.customerType === "cash" ? "فوري" : "أقساط"}
                      </td>
                      <td className="p-2.5">{row.openingBalance} ج.م</td>
                      <td className="p-2.5">{row.creditLimit ? `${row.creditLimit} ج.م` : "—"}</td>
                      <td className="p-2.5">{row.customerType === "installment" ? `يوم ${row.dueDay}` : "—"}</td>
                      <td className="p-2.5 text-muted-foreground truncate max-w-[120px]">
                        {row.address || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 border-t border-border/30 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            إلغاء
          </Button>

          <Button
            type="button"
            onClick={handleImport}
            disabled={validCount === 0 || isProcessing}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            {isProcessing ? "جاري الاستيراد..." : `استيراد (${validCount}) عميل`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
