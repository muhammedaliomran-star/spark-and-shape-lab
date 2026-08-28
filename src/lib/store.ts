import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CustomerStatus = "committed" | "neutral" | "defaulter";
export type CustomerType = "installment" | "cash";

export interface Branch {
  id: string;
  name: string;
  location: string | null;
  phone: string | null;
  managerName: string | null;
  isMain: boolean;
  createdAt: string;
}

export interface PaymentVoucher {
  id: string;
  customerId: string | null;
  supplierId: string | null;
  amount: number;
  type: "receipt" | "payment";
  paymentMethod: string;
  description: string | null;
  voucherDate: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  rating: number;
  status: CustomerStatus;
  customerType: CustomerType;
  notes: string | null;
  frozen: boolean;
  address: string | null;
  joiningDate: string;
  creditLimit: number;
  dueDay: number;
  openingBalance: number;
  createdAt: string;
}

export type InvoiceStatus = "paid" | "pending" | "cancelled";

export interface Invoice {
  id: string;
  customerId: string;
  total: number;
  downPayment: number;
  monthlyInstallment: number;
  firstDueDate: string;
  paid: number;
  notes: string | null;
  createdAt: string;
  discountPct?: number;
  discountAmount?: number;
  taxPct?: number;
  taxAmount?: number;
  status?: InvoiceStatus;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paidAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  name: string;
  cost: number;
  price: number;
  quantity: number;
  createdAt: string;
}

export type ExpenseCategory = "rent" | "electricity" | "salaries" | "transport" | "other";

export interface ShipmentCarrier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  baseCost: number;
  active: boolean;
  createdAt: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  carrierId: string;
  deliveryCost: number;
  estimatedDays: number;
  createdAt: string;
}

export type ShipmentStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'returned' | 'cancelled';
export type ShipmentCollectionStatus = 'uncollected' | 'collected' | 'settled';

export interface Shipment {
  id: string;
  invoiceId: string | null;
  carrierId: string | null;
  zoneId: string | null;
  trackingNumber: string | null;
  status: ShipmentStatus;
  recipientName: string | null;
  recipientPhone: string | null;
  deliveryAddress: string | null;
  actualDeliveryDate: string | null;
  processingAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  statusUpdatedBy: string | null;
  shippingCost: number;
  codAmount: number;
  collectionStatus: ShipmentCollectionStatus;
  collectedAt: string | null;
  settledAt: string | null;
  notes: string | null;
  createdAt: string;
}


export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  expenseDate: string;
  notes: string | null;
  createdAt: string;
}


export interface Supplier {
  id: string;
  name: string;
  contact: string;
  notes: string | null;
  openingBalance: number;
  createdAt: string;
}

export type PurchasePaymentType = "cash" | "credit";

export interface Purchase {
  id: string;
  supplierId: string;
  total: number;
  paymentType: PurchasePaymentType;
  purchaseDate: string;
  notes: string | null;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  name: string;
  unitCost: number;
  quantity: number;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  paidAt: string;
}

export interface ReturnRecord {
  id: string;
  invoiceId: string | null;
  type: "sale" | "supplier";
  totalAmount: number;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ReturnItem {
  id: string;
  returnId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  createdAt: string;
}

export type WarehouseSeason = "summer" | "winter" | "all";

export interface WarehouseItem {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  salePrice: number;
  season: WarehouseSeason;
  category: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const PRODUCT_TYPES = [
  "أخرى / غير محدد",
  "ملابس",
  "أحذية",
  "إلكترونيات",
  "أدوات منزلية",
  "مستحضرات",
  "قطع غيار",
  "أغذية",
] as const;

export interface StockItem {
  id: string;
  name: string;
  quantity: number;
  lastUnitCost: number;
  salePrice: number;
  barcode: string | null;
  size: string | null;
  itemType: string | null;
  minStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface DBState {

  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  invoiceItems: InvoiceItem[];
  suppliers: Supplier[];
  purchases: Purchase[];
  purchaseItems: PurchaseItem[];
  supplierPayments: SupplierPayment[];
  stockItems: StockItem[];
  warehouseItems: WarehouseItem[];
  returns: ReturnRecord[];
  returnItems: ReturnItem[];
  branches: Branch[];
  paymentVouchers: PaymentVoucher[];
  carriers: ShipmentCarrier[];
  zones: ShippingZone[];
  shipments: Shipment[];

  loading: boolean;
  addBranch: (b: Omit<Branch, "id" | "createdAt">) => Promise<void>;
  updateBranch: (id: string, patch: Partial<Branch>) => Promise<void>;
  removeBranch: (id: string) => Promise<void>;
  addPaymentVoucher: (v: Omit<PaymentVoucher, "id" | "createdAt">) => Promise<void>;
  removePaymentVoucher: (id: string) => Promise<void>;
  
  // Purchases management
  addPurchase: (p: Omit<Purchase, "id" | "createdAt" | "user_id"> & { items: Omit<PurchaseItem, "id" | "purchase_id" | "user_id">[] }) => Promise<void>;
  removePurchase: (id: string) => Promise<void>;
  
  // Reports
  getFinancialReport: (start: Date, end: Date) => Promise<{
    sales: number;
    purchases: number;
    expenses: number;
    grossProfit: number;
    netProfit: number;
    tax: number;
    returns: number;
  }>;
  
  refresh: () => Promise<void>;
  
  // Shipping
  addCarrier: (c: Omit<ShipmentCarrier, "id" | "createdAt">) => Promise<void>;
  updateCarrier: (id: string, patch: Partial<ShipmentCarrier>) => Promise<void>;
  addZone: (z: Omit<ShippingZone, "id" | "createdAt">) => Promise<void>;
  updateZone: (id: string, patch: Partial<ShippingZone>) => Promise<void>;
  removeZone: (id: string) => Promise<void>;
  addShipment: (s: Omit<Shipment, "id" | "createdAt">) => Promise<void>;
  updateShipment: (id: string, patch: Partial<Shipment>) => Promise<void>;
  updateShipmentStatus: (id: string, status: ShipmentStatus, reason?: string) => Promise<void>;
  settleCarrierCollections: (carrierId: string) => Promise<number>;

}


const listeners = new Set<() => void>();
let cache: {
  customers: Customer[]; invoices: Invoice[]; payments: Payment[]; expenses: Expense[]; invoiceItems: InvoiceItem[];
  suppliers: Supplier[]; purchases: Purchase[]; purchaseItems: PurchaseItem[]; supplierPayments: SupplierPayment[];
  stockItems: StockItem[];
  warehouseItems: WarehouseItem[];
  returns: ReturnRecord[];
  returnItems: ReturnItem[];
  branches: Branch[];
  paymentVouchers: PaymentVoucher[];
  carriers: ShipmentCarrier[];
  zones: ShippingZone[];
  shipments: Shipment[];
} = {
  customers: [], invoices: [], payments: [], expenses: [], invoiceItems: [],
  suppliers: [], purchases: [], purchaseItems: [], supplierPayments: [], stockItems: [], warehouseItems: [],
  returns: [], returnItems: [],
  branches: [], paymentVouchers: [],
  carriers: [], zones: [], shipments: [],
};

let loading = true;
let loaded = false;

function notify() { listeners.forEach((l) => l()); }

async function fetchAll() {
  loading = true;
  notify();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    cache = { customers: [], invoices: [], payments: [], expenses: [], invoiceItems: [], suppliers: [], purchases: [], purchaseItems: [], supplierPayments: [], stockItems: [], warehouseItems: [], returns: [], returnItems: [], branches: [], paymentVouchers: [], carriers: [], zones: [], shipments: [] };
    loading = false;
    notify();
    return;
  }
  const [c, i, p, e, ii, s, pu, pi, sp, st, wh, rr, ri, br, pv, sc, sz, sh] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("invoices").select("*").order("created_at", { ascending: false }),
    supabase.from("payments").select("*"),
    supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    supabase.from("invoice_items").select("*").order("created_at"),
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("purchases").select("*").order("created_at", { ascending: false }),
    supabase.from("purchase_items").select("*").order("created_at"),
    supabase.from("supplier_payments").select("*"),
    supabase.from("stock_items").select("*").order("name"),
    supabase.from("warehouse_items").select("*").order("name"),
    supabase.from("return_records").select("*").order("created_at", { ascending: false }),
    supabase.from("return_items").select("*").order("created_at"),
    (supabase.from as any)("branches").select("*").order("name"),
    (supabase.from as any)("payment_vouchers").select("*").order("voucher_date", { ascending: false }),
    (supabase.from as any)("shipping_carriers").select("*").order("name"),
    (supabase.from as any)("shipping_zones").select("*").order("name"),
    (supabase.from as any)("shipments").select("*").order("created_at", { ascending: false }),
  ]);

