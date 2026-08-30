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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDB, db, fmt, type Customer, type CustomerStatus, type CustomerType } from "@/lib/store";
import { decodeCustomerNotes, encodeCustomerNotes, type CustomerExtendedInfo } from "@/lib/customer-extended";
import { parseEgyptianNationalId } from "@/lib/national-id";
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  FileDown,
  X,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CustomerImportExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCustomers: Customer[];
}

interface ParsedCustomerRow {
  name: string;
  phone: string;
  alternatePhone?: string;
  nationalId?: string;
  address?: string;
  customerType: CustomerType;
  status: CustomerStatus;
  creditLimit: number;
  openingBalance: number;
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorRelation?: string;
  notes?: string;
  // Validation status
  isValid: boolean;
  isDuplicateInDB: boolean;
  errorReason?: string;
}

export function CustomerImportExportModal({
  open,
  onOpenChange,
  currentCustomers,
}: CustomerImportExportModalProps) {
  const data = useDB();
  const [tab, setTab] = useState<"export" | "import">("export");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCustomerRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Export Customers to Excel
  const handleExportExcel = () => {
    try {
      const exportData = currentCustomers.map((c, i) => {
        const { rawNotes, ext } = decodeCustomerNotes(c.notes);
        return {
          "م": i + 1,
          "اسم العميل": c.name,
          "رقم الهاتف": c.phone,
          "الهاتف البديل": ext.alternatePhone || "",
          "الرقم القومي": ext.nationalId || "",
          "المحافظة": ext.governorate || "",
          "النوع": ext.gender === "female" ? "أنثى" : ext.gender === "male" ? "ذكر" : "",
          "نوع الحساب": c.customerType === "cash" ? "فوري (نقدي)" : "أقساط",
          "حالة الالتزام": c.status === "committed" ? "ملتزم" : c.status === "defaulter" ? "مماطل" : "عادي",
          "سقف الائتمان (ج.م)": c.creditLimit || 0,
          "رصيد افتتاحي (ج.م)": c.openingBalance || 0,
          "العنوان": c.address || "",
          "اسم الضامن": ext.guarantor?.name || "",
          "هاتف الضامن": ext.guarantor?.phone || "",
          "صلة قرابة الضامن": ext.guarantor?.relation || "",
          "ملاحظات": rawNotes || "",
          "تاريخ الانضمام": c.joiningDate,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "العملاء");

      const fileName = `عملاء_سجلي_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("تم تصدير ملف الإكسيل بنجاح ✓");
    } catch (e: any) {
      toast.error(e?.message || "تعذر تصدير ملف الإكسيل");
    }
  };

  // 2. Download Sample Import Template
  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        "اسم العميل *": "محمود أحمد حسن",
        "رقم الهاتف *": "01012345678",
        "الهاتف البديل": "01123456789",
        "الرقم القومي": "29508151234567",
        "نوع الحساب (أقساط / فوري)": "أقساط",
        "سقف الائتمان": 15000,
        "رصيد افتتاحي": 0,
        "العنوان": "شارع الجمهورية - المنصورة",
        "اسم الضامن": "أحمد حسن إبراهيم",
        "هاتف الضامن": "01234567890",
        "صلة القرابة": "أخ",
        "ملاحظات": "عميل محول من الفرع القديم",
      },
      {
        "اسم العميل *": "سارة محمد إبراهيم",
        "رقم الهاتف *": "01287654321",
        "الهاتف البديل": "",
        "الرقم القومي": "30105202100000",
        "نوع الحساب (أقساط / فوري)": "فوري",
        "سقف الائتمان": 0,
        "رصيد افتتاحي": 0,
        "العنوان": "الهرم - الجيزة",
        "اسم الضامن": "",
        "هاتف الضامن": "",
        "صلة القرابة": "",
        "ملاحظات": "شراء نقدي",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نموذج_استيراد");
    XLSX.writeFile(wb, "نموذج_استيراد_العملاء.xlsx");
    toast.success("تم تنزيل نموذج الاستيراد التجريبي ✓");
  };

  // 3. Handle File Selection and Parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    processExcelFile(selectedFile);
  };

  const processExcelFile = async (f: File) => {
    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rawRows.length === 0) {
        toast.error("الملف المختار فارغ!");
        setParsedRows([]);
        return;
      }

      const existingPhones = new Set(data.customers.map((c) => c.phone.replace(/\D/g, "")));
      const filePhoneSet = new Set<string>();

      const rows: ParsedCustomerRow[] = rawRows.map((r, idx) => {
        // Extract fields matching various possible column headers in Arabic or English
        const name = (
          r["اسم العميل *"] ||
          r["اسم العميل"] ||
          r["الاسم"] ||
          r["Name"] ||
          r["Customer Name"] ||
          ""
        ).toString().trim();

        let rawPhone = (
          r["رقم الهاتف *"] ||
          r["رقم الهاتف"] ||
          r["الهاتف"] ||
          r["Phone"] ||
          r["Mobile"] ||
          ""
        ).toString().replace(/\D/g, "");

        if (rawPhone.startsWith("20") && rawPhone.length === 12) {
          rawPhone = rawPhone.slice(2);
        }

        const altPhone = (r["الهاتف البديل"] || r["هاتف بديل"] || r["Alt Phone"] || "")
          .toString()
          .replace(/\D/g, "");

        const nid = (r["الرقم القومي"] || r["الرقم_القومي"] || r["National ID"] || "")
          .toString()
          .replace(/\D/g, "");

        const address = (r["العنوان"] || r["Address"] || "").toString().trim();
        const rawType = (r["نوع الحساب (أقساط / فوري)"] || r["نوع الحساب"] || r["نوع العميل"] || "")
          .toString()
          .trim();
        const customerType: CustomerType = rawType.includes("فوري") || rawType.includes("نقدي") || rawType.toLowerCase() === "cash" ? "cash" : "installment";

        const creditLimit = Number(r["سقف الائتمان"] || r["سقف المديونية"] || 0) || 0;
        const openingBalance = Number(r["رصيد افتتاحي"] || r["الرصيد الافتتاحي"] || 0) || 0;

        const gName = (r["اسم الضامن"] || r["الضامن"] || "").toString().trim();
        const gPhone = (r["هاتف الضامن"] || r["تليفون الضامن"] || "")
          .toString()
          .replace(/\D/g, "");
        const gRelation = (r["صلة القرابة"] || r["صلة قرابة الضامن"] || "").toString().trim();
        const notes = (r["ملاحظات"] || r["Notes"] || "").toString().trim();

        // Validation
        let isValid = true;
        let errorReason = "";

        if (!name) {
          isValid = false;
          errorReason = "اسم العميل مفقود";
        } else if (!rawPhone || rawPhone.length < 10) {
          isValid = false;
          errorReason = "رقم الهاتف غير صحيح أو قصير";
        }

        const isDuplicateInDB = existingPhones.has(rawPhone);
        if (filePhoneSet.has(rawPhone)) {
          isValid = false;
          errorReason = "رقم الهاتف مكرر داخل نفس الملف";
        } else if (rawPhone) {
          filePhoneSet.add(rawPhone);
        }

        return {
          name,
          phone: rawPhone,
          alternatePhone: altPhone || undefined,
          nationalId: nid || undefined,
          address: address || undefined,
          customerType,
          status: "neutral" as CustomerStatus,
          creditLimit,
          openingBalance,
          guarantorName: gName || undefined,
          guarantorPhone: gPhone || undefined,
          guarantorRelation: gRelation || undefined,
          notes: notes || undefined,
          isValid,
          isDuplicateInDB,
          errorReason,
        };
      });

      setParsedRows(rows);
      toast.success(`تم قراءة ${rows.length} سجل من الملف بنجاح.`);
    } catch (e: any) {
      toast.error("فشل في قراءة ملف الإكسيل: " + (e?.message || "تنسيق غير مدعوم"));
    }
  };

  // 4. Execute Bulk Import
  const handleExecuteImport = async (skipDuplicates: boolean = true) => {
    const toImport = parsedRows.filter((r) => r.isValid && (!skipDuplicates || !r.isDuplicateInDB));
    if (toImport.length === 0) {
      toast.error("لا توجد سجلات صالحة للإضافة");
      return;
    }

    try {
      setImporting(true);
      setImportProgress(0);
      let addedCount = 0;
      const todayIso = new Date().toISOString().slice(0, 10);

      for (let i = 0; i < toImport.length; i++) {
        const row = toImport[i];

        // Parse National ID if present
        let gov = "";
        let birth = "";
        let gender: "male" | "female" | undefined = undefined;
        if (row.nationalId && row.nationalId.length === 14) {
          const nidInfo = parseEgyptianNationalId(row.nationalId);
          if (nidInfo.isValid) {
            gov = nidInfo.governorate || "";
            birth = nidInfo.birthDate || "";
            gender = nidInfo.gender;
          }
        }

        const ext: CustomerExtendedInfo = {
          nationalId: row.nationalId,
          alternatePhone: row.alternatePhone,
          governorate: gov || undefined,
          birthDate: birth || undefined,
          gender,
          guarantor:
            row.guarantorName || row.guarantorPhone
              ? {
                  name: row.guarantorName,
                  phone: row.guarantorPhone,
                  relation: row.guarantorRelation,
                }
              : undefined,
        };

        const encodedNotes = encodeCustomerNotes(row.notes, ext);

        await db.addCustomer({
          name: row.name,
          phone: row.phone,
          rating: 3,
          status: row.status,
          customerType: row.customerType,
          notes: encodedNotes,
          frozen: false,
          address: row.address || null,
          joiningDate: todayIso,
          creditLimit: row.creditLimit,
          dueDay: 1,
          openingBalance: row.openingBalance,
        });

        addedCount++;
        setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
      }

      toast.success(`تم استيراد وإضافة ${addedCount} عميل بنجاح إلى النظام ✓`);
      setParsedRows([]);
      setFile(null);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ أثناء الاستيراد");
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid && !r.isDuplicateInDB).length;
  const duplicateCount = parsedRows.filter((r) => r.isDuplicateInDB).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            استيراد وتصدير بيانات العملاء (Excel / CSV)
          </DialogTitle>
          <DialogDescription className="text-right">
            تصدير كشوف العملاء الحالية أو رفع ملف إكسيل يحتوي على مئات العملاء دفعة واحدة.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="export" className="gap-2 font-bold">
              <FileDown className="h-4 w-4" />
              تصدير إلى Excel ({currentCustomers.length})
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2 font-bold">
              <UploadCloud className="h-4 w-4" />
              استيراد من Excel / CSV
            </TabsTrigger>
          </TabsList>

          {/* EXPORT TAB */}
          <TabsContent value="export" className="space-y-4">
            <div className="rounded-2xl border border-border/40 bg-foreground/[0.02] p-5 text-right space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-primary font-bold bg-primary/10 border-primary/30">
                  {currentCustomers.length} عميل جاهز للتصدير
                </Badge>
                <h4 className="font-extrabold text-base">كشف حساب العملاء الشامل</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                سيتم تصدير ملف إكسيل كامل يحتوي على كافة بيانات العملاء المسجلة (الأسماء، الهواتف الأساسية والبديلة، الرقم القومي، المحافظات، نوع الحساب، سقف الائتمان، الأرصدة الافتتاحية، بيانات الضامن، والملاحظات).
              </p>

              <div className="pt-3 flex justify-end">
                <Button onClick={handleExportExcel} className="gap-2 font-bold h-11 px-6 rounded-xl shadow-md">
                  <Download className="h-4 w-4" />
                  تحميل ملف Excel الآن (.xlsx)
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-4">
            {/* Upload Area */}
            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/70 hover:border-primary/60 bg-foreground/[0.02] hover:bg-primary/[0.03] transition-all rounded-3xl p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3"
              >
                <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <div className="font-extrabold text-base">اضغط لاختيار ملف Excel أو CSV</div>
                  <div className="text-xs text-muted-foreground">يدعم ملفات .xlsx و .xls و .csv</div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadTemplate();
                  }}
                  className="gap-2 text-xs rounded-xl mt-2"
                >
                  <Download className="h-3.5 w-3.5" />
                  تنزيل نموذج إكسيل جاهز للملء
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File summary bar */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-foreground/[0.04] border border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setParsedRows([]);
                    }}
                    className="text-danger hover:bg-danger/10 gap-1 text-xs"
                  >
                    <X className="h-4 w-4" />
                    إلغاء الملف
                  </Button>
                  <div className="flex items-center gap-2 text-right">
                    <span className="font-bold text-sm">{file.name}</span>
                    <FileCheck className="h-5 w-5 text-success" />
                  </div>
                </div>

                {/* Validation Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-success/10 border border-success/30 p-2.5">
                    <div className="text-xs text-muted-foreground">جاهز للإضافة</div>
                    <div className="text-lg font-extrabold text-success">{validCount}</div>
                  </div>
                  <div className="rounded-xl bg-warning/10 border border-warning/30 p-2.5">
                    <div className="text-xs text-muted-foreground">مكرر بالنظام</div>
                    <div className="text-lg font-extrabold text-warning">{duplicateCount}</div>
                  </div>
                  <div className="rounded-xl bg-danger/10 border border-danger/30 p-2.5">
                    <div className="text-xs text-muted-foreground">بيانات غير صالحة</div>
                    <div className="text-lg font-extrabold text-danger">{invalidCount}</div>
                  </div>
                </div>

                {/* Preview Table */}
                <ScrollArea className="h-60 rounded-2xl border border-border/40 bg-background/50">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-foreground/[0.05] sticky top-0 font-bold border-b">
                      <tr>
                        <th className="p-2.5">الحالة</th>
                        <th className="p-2.5">الاسم</th>
                        <th className="p-2.5">الهاتف</th>
                        <th className="p-2.5">النوع</th>
                        <th className="p-2.5">سقف الائتمان</th>
                        <th className="p-2.5">الضامن</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {parsedRows.map((r, i) => (
                        <tr key={i} className={cn(!r.isValid && "bg-danger/5", r.isDuplicateInDB && "bg-warning/5")}>
                          <td className="p-2.5">
                            {r.isDuplicateInDB ? (
                              <Badge variant="outline" className="bg-warning/15 text-warning border-warning/40 text-[10px]">
                                مكرر بالنظام
                              </Badge>
                            ) : !r.isValid ? (
                              <Badge variant="outline" className="bg-danger/15 text-danger border-danger/40 text-[10px]">
                                {r.errorReason || "خطأ"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-success/15 text-success border-success/40 text-[10px]">
                                سليم ✓
                              </Badge>
                            )}
                          </td>
                          <td className="p-2.5 font-bold">{r.name || "—"}</td>
                          <td className="p-2.5 font-mono" dir="ltr">{r.phone || "—"}</td>
                          <td className="p-2.5">{r.customerType === "cash" ? "فوري" : "أقساط"}</td>
                          <td className="p-2.5">{r.creditLimit ? `${fmt(r.creditLimit)} ج.م` : "—"}</td>
                          <td className="p-2.5">{r.guarantorName || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>

                {importing && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span>{importProgress}%</span>
                      <span>جاري إضافة العملاء...</span>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                    className="text-xs"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    تنزيل النموذج
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      disabled={validCount === 0 || importing}
                      onClick={() => handleExecuteImport(true)}
                      className="gap-1.5 font-extrabold rounded-xl bg-success hover:bg-success/90 text-white"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      استيراد العملاء الجدد فقط ({validCount})
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
