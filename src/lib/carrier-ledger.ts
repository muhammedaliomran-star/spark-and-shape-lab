import * as XLSX from "xlsx";
import { Shipment, ShipmentCarrier, ShippingZone } from "./store";
import { pdfDocument, openPdfDocument, esc } from "./pdf-doc";

export interface CarrierSettlementTransaction {
  id: string;
  carrierId: string;
  type: "settlement" | "partial_payment" | "return_penalty" | "bonus" | "adjustment";
  amount: number; // المبلغ المورد أو المخصوم
  date: string;
  paymentMethod: "cash" | "bank_transfer" | "instapay" | "vodafone_cash" | "other";
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}

const SETTLEMENTS_KEY = "segelly_carrier_settlement_transactions_v1";

export function loadCarrierTransactions(carrierId?: string): CarrierSettlementTransaction[] {
  try {
    const raw = localStorage.getItem(SETTLEMENTS_KEY);
    const list: CarrierSettlementTransaction[] = raw ? JSON.parse(raw) : [];
    if (carrierId) {
      return list.filter(t => t.carrierId === carrierId);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveCarrierTransaction(tx: Omit<CarrierSettlementTransaction, "id" | "createdAt">): CarrierSettlementTransaction {
  const list = loadCarrierTransactions();
  const newTx: CarrierSettlementTransaction = {
    ...tx,
    id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  list.unshift(newTx);
  localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(list));
  return newTx;
}

export function deleteCarrierTransaction(id: string) {
  const list = loadCarrierTransactions().filter(t => t.id !== id);
  localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(list));
}

export interface CarrierFinancialSummary {
  carrier: ShipmentCarrier;
  totalShipments: number;
  deliveredCount: number;
  returnedCount: number;
  pendingCount: number;
  totalCodCollected: number; // إجمالي المحصل من العملاء للشحنات المسلمة
  totalCarrierFees: number; // إجمالي عمولات الشحن المستحقة للمندوب
  totalReturnDeductions: number; // خصومات المرتجعات إن وجدت
  netStoreDue: number; // صافي المستحق للتاجر = COD - Fees - Deductions
  totalSettledAmount: number; // إجمالي ما قام المندوب بتوريده للمتجر حتى الآن
  currentOutstandingBalance: number; // الرصيد المعلق المتبقي على المندوب
}

export function calculateCarrierSummary(
  carrier: ShipmentCarrier,
  shipments: Shipment[],
  transactions: CarrierSettlementTransaction[]
): CarrierFinancialSummary {
  const carrierShipments = shipments.filter(s => s.carrierId === carrier.id);
  const delivered = carrierShipments.filter(s => s.status === "delivered");
  const returned = carrierShipments.filter(s => s.status === "returned");
  const pending = carrierShipments.filter(s => ["pending", "processing", "shipped"].includes(s.status));

  const totalCodCollected = delivered.reduce((sum, s) => sum + (s.codAmount || 0), 0);
  const totalCarrierFees = delivered.reduce((sum, s) => sum + (s.shippingCost || carrier.baseCost || 0), 0);

  const carrierTx = transactions.filter(t => t.carrierId === carrier.id);
  const totalSettledAmount = carrierTx
    .filter(t => t.type === "settlement" || t.type === "partial_payment")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalReturnDeductions = carrierTx
    .filter(t => t.type === "return_penalty")
    .reduce((sum, t) => sum + t.amount, 0);

  // Net due to store from deliveries
  const netStoreDue = totalCodCollected - totalCarrierFees - totalReturnDeductions;
  const currentOutstandingBalance = Math.max(0, netStoreDue - totalSettledAmount);

  return {
    carrier,
    totalShipments: carrierShipments.length,
    deliveredCount: delivered.length,
    returnedCount: returned.length,
    pendingCount: pending.length,
    totalCodCollected,
    totalCarrierFees,
    totalReturnDeductions,
    netStoreDue,
    totalSettledAmount,
    currentOutstandingBalance,
  };
}

const money = (n: number) => `${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ج.م`;

/** طباعة تقرير مطابقة وتصفية مالية للمندوب PDF */
export function printCarrierReconciliationReport(
  summary: CarrierFinancialSummary,
  shipments: Shipment[],
  transactions: CarrierSettlementTransaction[]
): boolean {
  const carrierShipments = shipments.filter(s => s.carrierId === summary.carrier.id);
  const carrierTx = transactions.filter(t => t.carrierId === summary.carrier.id);

  const body = `
  <div style="margin-bottom:15px; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
    <h3 style="margin:0 0 8px 0; color:#0f172a;">ملخص الحساب المالي — ${esc(summary.carrier.name)}</h3>
    <p style="margin:0; font-size:13px; color:#475569;">
      الهاتف: ${esc(summary.carrier.phone || "-")} | الشخص المسؤول: ${esc(summary.carrier.contactPerson || "-")}
    </p>
  </div>

  <table style="margin-bottom:20px;">
    <thead>
      <tr>
        <th>بيان الحساب</th>
        <th>القيمة</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>إجمالي الشحنات المسلمة (COD المحصل)</td><td><b>${money(summary.totalCodCollected)}</b> (${summary.deliveredCount} طرد)</td></tr>
      <tr><td>أجرة/عمولة التوصيل المستحقة للمندوب (-)</td><td style="color:#e11d48;">- ${money(summary.totalCarrierFees)}</td></tr>
      ${summary.totalReturnDeductions > 0 ? `<tr><td>خصومات مرتجعات وغرامات (-)</td><td style="color:#e11d48;">- ${money(summary.totalReturnDeductions)}</td></tr>` : ""}
      <tr style="background:#f1f5f9; font-weight:bold;"><td>الصافي المستحق للتوريد للشركة</td><td style="color:#0f172a;">${money(summary.netStoreDue)}</td></tr>
      <tr><td>إجمالي المبالغ المسددة والموردة سابقاً</td><td style="color:#16a34a;">${money(summary.totalSettledAmount)}</td></tr>
      <tr style="background:#eff6ff; font-weight:bold; font-size:15px;"><td>المبلغ المتبقي المعلق للتصفية</td><td style="color:#2563eb;">${money(summary.currentOutstandingBalance)}</td></tr>
    </tbody>
  </table>

  <h4>سجل الشحنات المضمنة في المطابقة</h4>
  <table style="font-size:12px; margin-bottom:20px;">
    <thead>
      <tr>
        <th>#</th>
        <th>رقم التتبع</th>
        <th>المستلم</th>
        <th>الموبايل</th>
        <th>الحالة</th>
        <th>قيمة COD</th>
        <th>أجرة الشحن</th>
        <th>الصافي</th>
      </tr>
    </thead>
    <tbody>
      ${carrierShipments.slice(0, 50).map((s, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${esc(s.trackingNumber || s.id.slice(0, 8))}</td>
          <td>${esc(s.recipientName || "-")}</td>
          <td>${esc(s.recipientPhone || "-")}</td>
          <td>${s.status === "delivered" ? "تم التسليم" : s.status === "returned" ? "مرتجع" : "قيد الشحن"}</td>
          <td>${money(s.codAmount)}</td>
          <td>${money(s.shippingCost)}</td>
          <td>${money((s.codAmount || 0) - (s.shippingCost || 0))}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  ${carrierTx.length > 0 ? `
    <h4>سجل التوريدات والمدفوعات المسجلة</h4>
    <table style="font-size:12px; margin-bottom:20px;">
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>النوع</th>
          <th>المبلغ</th>
          <th>طريقة الدفع</th>
          <th>رقم المرجع / ملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${carrierTx.map(t => `
          <tr>
            <td>${new Date(t.date).toLocaleDateString("ar-EG")}</td>
            <td>${t.type === "settlement" ? "تسوية كاملة" : t.type === "partial_payment" ? "توريد جزئي" : "خصم مرتجع"}</td>
            <td><b>${money(t.amount)}</b></td>
            <td>${t.paymentMethod}</td>
            <td>${esc(t.referenceNumber || t.notes || "-")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : ""}

  <div class="sig" style="margin-top:30px; display:flex; justify-content:space-between;">
    <div style="text-align:center; width:200px; border-top:1px solid #cbd5e1; padding-top:8px;">توقيع المندوب / شركة الشحن</div>
    <div style="text-align:center; width:200px; border-top:1px solid #cbd5e1; padding-top:8px;">اعتماد المحاسب / الإدارة</div>
  </div>
  `;

  return openPdfDocument(
    pdfDocument({
      docTitle: `مطابقة مالية - ${summary.carrier.name}`,
      badge: "كشف حساب ومطابقة شحن",
      title: `كشف حساب ${summary.carrier.name}`,
      brandSub: "سجل المطابقات والتسويات المالية",
      meta: [
        { label: "تاريخ المطابقة", value: new Date().toLocaleDateString("ar-EG") },
        { label: "عدد الشحنات", value: String(summary.totalShipments) },
      ],
      kpis: [
        { label: "المحصل COD", value: money(summary.totalCodCollected), tone: "brand" },
        { label: "عمولة التوصيل", value: money(summary.totalCarrierFees), tone: "warn" },
        { label: "الرصيد المعلق", value: money(summary.currentOutstandingBalance), tone: summary.currentOutstandingBalance > 0 ? "warn" : "brand" },
      ],
      body,
      page: "A4",
      footerNote: "هذا المستند يعتبر إقرار مطابقة وتصفية رسمية بين المتجر ومندوب/شركة الشحن.",
    }),
    { autoPrint: false }
  );
}

/** تصدير كشف حساب المندوب بصيغة Excel */
export function exportCarrierLedgerToExcel(
  summary: CarrierFinancialSummary,
  shipments: Shipment[],
  transactions: CarrierSettlementTransaction[]
) {
  const carrierShipments = shipments.filter(s => s.carrierId === summary.carrier.id);
  const carrierTx = transactions.filter(t => t.carrierId === summary.carrier.id);

  const summarySheetData = [
    { "البيان": "اسم شركة الشحن / المندوب", "القيمة": summary.carrier.name },
    { "البيان": "رقم الهاتف", "القيمة": summary.carrier.phone || "-" },
    { "البيان": "إجمالي الشحنات", "القيمة": summary.totalShipments },
    { "البيان": "عدد المسلم", "القيمة": summary.deliveredCount },
    { "البيان": "عدد المرتجع", "القيمة": summary.returnedCount },
    { "البيان": "إجمالي المحصل COD", "القيمة": summary.totalCodCollected },
    { "البيان": "عمولة الشحن للمندوب (-)", "القيمة": summary.totalCarrierFees },
    { "البيان": "خصومات المرتجعات (-)", "القيمة": summary.totalReturnDeductions },
    { "البيان": "صافي مستحق المتجر", "القيمة": summary.netStoreDue },
    { "البيان": "المبالغ الموردة سابقاً", "القيمة": summary.totalSettledAmount },
    { "البيان": "الرصيد المعلق المتبقي للتصفية", "القيمة": summary.currentOutstandingBalance },
  ];

  const shipmentsSheetData = carrierShipments.map((s, i) => ({
    "م": i + 1,
    "رقم التتبع": s.trackingNumber || s.id.slice(0, 8),
    "اسم المستلم": s.recipientName || "",
    "رقم الموبايل": s.recipientPhone || "",
    "العنوان": s.deliveryAddress || "",
    "الحالة": s.status,
    "مبلغ التحصيل COD": s.codAmount || 0,
    "تكلفة الشحن": s.shippingCost || 0,
    "الصافي": (s.codAmount || 0) - (s.shippingCost || 0),
    "تاريخ الإنشاء": s.createdAt ? new Date(s.createdAt).toLocaleDateString("ar-EG") : "",
    "تاريخ التسليم": s.deliveredAt ? new Date(s.deliveredAt).toLocaleDateString("ar-EG") : "",
  }));

  const txSheetData = carrierTx.map((t, i) => ({
    "م": i + 1,
    "التاريخ": new Date(t.date).toLocaleDateString("ar-EG"),
    "نوع الحركة": t.type === "settlement" ? "تسوية كاملة" : t.type === "partial_payment" ? "توريد جزئي" : "خصم مرتجع",
    "المبلغ": t.amount,
    "طريقة الدفع": t.paymentMethod,
    "رقم المرجع": t.referenceNumber || "",
    "ملاحظات": t.notes || "",
  }));

  const workbook = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
  const wsShipments = XLSX.utils.json_to_sheet(shipmentsSheetData);
  const wsTx = XLSX.utils.json_to_sheet(txSheetData.length ? txSheetData : [{ "بيان": "لا توجد حركات توريد مسجلة" }]);

  XLSX.utils.book_append_sheet(workbook, wsSummary, "ملخص الحساب");
  XLSX.utils.book_append_sheet(workbook, wsShipments, "الشحنات");
  XLSX.utils.book_append_sheet(workbook, wsTx, "حركات التوريد والتسويات");

  XLSX.writeFile(workbook, `كشف_حساب_${summary.carrier.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
