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
  banner_url: string | null;
  theme_key: string;
  seo_title: string | null;
  seo_description: string | null;
  social_links: Record<string, string>;
  minimum_order: number;
  opening_hours: Record<string, string>;
  is_published: boolean;
}

export interface StorefrontCategory {
  id: string;
  storefront_id: string;
  name: string;
  slug: string;
  sort_order: number;
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

export interface ShippingOption {
  id: string;
  name: string;
  delivery_cost: number;
  estimated_days: number;
  carrier_name: string;
}

export interface StorefrontNotification {
  id: string;
  user_id: string;
  order_id: string | null;
  event_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
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
  shipping_zone_id: string | null;
  total: number;
  invoice_id: string | null;
  return_id: string | null;
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

export interface StoreOrderEvent {
  id: string;
  order_id: string;
  actor_user_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
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

export async function invoiceStoreOrderInstallment(orderId: string, downPayment: number, monthlyInstallment: number, firstDueDate: string, installmentCount = 1) {
  const { data, error } = await storefrontDb.rpc("invoice_store_order_installment", {
    p_order_id: orderId,
    p_down_payment: downPayment,
    p_monthly_installment: monthlyInstallment,
    p_first_due_date: firstDueDate,
    p_installment_count: installmentCount,
  });
  if (error) throw error;
  return data as { invoice_id: string; already_invoiced: boolean; installment_count: number; remaining: number };
}

export async function updateStoreOrderStatus(orderId: string, status: Exclude<StoreOrderStatus, "accepted">, reason?: string) {
  const { error } = await storefrontDb.rpc("update_store_order_status", { p_order_id: orderId, p_status: status, p_reason: reason ?? null });
  if (error) throw error;
}

export async function getStoreOrderEvents(orderId: string) {
  const { data, error } = await storefrontDb.from("store_order_events").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StoreOrderEvent[];
}

export async function updateStorefrontShipment(invoiceId: string, carrierId: string | null, zoneId: string | null, trackingNumber: string | null, reason?: string) {
  const { error } = await storefrontDb.rpc("assign_storefront_shipment", { p_invoice_id: invoiceId, p_carrier_id: carrierId, p_zone_id: zoneId, p_tracking_number: trackingNumber?.trim() || null, p_reason: reason?.trim() || null });
  if (error) throw error;
}

export async function updateStorefrontShipmentStatus(shipmentId: string, status: "processing" | "shipped" | "delivered" | "returned" | "cancelled") {
  const { error } = await storefrontDb.rpc("update_storefront_shipment_status", { p_shipment_id: shipmentId, p_status: status });
  if (error) throw error;
}

export async function createStorefrontReturn(orderId: string, reason: string) {
  const { data: order, error: orderError } = await storefrontDb.from("store_orders").select("id,invoice_id,return_id,store_order_items(stock_item_id,product_title,quantity)").eq("id", orderId).single();
  if (orderError) throw orderError;
  if (!order.invoice_id) throw new Error("أنشئ الفاتورة قبل تسجيل المرتجع");
  const { data, error } = await storefrontDb.rpc("create_storefront_sale_return", { p_order_id: orderId, p_reason: reason.trim(), p_items: (order.store_order_items ?? []).map((item: any) => ({ stock_item_id: item.stock_item_id, quantity: item.quantity })) });
  if (error) throw error;
  return data as string;
}

export async function reverseStorefrontReturn(returnId: string) {
  const { error } = await storefrontDb.rpc("reverse_storefront_sale_return", { p_return_id: returnId });
  if (error) throw error;
}

export interface PublicStorefrontData {
  storefront: Omit<Storefront, "owner_id" | "branch_id" | "is_published">;
  categories: StorefrontCategory[];
  shippingOptions: ShippingOption[];
  products: StorefrontProduct[];
}

export async function getPublicStorefront(slug: string): Promise<PublicStorefrontData | null> {
  const { data, error } = await storefrontDb.rpc("get_public_storefront_with_settings", { p_slug: slug.toLowerCase() });
  if (error) throw error;
  if (!data) return null;
  return {
    storefront: data.storefront as PublicStorefrontData["storefront"],
    categories: (data.categories ?? []) as StorefrontCategory[],
    shippingOptions: (data.shipping_options ?? []).map((value: any) => ({ id: value.id, name: value.name, delivery_cost: asNumber(value.delivery_cost), estimated_days: asNumber(value.estimated_days), carrier_name: value.carrier_name ?? "" })) as ShippingOption[],
    products: (data.products ?? []).map(mapProduct),
  };
}

export async function submitStoreOrder(input: { storefrontId: string; customerName: string; customerPhone: string; deliveryAddress: string; deliveryArea?: string; notes?: string; orderType: OrderType; shippingZoneId?: string; couponCode?: string; idempotencyKey?: string; items: Array<{ productId: string; quantity: number }> }) {
  const { data, error } = await storefrontDb.rpc("submit_store_order", {
    p_storefront_id: input.storefrontId,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_delivery_address: input.deliveryAddress,
    p_delivery_area: input.deliveryArea ?? null,
    p_notes: input.notes ?? null,
    p_order_type: input.orderType,
    p_shipping_zone_id: input.shippingZoneId ?? null,
    p_coupon_code: input.couponCode?.trim() || null,
    p_idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
    p_items: input.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
  });
  if (error) throw error;
  return data as { id: string; public_number: string; status: StoreOrderStatus; shipping_fee: number; total: number };
}

export interface PublicOrderStatus {
  id: string;
  public_number: string;
  status: StoreOrderStatus;
  total: number;
  items: Array<{ title: string; quantity: number }>;
}

export async function getPublicOrderStatus(publicNumber: string, customerPhone: string): Promise<PublicOrderStatus | null> {
  const { data, error } = await storefrontDb.rpc("get_public_order_status", {
    p_public_number: publicNumber.trim(),
    p_customer_phone: customerPhone.trim(),
  });
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id ?? "",
    public_number: data.public_number,
    status: data.status,
    total: asNumber(data.total),
    items: (data.items ?? []).map((item: any) => ({ title: item.title, quantity: asNumber(item.quantity) })),
  };
}

export async function getStorefrontCategories(storefrontId: string) {
  const { data, error } = await storefrontDb.from("storefront_categories").select("*").eq("storefront_id", storefrontId).order("sort_order").order("name");
  if (error) throw error;
  return (data ?? []) as StorefrontCategory[];
}

export async function saveStorefrontCategory(input: Pick<StorefrontCategory, "storefront_id" | "name" | "sort_order"> & { id?: string }) {
  const payload = { storefront_id: input.storefront_id, name: input.name.trim(), slug: storefrontSlug(input.name), sort_order: input.sort_order ?? 0, updated_at: new Date().toISOString() };
  const query = input.id
    ? storefrontDb.from("storefront_categories").update(payload).eq("id", input.id).select().single()
    : storefrontDb.from("storefront_categories").insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data as StorefrontCategory;
}

export function storefrontProductReady(product: Pick<StorefrontProduct, "title" | "display_price" | "is_published">, stockQuantity: number): string | null {
  if (!product.title.trim()) return "اكتب عنوان المنتج";
  if (!Number.isFinite(product.display_price) || product.display_price < 0) return "اكتب سعر صحيح";
  if (product.is_published && stockQuantity <= 0) return "المخزون خلص، مينفعش تنشر المنتج";
  return null;
}

export async function uploadStorefrontProductImage(file: File): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("سجل الدخول أولًا");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("storefront-product-images").upload(path, file, { cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;
  const { data: publicUrl } = supabase.storage.from("storefront-product-images").getPublicUrl(path);
  return publicUrl.publicUrl;
}

export async function getStorefrontNotifications(): Promise<StorefrontNotification[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];
  const { data, error } = await storefrontDb.from("storefront_notifications").select("*").eq("user_id", userData.user.id).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StorefrontNotification[];
}

export async function markStorefrontNotificationRead(id: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("سجل الدخول أولًا");
  const { error } = await storefrontDb.from("storefront_notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userData.user.id);
  if (error) throw error;
}

export function storefrontSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
}
