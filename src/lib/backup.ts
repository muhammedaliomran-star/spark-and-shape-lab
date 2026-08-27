import { supabase } from "@/integrations/supabase/client";

/** Tables owned by the signed-in user, in dependency order (parents first). */
const TABLES = [
  "customers",
  "suppliers",
  "invoices",
  "invoice_items",
  "payments",
  "purchases",
  "purchase_items",
  "supplier_payments",
  "stock_items",
  "stock_adjustments",
  "expenses",
  "shop_settings",
  "branches",
  "payment_vouchers",
  "shipping_carriers",
  "shipping_zones",
  "shipments",
  "storefronts",
  "storefront_categories",
  "storefront_products",
  "storefront_coupons",
  "storefront_domains",
  "storefront_feature_flags",
  "storefront_analytics_events",
  "store_orders",
  "store_order_items",
  "stock_reservations",
  "store_order_events",
  "storefront_notifications",
  "stock_movements",
  "audit_events",
  "return_records",
  "return_items",
] as const;

/** Child rows must go before their parents when deleting. */
const DELETE_ORDER = [
  "audit_events",
  "storefront_notifications",
  "store_order_events",
  "stock_reservations",
  "store_order_items",
  "store_orders",
  "storefront_analytics_events",
  "storefront_feature_flags",
  "storefront_domains",
  "storefront_coupons",
  "storefront_products",
  "storefront_categories",
  "storefronts",
  "shipments",
  "shipping_zones",
  "shipping_carriers",
  "stock_movements",
  "return_items",
  "return_records",
  "payment_vouchers",
  "branches",
  "payments",
  "invoice_items",
  "invoices",
  "purchase_items",
  "purchases",
  "supplier_payments",
  "stock_adjustments",
  "stock_items",
  "expenses",
  "customers",
  "suppliers",
] as const;

const USER_SCOPED_TABLES = new Set([
  "customers", "suppliers", "invoices", "invoice_items", "payments", "purchases", "purchase_items",
  "supplier_payments", "stock_items", "stock_adjustments", "expenses", "shop_settings", "branches",
  "payment_vouchers", "shipping_carriers", "shipping_zones", "shipments", "stock_movements",
  "audit_events", "return_records", "return_items",
]);

export type BackupPayload = {
  app: "segilly";
  version: 2;
  exportedAt: string;
  tables: Record<string, unknown[]>;
};

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("مش مسجّل دخول");
  return user.id;
}

async function ownedIds(table: string, column: string, value: string | string[]) {
  const query = (supabase.from as any)(table).select("id");
  const scoped = Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
  const { data, error } = await scoped;
  if (error) throw error;
  return (data ?? []).map((row: { id: string }) => row.id);
}

/** Reads every row the user owns and returns a portable JSON snapshot. */
export async function buildBackup(): Promise<BackupPayload> {
  const userId = await currentUserId();
  const tables: Record<string, unknown[]> = {};
  const storefrontIds = await ownedIds("storefronts", "owner_id", userId);
  const orderIds = storefrontIds.length ? await ownedIds("store_orders", "storefront_id", storefrontIds) : [];
  for (const t of TABLES) {
    let query: any = (supabase as any).from(t).select("*");
    if (USER_SCOPED_TABLES.has(t)) query = query.eq("user_id", userId);
    else if (t === "storefronts") query = query.eq("owner_id", userId);
    else if (t === "storefront_categories" || t === "storefront_products" || t === "storefront_coupons" || t === "storefront_domains" || t === "storefront_feature_flags" || t === "storefront_analytics_events") query = storefrontIds.length ? query.in("storefront_id", storefrontIds) : query.eq("id", "00000000-0000-0000-0000-000000000000");
    else if (t === "store_orders") query = storefrontIds.length ? query.in("storefront_id", storefrontIds) : query.eq("id", "00000000-0000-0000-0000-000000000000");
    else if (t === "store_order_items" || t === "store_order_events" || t === "stock_reservations" || t === "storefront_notifications") query = orderIds.length ? query.in("order_id", orderIds) : query.eq("id", "00000000-0000-0000-0000-000000000000");
    const { data, error } = await query;
    if (error) throw error;
    tables[t] = data ?? [];
  }
  return { app: "segilly", version: 2, exportedAt: new Date().toISOString(), tables };
}

