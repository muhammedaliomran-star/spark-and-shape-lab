/**
 * نظام الفروع والمخزون متعدد المواقع المتكامل (Segilly Branch Engine)
 * يشمل:
 * 1. مخزون الفروع والحدود الدنيا والتقييم المالي
 * 2. نظام التحويلات بين الفروع ودورة حياتها وطباعة أذون النقل
 * 3. ربط المبيعات ونقاط البيع والفواتير بالفرع والفرع النشط
 * 4. خزن الفروع وعهد النقدية وتوريد الأموال وتقفيل الورديات (Z-Report)
 * 5. مصروفات وأرباح الفروع (Branch P&L)
 * 6. المقارنات والتحليلات ولوحة المتصدرين
 * 7. الموظفين والصلاحيات لكل فرع
 */

import { pdfDocument, openPdfDocument, esc } from "@/lib/pdf-doc";
import { fmt, StockItem, Invoice, Expense, Payment, Branch } from "@/lib/store";

// ==================== 1. الأنواع والنماذج (Types & Interfaces) ====================

export interface ExtendedBranch extends Branch {
  code?: string;
  taxNumber?: string | null;
  commercialRecord?: string | null;
  email?: string | null;
  isActive?: boolean;
}

export interface BranchStockItem {
  id: string;
  branchId: string;
  stockItemId: string;
  quantity: number;
  minStock: number;
  maxStock?: number;
  shelfLocation?: string;
  updatedAt: string;
}

export type TransferStatus = "draft" | "in_transit" | "received" | "cancelled";

export interface BranchTransferItem {
  stockItemId: string;
  name: string;
  barcode?: string | null;
  requestedQty: number;
  sentQty: number;
  receivedQty: number;
  damagedQty: number;
  unitCost: number;
  salePrice: number;
  notes?: string;
}

export interface BranchTransfer {
  id: string;
  transferNumber: string;
  fromBranchId: string;
  toBranchId: string;
  status: TransferStatus;
  items: BranchTransferItem[];
  notes?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  createdBy: string;
  dispatchedBy?: string;
  receivedBy?: string;
  createdAt: string;
  dispatchedAt?: string;
  receivedAt?: string;
  cancelledAt?: string;
}

export interface BranchShift {
  id: string;
  branchId: string;
  shiftNumber: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  systemCashSales: number;
  systemInstallmentsCash: number;
  systemExpenses: number;
  systemRemittances: number;
  expectedCash: number;
  actualCash: number;
  variance: number; // actual - expected
  varianceReason?: string;
  status: "open" | "closed";
  notes?: string;
}

export interface BranchRemittance {
  id: string;
  branchId: string;
  amount: number;
  destinationType: "main_vault" | "bank" | "other_branch";
  destinationName: string;
  referenceNumber?: string;
  remittanceDate: string;
  performedBy: string;
  receivedBy?: string;
  status: "completed" | "pending";
  notes?: string;
  createdAt: string;
}

export interface BranchStaffMember {
  id: string;
  branchId: string;
  name: string;
  role: "manager" | "cashier" | "sales" | "inventory_keeper" | "accountant";
  phone: string;
  nationalId?: string;
  email?: string;
  salary: number;
  active: boolean;
  hiredDate: string;
  notes?: string;
}

// ==================== 2. التخزين المحلي والمزامنة (Storage Keys & Helpers) ====================

