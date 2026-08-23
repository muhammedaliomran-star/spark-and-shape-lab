import { supabase } from "@/integrations/supabase/client";

export type StorefrontFeature = "coupons" | "online_payment" | "custom_domain" | "branch_catalog";

export async function isStorefrontFeatureEnabled(storefrontId: string, flag: StorefrontFeature) {
  const { data, error } = await (supabase as any).rpc("get_storefront_feature_flag", { p_storefront_id: storefrontId, p_flag: flag });
  if (error) throw error;
  return data === true;
}

export async function setStorefrontFeature(storefrontId: string, flag: StorefrontFeature, enabled: boolean) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("سجل الدخول أولًا");
  const { error } = await (supabase as any).from("storefront_feature_flags").upsert({ storefront_id: storefrontId, flag, enabled, updated_at: new Date().toISOString() });
  if (error) throw error;
}