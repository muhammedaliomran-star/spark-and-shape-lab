import { useState, useMemo } from "react";
import { format } from "date-fns";
import { type Invoice, type Customer, type InvoiceItem, type ShopSettings, fmt, invoiceNumber } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Printer, FileText, QrCode, ShieldCheck, Check, Store } from "lucide-react";
import { pdfDocument, openPdfDocument, esc, pdfCss } from "@/lib/pdf-doc";
import { calculateInstallmentSchedule } from "@/components/InstallmentScheduleMatrix";
import { toArabicDigits } from "@/lib/arabic-digits";
import { useDB } from "@/lib/store";
import { getInvoiceBranchId, getBranchProfile } from "@/lib/branch-system";

function isoToDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export function InvoicePrintCustomizerDialog({
  inv,
  customer,
  items,
  payments,
  allInvoices,
  shopSettings,
  onClose,
}: {
  inv: Invoice | null;
  customer: Customer | null;
  items: InvoiceItem[];
  payments: { invoiceId: string; amount: number; paidAt: string }[];
  allInvoices: Invoice[];
  shopSettings: ShopSettings;
  onClose: () => void;
}) {
  const { branches } = useDB();
  const [paperFormat, setPaperFormat] = useState<"thermal" | "a4">("thermal");
  const [showBranchInfo, setShowBranchInfo] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [showWarranty, setShowWarranty] = useState(true);
  const [showSchedule, setShowSchedule] = useState(true);
  const [showShopInfo, setShowShopInfo] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);

  const invItems = useMemo(() => {
    if (!inv) return [];
    return items.filter((it) => it.invoiceId === inv.id);
  }, [inv, items]);

  const schedule = useMemo(() => {
    if (!inv) return [];
    return calculateInstallmentSchedule(inv, payments);
  }, [inv, payments]);

  const invoiceBranch = useMemo(() => {
    if (!inv) return null;
    const bid = getInvoiceBranchId(inv.id);
    if (bid) return branches.find((b) => b.id === bid) || null;
    return branches.find((b) => b.isMain) || null;
  }, [inv, branches]);

  const branchProfile = invoiceBranch ? getBranchProfile(invoiceBranch.id) : {};

  if (!inv || !customer) return null;

  const handlePrint = () => {
    const cur = shopSettings.currency || "ج.م";
    const invNo = invoiceNumber(allInvoices, inv.id, shopSettings.invoicePrefix);
    const remaining = Math.max(0, inv.total - inv.paid);
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const isThermal = paperFormat === "thermal";

    // Build QR Code link or payload
    const receiptUrl = inv.receiptToken ? `${window.location.origin}/receipt/${inv.receiptToken}` : `${window.location.origin}/invoices`;
    const qrPayload = encodeURIComponent(receiptUrl);
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrPayload}&margin=4`;

    const itemsHtml = invItems.length > 0
      ? `
      <h2 class="sec">الأصناف المشتراة (${invItems.length})</h2>
      <div class="t-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:40%">الصنف</th>
              <th style="text-align:center">الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${invItems.map((it) => {
              const q = it.quantity || 1;
              const lineTotal = it.lineTotal || it.price * q;
              return `
              <tr>
                <td><b>${esc(it.name)}</b>${it.serialNumbers.length ? `<div style="font-size:9px;color:#64748b" dir="ltr">IMEI/SN: ${esc(it.serialNumbers.join(" • "))}</div>` : ""}${it.discountPct || it.taxPct ? `<div style="font-size:9px;color:#64748b">خصم ${fmt(it.discountPct)}% • ضريبة ${fmt(it.taxPct)}%</div>` : ""}</td>
                <td style="text-align:center" class="num">${q}</td>
                <td class="num">${fmt(it.price)} ${esc(cur)}</td>
                <td class="num font-bold">${fmt(lineTotal)} ${esc(cur)}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`
      : `<div class="info"><div class="box" style="grid-column:1/-1"><b>السلعة</b> ${esc(inv.notes || "مشتريات")}</div></div>`;

    const scheduleHtml = (showSchedule && inv.monthlyInstallment > 0 && schedule.length > 0)
      ? `
      <h2 class="sec">جدول الأقساط الشهرية</h2>
      <div class="t-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:30px; text-align:center">#</th>
              <th>تاريخ الاستحقاق</th>
              <th>قيمة القسط</th>
              <th style="text-align:center">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${schedule.map((s) => `
              <tr>
                <td style="text-align:center" class="num">${s.index}</td>
                <td dir="ltr" class="num">${format(s.dueDate, "dd/MM/yyyy")}</td>
                <td class="num">${fmt(s.dueAmount)} ${esc(cur)}</td>
                <td style="text-align:center">
                  <span class="tag ${s.status === "paid" ? "ok" : s.status === "overdue" ? "purchase" : ""}">
                    ${s.status === "paid" ? "مسدد ✓" : s.status === "overdue" ? "متأخر ⚠" : "مستحق"}
                  </span>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`
      : "";

    const warrantyHtml = showWarranty
      ? `
      <div style="margin-top:16px; padding:10px 12px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0; font-size:10px; color:#475569; line-height:1.6;">
        <b style="color:#0f172a; display:block; margin-bottom:2px;">شروط الضمان وسياسة الاستبدال:</b>
        • يحق للعميل استبدال أو إرجاع السلعة خلال 14 يوماً من تاريخ الشراء بشرط وجود الفاتورة وبحالتها الأصلية.<br/>
        • الضمان يسري على عيوب الصناعة ولا يشمل سوء الاستخدام أو الكسر أو السوائل.<br/>
        • الالتزام بسداد الأقساط في مواعيدها المحددة يضمن استمرار التسهيلات الائتمانية.
      </div>`
      : "";

    const qrHtml = showQr
      ? `
      <div style="margin-top:16px; text-align:center; padding:10px; background:#fff; border-radius:12px; border:1px dashed #cbd5e1; display:inline-block; width:100%;">
        <img src="${qrImgUrl}" alt="QR Verification" style="width:85px; height:85px; display:block; margin:0 auto;" />
        <div style="font-size:9.5px; color:#64748b; margin-top:4px;">امسح الكود لفتح الإيصال الرقمي</div>
      </div>`
      : "";

    const signaturesHtml = showSignatures
      ? `<div class="sig" style="margin-top:24px; display:flex; justify-content:space-between; text-align:center; font-size:11px; color:#475569;">
          <div style="border-top:1px dashed #94a3b8; width:130px; padding-top:6px;">توقيع واستلام العميل</div>
          <div style="border-top:1px dashed #94a3b8; width:130px; padding-top:6px;">ختم وتوقيع المحل</div>
        </div>`
      : "";

    const branchBar = (showBranchInfo && invoiceBranch)
      ? `<div style="margin-bottom:10px; padding:8px 10px; border-radius:10px; background:#f1f5f9; border:1px solid #e2e8f0; font-size:11px; color:#0f172a; text-align:center;">
          <b>${esc(invoiceBranch.name)}</b>${invoiceBranch.location ? ` — ${esc(invoiceBranch.location)}` : ""}
          ${invoiceBranch.phone ? `<div dir="ltr" style="color:#475569;">${esc(invoiceBranch.phone)}</div>` : ""}
          ${branchProfile.taxNumber ? `<div style="color:#475569;">س.ض: ${esc(branchProfile.taxNumber)}</div>` : ""}
          ${branchProfile.commercialRecord ? `<div style="color:#475569;">س.ت: ${esc(branchProfile.commercialRecord)}</div>` : ""}
        </div>`
      : "";

    const body = `
      ${branchBar}
      <div class="info" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
        <div class="box" style="border:1px solid #e2e8f0; border-radius:10px; padding:8px 10px; background:#fff;"><b>اسم العميل</b> ${esc(customer.name)}</div>
        <div class="box" style="border:1px solid #e2e8f0; border-radius:10px; padding:8px 10px; background:#fff;"><b>الهاتف</b> <span dir="ltr">${esc(customer.phone || "—")}</span></div>
        ${customer.address ? `<div class="box" style="grid-column:1/-1; border:1px solid #e2e8f0; border-radius:10px; padding:8px 10px; background:#fff;"><b>العنوان</b> ${esc(customer.address)}</div>` : ""}
      </div>

      ${itemsHtml}

      <h2 class="sec">الملخص المالي للدفع</h2>
      <div class="t-wrap">
        <table>
          <tbody>
            <tr>
              <th>إجمالي الفاتورة</th><td class="num font-bold">${fmt(inv.total)} ${esc(cur)}</td>
              <th>المدفوع / المقدم</th><td class="num ok">${fmt(inv.downPayment || inv.paid)} ${esc(cur)}</td>
            </tr>
            ${inv.monthlyInstallment > 0 ? `
            <tr>
              <th>القسط الشهري</th><td class="num">${fmt(inv.monthlyInstallment)} ${esc(cur)}</td>
              <th>تاريخ أول قسط</th><td class="num" dir="ltr">${esc(isoToDDMMYYYY(inv.firstDueDate))}</td>
            </tr>` : ""}
            <tr>
              <th>المسدد حتى الآن</th><td class="num ok">${fmt(inv.paid)} ${esc(cur)}</td>
              <th>المتبقي المستحق</th><td class="num ${remaining > 0 ? "due" : "ok"} font-bold">${fmt(remaining)} ${esc(cur)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="total-bar" style="margin-top:14px; background:#0f172a; color:#fff; padding:10px 14px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:700;">المبلغ المطلوب / المتبقي</span>
        <span class="v" style="font-size:18px; font-weight:800; color:#34d399;">${fmt(remaining)} ${esc(cur)}</span>
      </div>

      ${scheduleHtml}
      ${warrantyHtml}
      ${qrHtml}
      ${signaturesHtml}
    `;

    const html = pdfDocument({
      docTitle: `إيصال فاتورة ${invNo} — ${shopSettings.shopName || "سجلي"}`,
      badge: isThermal ? undefined : "فاتورة بيع معتمدة",
      title: isThermal ? (shopSettings.shopName || "إيصال كاشير") : "فاتورة بيع رسمية",
      lede: isThermal ? undefined : "نسخة العميل المعتمدة متضمنة بيانات الشراء والأقساط.",
      brandSub: shopSettings.shopName || undefined,
      paper: paperFormat,
      meta: [
        { label: "رقم الفاتورة", value: esc(invNo) },
        { label: "تاريخ الإصدار", value: today },
        ...(showShopInfo && shopSettings.phone ? [{ label: "هاتف المحل", value: esc(shopSettings.phone) }] : []),
        ...(showShopInfo && shopSettings.address ? [{ label: "العنوان", value: esc(shopSettings.address) }] : []),
        ...(showShopInfo && shopSettings.taxNumber ? [{ label: "الرقم الضريبي", value: esc(shopSettings.taxNumber) }] : []),
        ...(showBranchInfo && invoiceBranch ? [{ label: "الفرع", value: esc(invoiceBranch.name) }] : []),
        ...(showBranchInfo && invoiceBranch?.location ? [{ label: "عنوان الفرع", value: esc(invoiceBranch.location) }] : []),
        ...(showBranchInfo && invoiceBranch?.phone ? [{ label: "هاتف الفرع", value: esc(invoiceBranch.phone) }] : []),
        ...(showBranchInfo && branchProfile.taxNumber ? [{ label: "السجل الضريبي للفرع", value: esc(branchProfile.taxNumber) }] : []),
        ...(showBranchInfo && branchProfile.commercialRecord ? [{ label: "السجل التجاري للفرع", value: esc(branchProfile.commercialRecord) }] : []),
      ],
      kpis: isThermal ? undefined : [
        { label: "إجمالي الفاتورة", value: `${fmt(inv.total)} ${cur}`, tone: "brand" },
        { label: "المدفوع", value: `${fmt(inv.paid)} ${cur}` },
        { label: "المتبقي", value: `${fmt(remaining)} ${cur}`, tone: remaining > 0 ? "danger" : "brand" },
      ],
      body,
      footerNote: shopSettings.footerNote || undefined,
    });

    openPdfDocument(html, { autoPrint: true });
    onClose();
  };

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end text-right">
            تخصيص وطباعة الفاتورة #{inv.id.slice(0, 6)}
            <Printer className="w-5 h-5 text-primary" />
          </DialogTitle>
          <DialogDescription className="text-right">
            اختر قالب الطباعة والمكونات المراد تضمينها في الإيصال.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-right">
          {/* اختيار نمط الطباعة */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground">نوع وحجم الإيصال</Label>
            <RadioGroup
              value={paperFormat}
              onValueChange={(val: any) => setPaperFormat(val)}
              className="grid grid-cols-2 gap-2.5"
            >
              <label
                htmlFor="fmt-thermal"
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  paperFormat === "thermal"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/60 hover:bg-foreground/[0.02]"
                }`}
              >
                <RadioGroupItem value="thermal" id="fmt-thermal" className="sr-only" />
                <Store className="w-6 h-6 mb-1" />
                <span className="font-bold text-xs">إيصال حراري (80mm)</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">طابعات الكاشير والـ POS</span>
              </label>

              <label
                htmlFor="fmt-a4"
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  paperFormat === "a4"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/60 hover:bg-foreground/[0.02]"
                }`}
              >
                <RadioGroupItem value="a4" id="fmt-a4" className="sr-only" />
                <FileText className="w-6 h-6 mb-1" />
                <span className="font-bold text-xs">فاتورة كاملة (A4)</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">مستند رسمي مفصل</span>
              </label>
            </RadioGroup>
          </div>

          {/* خيارات المحتوى */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-foreground/[0.025] border border-border/60">
            <Label className="text-xs font-bold text-muted-foreground">خيارات وتخصيص المحتوى</Label>

            <div className="flex items-center justify-between py-1">
              <Switch checked={showQr} onCheckedChange={setShowQr} id="sw-qr" />
              <Label htmlFor="sw-qr" className="cursor-pointer text-xs flex items-center gap-2">
                <QrCode className="w-3.5 h-3.5 text-primary" />
                تضمين باركود QR للتحقق السريع
              </Label>
            </div>

            <div className="flex items-center justify-between py-1">
              <Switch checked={showWarranty} onCheckedChange={setShowWarranty} id="sw-war" />
              <Label htmlFor="sw-war" className="cursor-pointer text-xs flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-success" />
                شروط الضمان وسياسة الاستبدال (14 يوم)
              </Label>
            </div>

            {inv.monthlyInstallment > 0 && (
              <div className="flex items-center justify-between py-1">
                <Switch checked={showSchedule} onCheckedChange={setShowSchedule} id="sw-sch" />
                <Label htmlFor="sw-sch" className="cursor-pointer text-xs flex items-center gap-2">
                  جدول مواعيد الأقساط الشهرية
                </Label>
              </div>
            )}

            <div className="flex items-center justify-between py-1">
              <Switch checked={showShopInfo} onCheckedChange={setShowShopInfo} id="sw-shp" />
              <Label htmlFor="sw-shp" className="cursor-pointer text-xs flex items-center gap-2">
                بيانات المتجر (العنوان، الهاتف، السجل)
              </Label>
            </div>

            <div className="flex items-center justify-between py-1">
              <Switch checked={showBranchInfo} onCheckedChange={setShowBranchInfo} id="sw-brn" />
              <Label htmlFor="sw-brn" className="cursor-pointer text-xs flex items-center gap-2">
                <Store className="w-3.5 h-3.5 text-primary" />
                بيانات الفرع (الاسم، العنوان، الهاتف، السجل الضريبي)
              </Label>
            </div>

            <div className="flex items-center justify-between py-1">
              <Switch checked={showSignatures} onCheckedChange={setShowSignatures} id="sw-sig" />
              <Label htmlFor="sw-sig" className="cursor-pointer text-xs flex items-center gap-2">
                خانة توقيع واستلام العميل
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handlePrint} className="gap-1.5 bg-primary text-primary-foreground font-bold">
            <Printer className="w-4 h-4" /> فتح الطباعة الآن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