const STORAGE_KEYS = {
  ACTIVE_BRANCH: "segilly_active_branch_id",
  BRANCH_EXTENSIONS: "segilly_branch_extensions_v1",
  BRANCH_STOCK: "segilly_branch_stock_v1",
  BRANCH_TRANSFERS: "segilly_branch_transfers_v1",
  BRANCH_SHIFTS: "segilly_branch_shifts_v1",
  BRANCH_REMITTANCES: "segilly_branch_remittances_v1",
  BRANCH_STAFF: "segilly_branch_staff_v1",
  BRANCH_EXPENSES_ALLOC: "segilly_branch_expenses_alloc_v1",
  INVOICE_BRANCH_MAP: "segilly_invoice_branch_map_v1",
  BRANCH_PROFILES: "segilly_branch_profiles_v1",
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Error reading ${key}:`, e);
    return fallback;
  }
}

function writeStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("segilly_branch_data_updated", { detail: { key } }));
  } catch (e) {
    console.error(`Error writing ${key}:`, e);
  }
}

// ==================== 3. محرك مخزون الفروع (Multi-Location Stock Engine) ====================

export function getBranchStockList(): BranchStockItem[] {
  return readStorage<BranchStockItem[]>(STORAGE_KEYS.BRANCH_STOCK, []);
}

export function saveBranchStockList(items: BranchStockItem[]): void {
  writeStorage(STORAGE_KEYS.BRANCH_STOCK, items);
}

/**
 * جلب وتأكيد مخزون الصنف في فرع محدد، مع التهيئة التلقائية إن لم يكن مسجلاً
 */
export function getProductStockInBranch(
  branchId: string,
  stockItemId: string,
  totalStockFallback = 0
): { quantity: number; minStock: number; id?: string } {
  const allStock = getBranchStockList();
  const found = allStock.find((s) => s.branchId === branchId && s.stockItemId === stockItemId);
  if (found) {
    return { quantity: found.quantity, minStock: found.minStock, id: found.id };
  }
  return { quantity: totalStockFallback, minStock: 3 };
}

/**
 * تحديث رصيد صنف في فرع محدد
 */
export function updateBranchStockQuantity(
  branchId: string,
  stockItemId: string,
  deltaQuantity: number,
  minStock?: number
): void {
  const allStock = getBranchStockList();
  const idx = allStock.findIndex((s) => s.branchId === branchId && s.stockItemId === stockItemId);

  if (idx >= 0) {
    const current = allStock[idx];
    allStock[idx] = {
      ...current,
      quantity: Math.max(0, current.quantity + deltaQuantity),
      minStock: minStock !== undefined ? minStock : current.minStock,
      updatedAt: new Date().toISOString(),
    };
  } else {
    allStock.push({
      id: crypto.randomUUID(),
      branchId,
      stockItemId,
      quantity: Math.max(0, deltaQuantity),
      minStock: minStock !== undefined ? minStock : 3,
      updatedAt: new Date().toISOString(),
    });
  }
  saveBranchStockList(allStock);
}

/**
 * ضبط الرصيد الفعلي لصنف في فرع محدد (Direct Stock Override / Correction)
 */
export function setBranchStockAbsolute(
  branchId: string,
  stockItemId: string,
  newQuantity: number,
  minStock?: number,
  shelfLocation?: string
): void {
  const allStock = getBranchStockList();
  const idx = allStock.findIndex((s) => s.branchId === branchId && s.stockItemId === stockItemId);

  if (idx >= 0) {
    allStock[idx] = {
      ...allStock[idx],
      quantity: Math.max(0, newQuantity),
      minStock: minStock !== undefined ? minStock : allStock[idx].minStock,
      shelfLocation: shelfLocation !== undefined ? shelfLocation : allStock[idx].shelfLocation,
      updatedAt: new Date().toISOString(),
    };
  } else {
    allStock.push({
      id: crypto.randomUUID(),
      branchId,
      stockItemId,
      quantity: Math.max(0, newQuantity),
      minStock: minStock !== undefined ? minStock : 3,
      shelfLocation,
      updatedAt: new Date().toISOString(),
    });
  }
  saveBranchStockList(allStock);
}

/**
 * حساب إجمالي تقييم مخزون الفرع (بالتكلفة وسعر البيع)
 */
export function calculateBranchStockValuation(
  branchId: string,
  stockItems: StockItem[]
): {
  totalItemsCount: number;
  totalUnitsCount: number;
  totalCostValue: number;
  totalRetailValue: number;
  lowStockItemsCount: number;
  potentialProfit: number;
} {
  const branchStocks = getBranchStockList().filter((s) => s.branchId === branchId);
  const stockMap = new Map(stockItems.map((item) => [item.id, item]));

  let totalItemsCount = 0;
  let totalUnitsCount = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let lowStockItemsCount = 0;

  // If no branch-specific distribution yet, check if it's the main branch or evenly spread
  if (branchStocks.length === 0) {
    stockItems.forEach((item) => {
      totalItemsCount++;
      totalUnitsCount += item.quantity;
      totalCostValue += item.quantity * (item.lastUnitCost || 0);
      totalRetailValue += item.quantity * (item.salePrice || 0);
      if (item.quantity <= (item.minStock || 3)) {
        lowStockItemsCount++;
      }
    });
  } else {
    branchStocks.forEach((bStock) => {
      const original = stockMap.get(bStock.stockItemId);
      if (original) {
        totalItemsCount++;
        totalUnitsCount += bStock.quantity;
        totalCostValue += bStock.quantity * (original.lastUnitCost || 0);
        totalRetailValue += bStock.quantity * (original.salePrice || 0);
        if (bStock.quantity <= bStock.minStock) {
          lowStockItemsCount++;
        }
      }
    });
  }

  return {
    totalItemsCount,
    totalUnitsCount,
    totalCostValue: Math.round(totalCostValue * 100) / 100,
    totalRetailValue: Math.round(totalRetailValue * 100) / 100,
    lowStockItemsCount,
    potentialProfit: Math.round((totalRetailValue - totalCostValue) * 100) / 100,
  };
}

// ==================== 4. محرك التحويلات بين الفروع (Inter-Branch Transfers) ====================

export function getBranchTransfers(): BranchTransfer[] {
  return readStorage<BranchTransfer[]>(STORAGE_KEYS.BRANCH_TRANSFERS, []);
}

export function saveBranchTransfers(transfers: BranchTransfer[]): void {
  writeStorage(STORAGE_KEYS.BRANCH_TRANSFERS, transfers);
}

/**
 * إنشاء أمر تحويل جديد (Draft)
 */
export function createBranchTransfer(params: {
  fromBranchId: string;
  toBranchId: string;
  items: BranchTransferItem[];
  notes?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  createdBy: string;
}): BranchTransfer {
  const transfers = getBranchTransfers();
  const nextNum = `#TRF-${String(transfers.length + 1).padStart(4, "0")}`;

  const newTransfer: BranchTransfer = {
    id: crypto.randomUUID(),
    transferNumber: nextNum,
    fromBranchId: params.fromBranchId,
    toBranchId: params.toBranchId,
    status: "draft",
    items: params.items,
    notes: params.notes,
    driverName: params.driverName,
    driverPhone: params.driverPhone,
    vehicleNumber: params.vehicleNumber,
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
  };

  transfers.unshift(newTransfer);
  saveBranchTransfers(transfers);
  return newTransfer;
}

