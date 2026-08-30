import { useState, useEffect } from "react";

export interface HeldInvoiceItem {
  id: string;
  stockId?: string;
  name: string;
  cost: string;
  price: string;
  quantity: string;
}

export interface HeldInvoice {
  id: string;
  createdAt: string;
  source: "pos" | "invoice";
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  saleType: "cash" | "installments";
  items: HeldInvoiceItem[];
  total: number;
  downPayment?: string;
  monthlyInstallment?: string;
  installmentCount?: string;
  notes?: string;
  discountPct?: string;
  discountAmt?: string;
  taxPct?: string;
  shippingCarrierId?: string;
  shippingAddress?: string;
}

const STORAGE_KEY = "segilly_held_invoices_v1";

export function getHeldInvoices(): HeldInvoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error reading held invoices", e);
    return [];
  }
}

export function saveHeldInvoice(held: Omit<HeldInvoice, "id" | "createdAt">): HeldInvoice {
  const all = getHeldInvoices();
  const newItem: HeldInvoice = {
    ...held,
    id: "held_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    createdAt: new Date().toISOString(),
  };
  const updated = [newItem, ...all];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("segilly_held_invoices_changed"));
  } catch (e) {
    console.error("Error saving held invoice", e);
  }
  return newItem;
}

export function removeHeldInvoice(id: string) {
  const all = getHeldInvoices();
  const updated = all.filter((x) => x.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("segilly_held_invoices_changed"));
  } catch (e) {
    console.error("Error removing held invoice", e);
  }
}

export function clearAllHeldInvoices() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("segilly_held_invoices_changed"));
  } catch (e) {
    console.error("Error clearing held invoices", e);
  }
}

export function useHeldInvoices() {
  const [heldList, setHeldList] = useState<HeldInvoice[]>(() => getHeldInvoices());

  useEffect(() => {
    const update = () => setHeldList(getHeldInvoices());
    window.addEventListener("segilly_held_invoices_changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("segilly_held_invoices_changed", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return {
    heldList,
    count: heldList.length,
    saveHeld: saveHeldInvoice,
    removeHeld: removeHeldInvoice,
    clearAll: clearAllHeldInvoices,
  };
}
