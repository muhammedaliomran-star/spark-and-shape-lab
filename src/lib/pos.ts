import { useState, useEffect, useCallback } from "react";

export interface ParkedBill {
  id: string;
  parkNumber: number;
  customerId?: string;
  customerName: string;
  totalAmount?: number;
  products: Array<{
    id: string;
    stockId?: string;
    variantId?: string;
    name: string;
    cost: string;
    price: string;
    quantity: string;
    size?: string;
  }>;
  down?: string;
  monthly?: string;
  saleType?: "cash" | "installments";
  discountPct?: string;
  notes?: string;
  parkedAt: string;
  total?: number;
}

const PARKED_BILLS_KEY = "segilly:parked_bills";
const parkedListeners = new Set<() => void>();

function notifyParked() {
  parkedListeners.forEach((l) => l());
}

export function loadParkedBills(): ParkedBill[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(PARKED_BILLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveParkedBills(bills: ParkedBill[]) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PARKED_BILLS_KEY, JSON.stringify(bills));
    notifyParked();
  } catch (e) {
    console.error("Failed to save parked bills:", e);
  }
}

export function parkActiveBill(params: Omit<ParkedBill, "id" | "parkNumber" | "parkedAt">): ParkedBill {
  const current = loadParkedBills();
  const nextNum = current.length > 0 ? Math.max(...current.map((b) => b.parkNumber || 0)) + 1 : 1;

  const newBill: ParkedBill = {
    ...params,
    id: `park-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    parkNumber: nextNum,
    parkedAt: new Date().toISOString(),
  };

  saveParkedBills([newBill, ...current]);
  return newBill;
}

export function removeParkedBill(id: string) {
  const current = loadParkedBills();
  const filtered = current.filter((b) => b.id !== id);
  saveParkedBills(filtered);
}

export function useParkedBills() {
  const [bills, setBills] = useState<ParkedBill[]>(loadParkedBills());

  useEffect(() => {
    const l = () => setBills(loadParkedBills());
    parkedListeners.add(l);
    return () => {
      parkedListeners.delete(l);
    };
  }, []);

  return {
    bills,
    parkedBills: bills,
    parkBill: parkActiveBill,
    removeBill: removeParkedBill,
    removeParkedBill,
    count: bills.length,
  };
}

/**
 * Plays a quick, pleasant POS chime for continuous barcode scan
 */
export function playScanSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08); // E6

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {
    // ignore audio block
  }
}

/**
 * Plays a cash register bell / success chime when invoice is submitted
 */
export function playCashSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // 2-tone pleasant chord
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.05);

      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4 + i * 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + 0.45 + i * 0.05);
    });
  } catch {
    // ignore audio block
  }
}
