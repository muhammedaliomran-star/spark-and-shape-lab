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
] as const;

/** Child rows must go before their parents when deleting. */
const DELETE_ORDER = [
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

export type BackupPayload = {
  app: "segilly";
  version: 1;
  exportedAt: string;
  tables: Record<string, unknown[]>;
};

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("مش مسجّل دخول");
  return user.id;
}

/** Reads every row the user owns and returns a portable JSON snapshot. */
export async function buildBackup(): Promise<BackupPayload> {
  const userId = await currentUserId();
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select("*").eq("user_id", userId);
    if (error) throw error;
    tables[t] = data ?? [];
  }
  return { app: "segilly", version: 1, exportedAt: new Date().toISOString(), tables };
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
  await Promise.all(
    DELETE_ORDER.map(async (t) => {
      const { count } = await supabase
        .from(t)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      out[t] = count ?? 0;
    }),
  );
  return out;
}

/** Danger zone: deletes every business record for the signed-in user (settings kept). */
export async function wipeAllData() {
  const userId = await currentUserId();
  for (const t of DELETE_ORDER) {
    const { error } = await supabase.from(t).delete().eq("user_id", userId);
    if (error) throw error;
  }
}