  cache = {
    customers: (c.data ?? []).map((r: any) => ({
      id: r.id, name: r.name, phone: r.phone, rating: r.rating,
      status: r.status as CustomerStatus, customerType: (r.customer_type ?? 'installment') as CustomerType,
      notes: r.notes, frozen: r.frozen,
      address: r.address, joiningDate: r.joining_date,
      creditLimit: Number(r.credit_limit ?? 0), dueDay: r.due_day ?? 1,
      openingBalance: Number(r.opening_balance ?? 0),
      createdAt: r.created_at,
    })),
    invoices: (i.data ?? []).map((r: any) => ({
      id: r.id, customerId: r.customer_id, total: Number(r.total),
      downPayment: Number(r.down_payment), monthlyInstallment: Number(r.monthly_installment),
      firstDueDate: r.first_due_date, paid: Number(r.paid), notes: r.notes, createdAt: r.created_at,
      discountPct: Number(r.discount_pct ?? 0), discountAmount: Number(r.discount_amount ?? 0),
      taxPct: Number(r.tax_pct ?? 0), taxAmount: Number(r.tax_amount ?? 0),
      status: (r.status ?? "pending") as InvoiceStatus,
    })),
    payments: (p.data ?? []).map((r: any) => ({
      id: r.id, invoiceId: r.invoice_id, amount: Number(r.amount), paidAt: r.paid_at,
    })),
    expenses: (e.data ?? []).map((r: any) => ({
      id: r.id, amount: Number(r.amount), category: r.category as ExpenseCategory,
      expenseDate: r.expense_date, notes: r.notes, createdAt: r.created_at,
    })),
    invoiceItems: (ii.data ?? []).map((r: any) => ({
      id: r.id, invoiceId: r.invoice_id, name: r.name,
      cost: Number(r.cost ?? 0), price: Number(r.price ?? 0), quantity: Number(r.quantity ?? 1), createdAt: r.created_at,
    })),
    suppliers: (s.data ?? []).map((r: any) => ({
      id: r.id, name: r.name, contact: r.contact ?? "", notes: r.notes,
      openingBalance: Number(r.opening_balance ?? 0), createdAt: r.created_at,
    })),
    purchases: (pu.data ?? []).map((r: any) => ({
      id: r.id, supplierId: r.supplier_id, total: Number(r.total),
      paymentType: r.payment_type as PurchasePaymentType,
      purchaseDate: r.purchase_date, notes: r.notes, createdAt: r.created_at,
    })),
    purchaseItems: (pi.data ?? []).map((r: any) => ({
      id: r.id, purchaseId: r.purchase_id, name: r.name,
      unitCost: Number(r.unit_cost ?? 0), quantity: Number(r.quantity ?? 1), createdAt: r.created_at,
    })),
    supplierPayments: (sp.data ?? []).map((r: any) => ({
      id: r.id, supplierId: r.supplier_id, amount: Number(r.amount), paidAt: r.paid_at,
    })),
    stockItems: (st.data ?? []).map((r: any) => ({
      id: r.id, name: r.name,
      quantity: Number(r.quantity ?? 0),
      lastUnitCost: Number(r.last_unit_cost ?? 0),
      salePrice: Number(r.sale_price ?? 0),
      barcode: r.barcode ?? null,
      size: r.size ?? null,
      itemType: r.item_type ?? null,
      minStock: Number(r.min_stock ?? 0),
      createdAt: r.created_at, updatedAt: r.updated_at,
    })),
    warehouseItems: (wh.data ?? []).map((r: any) => ({
      id: r.id, name: r.name,
      quantity: Number(r.quantity ?? 0),
      unitCost: Number(r.unit_cost ?? 0),
      salePrice: Number(r.sale_price ?? 0),
      season: (r.season ?? "all") as WarehouseSeason,
      category: r.category ?? "other",
      notes: r.notes ?? null,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })),
    returns: (rr.data ?? []).map((r: any) => ({
      id: r.id, invoiceId: r.invoice_id, type: r.type as "sale" | "supplier",
      totalAmount: Number(r.total_amount), reason: r.reason, notes: r.notes, createdAt: r.created_at,
    })),
    returnItems: (ri.data ?? []).map((r: any) => ({
      id: r.id, returnId: r.return_id, name: r.name,
      unitPrice: Number(r.unit_price), quantity: Number(r.quantity), createdAt: r.created_at,
    })),
    branches: (br.data ?? []).map((r: any) => ({
      id: r.id, name: r.name, location: r.location, phone: r.phone,
      managerName: r.manager_name, isMain: r.is_main, createdAt: r.created_at,
    })),
    paymentVouchers: (pv.data ?? []).map((r: any) => ({
      id: r.id, customerId: r.customer_id, supplierId: r.supplier_id,
      amount: Number(r.amount), type: r.type as "receipt" | "payment",
      paymentMethod: r.payment_method, description: r.description,
      voucherDate: r.voucher_date, createdAt: r.created_at,
    })),
    carriers: (sc.data ?? []).map((r: any) => ({
      id: r.id, name: r.name, contactPerson: r.contact_person, phone: r.phone,
      email: r.email, baseCost: Number(r.base_cost ?? 0), active: r.active, createdAt: r.created_at,
    })),
    zones: (sz.data ?? []).map((r: any) => ({
      id: r.id, name: r.name, carrierId: r.carrier_id,
      deliveryCost: Number(r.delivery_cost ?? 0), estimatedDays: r.estimated_days ?? 2, createdAt: r.created_at,
    })),
    shipments: (sh.data ?? []).map((r: any) => ({
      id: r.id, invoiceId: r.invoice_id, carrierId: r.carrier_id, zoneId: r.zone_id,
      trackingNumber: r.tracking_number, status: r.status as ShipmentStatus,
      recipientName: r.recipient_name, recipientPhone: r.recipient_phone,
      deliveryAddress: r.delivery_address, actualDeliveryDate: r.actual_delivery_date,
      processingAt: r.processing_at ?? null, shippedAt: r.shipped_at ?? null,
      deliveredAt: r.delivered_at ?? null, returnedAt: r.returned_at ?? null,
      statusUpdatedBy: r.status_updated_by ?? null,
      shippingCost: Number(r.shipping_cost ?? 0),
      codAmount: Number(r.cod_amount ?? 0),
      collectionStatus: (r.collection_status ?? "uncollected") as ShipmentCollectionStatus,
      collectedAt: r.collected_at ?? null,
      settledAt: r.settled_at ?? null,

      notes: r.notes, createdAt: r.created_at,
    })),

  };
  loading = false;
  loaded = true;
  notify();
}

