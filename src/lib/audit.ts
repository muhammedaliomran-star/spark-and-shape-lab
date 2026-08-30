import { useState, useEffect, useCallback, useMemo } from "react";
import { type StaffRole } from "@/lib/staff";

export type AuditActionType =
  | "INVOICE_CREATE"
  | "INVOICE_UPDATE"
  | "INVOICE_DELETE"
  | "PAYMENT_COLLECT"
  | "PAYMENT_DELETE"
  | "CUSTOMER_CREATE"
  | "CUSTOMER_UPDATE"
  | "CUSTOMER_DELETE"
  | "STOCK_CREATE"
  | "STOCK_UPDATE"
  | "STOCK_DELETE"
  | "STOCK_DELTA"
  | "EXPENSE_CREATE"
  | "RETURN_CREATE"
  | "DISCOUNT_APPLIED"
  | "LOYALTY_REDEEM"
  | "SHIFT_OPEN"
  | "SHIFT_CLOSE"
  | "SETTINGS_UPDATE"
  | "PRICE_OVERRIDE";

export type AuditModule =
  | "invoices"
  | "payments"
  | "customers"
  | "inventory"
  | "expenses"
  | "returns"
  | "discounts"
  | "staff"
  | "settings";

export type AuditSeverity = "info" | "warning" | "danger" | "critical";

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  action: AuditActionType;
  module: AuditModule;
  severity: AuditSeverity;
  staffId?: string;
  staffName: string;
  staffRole: StaffRole | "system";
  branchName?: string;
  entityId?: string;
  entityName?: string;
  title: string;
  details?: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  ipAddress?: string;
}

const STORAGE_KEY_AUDIT = "segilly_audit_logs_v1";

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "log-init-1",
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    action: "SHIFT_OPEN",
    module: "staff",
    severity: "info",
    staffId: "staff-admin-main",
    staffName: "المدير العام (المالك)",
    staffRole: "admin",
    branchName: "الفرع الرئيسي",
    title: "فتح وردية عمل جديدة",
    details: "تم بدء وردية جديدة برصيد افتتاحي 500 ج.م في الدرج",
  },
  {
    id: "log-init-2",
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    action: "INVOICE_CREATE",
    module: "invoices",
    severity: "info",
    staffId: "staff-cashier-1",
    staffName: "أحمد كاشير (نقطة البيع)",
    staffRole: "cashier",
    branchName: "الفرع الرئيسي",
    entityId: "inv-001",
    entityName: "فاتورة #0001",
    title: "إصدار فاتورة بيع جديدة",
    details: "إصدار فاتورة نقدية بقيمة 1,250 ج.م للعميل محمد أحمد",
  },
  {
    id: "log-init-3",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    action: "DISCOUNT_APPLIED",
    module: "discounts",
    severity: "warning",
    staffId: "staff-cashier-1",
    staffName: "أحمد كاشير (نقطة البيع)",
    staffRole: "cashier",
    branchName: "الفرع الرئيسي",
    title: "تطبيق كود خصم ترويجي",
    details: "تم تطبيق كود خصم WELCOME10 بنسبة 10% (قيمة الخصم: 125 ج.م)",
  },
  {
    id: "log-init-4",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    action: "STOCK_UPDATE",
    module: "inventory",
    severity: "warning",
    staffId: "staff-mgr-1",
    staffName: "محمود المشرف",
    staffRole: "manager",
    branchName: "الفرع الرئيسي",
    entityName: "شاحن أصلي Type-C",
    title: "تعديل كمية مخزون يدوي",
    details: "تعديل رصيد المخزن بعد الجرد الفعلي من 40 إلى 38 قطعة",
    oldValue: 40,
    newValue: 38,
  },
];

function loadAuditLogs(): AuditLogEntry[] {
  if (typeof window === "undefined") return INITIAL_AUDIT_LOGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(INITIAL_AUDIT_LOGS));
      return INITIAL_AUDIT_LOGS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load audit logs", e);
    return INITIAL_AUDIT_LOGS;
  }
}

function saveAuditLogs(logs: AuditLogEntry[]) {
  if (typeof window === "undefined") return;
  try {
    // Keep last 1500 logs to optimize storage
    const trimmed = logs.slice(0, 1500);
    localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(trimmed));
    window.dispatchEvent(new Event("segilly_audit_updated"));
  } catch (e) {
    console.error("Failed to save audit logs", e);
  }
}

export function getActiveStaffSnapshot(): { staffId: string; staffName: string; staffRole: StaffRole; branchName: string } {
  if (typeof window === "undefined") {
    return { staffId: "system", staffName: "المدير العام", staffRole: "admin", branchName: "الفرع الرئيسي" };
  }
  try {
    const activeStaffId = localStorage.getItem("segilly_active_staff_id_v1") || "staff-admin-main";
    const staffMembersRaw = localStorage.getItem("segilly_staff_members_v1");
    if (staffMembersRaw) {
      const list = JSON.parse(staffMembersRaw);
      const found = Array.isArray(list) ? list.find((s: any) => s.id === activeStaffId) : null;
      if (found) {
        return {
          staffId: found.id,
          staffName: found.name,
          staffRole: found.role || "admin",
          branchName: found.branchName || "الفرع الرئيسي",
        };
      }
    }
  } catch (e) {
    // ignore
  }
  return { staffId: "staff-admin-main", staffName: "المدير العام (المالك)", staffRole: "admin", branchName: "الفرع الرئيسي" };
}

