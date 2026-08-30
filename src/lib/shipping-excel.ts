import * as XLSX from "xlsx";
import { Shipment, ShipmentCarrier, ShippingZone, Invoice, InvoiceItem } from "./store";

export type ExcelCarrierFormat = "bosta" | "jt" | "mylerz" | "aramex" | "generic";

export interface ShipmentExportRow {
  shipment: Shipment;
  carrier?: ShipmentCarrier;
  zone?: ShippingZone;
  invoice?: Invoice;
  items?: InvoiceItem[];
}

/** تصدير الشحنات إلى ملف إكسيل بصيغة متوافقة مع شركات الشحن */
export function exportShipmentsToExcel(
  rows: ShipmentExportRow[],
  format: ExcelCarrierFormat = "generic",
  fileName?: string
) {
  let data: Record<string, any>[] = [];

  if (format === "bosta") {
    data = rows.map((r, i) => {
      const s = r.shipment;
      const itemsSummary = (r.items ?? []).map(item => `${item.name} (${item.quantity})`).join(" + ") || "طرد تجاري";
      return {
        "Serial": i + 1,
        "Business Reference": s.trackingNumber || s.invoiceId || `SHP-${s.id.slice(0, 6)}`,
        "Receiver Name": s.recipientName || "عميل",
        "Receiver Phone": s.recipientPhone || "",
        "Receiver Phone 2": "",
        "Governorate / City": r.zone?.name || "القاهرة",
        "Dropoff Address": s.deliveryAddress || "",
        "COD Amount (EGP)": s.codAmount || 0,
        "Package Type": "Parcel",
        "Number of Items": (r.items ?? []).reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
        "Item Description": itemsSummary,
        "Notes / Special Instructions": s.notes || "ممنوع فتح الطرد إلا بعد سداد القيمة",
      };
    });
  } else if (format === "jt") {
    data = rows.map((r, i) => {
      const s = r.shipment;
      return {
        "Order No": s.trackingNumber || `JT-${s.id.slice(0, 8)}`,
        "Express Type": "EZ",
        "Consignee Name": s.recipientName || "عميل",
        "Consignee Mobile": s.recipientPhone || "",
        "Consignee Phone2": "",
        "Province": r.zone?.name || "القاهرة",
        "City": r.zone?.name || "القاهرة",
        "Detailed Address": s.deliveryAddress || "",
        "Goods Value": s.codAmount || 0,
        "Payment Type": "COD",
        "COD Amount": s.codAmount || 0,
        "Weight (kg)": 1,
        "Item Name": (r.items ?? []).map(item => item.name).join(" - ") || "منتجات",
        "Remarks": s.notes || "",
      };
    });
  } else if (format === "mylerz") {
    data = rows.map((r, i) => {
      const s = r.shipment;
      return {
        "Reference": s.trackingNumber || s.id.slice(0, 8),
        "Customer Name": s.recipientName || "عميل",
        "Mobile Number": s.recipientPhone || "",
        "Secondary Phone": "",
        "Neighborhood / Zone": r.zone?.name || "",
        "Full Address": s.deliveryAddress || "",
        "Cash on Delivery (COD)": s.codAmount || 0,
        "Pieces": 1,
        "Description": (r.items ?? []).map(item => `${item.name} (${item.quantity})`).join(", ") || "أصناف",
        "Instructions": s.notes || "",
      };
    });
  } else if (format === "aramex") {
    data = rows.map((r, i) => {
      const s = r.shipment;
      return {
        "Reference 1": s.trackingNumber || s.id.slice(0, 8),
        "Consignee Name": s.recipientName || "عميل",
        "Phone 1": s.recipientPhone || "",
        "Phone 2": "",
        "Country": "EG",
        "City": r.zone?.name || "Cairo",
        "Address 1": s.deliveryAddress || "",
        "Goods Description": (r.items ?? []).map(item => item.name).join(" + ") || "Goods",
        "COD Amount": s.codAmount || 0,
        "COD Currency": "EGP",
        "Comments": s.notes || "",
      };
    });
  } else {
    // Generic Master Template (شامل جميع التفاصيل)
    data = rows.map((r, i) => {
      const s = r.shipment;
      return {
        "م": i + 1,
        "رقم التتبع": s.trackingNumber || "بدون",
        "اسم المستلم": s.recipientName || "",
        "رقم الموبايل": s.recipientPhone || "",
        "العنوان بالكامل": s.deliveryAddress || "",
        "المنطقة / المحافظة": r.zone?.name || "",
        "شركة الشحن / المندوب": r.carrier?.name || "",
        "مبلغ التحصيل (COD)": s.codAmount || 0,
        "تكلفة الشحن": s.shippingCost || 0,
        "صافي المتجر المتوقع": (s.codAmount || 0) - (s.shippingCost || 0),
        "الحالة الحالية": s.status,
        "تاريخ الإنشاء": s.createdAt ? new Date(s.createdAt).toLocaleDateString("ar-EG") : "",
        "ملاحظات": s.notes || "",
      };
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Shipments");

  const actualFileName =
    fileName || `شحنات_${format.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(workbook, actualFileName);
}

export interface ImportedStatusRecord {
  trackingNumber: string;
  recipientName?: string;
  status: "delivered" | "returned" | "shipped" | "processing" | "cancelled";
  statusTextRaw: string;
  collectedAmount?: number;
  notes?: string;
  matchedShipment?: Shipment;
}

/** قراءة وتحليل ملف إكسيل مرفوع من شركة الشحن لتحديث الحالات */
export async function parseCarrierExcelReport(
  file: File,
  existingShipments: Shipment[]
): Promise<{ records: ImportedStatusRecord[]; unmatchedCount: number }> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  const records: ImportedStatusRecord[] = [];
  let unmatchedCount = 0;

  // Search common column headers for tracking and status
  for (const row of rawJson) {
    const keys = Object.keys(row);
    const getVal = (possibleHeaders: string[]): string => {
      for (const h of possibleHeaders) {
        const foundKey = keys.find(k => k.trim().toLowerCase() === h.toLowerCase());
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== "") {
          return String(row[foundKey]).trim();
        }
      }
      return "";
    };

    const trackingRaw = getVal([
      "رقم التتبع",
      "tracking",
      "tracking number",
      "tracking_number",
      "order no",
      "order number",
      "reference",
      "business reference",
      "رقم البوليصة",
      "الرقم المرجعي",
      "الكود",
      "barcode",
      "waybill",
      "awb",
    ]);

    const statusRaw = getVal([
      "الحالة",
      "status",
      "shipment status",
      "حالة الشحنة",
      "حالة الطلب",
      "order status",
      "delivery status",
      "delivery_status",
    ]);

    const codRaw = getVal([
      "مبلغ التحصيل",
      "التحصيل",
      "cod",
      "cod amount",
      "collected",
      "collected amount",
      "المحصل",
    ]);

    const notesRaw = getVal([
      "ملاحظات",
      "notes",
      "remarks",
      "reason",
      "السبب",
      "تعليق",
      "comments",
    ]);

    const recipientRaw = getVal([
      "اسم المستلم",
      "المستلم",
      "receiver name",
      "consignee name",
      "customer name",
      "العميل",
    ]);

    if (!trackingRaw && !recipientRaw) continue;

    // Map status string to standard status
    let mappedStatus: "delivered" | "returned" | "shipped" | "processing" | "cancelled" = "processing";
    const st = (statusRaw || "").toLowerCase();

    if (
      st.includes("تم التسليم") ||
      st.includes("delivered") ||
      st.includes("completed") ||
      st.includes("ناجح") ||
      st.includes("مستلم") ||
      st.includes("تم التوصيل")
    ) {
      mappedStatus = "delivered";
    } else if (
      st.includes("مرتجع") ||
      st.includes("returned") ||
      st.includes("فشل") ||
      st.includes("failed") ||
      st.includes("مرفوض") ||
      st.includes("refused") ||
      st.includes("rejected") ||
      st.includes("رجوع")
    ) {
      mappedStatus = "returned";
    } else if (
      st.includes("خرج") ||
      st.includes("مع المندوب") ||
      st.includes("shipped") ||
      st.includes("out for delivery") ||
      st.includes("جاري التوصيل") ||
      st.includes("في الطريق")
    ) {
      mappedStatus = "shipped";
    } else if (st.includes("ملغي") || st.includes("cancelled") || st.includes("canceled")) {
      mappedStatus = "cancelled";
    }

    // Try to match with existing shipments
    const matched = existingShipments.find(s => {
      if (trackingRaw && s.trackingNumber && s.trackingNumber.trim().toLowerCase() === trackingRaw.toLowerCase()) {
        return true;
      }
      if (trackingRaw && (s.id === trackingRaw || s.id.startsWith(trackingRaw))) {
        return true;
      }
      if (trackingRaw && s.invoiceId && s.invoiceId.toLowerCase() === trackingRaw.toLowerCase()) {
        return true;
      }
      return false;
    });

    if (matched) {
      records.push({
        trackingNumber: trackingRaw || matched.trackingNumber || matched.id,
        recipientName: recipientRaw || matched.recipientName || undefined,
        status: mappedStatus,
        statusTextRaw: statusRaw,
        collectedAmount: codRaw ? Number(codRaw.replace(/[^0-9.]/g, "")) : undefined,
        notes: notesRaw,
        matchedShipment: matched,
      });
    } else {
      unmatchedCount++;
      if (trackingRaw) {
        records.push({
          trackingNumber: trackingRaw,
          recipientName: recipientRaw,
          status: mappedStatus,
          statusTextRaw: statusRaw,
          collectedAmount: codRaw ? Number(codRaw.replace(/[^0-9.]/g, "")) : undefined,
          notes: notesRaw,
        });
      }
    }
  }

  return { records, unmatchedCount };
}
