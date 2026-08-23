import { supabase } from "@/integrations/supabase/client";

// The storefront migration is intentionally shipped with this feature; generated Supabase types
// are refreshed by the Supabase CLI after it is applied.
const storefrontDb = supabase as any;

export type OrderType = "cash_on_delivery" | "installment_request";
export type StoreOrderStatus = "submitted" | "under_review" | "needs_info" | "accepted" | "invoiced" | "shipped" | "delivered" | "rejected" | "cancelled" | "expired";

export interface Storefront {
  id: string;
  owner_id: string;
  branch_id: string | null;
  slug: string;
  name: string;
  phone: string | null;
  whatsapp_phone: string | null;
  logo_url: string | null;
  description: string | null;
  shipping_policy: string | null;
  is_published: boolean;
}

export interface StorefrontProduct {
  id: string;
  storefront_id: string;
  stock_item_id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  images: string[];
  display_price: number;
  show_installments: boolean;
  down_payment_from: number | null;
  monthly_payment_from: number | null;
  sort_order: number;
  is_published: boolean;
  available_quantity?: number;
}

export interface StoreOrder {
  id: string;
  public_number: string;
  storefront_id: string;
  status: StoreOrderStatus;
  order_type: OrderType;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_area: string | null;
  notes: string | null;
  subtotal: number;
  shipping_fee: number;
  total: number;
  created_at: string;
  reservation_expires_at: string | null;
  store_order_items?: StoreOrderItem[];
}

export interface StoreOrderItem {
  id: string;
  product_title: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

const asNumber = (value: unknown) => Number(value ?? 0);

function mapProduct(value: any): StorefrontProduct {
  return { ...value, images: Array.isArray(value.images) ? value.images : [], display_price: asNumber(value.display_price), down_payment_from: value.down_payment_from == null ? null : asNumber(value.down_payment_from), monthly_payment_from: value.monthly_payment_from == null ? null : asNumber(value.monthly_payment_from), available_quantity: value.available_quantity == null ? undefined : asNumber(value.available_quantity) };
}

export async function getMyStorefront() {
  const { data, error } = await storefrontDb.from("storefronts").select("*").maybeSingle();
  if (error) throw error;
  return data as Storefront | null;
}

export async function saveStorefront(input: Partial<Storefront> & Pick<Storefront, "slug" | "name">) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("سجل الدخول أولًا");
  const current = await getMyStorefront();
  const payload = { ...input, slug: input.slug.toLowerCase().trim(), owner_id: userData.user.id, updated_at: new Date().toISOString() };
  const request = current
    ? storefrontDb.from("storefronts").update(payload).eq("id", current.id).select().single()
    : storefrontDb.from("storefronts").insert(payload).select().single();
  const { data, error } = await request;
  if (error) throw error;
  return data as Storefront;
}

export async function getMyStorefrontProducts(storefrontId: string) {
  const { data, error } = await storefrontDb.from("storefront_products").select("*").eq("storefront_id", storefrontId).order("sort_order").order("title");
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function upsertStorefrontProduct(product: Omit<StorefrontProduct, "id" | "available_quantity"> & { id?: string }) {
  const payload = { ...product, slug: product.slug.toLowerCase().trim(), updated_at: new Date().toISOString() };
  const query = product.id
    ? storefrontDb.from("storefront_products").update(payload).eq("id", product.id).select().single()
    : storefrontDb.from("storefront_products").insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return mapProduct(data);
}

export async function getMyStoreOrders(storefrontId: string) {
  const { data, error } = await storefrontDb.from("store_orders").select("*, store_order_items(*) ").eq("storefront_id", storefrontId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((order: any) => ({ ...order, subtotal: asNumber(order.subtotal), shipping_fee: asNumber(order.shipping_fee), total: asNumber(order.total), store_order_items: (order.store_order_items ?? []).map((item: any) => ({ ...item, unit_price: asNumber(item.unit_price), line_total: asNumber(item.line_total) })) })) as StoreOrder[];
}

export async function acceptStoreOrder(orderId: string) {
  const { data, error } = await storefrontDb.rpc("accept_store_order", { p_order_id: orderId });
  if (error) throw error;
  return data as StoreOrder;
}

export async function invoiceStoreOrder(orderId: string) {
  const { data, error } = await storefrontDb.rpc("invoice_store_order", { p_order_id: orderId });
  if (error) throw error;
  return data as { invoice_id: string; already_invoiced: boolean };
}

export async function updateStoreOrderStatus(orderId: string, status: Exclude<StoreOrderStatus, "accepted">) {
  const { error } = await storefrontDb.from("store_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", orderId);
  if (error) throw error;
}

export async function getPublicStorefront(slug: string) {
  const { data, error } = await storefrontDb.rpc("get_public_storefront", { p_slug: slug.toLowerCase() });
  if (error) throw error;
  if (!data) return null;
  return { storefront: data.storefront as Omit<Storefront, "owner_id" | "branch_id" | "is_published">, categories: data.categories ?? [], products: (data.products ?? []).map(mapProduct) };
}

export async function submitStoreOrder(input: { storefrontId: string; customerName: string; customerPhone: string; deliveryAddress: string; deliveryArea?: string; notes?: string; orderType: OrderType; items: Array<{ productId: string; quantity: number }> }) {
  const { data, error } = await storefrontDb.rpc("submit_store_order", {
    p_storefront_id: input.storefrontId,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_delivery_address: input.deliveryAddress,
    p_delivery_area: input.deliveryArea ?? null,
    p_notes: input.notes ?? null,
    p_order_type: input.orderType,
    p_items: input.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
  });
  if (error) throw error;
  return data as { id: string; public_number: string; status: StoreOrderStatus };
}

export function storefrontSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
}
