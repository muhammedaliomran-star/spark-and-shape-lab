/**
 * حاسبة تسعير الشحن + حساب موعد التسليم المتوقع (SLA).
 * القاعدة: تكلفة المنطقة (أو التكلفة الأساسية للمندوب) + وزن زائد + قطع إضافية.
 */
import type { Shipment, ShipmentCarrier, ShippingZone } from "@/lib/store";

/** الوزن المشمول في السعر الأساسي بالكيلو. */
export const FREE_WEIGHT_KG = 5;
/** سعر كل كيلو زائد. */
export const EXTRA_KG_PRICE = 10;
/** سعر كل قطعة إضافية بعد القطعة الأولى. */
export const EXTRA_PIECE_PRICE = 5;

export interface PricingInput {
  zone?: ShippingZone | null;
  carrier?: ShipmentCarrier | null;
  weightKg?: number;
  pieces?: number;
}

export interface PricingBreakdown {
  base: number;
  weightExtra: number;
  piecesExtra: number;
  total: number;
  lines: Array<{ label: string; value: number }>;
}

export function calculateShippingCost(input: PricingInput): PricingBreakdown {
  const weight = Math.max(0, Number(input.weightKg ?? 0));
  const pieces = Math.max(1, Math.floor(Number(input.pieces ?? 1)));
  const base = Number(input.zone?.deliveryCost ?? input.carrier?.baseCost ?? 0);
  const extraKg = Math.max(0, Math.ceil(weight - FREE_WEIGHT_KG));
  const weightExtra = extraKg * EXTRA_KG_PRICE;
  const piecesExtra = (pieces - 1) * EXTRA_PIECE_PRICE;
  const total = Math.round((base + weightExtra + piecesExtra) * 100) / 100;
  return {
    base,
    weightExtra,
    piecesExtra,
    total,
    lines: [
      { label: input.zone ? `أساسي — ${input.zone.name}` : "التكلفة الأساسية للمندوب", value: base },
      { label: `وزن زائد (${extraKg} كجم × ${EXTRA_KG_PRICE})`, value: weightExtra },
      { label: `قطع إضافية (${Math.max(0, pieces - 1)} × ${EXTRA_PIECE_PRICE})`, value: piecesExtra },
    ],
  };
}

/** موعد التسليم المتوقع بناءً على أيام المنطقة (افتراضي 3 أيام). */
export function expectedDeliveryDate(from: string | Date, zone?: ShippingZone | null): string {
  const days = Number(zone?.estimatedDays ?? 3) || 3;
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export type SlaState = "on_time" | "due_today" | "late" | "closed";

export interface SlaInfo {
  state: SlaState;
  expected: string | null;
  daysLate: number;
  label: string;
}

/** حالة الالتزام بموعد التسليم لشحنة. */
export function shipmentSla(shipment: Shipment, zone?: ShippingZone | null): SlaInfo {
  const expected =
    (shipment as Shipment & { expectedDeliveryDate?: string | null }).expectedDeliveryDate ??
    expectedDeliveryDate(shipment.createdAt, zone);
  if (!["pending", "processing", "shipped"].includes(shipment.status)) {
    return { state: "closed", expected, daysLate: 0, label: "مُغلقة" };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (expected > today) return { state: "on_time", expected, daysLate: 0, label: `متبقي حتى ${expected}` };
  if (expected === today) return { state: "due_today", expected, daysLate: 0, label: "التسليم النهارده" };
  const daysLate = Math.max(
    1,
    Math.round((new Date(today).getTime() - new Date(expected).getTime()) / 86400000),
  );
  return { state: "late", expected, daysLate, label: `متأخرة ${daysLate} يوم` };
}