/**
 * Global helper to record any system or user activity
 */
export function recordAuditLog(entry: Partial<AuditLogEntry> & { action: AuditActionType; module: AuditModule; title: string }) {
  const staff = getActiveStaffSnapshot();
  const newLog: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    severity: entry.severity || "info",
    staffId: entry.staffId || staff.staffId,
    staffName: entry.staffName || staff.staffName,
    staffRole: entry.staffRole || staff.staffRole,
    branchName: entry.branchName || staff.branchName,
    ...entry,
  };

  const current = loadAuditLogs();
  const next = [newLog, ...current];
  saveAuditLogs(next);
  return newLog;
}

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(loadAuditLogs);

  const reload = useCallback(() => {
    setLogs(loadAuditLogs());
  }, []);

  useEffect(() => {
    window.addEventListener("segilly_audit_updated", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("segilly_audit_updated", reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  const clearLogs = useCallback(() => {
    saveAuditLogs([]);
    setLogs([]);
  }, []);

  const addLog = useCallback((entry: Omit<AuditLogEntry, "id" | "timestamp">) => {
    return recordAuditLog(entry);
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayLogs = logs.filter((l) => l.timestamp.startsWith(today));
    const warnings = logs.filter((l) => l.severity === "warning" || l.severity === "danger" || l.severity === "critical");
    const staffActions = new Map<string, number>();

    logs.forEach((l) => {
      staffActions.set(l.staffName, (staffActions.get(l.staffName) ?? 0) + 1);
    });

    return {
      total: logs.length,
      todayCount: todayLogs.length,
      warningCount: warnings.length,
      staffActionCounts: Array.from(staffActions.entries()).map(([name, count]) => ({ name, count })),
    };
  }, [logs]);

  return {
    logs,
    stats,
    addLog,
    clearLogs,
    reload,
  };
}

export const ACTION_TYPE_META: Record<
  AuditActionType,
  { label: string; module: AuditModule; severity: AuditSeverity; iconName: string }
> = {
  INVOICE_CREATE: { label: "إصدار فاتورة بيع", module: "invoices", severity: "info", iconName: "FilePlus" },
  INVOICE_UPDATE: { label: "تعديل بيانات فاتورة", module: "invoices", severity: "warning", iconName: "FileEdit" },
  INVOICE_DELETE: { label: "حذف فاتورة بيع", module: "invoices", severity: "critical", iconName: "FileX" },
  PAYMENT_COLLECT: { label: "تحصيل دفعة أو قسط", module: "payments", severity: "info", iconName: "CheckCircle2" },
  PAYMENT_DELETE: { label: "إلغاء أو حذف دفعة", module: "payments", severity: "danger", iconName: "Trash2" },
  CUSTOMER_CREATE: { label: "إضافة عميل جديد", module: "customers", severity: "info", iconName: "UserPlus" },
  CUSTOMER_UPDATE: { label: "تعديل بيانات عميل", module: "customers", severity: "info", iconName: "UserCheck" },
  CUSTOMER_DELETE: { label: "حذف عميل من النظام", module: "customers", severity: "danger", iconName: "UserX" },
  STOCK_CREATE: { label: "إضافة صنف جديد بالمخزن", module: "inventory", severity: "info", iconName: "PackagePlus" },
  STOCK_UPDATE: { label: "تعديل سعر أو بيانات منتج", module: "inventory", severity: "warning", iconName: "PackageCheck" },
  STOCK_DELETE: { label: "حذف صنف من المخزن", module: "inventory", severity: "danger", iconName: "PackageX" },
  STOCK_DELTA: { label: "تسوية كميات الجرد والمخزن", module: "inventory", severity: "warning", iconName: "Layers" },
  EXPENSE_CREATE: { label: "تسجيل مصروف من الخزينة", module: "expenses", severity: "warning", iconName: "Receipt" },
  RETURN_CREATE: { label: "معالجة مرتجع بضاعة", module: "returns", severity: "warning", iconName: "RotateCcw" },
  DISCOUNT_APPLIED: { label: "تطبيق خصم أو كوبون", module: "discounts", severity: "warning", iconName: "Tag" },
  LOYALTY_REDEEM: { label: "استبدال نقاط ولاء العميل", module: "discounts", severity: "info", iconName: "Gift" },
  SHIFT_OPEN: { label: "فتح وردية كاشير", module: "staff", severity: "info", iconName: "Unlock" },
  SHIFT_CLOSE: { label: "إغلاق وردية وجرد الدرج", module: "staff", severity: "warning", iconName: "Lock" },
  SETTINGS_UPDATE: { label: "تعديل إعدادات النظام الحساسة", module: "settings", severity: "danger", iconName: "Sliders" },
  PRICE_OVERRIDE: { label: "تغيير سعر بيع مباشر في الكاشير", module: "invoices", severity: "danger", iconName: "AlertTriangle" },
};

export const MODULE_META: Record<AuditModule, { label: string; color: string }> = {
  invoices: { label: "الفواتير والمبيعات", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  payments: { label: "التحصيلات والدفعات", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  customers: { label: "العملاء والحسابات", color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
  inventory: { label: "المخزن والمنتجات", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  expenses: { label: "المصروفات والخزينة", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
  returns: { label: "المرتجعات", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
  discounts: { label: "الخصومات والولاء", color: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
  staff: { label: "الموظفين والورديات", color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
  settings: { label: "إعدادات النظام", color: "text-slate-500 bg-slate-500/10 border-slate-500/20" },
};
