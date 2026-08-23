import { supabase } from "@/integrations/supabase/client";

export type StorefrontDomainStatus = "pending_dns" | "pending_ssl" | "active" | "disabled";
export interface StorefrontDomain { id: string; storefront_id: string; domain: string; status: StorefrontDomainStatus; verification_token: string; verified_at: string | null; created_at: string; updated_at: string; }

export async function getStorefrontDomains(storefrontId: string) {
  const { data, error } = await (supabase as any).from("storefront_domains").select("*").eq("storefront_id", storefrontId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StorefrontDomain[];
}

export async function addStorefrontDomain(storefrontId: string, domain: string) {
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) throw new Error("اكتب نطاق صحيح");
  const { data, error } = await (supabase as any).from("storefront_domains").insert({ storefront_id: storefrontId, domain: normalized }).select().single();
  if (error) throw error;
  return data as StorefrontDomain;
}