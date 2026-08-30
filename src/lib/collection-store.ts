import { useState, useEffect } from "react";

export interface PromiseToPay {
  invoiceId: string;
  customerId: string;
  promisedDate: string; // YYYY-MM-DD
  promisedAmount: number;
  note?: string;
  createdAt: number;
  status: "pending" | "fulfilled" | "broken";
}

export interface CollectionCallLog {
  id: string;
  invoiceId: string;
  customerId: string;
  date: number;
  outcome: "promise" | "no_answer" | "switched_off" | "grace_period" | "dispute" | "paid" | "other";
  outcomeLabel: string;
  notes?: string;
  promisedDate?: string;
  promisedAmount?: number;
}

const PROMISES_KEY = "segilly:alerts:promises_v2";
const CALL_LOGS_KEY = "segilly:alerts:call_logs_v2";
const SNOOZE_KEY = "segilly:alerts:snooze_v2";

type SnoozeMap = Record<string, number>; // invoiceId -> expiresAt(ms)

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function getPromises(): Record<string, PromiseToPay> {
  try {
    return JSON.parse(localStorage.getItem(PROMISES_KEY) || "{}");
  } catch {
    return {};
  }
}

export function savePromise(p: PromiseToPay) {
  try {
    const current = getPromises();
    current[p.invoiceId] = p;
    localStorage.setItem(PROMISES_KEY, JSON.stringify(current));
    notify();
  } catch (e) {
    console.error("Failed to save promise", e);
  }
}

export function removePromise(invoiceId: string) {
  try {
    const current = getPromises();
    delete current[invoiceId];
    localStorage.setItem(PROMISES_KEY, JSON.stringify(current));
    notify();
  } catch (e) {
    console.error("Failed to remove promise", e);
  }
}

export function getCallLogs(): CollectionCallLog[] {
  try {
    return JSON.parse(localStorage.getItem(CALL_LOGS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addCallLog(log: Omit<CollectionCallLog, "id" | "date">) {
  try {
    const current = getCallLogs();
    const newEntry: CollectionCallLog = {
      ...log,
      id: "LOG-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      date: Date.now(),
    };
    current.unshift(newEntry);
    // Keep last 200 logs
    const trimmed = current.slice(0, 200);
    localStorage.setItem(CALL_LOGS_KEY, JSON.stringify(trimmed));

    // If it has a promise, also update promise map
    if (log.outcome === "promise" && log.promisedDate && log.promisedAmount) {
      savePromise({
        invoiceId: log.invoiceId,
        customerId: log.customerId,
        promisedDate: log.promisedDate,
        promisedAmount: log.promisedAmount,
        note: log.notes,
        createdAt: Date.now(),
        status: "pending",
      });
    }

    notify();
  } catch (e) {
    console.error("Failed to add call log", e);
  }
}

export function getSnoozes(): SnoozeMap {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setSnooze(invoiceId: string, hours = 24) {
  try {
    const current = getSnoozes();
    current[invoiceId] = Date.now() + hours * 60 * 60 * 1000;
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(current));
    notify();
  } catch (e) {
    console.error("Failed to set snooze", e);
  }
}

export function clearSnooze(invoiceId: string) {
  try {
    const current = getSnoozes();
    delete current[invoiceId];
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(current));
    notify();
  } catch (e) {
    console.error("Failed to clear snooze", e);
  }
}

export function useCollectionTracker() {
  const [, setVer] = useState(0);

  useEffect(() => {
    const handler = () => setVer((v) => v + 1);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    promises: getPromises(),
    callLogs: getCallLogs(),
    snoozes: getSnoozes(),
    savePromise,
    removePromise,
    addCallLog,
    setSnooze,
    clearSnooze,
  };
}
