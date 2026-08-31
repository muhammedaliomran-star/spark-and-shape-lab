import { useState, useEffect, useCallback } from "react";
import { getShopSettings, type ShopSettings } from "./store";

const CASHIER_MODE_KEY = "segilly:cashier_mode_active";
const DEFAULT_MANAGER_PIN = "1234";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function isCashierModeActive(): boolean {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return false;
  const val = localStorage.getItem(CASHIER_MODE_KEY);
  return val === "true";
}

export function setCashierMode(active: boolean): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  localStorage.setItem(CASHIER_MODE_KEY, active ? "true" : "false");
  notify();
}

export const setCashierModeActive = setCashierMode;

export function getManagerPin(shop?: Partial<ShopSettings>): string {
  const settings = shop || getShopSettings();
  return (settings.managerPin || DEFAULT_MANAGER_PIN).trim();
}

export function verifyManagerPin(pin: string, shop?: Partial<ShopSettings>): boolean {
  const correct = getManagerPin(shop);
  return pin.trim() === correct.trim();
}

export function shouldRequireManagerPinForDiscount(
  discountPct: number,
  shop: Partial<ShopSettings>,
  isCashier: boolean,
): boolean {
  if (!isCashier) return false;
  const maxAllowed = shop.maxDiscountWithoutPin ?? 5;
  return discountPct > maxAllowed;
}

export function shouldHideCostAndProfits(
  shop: Partial<ShopSettings>,
  isCashier: boolean,
): boolean {
  if (!isCashier) return false;
  return shop.hideCostAndProfitsFromCashier ?? true;
}

export function useSecurity() {
  const [isCashierMode, setIsCashierModeState] = useState<boolean>(isCashierModeActive());
  const shop = getShopSettings();

  useEffect(() => {
    const l = () => setIsCashierModeState(isCashierModeActive());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const toggleCashierMode = useCallback(
    (targetState?: boolean, pin?: string): { success: boolean; error?: string } => {
      const next = targetState !== undefined ? targetState : !isCashierMode;
      // If exiting cashier mode (going back to manager mode), require PIN
      if (!next && isCashierMode) {
        if (!pin || !verifyManagerPin(pin, shop)) {
          return { success: false, error: "الرقم السري للمدير غير صحيح" };
        }
      }
      setCashierMode(next);
      return { success: true };
    },
    [isCashierMode, shop],
  );

  const hideCostAndProfits = shouldHideCostAndProfits(shop, isCashierMode);
  const maxAllowedDiscountPct = isCashierMode ? (shop.maxDiscountWithoutPin ?? 5) : 100;
  const requiresPinForDelete = isCashierMode && (shop.preventInvoiceDeletionWithoutPin ?? true);
  const requiresPinForAnalytics =
    isCashierMode && (shop.preventViewingTotalAnalyticsWithoutPin ?? true);

  return {
    isCashierMode,
    cashierMode: isCashierMode,
    toggleCashierMode,
    shouldHideCostAndProfits: hideCostAndProfits,
    maxAllowedDiscountPct,
    requiresPinForDelete,
    requiresPinForAnalytics,
    verifyPin: (pin: string) => verifyManagerPin(pin, shop),
  };
}

export const useCashierSecurity = useSecurity;
