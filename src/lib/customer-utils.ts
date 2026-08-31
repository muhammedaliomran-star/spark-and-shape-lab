import type { Customer, Invoice } from "@/lib/store";

export const EG_PHONE_RE = /^01[0125]\d{8}$/;

/**
 * توليد كود تعريفي فريد ومختصر للعميل للبحث السريع والفواتير
 */
export function getCustomerCode(c: { id: string }): string {
  if (!c.id) return "C-0000";
  const hex = c.id.replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase();
  return `C-${hex.padStart(5, "0")}`;
}

/**
 * تحويل تاريخ ISO (YYYY-MM-DD) إلى التاريخ المعتاد في مصر (DD/MM/YYYY)
 */
export function isoToDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/**
 * تحويل DD/MM/YYYY إلى ISO
 */
export function ddmmyyyyToIso(s: string): string | null {
  if (!s) return null;
  const clean = s.trim();
  // If already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const m = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dd = String(Number(d)).padStart(2, "0");
  const mm = String(Number(mo)).padStart(2, "0");
  const nDd = Number(d),
    nMm = Number(mo);
  if (nMm < 1 || nMm > 12 || nDd < 1 || nDd > 31) return null;
  return `${y}-${mm}-${dd}`;
}

export const RATING_TIPS: Record<number, { text: string; cls: string }> = {
  5: {
    text: "★5: عميل موثوق — يمكن البيع بدون مقدم.",
    cls: "bg-success/15 text-success border-success/30",
  },
  4: { text: "★4: التزام جيد — شروط مرنة.", cls: "bg-success/10 text-success border-success/20" },
  3: {
    text: "★3: عادي — اتبع السياسة المعتادة.",
    cls: "bg-warning/15 text-warning border-warning/30",
  },
  2: { text: "★2: ضعيف — اطلب مقدم أعلى.", cls: "bg-warning/15 text-warning border-warning/30" },
  1: {
    text: "★1: خطر مرتفع — أوقف البيع الآجل.",
    cls: "bg-danger/15 text-danger border-danger/30",
  },
};

/**
 * حساب حالة حساب العميل الإجمالية بدقة
 */
export function getCustomerAccountSummary(customer: Customer, invoices: Invoice[]) {
  const customerInvoices = invoices.filter((inv) => inv.customerId === customer.id);
  const totalInvoiced = customerInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalPaid = customerInvoices.reduce((sum, inv) => sum + (inv.paid || 0), 0);
  const currentDebt = Math.max(0, (customer.openingBalance || 0) + totalInvoiced - totalPaid);

  const activeInvoices = customerInvoices.filter(
    (inv) => inv.status !== "cancelled" && (inv.paid || 0) < inv.total,
  );
  const completedInvoices = customerInvoices.filter(
    (inv) => inv.status === "paid" || (inv.paid || 0) >= inv.total,
  );

  return {
    customerInvoices,
    totalInvoiced,
    totalPaid,
    currentDebt,
    activeCount: activeInvoices.length,
    completedCount: completedInvoices.length,
    isOverCreditLimit: customer.creditLimit > 0 && currentDebt > customer.creditLimit,
  };
}