export function useDB(): DBState {
  const [, setTick] = useState(0);
  const refresh = useCallback(async () => { await fetchAll(); }, []);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    if (!loaded) fetchAll();
    return () => { listeners.delete(l); };
  }, []);
  return { 
    ...cache, 
    loading, 
    refresh,
    carriers: cache.carriers,
    zones: cache.zones,
    shipments: cache.shipments,

    addBranch: db.addBranch,
    updateBranch: db.updateBranch,
    removeBranch: db.removeBranch,
    addPaymentVoucher: db.addPaymentVoucher,
    removePaymentVoucher: db.removePaymentVoucher,
    addPurchase: db.addPurchase,
    removePurchase: db.removePurchase,
    getFinancialReport: db.getFinancialReport,
    addCarrier: db.addCarrier,
    updateCarrier: db.updateCarrier,
    addZone: db.addZone,
    updateZone: db.updateZone,
    removeZone: db.removeZone,
    addShipment: db.addShipment,
    updateShipment: db.updateShipment,
    updateShipmentStatus: db.updateShipmentStatus,
    settleCarrierCollections: db.settleCarrierCollections,


  };
}

export async function uid() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// Recalculate invoice.paid = sum(payments.amount) + downPayment baseline.
// downPayment is stored on the invoice and was historically added to paid at creation time,
// so total paid = downPayment (already counted) + sum of subsequent payment rows.
async function recomputeInvoicePaid(invoiceId: string) {
  const { error } = await (supabase as any).rpc("recalculate_invoice_paid", { p_invoice_id: invoiceId });
  if (error) throw error;
}

/**
 * Data-layer business rules for creating an invoice.
 * Mirrors (and backs up) the checks done in the UI form so no path can bypass them.
 */
async function assertInvoiceAllowed(inv: {
  customerId: string; total: number; downPayment: number; monthlyInstallment: number; paid?: number;
}) {
  const { data: c, error } = await supabase
    .from("customers")
    .select("id,name,frozen,status,credit_limit,opening_balance,customer_type")
    .eq("id", inv.customerId)
    .maybeSingle();
  if (error) throw error;
  if (!c) throw new Error("العميل غير موجود");
  if (c.frozen) throw new Error(`العميل «${c.name}» مجمّد — لا يمكن فتح فاتورة جديدة قبل تسوية حسابه`);
  if (c.status === "defaulter") throw new Error(`العميل «${c.name}» مماطل — لا يمكن فتح فاتورة جديدة قبل تسوية حسابه`);

  const paid = inv.paid ?? inv.downPayment;
  const remaining = Math.max(0, Number(inv.total) - Number(paid));

  // A cash customer may only have fully-paid invoices.
  if (c.customer_type === "cash" && (remaining > 0 || Number(inv.monthlyInstallment) > 0)) {
    throw new Error(`«${c.name}» عميل فوري (نقدي) — لازم تحصيل كامل المبلغ، أو غيّر نوع العميل لقسط أولًا`);
  }

  const limit = Number(c.credit_limit ?? 0);
  if (limit > 0 && remaining > 0) {
    const { data: invs } = await supabase
      .from("invoices").select("total,paid").eq("customer_id", inv.customerId);
    const openBalance = (invs ?? []).reduce((s: number, r: any) => s + (Number(r.total) - Number(r.paid)), 0)
      + Number(c.opening_balance ?? 0);
    if (openBalance + remaining > limit) {
      throw new Error(`تجاوز سقف المديونية: الحد ${Math.round(limit)} والمديونية بعد الفاتورة ${Math.round(openBalance + remaining)}`);
    }
  }
}

/** Adds quantities back to stock, matched by item name (used when reversing invoices/purchases). */
async function restoreStockByName(items: Array<{ name: string; quantity: number }>) {
  const user_id = await uid();
  const merged = new Map<string, number>();
  for (const it of items) {
    const name = (it.name || "").trim();
    if (!name || !it.quantity) continue;
    merged.set(name, (merged.get(name) ?? 0) + it.quantity);
  }
  for (const [name, qty] of merged) {
    const { data: existing } = await supabase
      .from("stock_items").select("id,quantity")
      .eq("user_id", user_id).eq("name", name).maybeSingle();
    if (!existing?.id) continue; // item no longer in stock catalogue — skip silently
    await supabase.from("stock_items")
      .update({ quantity: Math.max(0, Number(existing.quantity) + qty) })
      .eq("id", existing.id);
  }
}