/**
 * شحن وإرسال التحويل (In Transit) - خصم الكميات من الفرع المصدر
 */
export function dispatchBranchTransfer(transferId: string, dispatchedBy = "المدير"): boolean {
  const transfers = getBranchTransfers();
  const transfer = transfers.find((t) => t.id === transferId);
  if (!transfer || transfer.status !== "draft") return false;

  // خصم الكميات من فرع الإرسال
  transfer.items.forEach((item) => {
    updateBranchStockQuantity(transfer.fromBranchId, item.stockItemId, -item.sentQty);
  });

  transfer.status = "in_transit";
  transfer.dispatchedBy = dispatchedBy;
  transfer.dispatchedAt = new Date().toISOString();

  saveBranchTransfers(transfers);
  return true;
}

/**
 * استلام وتأكيد التحويل (Received) - إضافة الكميات السليمة للفرع المستلم وتسجيل التوالف
 */
export function receiveBranchTransfer(params: {
  transferId: string;
  receivedItems: Array<{
    stockItemId: string;
    receivedQty: number;
    damagedQty: number;
    notes?: string;
  }>;
  receivedBy: string;
}): boolean {
  const transfers = getBranchTransfers();
  const transfer = transfers.find((t) => t.id === params.transferId);
  if (!transfer || transfer.status !== "in_transit") return false;

  const itemUpdatesMap = new Map(params.receivedItems.map((i) => [i.stockItemId, i]));

  transfer.items = transfer.items.map((item) => {
    const update = itemUpdatesMap.get(item.stockItemId);
    const recQty = update ? update.receivedQty : item.sentQty;
    const damQty = update ? update.damagedQty : 0;

    // إضافة الكميات المستلمة لفرع الوجهة
    if (recQty > 0) {
      updateBranchStockQuantity(transfer.toBranchId, item.stockItemId, recQty);
    }

    return {
      ...item,
      receivedQty: recQty,
      damagedQty: damQty,
      notes: update?.notes || item.notes,
    };
  });

  transfer.status = "received";
  transfer.receivedBy = params.receivedBy;
  transfer.receivedAt = new Date().toISOString();

  saveBranchTransfers(transfers);
  return true;
}

/**
 * إلغاء التحويل (Cancelled) - إرجاع البضاعة إذا كانت قيد النقل
 */
export function cancelBranchTransfer(transferId: string): boolean {
  const transfers = getBranchTransfers();
  const transfer = transfers.find((t) => t.id === transferId);
  if (!transfer || transfer.status === "received" || transfer.status === "cancelled") return false;

  // إذا كان في الطريق، يتم إرجاع المخزون لفرع الإرسال
  if (transfer.status === "in_transit") {
    transfer.items.forEach((item) => {
      updateBranchStockQuantity(transfer.fromBranchId, item.stockItemId, item.sentQty);
    });
  }

  transfer.status = "cancelled";
  transfer.cancelledAt = new Date().toISOString();

  saveBranchTransfers(transfers);
  return true;
}

/**
 * طباعة إذن تحويل ونقل بضائع رسمي (Transfer Note) بصيغة PDF
 */
