import { supabase } from "@/integrations/supabase/client";

export async function validateStorefrontCoupon(storefrontId: string, code: string, subtotal: number) {
  const { data, error } = await (supabase as any).rpc("validate_storefront_coupon", { p_storefront_id: storefrontId, p_code: code, p_subtotal: subtotal });
  if (error) throw error;
  return data as { valid: boolean; coupon_id: string; discount_type: "percentage" | "fixed"; discount_value: number; discount_amount: number } | null;
}

export async function redeemStorefrontCoupon(orderId: string, couponId: string) {
  const { data, error } = await (supabase as any).rpc("redeem_storefront_coupon", { p_order_id: orderId, p_coupon_id: couponId });
  if (error) throw error;
  return Number(data ?? 0);
}