export const db = {

  invalidate: fetchAll,
  async addCustomer(c: Omit<Customer, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await supabase.from("customers").insert({
      user_id, name: c.name, phone: c.phone, rating: c.rating, status: c.status,
      customer_type: c.customerType ?? 'installment',
      notes: c.notes, frozen: c.frozen,
      address: c.address, joining_date: c.joiningDate,
      credit_limit: c.creditLimit, due_day: c.dueDay,
      opening_balance: c.openingBalance,
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateCustomer(id: string, patch: Partial<Customer>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.phone !== undefined) upd.phone = patch.phone;
    if (patch.rating !== undefined) upd.rating = patch.rating;
    if (patch.status !== undefined) upd.status = patch.status;
    if (patch.customerType !== undefined) upd.customer_type = patch.customerType;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    if (patch.frozen !== undefined) upd.frozen = patch.frozen;
    if (patch.address !== undefined) upd.address = patch.address;
    if (patch.joiningDate !== undefined) upd.joining_date = patch.joiningDate;
    if (patch.creditLimit !== undefined) upd.credit_limit = patch.creditLimit;
    if (patch.dueDay !== undefined) upd.due_day = patch.dueDay;
    if (patch.openingBalance !== undefined) upd.opening_balance = patch.openingBalance;
    const { error } = await supabase.from("customers").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeCustomer(id: string) {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addInvoice(inv: Omit<Invoice, "id" | "createdAt" | "paid"> & { paid?: number; items?: Array<{ name: string; cost: number; price: number; quantity?: number }> }) {
    const user_id = await uid();
    await assertInvoiceAllowed(inv);

    const { data, error } = await supabase.from("invoices").insert({
      user_id, customer_id: inv.customerId, total: inv.total, down_payment: inv.downPayment,
      monthly_installment: inv.monthlyInstallment, first_due_date: inv.firstDueDate,
      paid: inv.paid ?? inv.downPayment, notes: inv.notes,
      discount_pct: inv.discountPct ?? 0, discount_amount: inv.discountAmount ?? 0,
      tax_pct: inv.taxPct ?? 0, tax_amount: inv.taxAmount ?? 0,
      status: inv.status ?? "pending",
    }).select("id").single();
    if (error) throw error;
    if (inv.items && inv.items.length > 0 && data?.id) {
      const rows = inv.items.map((it) => ({
        user_id, invoice_id: data.id, name: it.name, cost: it.cost, price: it.price, quantity: Math.max(1, Math.floor(it.quantity ?? 1)),
      }));
      const { error: e2 } = await supabase.from("invoice_items").insert(rows);
      if (e2) throw e2;
    }
    await fetchAll();
  },
  async addInvoiceItem(invoiceId: string, item: { name: string; cost: number; price: number; quantity?: number }) {
    const user_id = await uid();
    const { error } = await supabase.from("invoice_items").insert({
      user_id, invoice_id: invoiceId, name: item.name, cost: item.cost, price: item.price, quantity: Math.max(1, Math.floor(item.quantity ?? 1)),
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateInvoiceItem(id: string, patch: Partial<{ name: string; cost: number; price: number; quantity: number }>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.cost !== undefined) upd.cost = patch.cost;
    if (patch.price !== undefined) upd.price = patch.price;
    if (patch.quantity !== undefined) upd.quantity = Math.max(1, Math.floor(patch.quantity));
    const { error } = await supabase.from("invoice_items").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeInvoiceItem(id: string) {
    const { error } = await supabase.from("invoice_items").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },

  // Branches
  async addBranch(b: Omit<Branch, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await (supabase.from as any)("branches").insert({
      user_id, name: b.name, location: b.location, phone: b.phone,
      manager_name: b.managerName, is_main: b.isMain
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateBranch(id: string, patch: Partial<Branch>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.location !== undefined) upd.location = patch.location;
    if (patch.phone !== undefined) upd.phone = patch.phone;
    if (patch.managerName !== undefined) upd.manager_name = patch.managerName;
    if (patch.isMain !== undefined) upd.is_main = patch.isMain;
    const { error } = await (supabase.from as any)("branches").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeBranch(id: string) {
    const { error } = await (supabase.from as any)("branches").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },

  // Payment Vouchers
  async addPaymentVoucher(v: Omit<PaymentVoucher, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await (supabase.from as any)("payment_vouchers").insert({
      user_id, customer_id: v.customerId, supplier_id: v.supplierId,
      amount: v.amount, type: v.type, payment_method: v.paymentMethod,
      description: v.description, voucher_date: v.voucherDate
    });
    if (error) throw error;
    await fetchAll();
  },
  async removePaymentVoucher(id: string) {
    const { error } = await (supabase.from as any)("payment_vouchers").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeInvoice(id: string) {
    // Return the sold units back to stock before deleting (items cascade-delete with the invoice).
    const { data: items } = await supabase
      .from("invoice_items").select("name").eq("invoice_id", id);
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) throw error;
    if (items && items.length > 0) {
      await restoreStockByName(items.map((it: any) => ({ name: it.name, quantity: 1 })));
    }
    await fetchAll();
  },

  async updateInvoice(id: string, patch: Partial<Pick<Invoice, "total" | "downPayment" | "monthlyInstallment" | "firstDueDate" | "notes">>) {
    const upd: any = {};
    if (patch.total !== undefined) upd.total = patch.total;
    if (patch.downPayment !== undefined) upd.down_payment = patch.downPayment;
    if (patch.monthlyInstallment !== undefined) upd.monthly_installment = patch.monthlyInstallment;
    if (patch.firstDueDate !== undefined) upd.first_due_date = patch.firstDueDate;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    const { error } = await supabase.from("invoices").update(upd).eq("id", id);
    if (error) throw error;
    await recomputeInvoicePaid(id);
    await fetchAll();
  },
  async updatePayment(id: string, amount: number) {
    const { error } = await (supabase as any).rpc("update_invoice_payment", { p_payment_id: id, p_amount: amount });
    if (error) throw error;
    await fetchAll();
  },
  async removePayment(id: string) {
    const { error } = await (supabase as any).rpc("delete_invoice_payment", { p_payment_id: id });
    if (error) throw error;
    await fetchAll();
  },
  async recordPayment(invoiceId: string, amount: number) {
    const { error } = await (supabase as any).rpc("record_invoice_payment", {
      p_invoice_id: invoiceId,
      p_amount: amount,
      p_payment_id: crypto.randomUUID(),
    });
    if (error) throw error;
    await fetchAll();
  },
  async addExpense(exp: Omit<Expense, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await supabase.from("expenses").insert({
      user_id, amount: exp.amount, category: exp.category,
      expense_date: exp.expenseDate, notes: exp.notes,
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateExpense(id: string, patch: Partial<Omit<Expense, "id" | "createdAt">>) {
    const upd: any = {};
    if (patch.amount !== undefined) upd.amount = patch.amount;
    if (patch.category !== undefined) upd.category = patch.category;
    if (patch.expenseDate !== undefined) upd.expense_date = patch.expenseDate;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    const { error } = await supabase.from("expenses").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeExpense(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },

  // ---------- Suppliers ----------
  async addSupplier(s: Omit<Supplier, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await supabase.from("suppliers").insert({
      user_id, name: s.name, contact: s.contact, notes: s.notes,
      opening_balance: s.openingBalance,
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateSupplier(id: string, patch: Partial<Omit<Supplier, "id" | "createdAt">>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.contact !== undefined) upd.contact = patch.contact;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    if (patch.openingBalance !== undefined) upd.opening_balance = patch.openingBalance;
    const { error } = await supabase.from("suppliers").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeSupplier(id: string) {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addPurchase(
    p: Omit<Purchase, "id" | "createdAt"> & { items: Array<{ name: string; unitCost: number; quantity: number }> }
  ) {
    const { error } = await (supabase as any).rpc("record_purchase_with_inventory", {
      p_supplier_id: p.supplierId, p_total: p.total, p_payment_type: p.paymentType,
      p_purchase_date: p.purchaseDate, p_notes: p.notes, p_items: p.items.map((item) => ({ name: item.name, unitCost: item.unitCost, quantity: item.quantity })),
    });
    if (error) throw error;
    await fetchAll();
  },
  async removePurchase(id: string) {
    const { error } = await (supabase as any).rpc("delete_purchase_with_inventory", { p_purchase_id: id });
    if (error) throw error;
    await fetchAll();
  },
  async getFinancialReport(start: Date, end: Date) {
    const s = start.toISOString();
    const e = end.toISOString();
    
    const [sales, purchases, expenses, returns, saleItems] = await Promise.all([
      supabase.from("invoices").select("id, total, tax_amount, status").gte("created_at", s).lte("created_at", e),
      supabase.from("purchases").select("total").gte("purchase_date", s).lte("purchase_date", e),
      supabase.from("expenses").select("amount, category").gte("expense_date", s).lte("expense_date", e),
      supabase.from("return_records").select("total_amount").gte("created_at", s).lte("created_at", e),
      supabase.from("invoice_items").select("invoice_id, cost"),
    ]);
    
    const validSales = (sales.data ?? []).filter((invoice: any) => invoice.status !== "cancelled");
    const totalSales = validSales.reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0);
    const totalTax = validSales.reduce((acc: number, curr: any) => acc + (Number(curr.tax_amount) || 0), 0);
    const totalPurchases = (purchases.data ?? []).reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0);
    const cashPurchases = (purchases.data ?? []).filter((purchase: any) => purchase.payment_type === "cash").reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0);
    const totalExpenses = (expenses.data ?? []).reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
    const totalReturns = (returns.data ?? []).filter((item: any) => item.type === "sale").reduce((acc: number, curr: any) => acc + (Number(curr.total_amount) || 0), 0);
    
    const netSales = totalSales - totalTax - totalReturns;

    // Accurate COGS calculation
    const periodInvoiceIds = new Set(validSales.map((invoice: any) => invoice.id));
    const periodSaleItems = (saleItems.data ?? []).filter((item: any) => periodInvoiceIds.has(item.invoice_id));
    const cogs = periodSaleItems.reduce((sum: number, item: any) => sum + (Number(item.cost) || 0), 0);
    
    const grossProfit = netSales - cogs;
    const netProfit = grossProfit - totalExpenses - cashPurchases;
    
    return {
      sales: totalSales,
      purchases: totalPurchases,
      expenses: totalExpenses,
      grossProfit,
      netProfit,
      tax: totalTax,
      returns: totalReturns,
      expenseBreakdown: (expenses.data ?? []),
    };
  },
  /**
  * Edit an existing purchase invoice and apply the old/new inventory delta atomically.
   */
  async updatePurchase(
    id: string,
    p: {
      supplierId: string; total: number; paymentType: PurchasePaymentType;
      purchaseDate: string; notes: string | null;
      items: Array<{ name: string; unitCost: number; quantity: number }>;
    },
  ) {
    const { error } = await (supabase as any).rpc("update_purchase_with_inventory", {
      p_purchase_id: id, p_supplier_id: p.supplierId, p_total: p.total, p_payment_type: p.paymentType,
      p_purchase_date: p.purchaseDate, p_notes: p.notes, p_items: p.items.map((item) => ({ name: item.name, unitCost: item.unitCost, quantity: item.quantity })),
    });
    if (error) throw error;
    await fetchAll();
  },


  async upsertStockDeltas(items: Array<{ name: string; quantity: number; unitCost: number; barcode?: string | null }>) {
    const user_id = await uid();
    for (const it of items) {
      const name = it.name.trim();
      if (!name || it.quantity <= 0) continue;
      let existing: { id: string; quantity: number } | null = null;
      if (it.barcode) {
        const { data } = await supabase
          .from("stock_items")
          .select("id,quantity")
          .eq("user_id", user_id)
          .eq("barcode", it.barcode)
          .maybeSingle();
        existing = data;
      }
      if (!existing) {
        const { data } = await supabase
          .from("stock_items")
          .select("id,quantity")
          .eq("user_id", user_id)
          .eq("name", name)
          .maybeSingle();
        existing = data;
      }
      if (existing?.id) {
        const upd: { quantity: number; last_unit_cost: number; barcode?: string } = {
          quantity: Number(existing.quantity) + it.quantity,
          last_unit_cost: it.unitCost,
        };
        if (it.barcode) upd.barcode = it.barcode;
        await supabase.from("stock_items")
          .update(upd)
          .eq("id", existing.id);
      } else {
        await supabase.from("stock_items").insert({
          user_id, name, quantity: it.quantity, last_unit_cost: it.unitCost,
          barcode: it.barcode || null,
        });
      }
    }
  },
  async deductStock(items: Array<{ stockId: string; quantity: number }>) {
    for (const it of items) {
      if (!it.stockId || it.quantity <= 0) continue;
      const { data: existing } = await supabase
        .from("stock_items")
        .select("quantity")
        .eq("id", it.stockId)
        .maybeSingle();
      const current = Number(existing?.quantity ?? 0);
      const next = Math.max(0, current - it.quantity);
      await supabase.from("stock_items")
        .update({ quantity: next })
        .eq("id", it.stockId);
    }
  },
  async recordSupplierPayment(supplierId: string, amount: number) {
    const user_id = await uid();
    const { error } = await supabase.from("supplier_payments").insert({
      user_id, supplier_id: supplierId, amount,
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateSupplierPayment(id: string, amount: number) {
    if (!(amount > 0)) throw new Error("أدخل مبلغ صحيح");
    const { error } = await supabase.from("supplier_payments").update({ amount }).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeSupplierPayment(id: string) {
    const { error } = await supabase.from("supplier_payments").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },

  async updateStockItem(
    id: string,
    patch: Partial<{ name: string; quantity: number; lastUnitCost: number; salePrice: number; barcode: string | null; size: string | null; itemType: string | null; minStock: number }>,
    adjustment?: { delta: number; reason: string; notes?: string },
  ) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.quantity !== undefined) upd.quantity = patch.quantity;
    if (patch.lastUnitCost !== undefined) upd.last_unit_cost = patch.lastUnitCost;
    if (patch.salePrice !== undefined) upd.sale_price = patch.salePrice;
    if (patch.barcode !== undefined) upd.barcode = patch.barcode || null;
    if (patch.size !== undefined) upd.size = patch.size || null;
    if (patch.itemType !== undefined) upd.item_type = patch.itemType || null;
    if (patch.minStock !== undefined) upd.min_stock = patch.minStock;
    const { error } = await supabase.from("stock_items").update(upd).eq("id", id);
    if (error) throw error;
    if (adjustment && adjustment.delta !== 0) {
      const user_id = await uid();
      await supabase.from("stock_adjustments").insert({
        user_id, stock_item_id: id, delta: adjustment.delta,
        reason: adjustment.reason, notes: adjustment.notes ?? null,
      });
    }
    await fetchAll();
  },
  async removeStockItem(id: string) {
    const { error } = await supabase.from("stock_items").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  /** Manual stock reconciliation: applies a signed delta and logs it in stock_adjustments. */
  async adjustStock(id: string, delta: number, reason: string, notes?: string) {
    if (!delta) throw new Error("أدخل كمية التعديل");
    const user_id = await uid();
    const { data: existing, error: e0 } = await supabase
      .from("stock_items").select("quantity").eq("id", id).single();
    if (e0) throw e0;
    const next = Math.max(0, Number(existing?.quantity ?? 0) + delta);
    const applied = next - Number(existing?.quantity ?? 0);
    const { error: e1 } = await supabase.from("stock_items").update({ quantity: next }).eq("id", id);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("stock_adjustments").insert({
      user_id, stock_item_id: id, delta: applied, reason, notes: notes?.trim() || null,
    });
    if (e2) throw e2;
    await fetchAll();
    return next;
  },
  async addStockItem(item: {
    name: string; quantity?: number; lastUnitCost?: number; salePrice?: number; barcode?: string | null;
    size?: string | null; itemType?: string | null; minStock?: number;
  }) {
    const user_id = await uid();
    const { data, error } = await supabase.from("stock_items").insert({
      user_id,
      name: item.name,
      quantity: item.quantity ?? 0,
      last_unit_cost: item.lastUnitCost ?? 0,
      sale_price: item.salePrice ?? 0,
      barcode: item.barcode ?? null,
      size: item.size ?? null,
      item_type: item.itemType ?? null,
      min_stock: item.minStock ?? 0,
    }).select("id").single();
    if (error) throw error;
    await fetchAll();
    return data?.id as string | undefined;
  },

  async addWarehouseItem(item: {
    name: string; quantity?: number; unitCost?: number; salePrice?: number;
    season?: WarehouseSeason; category?: string; notes?: string | null;
  }) {
    const user_id = await uid();
    const { data, error } = await supabase.from("warehouse_items").insert({
      user_id,
      name: item.name,
      quantity: item.quantity ?? 0,
      unit_cost: item.unitCost ?? 0,
      sale_price: item.salePrice ?? 0,
      season: item.season ?? "all",
      category: item.category ?? "other",
      notes: item.notes ?? null,
    }).select("id").single();
    if (error) throw error;
    await fetchAll();
    return data?.id as string | undefined;
  },
  async updateWarehouseItem(id: string, patch: Partial<{
    name: string; quantity: number; unitCost: number; salePrice: number;
    season: WarehouseSeason; category: string; notes: string | null;
  }>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.quantity !== undefined) upd.quantity = patch.quantity;
    if (patch.unitCost !== undefined) upd.unit_cost = patch.unitCost;
    if (patch.salePrice !== undefined) upd.sale_price = patch.salePrice;
    if (patch.season !== undefined) upd.season = patch.season;
    if (patch.category !== undefined) upd.category = patch.category;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    const { error } = await supabase.from("warehouse_items").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeWarehouseItem(id: string) {
    const { error } = await supabase.from("warehouse_items").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },

  async addReturn(r: {
    invoiceId: string | null;
    type: "sale" | "supplier";
    totalAmount: number;
    reason: string | null;
    notes: string | null;
    items: Array<{ name: string; unitPrice: number; quantity: number }>;
  }) {
    if (r.type === "sale" && r.invoiceId) {
      const { error } = await (supabase as any).rpc("create_sale_return", {
        p_invoice_id: r.invoiceId,
        p_reason: r.reason?.trim() || "مرتجع بيع",
        p_items: r.items.map((item) => ({ name: item.name, unit_price: item.unitPrice, quantity: item.quantity })),
      });
      if (error) throw error;
      await fetchAll();
      return;
    }
    const user_id = await uid();
    const { data, error } = await supabase.from("return_records").insert({
      user_id,
      invoice_id: r.invoiceId,
      type: r.type,
      total_amount: r.totalAmount,
      reason: r.reason,
      notes: r.notes,
    }).select("id").single();
    
    if (error) throw error;
    
    const returnId = data?.id;
    if (returnId && r.items.length > 0) {
      const rows = r.items.map((it) => ({
        user_id,
        return_id: returnId,
        name: it.name,
        unit_price: it.unitPrice,
        quantity: it.quantity,
      }));
      const { error: e2 } = await supabase.from("return_items").insert(rows);
      if (e2) throw e2;
      
      // Supplier returns remain separate until supplier inventory reversal is modeled.
    }
    await fetchAll();
  },
  async removeReturn(id: string) {
    const { data: storefrontOrder } = await (supabase.from as any)("store_orders").select("id").eq("return_id", id).maybeSingle();
    if (storefrontOrder) {
      const { error: reverseError } = await (supabase as any).rpc("reverse_storefront_sale_return", { p_return_id: id });
      if (reverseError) throw reverseError;
      await fetchAll();
      return;
    }
    const { error } = await supabase.from("return_records").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  // Shipping
  async addCarrier(c: Omit<ShipmentCarrier, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await (supabase.from as any)("shipping_carriers").insert({
      user_id, name: c.name, contact_person: c.contactPerson, phone: c.phone,
      email: c.email, base_cost: c.baseCost, active: c.active
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateCarrier(id: string, patch: Partial<ShipmentCarrier>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.contactPerson !== undefined) upd.contact_person = patch.contactPerson;
    if (patch.phone !== undefined) upd.phone = patch.phone;
    if (patch.email !== undefined) upd.email = patch.email;
    if (patch.baseCost !== undefined) upd.base_cost = patch.baseCost;
    if (patch.active !== undefined) upd.active = patch.active;
    const { error } = await (supabase.from as any)("shipping_carriers").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addZone(z: Omit<ShippingZone, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await (supabase.from as any)("shipping_zones").insert({
      user_id, name: z.name, carrier_id: z.carrierId,
      delivery_cost: z.deliveryCost, estimated_days: z.estimatedDays,
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateZone(id: string, patch: Partial<ShippingZone>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.carrierId !== undefined) upd.carrier_id = patch.carrierId;
    if (patch.deliveryCost !== undefined) upd.delivery_cost = patch.deliveryCost;
    if (patch.estimatedDays !== undefined) upd.estimated_days = patch.estimatedDays;
    const { error } = await (supabase.from as any)("shipping_zones").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeZone(id: string) {
    const { error } = await (supabase.from as any)("shipping_zones").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addShipment(s: Omit<Shipment, "id" | "createdAt">) {
    if (s.status !== "pending") throw new Error("الشحنة الجديدة يجب أن تبدأ بحالة قيد الانتظار");
    const { data, error } = await (supabase as any).rpc("create_invoice_shipment", {
      p_invoice_id: s.invoiceId,
      p_carrier_id: s.carrierId,
      p_zone_id: s.zoneId,
      p_tracking_number: s.trackingNumber,
    });
    if (error) throw error;
    const created = Array.isArray(data) ? data[0] : data;
    const money: any = {};
    if (s.shippingCost) money.shipping_cost = s.shippingCost;
    if (s.codAmount) money.cod_amount = s.codAmount;
    if (created?.id && Object.keys(money).length) {
      await (supabase.from as any)("shipments").update(money).eq("id", created.id);
    }
    await fetchAll();
  },
  async updateShipment(id: string, patch: Partial<Shipment>) {
    if (patch.status !== undefined) {
      await this.updateShipmentStatus(id, patch.status);
      delete patch.status;
    }
    const upd: any = {};
    if (patch.carrierId !== undefined) upd.carrier_id = patch.carrierId;
    if (patch.zoneId !== undefined) upd.zone_id = patch.zoneId;
    if (patch.trackingNumber !== undefined) upd.tracking_number = patch.trackingNumber;
    if (patch.recipientName !== undefined) upd.recipient_name = patch.recipientName;
    if (patch.recipientPhone !== undefined) upd.recipient_phone = patch.recipientPhone;
    if (patch.deliveryAddress !== undefined) upd.delivery_address = patch.deliveryAddress;
    if (patch.shippingCost !== undefined) upd.shipping_cost = patch.shippingCost;
    if (patch.codAmount !== undefined) upd.cod_amount = patch.codAmount;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    if (Object.keys(upd).length === 0) return;
    const { error } = await (supabase.from as any)("shipments").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async updateShipmentStatus(id: string, status: ShipmentStatus, reason?: string) {
    const { error } = await (supabase as any).rpc("update_storefront_shipment_status", { p_shipment_id: id, p_status: status, p_reason: reason?.trim() || null });
    if (error) throw error;
    await fetchAll();
  },
  /** تغيير حالة مجموعة شحنات دفعة واحدة — يرجّع عدد الناجح والأخطاء. */
  async bulkShipmentStatus(ids: string[], status: ShipmentStatus, reason?: string) {
    let ok = 0; const errors: string[] = [];
    for (const id of ids) {
      const { error } = await (supabase as any).rpc("update_storefront_shipment_status", { p_shipment_id: id, p_status: status, p_reason: reason?.trim() || null });
      if (error) errors.push(error.message); else ok += 1;
    }
    await fetchAll();
    return { ok, errors };
  },
  /** تعيين مندوب لمجموعة شحنات. */
  async bulkAssignCarrier(ids: string[], carrierId: string) {
    const { error } = await (supabase.from as any)("shipments").update({ carrier_id: carrierId }).in("id", ids);
    if (error) throw error;
    await fetchAll();
  },
  async settleCarrierCollections(carrierId: string) {
    const { data, error } = await (supabase as any).rpc("settle_carrier_collections", { p_carrier_id: carrierId });
    if (error) throw error;
    await fetchAll();
    return Number(data ?? 0);
  },
};




export const WAREHOUSE_SEASONS: { value: WarehouseSeason; label: string }[] = [
  { value: "all", label: "عام / مستمر" },
  { value: "summer", label: "صيفي" },
  { value: "winter", label: "شتوي" },
];

export const WAREHOUSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "clothes", label: "ملابس" },
  { value: "shoes", label: "أحذية" },
  { value: "fabrics", label: "أقمشة" },
  { value: "accessories", label: "إكسسوارات" },
  { value: "other", label: "أخرى / غير محدد" },
];

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "rent", label: "إيجار" },
  { value: "electricity", label: "كهرباء" },
  { value: "salaries", label: "رواتب" },
  { value: "transport", label: "نقل" },
  { value: "other", label: "أخرى" },
];

export function expenseCategoryLabel(c: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

// --- helpers ---
export function supplierBalance(
  purchases: Purchase[],
  payments: SupplierPayment[],
  supplierId: string,
  openingBalance = 0,
) {
  const credit = purchases
    .filter((p) => p.supplierId === supplierId && p.paymentType === "credit")
    .reduce((s, p) => s + p.total, 0);
  const paid = payments
    .filter((p) => p.supplierId === supplierId)
    .reduce((s, p) => s + p.amount, 0);
  return openingBalance + credit - paid;
}

export function customerBalance(invoices: Invoice[], customerId: string, openingBalance = 0) {
  return openingBalance + invoices.filter((i) => i.customerId === customerId).reduce((s, i) => s + (i.total - i.paid), 0);
}

export function daysLate(inv: Invoice) {
  if (inv.paid >= inv.total) return 0;
  const diff = Math.floor((Date.now() - new Date(inv.firstDueDate).getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

export function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

/** عدد أيام التذكير المُبكِّر المضبوط في الإعدادات. */
export function reminderDaysBefore() {
  return shopCache?.reminderDaysBefore ?? EMPTY_SHOP_SETTINGS.reminderDaysBefore;
}

/**
 * فاتورة تستحق التنبيه: متأخرة، مستحقة اليوم، أو قرب موعدها خلال
 * «عدد أيام التذكير» المضبوط في الإعدادات.
 */
export function isDueSoonOrOverdue(
  inv: { firstDueDate: string; paid: number; total: number },
  daysBefore = reminderDaysBefore(),
) {
  if (inv.paid >= inv.total) return false;
  const due = new Date(inv.firstDueDate); due.setHours(0, 0, 0, 0);
  const limit = new Date(); limit.setHours(0, 0, 0, 0);
  limit.setDate(limit.getDate() + Math.max(0, daysBefore));
  return due.getTime() <= limit.getTime();
}

/** عدد الأيام المتبقية حتى الاستحقاق (0 = اليوم، سالب = متأخر). */
export function daysUntilDue(inv: { firstDueDate: string }) {
  const due = new Date(inv.firstDueDate); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/**
 * رقم الفاتورة المعروض/المطبوع = بادئة الإعدادات + مسلسل حسب ترتيب الإنشاء.
 * لو مفيش بادئة بنستخدم «#» علشان الشكل يفضل متسق.
 */
export function invoiceNumber(invoices: Invoice[], invoiceId: string, prefix = shopCache?.invoicePrefix ?? "") {
  const ordered = [...invoices].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const idx = ordered.findIndex((i) => i.id === invoiceId);
  const serial = String(idx >= 0 ? idx + 1 : ordered.length + 1).padStart(4, "0");
  const p = (prefix || "").trim();
  return p ? `${p}-${serial}` : `#${serial}`;
}

export const LOW_STOCK_THRESHOLD = 5;

/** Threshold actually in use (from shop settings, falling back to the default). */
export function lowStockThreshold() {
  return shopCache?.lowStockThreshold ?? LOW_STOCK_THRESHOLD;
}

export function lowStockCount(items: StockItem[], threshold = lowStockThreshold()) {
  return items.filter((it) => it.quantity < threshold).length;
}


export function findStockByBarcode(items: StockItem[], code: string): StockItem | undefined {
  const c = code.trim();
  if (!c) return undefined;
  return items.find((it) => (it.barcode ?? "").trim() === c);
}

export interface StockHistoryEntry {
  id: string;
  date: string;
  type: "purchase" | "sale" | "adjustment";
  qty: number; // positive = added, negative = removed
  reason?: string;
  notes?: string | null;
  ref?: string;
}

export async function fetchStockHistory(stockItemId: string, name: string): Promise<StockHistoryEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const [pi, ii, adj] = await Promise.all([
    supabase.from("purchase_items").select("id,name,quantity,created_at,purchase_id").eq("user_id", user.id).eq("name", name),
    supabase.from("invoice_items").select("id,name,created_at,invoice_id").eq("user_id", user.id).eq("name", name),
    supabase.from("stock_adjustments").select("id,delta,reason,notes,created_at").eq("user_id", user.id).eq("stock_item_id", stockItemId),
  ]);
  const out: StockHistoryEntry[] = [];
  for (const r of (pi.data ?? [])) {
    out.push({ id: `p-${r.id}`, date: r.created_at, type: "purchase", qty: Number(r.quantity ?? 0), ref: "فاتورة شراء" });
  }
  for (const r of (ii.data ?? [])) {
    out.push({ id: `i-${r.id}`, date: r.created_at, type: "sale", qty: -1, ref: "فاتورة بيع" });
  }
  for (const r of (adj.data ?? [])) {
    out.push({ id: `a-${r.id}`, date: r.created_at, type: "adjustment", qty: Number(r.delta ?? 0), reason: r.reason, notes: r.notes });
  }
  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function aiScript(c: Customer, balance: number, lateDays: number): string {
  // Status-driven tone: defaulter → formal legal warning, committed → thank-you + offer.
  if (c.status === "defaulter") {
    const months = Math.max(1, Math.floor(Math.max(lateDays, 30) / 30));
    return `السيد/ ${c.name} المحترم،\nنحيطكم علماً بأن حسابكم لدينا متأخر السداد منذ ${months} شهر، وقد بلغ الرصيد المستحق عليكم مبلغ ${fmt(balance)} ج.م.\nنمنحكم مهلة نهائية للسداد خلال (7) أيام من تاريخه، وفي حال عدم الاستجابة سنضطر آسفين لاتخاذ كافة الإجراءات القانونية اللازمة لاسترداد حقوقنا، وتحميلكم كافة المصاريف القضائية.\nنأمل المبادرة بالسداد تجنباً للإجراءات.\nوتفضلوا بقبول وافر الاحترام.`;
  }
  if (c.status === "committed") {
    return `يا أستاذ ${c.name}، تحية طيبة 🌿\nبنشكرك على التزامك الدائم في السداد، وده اللي خلانا نخصّك بعرض مميز:\n🎁 خصم 10% على مشترياتك الجاية، وسقف ائتماني أعلى من غير مقدم.\nالعرض ساري لمدة أسبوع. تحت أمرك في أي وقت.`;
  }
  // neutral / default tone scales with lateness
  if (lateDays <= 0)
    return `يا أستاذ ${c.name}، تحية طيبة. حسابك تمام معانا، وأي وقت محتاج بضاعة جديدة إحنا تحت أمرك.`;
  if (lateDays < 7)
    return `يا أستاذ ${c.name}، تذكير بسيط وعلى راحتك: عليك متبقي ${fmt(balance)} ج.م. لو فيه أي استفسار إحنا تحت أمرك.`;
  if (lateDays <= 30)
    return `يا أستاذ ${c.name}، بقالك ${lateDays} يوم متأخر على القسط. محتاجين نشرفنا في المحل لتحديث الحساب. المتبقي: ${fmt(balance)} ج.م.`;
  const months = Math.max(1, Math.floor(lateDays / 30));
  return `يا أستاذ ${c.name}، الحساب متوقف تماماً وبقالنا ${months} شهر من غير سداد. لازم الحساب يتقفل لتجنب الإجراءات القانونية. المتبقي: ${fmt(balance)} ج.م.`;
}

// ---------- Auth identity ----------
export type AuthProvider = "google" | "email" | "unknown";

export interface AuthIdentity {
  id: string;
  email?: string;
  /** Name from the identity provider (Google `full_name`/`name`), if any. */
  metaName: string | null;
  /** Avatar from the identity provider (Google `avatar_url`/`picture`), if any. */
  metaAvatar: string | null;
  provider: AuthProvider;
  /** All linked providers — a user can have both google and a password. */
  providers: string[];
  hasPassword: boolean;
  emailConfirmed: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

function toIdentity(u: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
  identities?: { provider: string }[] | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
}): AuthIdentity {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof meta[k] === "string" && meta[k] ? (meta[k] as string) : null);
  const linked = (u.identities ?? []).map((i) => i.provider);
  const appProviders = Array.isArray((u.app_metadata as { providers?: unknown })?.providers)
    ? ((u.app_metadata as { providers?: string[] }).providers as string[])
    : [];
  const providers = Array.from(new Set([...linked, ...appProviders])).filter(Boolean);
  const primary = (u.app_metadata as { provider?: string })?.provider ?? providers[0] ?? "";
  return {
    id: u.id,
    email: u.email,
    metaName: str("full_name") ?? str("name") ?? str("display_name"),
    metaAvatar: str("avatar_url") ?? str("picture"),
    provider: primary === "google" ? "google" : primary === "email" ? "email" : "unknown",
    providers: providers.length ? providers : primary ? [primary] : [],
    hasPassword: providers.includes("email") || primary === "email",
    emailConfirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
    createdAt: u.created_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
  };
}

/**
 * Auth state hook.
 * Session events drive re-renders instantly, but the identity we render is
 * re-validated against the auth server with getUser() — getSession() alone only
 * reads the locally-stored token.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthIdentity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    const verify = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(error || !data.user ? null : toIdentity(data.user));
      setReady(true);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!alive) return;
      // Optimistic paint from the session, then verify with the auth server.
      setUser(session?.user ? toIdentity(session.user) : null);
      setReady(true);
      if (session?.user) void verify();
      // Refresh data on auth change
      loaded = false;
      fetchAll();
    });

    void verify();

    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  return { user, ready };
}

// ---------- Profile (اسم العرض والصورة) ----------
export interface Profile {
  displayName: string;
  avatarUrl: string | null;
  phone: string;
}

const emptyProfile: Profile = { displayName: "", avatarUrl: null, phone: "" };

export function useProfile() {
  const { user, ready: authReady } = useAuth();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setProfile(emptyProfile); setLoading(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, phone")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(
      data
        ? { displayName: data.display_name ?? "", avatarUrl: data.avatar_url ?? null, phone: data.phone ?? "" }
        : { displayName: user.metaName ?? "", avatarUrl: user.metaAvatar ?? null, phone: "" },
    );
    setLoading(false);
  }, [user]);

  useEffect(() => { if (authReady) void load(); }, [authReady, load]);

  const save = useCallback(async (patch: Partial<Profile>) => {
    if (!user) throw new Error("لازم تكون مسجل دخول");
    const next = { ...profile, ...patch };
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: next.displayName,
      avatar_url: next.avatarUrl,
      phone: next.phone,
    });
    if (error) throw error;
    setProfile(next);
  }, [user, profile]);

  // The name we actually show anywhere in the UI.
  const label = profile.displayName || user?.metaName || user?.email?.split("@")[0] || "";
  const avatar = profile.avatarUrl || user?.metaAvatar || null;

  return { profile, label, avatar, loading: loading || !authReady, save, reload: load, user, authReady };
}


// ---------- Shop settings (بيانات المحل) ----------
export type ThemeMode = "dark" | "light" | "system";
export type PrintPaper = "a4" | "thermal";

export interface ShopSettings {
  shopName: string;
  phone: string;
  address: string;
  logoUrl: string | null;
  footerNote: string;
  currency: string;
  taxNumber: string;
  whatsapp: string;
  lowStockThreshold: number;
  defaultInstallmentMonths: number;
  defaultDueDay: number;
  invoicePrefix: string;
  printPaper: PrintPaper;
  theme: ThemeMode;
  reminderDaysBefore: number;
  alertsEnabled: boolean;
}

export const EMPTY_SHOP_SETTINGS: ShopSettings = {
  shopName: "",
  phone: "",
  address: "",
  logoUrl: null,
  footerNote: "",
  currency: "ج.م",
  taxNumber: "",
  whatsapp: "",
  lowStockThreshold: 5,
  defaultInstallmentMonths: 6,
  defaultDueDay: 1,
  invoicePrefix: "",
  printPaper: "a4",
  theme: "dark",
  reminderDaysBefore: 3,
  alertsEnabled: true,
};

let shopCache: ShopSettings | null = null;
const shopListeners = new Set<() => void>();

/** Synchronous read of the cached settings (safe defaults before first load). */
export function getShopSettings(): ShopSettings {
  return shopCache ?? EMPTY_SHOP_SETTINGS;
}

/** Currency symbol currently configured. */
export function currency() {
  return getShopSettings().currency || "ج.م";
}

/** Formats an amount with the configured currency, e.g. "1٬250 ج.م". */
export function money(n: number) {
  return `${fmt(n)} ${currency()}`;
}

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export async function fetchShopSettings(): Promise<ShopSettings> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_SHOP_SETTINGS;
  const { data } = await supabase
    .from("shop_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const row = data as Record<string, unknown> | null;
  shopCache = row
    ? {
        shopName: (row.shop_name as string) ?? "",
        phone: (row.phone as string) ?? "",
        address: (row.address as string) ?? "",
        logoUrl: (row.logo_url as string | null) ?? null,
        footerNote: (row.footer_note as string) ?? "",
        currency: (row.currency as string) || "ج.م",
        taxNumber: (row.tax_number as string) ?? "",
        whatsapp: (row.whatsapp as string) ?? "",
        lowStockThreshold: num(row.low_stock_threshold, 5),
        defaultInstallmentMonths: num(row.default_installment_months, 6),
        defaultDueDay: num(row.default_due_day, 1),
        invoicePrefix: (row.invoice_prefix as string) ?? "",
        printPaper: ((row.print_paper as PrintPaper) ?? "a4"),
        theme: ((row.theme as ThemeMode) ?? "dark"),
        reminderDaysBefore: num(row.reminder_days_before, 3),
        alertsEnabled: (row.alerts_enabled as boolean) ?? true,
      }
    : EMPTY_SHOP_SETTINGS;
  shopListeners.forEach((l) => l());
  return shopCache;
}

export async function saveShopSettings(patch: ShopSettings) {
  const user_id = await uid();
  const { error } = await supabase.from("shop_settings").upsert(
    {
      user_id,
      shop_name: patch.shopName.trim(),
      phone: patch.phone.trim(),
      address: patch.address.trim(),
      logo_url: patch.logoUrl?.trim() || null,
      footer_note: patch.footerNote.trim(),
      currency: patch.currency.trim() || "ج.م",
      tax_number: patch.taxNumber.trim(),
      whatsapp: patch.whatsapp.trim(),
      low_stock_threshold: Math.max(0, Math.round(patch.lowStockThreshold)),
      default_installment_months: Math.max(1, Math.round(patch.defaultInstallmentMonths)),
      default_due_day: Math.min(28, Math.max(1, Math.round(patch.defaultDueDay))),
      invoice_prefix: patch.invoicePrefix.trim(),
      print_paper: patch.printPaper,
      theme: patch.theme,
      reminder_days_before: Math.min(30, Math.max(0, Math.round(patch.reminderDaysBefore))),
      alerts_enabled: patch.alertsEnabled,
    } as never,
    { onConflict: "user_id" },
  );
  if (error) throw error;
  await fetchShopSettings();
}


/** Reactive access to the shop identity used on printed documents. */
export function useShopSettings() {
  const [settings, setSettings] = useState<ShopSettings>(shopCache ?? EMPTY_SHOP_SETTINGS);
  const [loading, setLoading] = useState(shopCache === null);
  useEffect(() => {
    const l = () => setSettings(shopCache ?? EMPTY_SHOP_SETTINGS);
    shopListeners.add(l);
    if (shopCache === null) {
      fetchShopSettings().finally(() => setLoading(false));
    }
    return () => { shopListeners.delete(l); };
  }, []);
  return { settings, loading, reload: fetchShopSettings };
}
