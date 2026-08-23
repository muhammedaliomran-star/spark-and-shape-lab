import { supabase } from "@/integrations/supabase/client";

export type StorefrontEvent = "store_view" | "product_view" | "cart_add" | "checkout_start" | "order_submitted";

export async function trackStorefrontEvent(storefrontId: string, eventName: StorefrontEvent, productId?: string) {
  const source = new URLSearchParams(window.location.search).get("utm_source") || "direct";
  await (supabase as any).rpc("record_storefront_event", { p_storefront_id: storefrontId, p_event_name: eventName, p_product_id: productId ?? null, p_source: ["direct", "whatsapp", "facebook", "instagram", "other"].includes(source) ? source : "other" });
}

export async function getStorefrontAnalyticsSummary(storefrontId: string, from?: Date) {
  const { data, error } = await (supabase as any).rpc("get_storefront_analytics_summary", { p_storefront_id: storefrontId, p_from: from?.toISOString() });
  if (error) throw error;
  return data as Record<StorefrontEvent, number>;
}