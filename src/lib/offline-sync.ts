import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PendingOfflinePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paidAt: string;
  createdAt: string;
  customerName?: string;
}

const OFFLINE_QUEUE_KEY = "sejelly_offline_payments_queue";

export function getOfflineQueue(): PendingOfflinePayment[] {
  try {
    const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: PendingOfflinePayment[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // LocalStorage full or blocked
  }
}

/**
 * تسجيل دفعة أوفلاين في الطابور المحلي
 */
export function enqueueOfflinePayment(payment: {
  invoiceId: string;
  amount: number;
  paidAt?: string;
  customerName?: string;
}): PendingOfflinePayment {
  const queue = getOfflineQueue();
  const newPayment: PendingOfflinePayment = {
    id: crypto.randomUUID(),
    invoiceId: payment.invoiceId,
    amount: payment.amount,
    paidAt: payment.paidAt || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    customerName: payment.customerName,
  };

  queue.push(newPayment);
  saveOfflineQueue(queue);
  return newPayment;
}

/**
 * مزامنة الدفعات العالقة عند عودة الاتصال
 */
export async function syncOfflinePayments(onSynced?: (count: number) => void): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  let successCount = 0;
  const remainingQueue: PendingOfflinePayment[] = [];

  for (const item of queue) {
    try {
      const { error: payErr } = await (supabase as any).rpc("record_invoice_payment", {
        p_invoice_id: item.invoiceId,
        p_amount: item.amount,
        p_payment_id: item.id,
        p_paid_at: item.paidAt,
      });
      if (payErr) throw payErr;

      successCount++;
    } catch {
      // إذا فشلت واحدة نحتفظ بها في الطابور
      remainingQueue.push(item);
    }
  }

  saveOfflineQueue(remainingQueue);

  if (successCount > 0) {
    toast.success(`النت رجع وتمت مزامنة ${successCount} دفعة مسجلة أوفلاين بنجاح ✓`);
    if (onSynced) onSynced(successCount);
  }

  return successCount;
}

/**
 * Hook لمتابعة حالة الشبكة والمزامنة التلقائية
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(() => getOfflineQueue().length);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getOfflineQueue().length);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncOfflinePayments(() => {
        refreshPendingCount();
      });
    } finally {
      setIsSyncing(false);
      refreshPendingCount();
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("انقطع اتصال الإنترنت — تقدر تسجل دفعات وهيتم حفظها ومزامنتها تلقائيًا أول ما النت يرجع.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [triggerSync]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    triggerSync,
    refreshPendingCount,
  };
}