export type RestoreReport = { inserted: number; skipped: number; failed: Array<{ table: string; error: string }> };

/** Validates and restores a JSON snapshot without allowing ownership to be imported. */
export async function restoreJsonBackup(value: unknown): Promise<RestoreReport> {
  const userId = await currentUserId();
  if (!value || typeof value !== "object") throw new Error("ملف النسخة غير صالح");
  const payload = value as Partial<BackupPayload>;
  if (payload.app !== "segilly" || ![1, 2].includes(Number(payload.version)) || !payload.tables || typeof payload.tables !== "object") {
    throw new Error("إصدار النسخة غير مدعوم أو البيانات ناقصة");
  }
  const report: RestoreReport = { inserted: 0, skipped: 0, failed: [] };
  for (const table of TABLES) {
    const rows = (payload.tables as Record<string, unknown[]>)[table];
    if (!Array.isArray(rows)) continue;
    for (const source of rows) {
      if (!source || typeof source !== "object") { report.skipped++; continue; }
      const row = { ...(source as Record<string, unknown>) };
      if ("user_id" in row) row.user_id = userId;
      if (table === "storefronts") row.owner_id = userId;
      delete row.created_at;
      delete row.updated_at;
      const { error } = await (supabase.from as any)(table).upsert(row, { onConflict: "id", ignoreDuplicates: true });
      if (error) report.failed.push({ table, error: error.message });
      else report.inserted++;
    }
  }
  return report;
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function downloadJsonBackup() {
  const backup = await buildBackup();
  downloadBlob(JSON.stringify(backup, null, 2), `segilly-backup-${stamp()}.json`, "application/json");
  return backup;
}

/** One sheet per table, opens in Excel / Google Sheets. */
export async function downloadExcelBackup() {
  const [{ utils, write }, backup] = await Promise.all([import("xlsx"), buildBackup()]);
  const wb = utils.book_new();
  for (const [name, rows] of Object.entries(backup.tables)) {
    const ws = utils.json_to_sheet(rows.length ? (rows as object[]) : [{}]);
    utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  const out = write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadBlob(out, `segilly-backup-${stamp()}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/** Row counts per table — used by the settings "data" tab. */
export async function dataCounts(): Promise<Record<string, number>> {
  const userId = await currentUserId();
  const out: Record<string, number> = {};
  const storefrontIds = await ownedIds("storefronts", "owner_id", userId);
  const orderIds = storefrontIds.length ? await ownedIds("store_orders", "storefront_id", storefrontIds) : [];
  await Promise.all(
    DELETE_ORDER.map(async (t) => {
      let query: any = (supabase as any).from(t).select("id", { count: "exact", head: true });
      if (USER_SCOPED_TABLES.has(t)) query = query.eq("user_id", userId);
      else if (t === "storefronts") query = query.eq("owner_id", userId);
      else if (t === "store_orders") query = storefrontIds.length ? query.in("storefront_id", storefrontIds) : query.eq("id", "00000000-0000-0000-0000-000000000000");
      else if (["storefront_categories", "storefront_products", "storefront_coupons", "storefront_domains", "storefront_feature_flags", "storefront_analytics_events"].includes(t)) query = storefrontIds.length ? query.in("storefront_id", storefrontIds) : query.eq("id", "00000000-0000-0000-0000-000000000000");
      else if (["store_order_items", "store_order_events", "stock_reservations", "storefront_notifications"].includes(t)) query = orderIds.length ? query.in("order_id", orderIds) : query.eq("id", "00000000-0000-0000-0000-000000000000");
      else query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      const { count } = await query;
      out[t] = count ?? 0;
    }),
  );
  return out;
}

/** Danger zone: deletes every business record for the signed-in user (settings kept). */
export async function wipeAllData() {
  const userId = await currentUserId();
  for (const t of DELETE_ORDER) {
    if (!USER_SCOPED_TABLES.has(t)) continue;
    const { error } = await (supabase as any).from(t).delete().eq("user_id", userId);
    if (error) throw error;
  }
}
