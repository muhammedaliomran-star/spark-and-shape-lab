/** سجل محاولات التسليم لكل شحنة (تسليم جزئي، فشل، إعادة جدولة). */
import { supabase } from "@/integrations/supabase/client";

export type AttemptOutcome =
  | "delivered"
  | "partial"
  | "no_answer"
  | "refused"
  | "wrong_address"
  | "postponed"
  | "failed";

export const ATTEMPT_LABELS: Record<AttemptOutcome, string> = {
  delivered: "تم التسليم بالكامل",
  partial: "تسليم جزئي",
  no_answer: "العميل لم يرد",
  refused: "العميل رفض الاستلام",
  wrong_address: "عنوان غير صحيح",
  postponed: "تأجيل باتفاق العميل",
  failed: "محاولة فاشلة",
};

export interface DeliveryAttempt {
  id: string;
  shipmentId: string;
  attemptNumber: number;
  outcome: AttemptOutcome;
  reason: string | null;
  deliveredAmount: number;
  nextAttemptAt: string | null;
  notes: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  shipment_id: string;
  attempt_number: number;
  outcome: string;
  reason: string | null;
  delivered_amount: number | string;
  next_attempt_at: string | null;
  notes: string | null;
  created_at: string;
};

const map = (r: Row): DeliveryAttempt => ({
  id: r.id,
  shipmentId: r.shipment_id,
  attemptNumber: Number(r.attempt_number ?? 1),
  outcome: r.outcome as AttemptOutcome,
  reason: r.reason,
  deliveredAmount: Number(r.delivered_amount ?? 0),
  nextAttemptAt: r.next_attempt_at,
  notes: r.notes,
  createdAt: r.created_at,
});

export async function loadDeliveryAttempts(shipmentId?: string): Promise<DeliveryAttempt[]> {
  let query = (supabase.from as any)("delivery_attempts").select("*").order("created_at", { ascending: false });
  if (shipmentId) query = query.eq("shipment_id", shipmentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(map);
}

export async function addDeliveryAttempt(input: {
  shipmentId: string;
  attemptNumber: number;
  outcome: AttemptOutcome;
  reason?: string;
  deliveredAmount?: number;
  nextAttemptAt?: string | null;
  notes?: string;
}): Promise<DeliveryAttempt> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await (supabase.from as any)("delivery_attempts")
    .insert({
      user_id: auth.user?.id,
      shipment_id: input.shipmentId,
      attempt_number: input.attemptNumber,
      outcome: input.outcome,
      reason: input.reason || null,
      delivered_amount: input.deliveredAmount ?? 0,
      next_attempt_at: input.nextAttemptAt || null,
      notes: input.notes || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return map(data as Row);
}

export async function deleteDeliveryAttempt(id: string): Promise<void> {
  const { error } = await (supabase.from as any)("delivery_attempts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
