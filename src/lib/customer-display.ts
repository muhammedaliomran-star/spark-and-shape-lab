// Customer-Facing Display synchronization helper
// Uses BroadcastChannel + localStorage fallback for dual-monitor / customer display support

export interface CustomerDisplayItem {
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface CustomerDisplayState {
  shopName: string;
  shopPhone?: string;
  items: CustomerDisplayItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paidAmount?: number;
  changeDue?: number;
  customerName?: string;
  status: "idle" | "active" | "completed";
  completedInvoiceCode?: string;
  lastUpdated: number;
}

const STORAGE_KEY = "segilly:customer_display_state";
const CHANNEL_NAME = "segilly_pos_customer_display";

let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  channel = null;
}

export function broadcastCustomerDisplay(state: CustomerDisplayState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (channel) {
      channel.postMessage(state);
    }
  } catch {
    /* noop */
  }
}

export function getCustomerDisplayState(): CustomerDisplayState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* noop */
  }
  return {
    shopName: "سِجلّي",
    items: [],
    subtotal: 0,
    discountAmount: 0,
    total: 0,
    status: "idle",
    lastUpdated: Date.now(),
  };
}

export function subscribeCustomerDisplay(callback: (state: CustomerDisplayState) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleMessage = (e: MessageEvent) => {
    if (e.data) {
      callback(e.data);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        callback(JSON.parse(e.newValue));
      } catch {
        /* noop */
      }
    }
  };

  if (channel) {
    channel.addEventListener("message", handleMessage);
  }
  window.addEventListener("storage", handleStorage);

  // Initial read
  callback(getCustomerDisplayState());

  return () => {
    if (channel) {
      channel.removeEventListener("message", handleMessage);
    }
    window.removeEventListener("storage", handleStorage);
  };
}