export function printBranchTransferNote(
  transfer: BranchTransfer,
  fromBranch?: Branch,
  toBranch?: Branch,
  shopSettings?: any
): void {
  const cur = shopSettings?.currency || "ج.م";
  const totalSentUnits = transfer.items.reduce((s, i) => s + i.sentQty, 0);
  const totalCostVal = transfer.items.reduce((s, i) => s + i.sentQty * i.unitCost, 0);

  const statusLabel =
    transfer.status === "draft"
      ? "مسودة"
      : transfer.status === "in_transit"
      ? "قيد الشحن والنقل"
      : transfer.status === "received"
      ? "تم الاستلام بنجاح"
      : "ملغي";

  const rows = transfer.items
    .map(
      (item, idx) => `
    <tr>
      <td style="text-align:center; padding:8px; border-bottom:1px solid #eee;">${idx + 1}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; font-weight:bold;">${esc(item.name)}</td>
      <td style="text-align:center; padding:8px; border-bottom:1px solid #eee;">${esc(item.barcode || "—")}</td>
      <td style="text-align:center; padding:8px; border-bottom:1px solid #eee; font-weight:bold; font-size:14px;">${item.sentQty}</td>
      <td style="text-align:center; padding:8px; border-bottom:1px solid #eee;">${item.receivedQty || "—"}</td>
      <td style="text-align:center; padding:8px; border-bottom:1px solid #eee; color:${item.damagedQty > 0 ? "#dc2626" : "inherit"};">${item.damagedQty || 0}</td>
      <td style="text-align:left; padding:8px; border-bottom:1px solid #eee;">${fmt(item.unitCost * item.sentQty)} ${cur}</td>
    </tr>
  `
    )
    .join("");

  const transferQr = `https://api.qrserver.com/v1/create-qr-code/?size=170x170&margin=4&data=${encodeURIComponent(
    `SEGILLY-TRANSFER:${transfer.transferNumber}`
  )}`;
  const transferBarcode = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
    transfer.transferNumber
  )}&code=Code128&translate-esc=false&dpi=96`;

  const body = `
    <div style="margin-bottom:20px; padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:16px; font-weight:bold; color:#1e293b;">إذن تحويل ونقل بضائع داخلي</span>
        <span style="padding:4px 12px; background:#e0f2fe; color:#0369a1; border-radius:20px; font-size:12px; font-weight:bold;">
          ${statusLabel}
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:10px; padding:8px 10px; background:#fff; border:1px dashed #cbd5e1; border-radius:10px;">
        <img src="${transferQr}" alt="QR" style="width:78px; height:78px;" />
        <div style="flex:1; text-align:center;">
          <img src="${transferBarcode}" alt="Barcode" style="max-width:230px; height:52px;" />
          <div style="font-size:12px; font-weight:bold; letter-spacing:1px; direction:ltr; margin-top:2px;">${esc(transfer.transferNumber)}</div>
          <div style="font-size:10px; color:#64748b;">امسح الكود لتأكيد استلام الإذن سريعًا</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:13px;">
        <div>
          <p style="margin:3px 0;"><strong>فرع الإرسال (المصدر):</strong> ${esc(fromBranch?.name || "الفرع الرئيسي")}</p>
          <p style="margin:3px 0; color:#64748b;">العنوان: ${esc(fromBranch?.location || "—")} | هاتف: ${esc(fromBranch?.phone || "—")}</p>
          <p style="margin:3px 0;"><strong>مسؤول الإرسال:</strong> ${esc(transfer.dispatchedBy || transfer.createdBy)}</p>
        </div>
        <div>
          <p style="margin:3px 0;"><strong>فرع الاستلام (الوجهة):</strong> ${esc(toBranch?.name || "الفرع المخصص")}</p>
          <p style="margin:3px 0; color:#64748b;">العنوان: ${esc(toBranch?.location || "—")} | هاتف: ${esc(toBranch?.phone || "—")}</p>
          <p style="margin:3px 0;"><strong>مسؤول الاستلام:</strong> ${esc(transfer.receivedBy || "قيد الفحص")}</p>
        </div>
      </div>
      ${
        transfer.driverName
          ? `
        <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #cbd5e1; font-size:12px; color:#475569;">
          <strong>بيانات النقل:</strong> السائق: ${esc(transfer.driverName)} | الهاتف: ${esc(transfer.driverPhone || "—")} | رقم المركبة: ${esc(transfer.vehicleNumber || "—")}
        </div>
      `
          : ""
      }
    </div>

    <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px;">
      <thead>
        <tr style="background:#f1f5f9; text-align:right;">
          <th style="padding:8px; border-bottom:2px solid #cbd5e1; width:30px; text-align:center;">#</th>
          <th style="padding:8px; border-bottom:2px solid #cbd5e1;">اسم الصنف</th>
          <th style="padding:8px; border-bottom:2px solid #cbd5e1; text-align:center;">الباركود</th>
          <th style="padding:8px; border-bottom:2px solid #cbd5e1; text-align:center;">الكمية المشحونة</th>
          <th style="padding:8px; border-bottom:2px solid #cbd5e1; text-align:center;">الكمية المستلمة</th>
          <th style="padding:8px; border-bottom:2px solid #cbd5e1; text-align:center;">التالف/العجز</th>
          <th style="padding:8px; border-bottom:2px solid #cbd5e1; text-align:left;">إجمالي التكلفة</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr style="background:#f8fafc; font-weight:bold;">
          <td colspan="3" style="padding:10px; text-align:right; border-top:2px solid #cbd5e1;">الإجمالي الكلي:</td>
          <td style="text-align:center; padding:10px; border-top:2px solid #cbd5e1; color:#0284c7;">${totalSentUnits} قطعة</td>
          <td colspan="2" style="border-top:2px solid #cbd5e1;"></td>
          <td style="text-align:left; padding:10px; border-top:2px solid #cbd5e1;">${fmt(totalCostVal)} ${cur}</td>
        </tr>
      </tfoot>
    </table>

    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-top:40px; text-align:center; font-size:13px;">
      <div style="border-top:1px solid #94a3b8; padding-top:8px;">
        <p style="margin:0; font-weight:bold;">أمين مخزن الإرسال</p>
        <p style="margin:5px 0 0 0; color:#64748b; font-size:11px;">التوقيع: .....................</p>
      </div>
      <div style="border-top:1px solid #94a3b8; padding-top:8px;">
        <p style="margin:0; font-weight:bold;">مسؤول النقل / السائق</p>
        <p style="margin:5px 0 0 0; color:#64748b; font-size:11px;">التوقيع: .....................</p>
      </div>
      <div style="border-top:1px solid #94a3b8; padding-top:8px;">
        <p style="margin:0; font-weight:bold;">أمين مخزن الاستلام</p>
        <p style="margin:5px 0 0 0; color:#64748b; font-size:11px;">التوقيع: .....................</p>
      </div>
    </div>
  `;

  const html = pdfDocument({
    docTitle: `إذن تحويل بضائع ${transfer.transferNumber}`,
    title: `إذن تحويل ونقل بضائع (${transfer.transferNumber})`,
    badge: "منظومة الفروع والمخازن",
    meta: [
      { label: "رقم الإذن", value: transfer.transferNumber },
      { label: "التاريخ", value: transfer.createdAt.split("T")[0] },
      { label: "المصدر", value: fromBranch?.name || "فرع المصدر" },
      { label: "الوجهة", value: toBranch?.name || "فرع الوجهة" },
    ],
    kpis: [
      { label: "عدد الأصناف", value: String(transfer.items.length) },
      { label: "إجمالي القطع", value: `${totalSentUnits} قطعة` },
      { label: "الحالة", value: statusLabel, tone: transfer.status === "received" ? "brand" : "warn" },
    ],
    body,
    footerNote: "تم إنشاء هذا الإذن إلكترونياً من خلال منظومة سِجلّي لإدارة الفروع والمخازن.",
    page: "A4",
    paper: "a4",
  });

  openPdfDocument(html, { autoPrint: true });
}

// ==================== 5. محرك الخزينة وتوريد النقدية والورديات (Branch Cashbox & Z-Reports) ====================

export function getBranchShifts(): BranchShift[] {
  return readStorage<BranchShift[]>(STORAGE_KEYS.BRANCH_SHIFTS, []);
}

export function saveBranchShifts(shifts: BranchShift[]): void {
  writeStorage(STORAGE_KEYS.BRANCH_SHIFTS, shifts);
}

export function getBranchRemittances(): BranchRemittance[] {
  return readStorage<BranchRemittance[]>(STORAGE_KEYS.BRANCH_REMITTANCES, []);
}

export function saveBranchRemittances(list: BranchRemittance[]): void {
  writeStorage(STORAGE_KEYS.BRANCH_REMITTANCES, list);
}

/**
 * حساب تفاصيل ورصيد خزينة الفرع الحالية
 */
export function calculateBranchCashboxSummary(
  branchId: string,
  invoices: Invoice[],
  payments: Payment[],
  expenses: Expense[]
): {
  cashSales: number;
  installmentsCash: number;
  totalInflow: number;
  pettyExpenses: number;
  remittancesOut: number;
  totalOutflow: number;
  currentCashBalance: number;
} {
  const branchInvoices = getInvoicesForBranch(branchId, invoices);
  const branchInvoiceIds = new Set(branchInvoices.map((i) => i.id));

  // مبيعات كاش (المقدمات أو الفواتير الكاش)
  const cashSales = branchInvoices.reduce((sum, inv) => sum + (inv.downPayment || 0), 0);

  // تحصيلات الأقساط
  const installmentsCash = payments
    .filter((p) => branchInvoiceIds.has(p.invoiceId))
    .reduce((sum, p) => sum + p.amount, 0);

  // مصروفات الفرع
  const branchExpenses = getExpensesForBranch(branchId, expenses);
  const pettyExpenses = branchExpenses.reduce((sum, e) => sum + e.amount, 0);

  // التوريدات المحولة للخزينة المركزية أو البنك
  const remittances = getBranchRemittances().filter((r) => r.branchId === branchId && r.status === "completed");
  const remittancesOut = remittances.reduce((sum, r) => sum + r.amount, 0);

  const totalInflow = cashSales + installmentsCash;
  const totalOutflow = pettyExpenses + remittancesOut;
  const currentCashBalance = Math.max(0, totalInflow - totalOutflow);

  return {
    cashSales: Math.round(cashSales * 100) / 100,
    installmentsCash: Math.round(installmentsCash * 100) / 100,
    totalInflow: Math.round(totalInflow * 100) / 100,
    pettyExpenses: Math.round(pettyExpenses * 100) / 100,
    remittancesOut: Math.round(remittancesOut * 100) / 100,
    totalOutflow: Math.round(totalOutflow * 100) / 100,
    currentCashBalance: Math.round(currentCashBalance * 100) / 100,
  };
}

/**
 * تسجيل عملية توريد نقدية من الفرع (Vault Remittance)
 */
export function addBranchRemittance(remittance: Omit<BranchRemittance, "id" | "createdAt">): BranchRemittance {
  const list = getBranchRemittances();
  const created: BranchRemittance = {
    ...remittance,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  list.unshift(created);
  saveBranchRemittances(list);
  return created;
}

/**
 * إغلاق وردية الكاشير وإنشاء تقرير Z-Report رسمي
 */
export function closeBranchShift(params: {
  branchId: string;
  cashierName: string;
  openingBalance: number;
  actualCashCounted: number;
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  varianceReason?: string;
  notes?: string;
}): BranchShift {
  const summary = calculateBranchCashboxSummary(params.branchId, params.invoices, params.payments, params.expenses);
  const expectedCash = params.openingBalance + summary.totalInflow - summary.totalOutflow;
  const variance = params.actualCashCounted - expectedCash;

  const shifts = getBranchShifts();
  const shiftNumber = `Z-${new Date().getFullYear()}-${String(shifts.length + 1).padStart(4, "0")}`;

  const newShift: BranchShift = {
    id: crypto.randomUUID(),
    branchId: params.branchId,
    shiftNumber,
    cashierName: params.cashierName,
    openedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    closedAt: new Date().toISOString(),
    openingBalance: params.openingBalance,
    systemCashSales: summary.cashSales,
    systemInstallmentsCash: summary.installmentsCash,
    systemExpenses: summary.pettyExpenses,
    systemRemittances: summary.remittancesOut,
    expectedCash: Math.round(expectedCash * 100) / 100,
    actualCash: Math.round(params.actualCashCounted * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    varianceReason: params.varianceReason,
    status: "closed",
    notes: params.notes,
  };

  shifts.unshift(newShift);
  saveBranchShifts(shifts);
  return newShift;
}

/**
 * طباعة إيصال تقفيل الوردية Z-Report (حراري أو A4)
 */
export function printBranchShiftZReport(
  shift: BranchShift,
  branch?: Branch,
  shopSettings?: any,
  paper: "thermal" | "A4" = "thermal"
): void {
  const cur = shopSettings?.currency || "ج.م";
  const varianceTone = shift.variance === 0 ? "#16a34a" : shift.variance > 0 ? "#0284c7" : "#dc2626";
  const varianceText =
    shift.variance === 0 ? "متطابق 100%" : shift.variance > 0 ? `زيادة (+${fmt(shift.variance)} ${cur})` : `عجز (${fmt(shift.variance)} ${cur})`;

  const body = `
    <div style="font-family:inherit; padding:${paper === "thermal" ? "4px" : "16px"};">
      <div style="text-align:center; border-bottom:2px dashed #94a3b8; padding-bottom:12px; margin-bottom:12px;">
        <h3 style="margin:0; font-size:18px; font-weight:bold;">تقرير تقفيل وردية (Z-Report)</h3>
        <p style="margin:4px 0 0 0; font-size:13px; color:#64748b;">${esc(branch?.name || "الفرع الرئيسي")}</p>
        <p style="margin:2px 0 0 0; font-size:11px; color:#94a3b8;">رقم الإغلاق: ${shift.shiftNumber}</p>
      </div>

      <div style="font-size:12px; margin-bottom:12px; line-height:1.6;">
        <div style="display:flex; justify-content:space-between;"><span>الكاشير:</span><strong>${esc(shift.cashierName)}</strong></div>
        <div style="display:flex; justify-content:space-between;"><span>وقت الفتح:</span><span>${new Date(shift.openedAt).toLocaleTimeString("ar-EG")}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>وقت الإغلاق:</span><span>${new Date(shift.closedAt || new Date()).toLocaleTimeString("ar-EG")}</span></div>
      </div>

      <div style="border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; padding:8px 0; margin-bottom:12px; font-size:13px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>رصيد بداية الوردية (العهدة):</span>
          <strong>${fmt(shift.openingBalance)} ${cur}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#16a34a;">
          <span>(+) مبيعات نقدية / مقدمات:</span>
          <strong>${fmt(shift.systemCashSales)} ${cur}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#16a34a;">
          <span>(+) تحصيلات أقساط نقدية:</span>
          <strong>${fmt(shift.systemInstallmentsCash)} ${cur}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#dc2626;">
          <span>(-) مصروفات ونثريات:</span>
          <strong>${fmt(shift.systemExpenses)} ${cur}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#dc2626;">
          <span>(-) توريدات نقدية للخزينة:</span>
          <strong>${fmt(shift.systemRemittances)} ${cur}</strong>
        </div>
      </div>

      <div style="background:#f8fafc; padding:10px; border-radius:8px; font-size:13px; margin-bottom:12px; border:1px solid #e2e8f0;">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span>النقدية المحسوبة بالنظام:</span>
          <strong>${fmt(shift.expectedCash)} ${cur}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px;">
          <span>النقدية الفعلية بالجرد (الدرج):</span>
          <strong style="color:#0f172a;">${fmt(shift.actualCash)} ${cur}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding-top:6px; border-top:1px dashed #cbd5e1; font-weight:bold;">
          <span>حالة المطابقة:</span>
          <span style="color:${varianceTone};">${varianceText}</span>
        </div>
        ${
          shift.varianceReason
            ? `<div style="margin-top:6px; font-size:11px; color:#64748b;">سبب الفارق: ${esc(shift.varianceReason)}</div>`
            : ""
        }
      </div>

      <div style="margin-top:20px; font-size:12px; display:flex; justify-content:space-between; text-align:center;">
        <div>توقيع الكاشير<br/><br/>...................</div>
        <div>توقيع المدير المسؤول<br/><br/>...................</div>
      </div>
    </div>
  `;

  const html = pdfDocument({
    docTitle: `تقرير Z-Report ${shift.shiftNumber}`,
    title: `تقرير تقفيل الوردية اليومية (${shift.shiftNumber})`,
    badge: "الخزينة والورديات",
    meta: [
      { label: "رقم الوردية", value: shift.shiftNumber },
      { label: "الكاشير", value: shift.cashierName },
      { label: "الفرع", value: branch?.name || "الفرع" },
      { label: "التاريخ", value: (shift.closedAt || new Date().toISOString()).split("T")[0] },
    ],
    kpis: [
      { label: "المبيعات الكاش", value: `${fmt(shift.systemCashSales)} ج.م` },
      { label: "النقدية الفعلية", value: `${fmt(shift.actualCash)} ج.م`, tone: "brand" },
      { label: "الفارق", value: varianceText, tone: shift.variance === 0 ? "brand" : "danger" },
    ],
    body,
    footerNote: "تم تقفيل واعتماد الوردية إلكترونياً.",
    page: "A4",
    paper: paper === "thermal" ? "thermal" : "a4",
  });

  openPdfDocument(html, {
    autoPrint: true,
    features: paper === "thermal" ? "width=420,height=760" : "width=880,height=760",
  });
}

// ==================== 6. ربط المبيعات والمصروفات بالفرع وقائمة الدخل (Branch P&L) ====================

export function getInvoiceBranchMap(): Record<string, string> {
  return readStorage<Record<string, string>>(STORAGE_KEYS.INVOICE_BRANCH_MAP, {});
}

export function linkInvoiceToBranch(invoiceId: string, branchId: string): void {
  if (!invoiceId || !branchId || branchId === "all") return;
  const map = getInvoiceBranchMap();
  map[invoiceId] = branchId;
  writeStorage(STORAGE_KEYS.INVOICE_BRANCH_MAP, map);
}

export function getInvoiceBranchId(invoiceId: string): string | null {
  return getInvoiceBranchMap()[invoiceId] || null;
}

/**
 * فواتير فرع محدد. الفواتير غير المختومة بفرع تُنسب للفرع الرئيسي (fallbackBranchId)
 * حتى لا تختفي البيانات القديمة عند التصفية.
 */
export function getInvoicesForBranch(
  branchId: string,
  allInvoices: Invoice[],
  fallbackBranchId?: string
): Invoice[] {
  if (!branchId || branchId === "all") return allInvoices;
  const map = getInvoiceBranchMap();
  return allInvoices.filter((inv) => {
    const assigned = map[inv.id];
    if (assigned) return assigned === branchId;
    return fallbackBranchId ? fallbackBranchId === branchId : true;
  });
}


export function getExpenseBranchMap(): Record<string, string> {
  return readStorage<Record<string, string>>(STORAGE_KEYS.BRANCH_EXPENSES_ALLOC, {});
}

export function linkExpenseToBranch(expenseId: string, branchId: string): void {
  const map = getExpenseBranchMap();
  map[expenseId] = branchId;
  writeStorage(STORAGE_KEYS.BRANCH_EXPENSES_ALLOC, map);
}

export function getExpensesForBranch(branchId: string, allExpenses: Expense[]): Expense[] {
  const map = getExpenseBranchMap();
  return allExpenses.filter((exp) => {
    const assigned = map[exp.id];
    if (assigned) return assigned === branchId;
    return true; // fallback
  });
}

export interface BranchProfitability {
  branchId: string;
  branchName: string;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: number;
  netProfit: number;
  netMarginPct: number;
  invoicesCount: number;
  averageTicketSize: number;
}

/**
 * حساب قائمة الدخل وأرباح الفرع المستقلة بدقة كاملة
 */
export function calculateBranchProfitability(
  branch: Branch,
  invoices: Invoice[],
  expenses: Expense[],
  invoiceItemsMap?: Map<string, Array<{ cost: number; price: number; quantity: number }>>
): BranchProfitability {
  const branchInvoices = getInvoicesForBranch(branch.id, invoices);
  const branchExpenses = getExpensesForBranch(branch.id, expenses);

  const totalRevenue = branchInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const invoicesCount = branchInvoices.length;
  const averageTicketSize = invoicesCount > 0 ? Math.round((totalRevenue / invoicesCount) * 100) / 100 : 0;

  // تقدير أو احتساب تكلفة البضاعة المباعة (COGS)
  let totalCogs = 0;
  if (invoiceItemsMap) {
    branchInvoices.forEach((inv) => {
      const items = invoiceItemsMap.get(inv.id) || [];
      items.forEach((it) => {
        totalCogs += (it.cost || 0) * (it.quantity || 1);
      });
    });
  } else {
    // 65% COGS benchmark if items breakdown not passed
    totalCogs = totalRevenue * 0.65;
  }

  const grossProfit = Math.max(0, totalRevenue - totalCogs);
  const grossMarginPct = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 10000) / 100 : 0;

  const operatingExpenses = branchExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = grossProfit - operatingExpenses;
  const netMarginPct = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 10000) / 100 : 0;

  return {
    branchId: branch.id,
    branchName: branch.name,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCogs: Math.round(totalCogs * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMarginPct,
    operatingExpenses: Math.round(operatingExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    netMarginPct,
    invoicesCount,
    averageTicketSize,
  };
}

// ==================== 7. الموظفين والصلاحيات (Staff & Role Scopes) ====================

export function getBranchStaff(): BranchStaffMember[] {
  const initial: BranchStaffMember[] = [
    {
      id: "staff-1",
      branchId: "main",
      name: "أحمد محمود (المدير العام)",
      role: "manager",
      phone: "01011223344",
      salary: 12000,
      active: true,
      hiredDate: "2024-01-15",
    },
  ];
  return readStorage<BranchStaffMember[]>(STORAGE_KEYS.BRANCH_STAFF, initial);
}

export function saveBranchStaff(staff: BranchStaffMember[]): void {
  writeStorage(STORAGE_KEYS.BRANCH_STAFF, staff);
}

export function addBranchStaffMember(member: Omit<BranchStaffMember, "id">): BranchStaffMember {
  const staff = getBranchStaff();
  const created: BranchStaffMember = {
    ...member,
    id: crypto.randomUUID(),
  };
  staff.push(created);
  saveBranchStaff(staff);
  return created;
}

export function updateBranchStaffMember(id: string, patch: Partial<BranchStaffMember>): void {
  const staff = getBranchStaff();
  const idx = staff.findIndex((s) => s.id === id);
  if (idx >= 0) {
    staff[idx] = { ...staff[idx], ...patch };
    saveBranchStaff(staff);
  }
}

export function removeBranchStaffMember(id: string): void {
  const staff = getBranchStaff().filter((s) => s.id !== id);
  saveBranchStaff(staff);
}

// ==================== 8. محدد الفرع العام (Global Active Branch State) ====================

export function getActiveBranchId(): string {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_BRANCH) || "all";
}

export function setActiveBranchId(branchId: string): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH, branchId);
  window.dispatchEvent(new CustomEvent("segilly_active_branch_changed", { detail: { branchId } }));
}

// ==================== 9. الملف الرسمي للفرع (Tax / Legal Profile) ====================

export interface BranchProfile {
  code?: string;
  taxNumber?: string;
  commercialRecord?: string;
  email?: string;
}

export function getBranchProfiles(): Record<string, BranchProfile> {
  return readStorage<Record<string, BranchProfile>>(STORAGE_KEYS.BRANCH_PROFILES, {});
}

export function getBranchProfile(branchId: string): BranchProfile {
  return getBranchProfiles()[branchId] || {};
}

export function saveBranchProfile(branchId: string, patch: BranchProfile): void {
  const all = getBranchProfiles();
  all[branchId] = { ...(all[branchId] || {}), ...patch };
  writeStorage(STORAGE_KEYS.BRANCH_PROFILES, all);
}

// ==================== 10. تنبيهات نواقص الفروع (Branch Low Stock Alerts) ====================

export interface BranchLowStockAlert {
  branchId: string;
  branchName: string;
  stockItemId: string;
  itemName: string;
  quantity: number;
  minStock: number;
  shortage: number;
  isOut: boolean;
}

export function getBranchLowStockAlerts(
  branches: Branch[],
  stockItems: StockItem[],
  onlyBranchId?: string
): BranchLowStockAlert[] {
  const stockList = getBranchStockList();
  const alerts: BranchLowStockAlert[] = [];
  const scoped = onlyBranchId && onlyBranchId !== "all"
    ? branches.filter((b) => b.id === onlyBranchId)
    : branches;

  for (const branch of scoped) {
    for (const item of stockItems) {
      const row = stockList.find((s) => s.branchId === branch.id && s.stockItemId === item.id);
      if (!row) continue; // لم يُخصص رصيد لهذا الصنف في هذا الفرع
      const minStock = row.minStock || 3;
      if (row.quantity > minStock) continue;
      alerts.push({
        branchId: branch.id,
        branchName: branch.name,
        stockItemId: item.id,
        itemName: item.name,
        quantity: row.quantity,
        minStock,
        shortage: Math.max(0, minStock - row.quantity),
        isOut: row.quantity <= 0,
      });
    }
  }

  return alerts.sort((a, b) => a.quantity - b.quantity);
}

/** الفرع الذي تُختم به العمليات الجديدة: الفرع النشط، وإن كان "كل الفروع" فالفرع الرئيسي. */
export function resolveStampBranchId(branches: Branch[]): string {
  const active = getActiveBranchId();
  if (active && active !== "all" && branches.some((b) => b.id === active)) return active;
  const main = branches.find((b) => b.isMain) || branches[0];
  return main?.id || "";
}
