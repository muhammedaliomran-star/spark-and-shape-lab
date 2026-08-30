import { useState, useEffect, useCallback, useMemo } from "react";
import { useDB, type Invoice, type Expense, type Payment } from "@/lib/store";

export type StaffRole = "admin" | "manager" | "cashier";

export interface StaffPermissions {
  canChangePrice: boolean; // السماح بتعديل سعر بيع الصنف
  canViewCostAndProfit: boolean; // السماح بالاطلاع على التكلفة والربح
  canDeleteInvoice: boolean; // السماح بحذف الفاتورة
  canGiveCustomDiscount: boolean; // السماح بعمل خصم حر
  maxDiscountPct: number; // أقصى نسبة خصم مسموحة للكاشير مثلا 5%
  canAccessReports: boolean; // الوصول للتقارير الشاملة
  canAccessSettings: boolean; // الوصول للإعدادات الحساسة
  canOpenCloseShift: boolean; // فتح وإغلاق الوردية
  canRefundInvoice: boolean; // إنشاء وعمل مرتجع
}

export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  admin: {
    canChangePrice: true,
    canViewCostAndProfit: true,
    canDeleteInvoice: true,
    canGiveCustomDiscount: true,
    maxDiscountPct: 100,
    canAccessReports: true,
    canAccessSettings: true,
    canOpenCloseShift: true,
    canRefundInvoice: true,
  },
  manager: {
    canChangePrice: true,
    canViewCostAndProfit: true,
    canDeleteInvoice: false,
    canGiveCustomDiscount: true,
    maxDiscountPct: 25,
    canAccessReports: true,
    canAccessSettings: false,
    canOpenCloseShift: true,
    canRefundInvoice: true,
  },
  cashier: {
    canChangePrice: false,
    canViewCostAndProfit: false,
    canDeleteInvoice: false,
    canGiveCustomDiscount: false,
    maxDiscountPct: 5,
    canAccessReports: false,
    canAccessSettings: false,
    canOpenCloseShift: true,
    canRefundInvoice: false,
  },
};

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: StaffRole;
  pinCode?: string; // 4-digit fast lock PIN
  branchId?: string;
  branchName?: string;
  active: boolean;
  notes?: string;
  permissions: StaffPermissions;
  commissionRatePct?: number; // نسبة عمولة المبيعات للبائع مثلا 2%
  baseSalary?: number; // الراتب الأساسي
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  branchName: string;
  date: string; // YYYY-MM-DD
  clockIn: string; // ISO string
  clockOut?: string | null; // ISO string
  totalHours?: number; // ساعات العمل
  notes?: string;
  status: "present" | "late" | "left_early" | "completed";
}

export interface ShiftDrawerCount {
  denomination1?: number; // فئة 1 ج.م
  denomination5?: number; // فئة 5 ج.م
  denomination10?: number; // فئة 10 ج.م
  denomination20?: number; // فئة 20 ج.م
  denomination50?: number; // فئة 50 ج.م
  denomination100?: number; // فئة 100 ج.م
  denomination200?: number; // فئة 200 ج.م
}

export interface ShiftRecord {
  id: string;
  shiftNumber: number;
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  branchId?: string;
  branchName?: string;
  openedAt: string;
  closedAt?: string | null;
  status: "open" | "closed";
  
  // Financial breakdown
  openingFloat: number; // رصيد البداية بالدرج
  actualClosingCash: number; // المبلغ الفعلي الذي تم عده بالدرج عند الإغلاق
  
  // Computed at close
  expectedClosingCash: number; // رصيد البداية + الكاش المحصل - المصروفات النقدية
  cashVariance: number; // actualClosingCash - expectedClosingCash (+ زيادة, - عجز)
  
  totalCashSales: number; // مبيعات كاش
  totalCardSales: number; // مبيعات فيزا/بطاقة
  totalInstallmentSales: number; // مبيعات أقساط/آجل
  totalGrossSales: number; // إجمالي كل المبيعات
  
  totalDiscountsGiven: number; // مجموع الخصومات
  totalRefundsAmount: number; // مجموع المرتجعات
  totalExpensesAmount: number; // مصروفات مسحوبة من الدرج
  
  invoicesCount: number; // عدد فواتير الوردية
  refundsCount: number; // عدد المرتجعات
  
  closeNotes?: string;
  denominationCounts?: ShiftDrawerCount;
}

const STORAGE_KEY_STAFF = "segilly_staff_members_v1";
const STORAGE_KEY_SHIFTS = "segilly_shifts_records_v1";
const STORAGE_KEY_ACTIVE_STAFF_ID = "segilly_active_staff_id_v1";
const STORAGE_KEY_ATTENDANCE = "segilly_staff_attendance_v1";

const DEFAULT_STAFF: StaffMember[] = [
  {
    id: "staff-admin-main",
    name: "المدير العام (المالك)",
    phone: "01000000000",
    role: "admin",
    pinCode: "1234",
    branchName: "الفرع الرئيسي",
    active: true,
    commissionRatePct: 0,
    baseSalary: 0,
    permissions: ROLE_DEFAULT_PERMISSIONS.admin,
    createdAt: new Date().toISOString(),
  },
  {
    id: "staff-cashier-1",
    name: "أحمد كاشير (نقطة البيع)",
    phone: "01112223344",
    role: "cashier",
    pinCode: "0000",
    branchName: "الفرع الرئيسي",
    active: true,
    commissionRatePct: 2.5,
    baseSalary: 4500,
    permissions: ROLE_DEFAULT_PERMISSIONS.cashier,
    createdAt: new Date().toISOString(),
  },
  {
    id: "staff-mgr-1",
    name: "محمود المشرف",
    phone: "01223344556",
    role: "manager",
    pinCode: "5555",
    branchName: "الفرع الرئيسي",
    active: true,
    commissionRatePct: 1.0,
    baseSalary: 6000,
    permissions: ROLE_DEFAULT_PERMISSIONS.manager,
    createdAt: new Date().toISOString(),
  },
];

function loadStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to load ${key}`, e);
    return defaultValue;
  }
}

function saveStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("segilly_staff_shifts_updated"));
  } catch (e) {
    console.error(`Failed to save ${key}`, e);
  }
}

export function useStaffAndShifts() {
  const [staffList, setStaffList] = useState<StaffMember[]>(() =>
    loadStorage(STORAGE_KEY_STAFF, DEFAULT_STAFF)
  );
  const [shifts, setShifts] = useState<ShiftRecord[]>(() =>
    loadStorage(STORAGE_KEY_SHIFTS, [])
  );
  const [activeStaffId, setActiveStaffId] = useState<string>(() =>
    loadStorage(STORAGE_KEY_ACTIVE_STAFF_ID, DEFAULT_STAFF[0].id)
  );
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() =>
    loadStorage(STORAGE_KEY_ATTENDANCE, [])
  );

  const { invoices, expenses, payments } = useDB();

  const reloadAll = useCallback(() => {
    setStaffList(loadStorage(STORAGE_KEY_STAFF, DEFAULT_STAFF));
    setShifts(loadStorage(STORAGE_KEY_SHIFTS, []));
    setActiveStaffId(loadStorage(STORAGE_KEY_ACTIVE_STAFF_ID, DEFAULT_STAFF[0].id));
    setAttendance(loadStorage(STORAGE_KEY_ATTENDANCE, []));
  }, []);

  useEffect(() => {
    window.addEventListener("segilly_staff_shifts_updated", reloadAll);
    window.addEventListener("storage", reloadAll);
    return () => {
      window.removeEventListener("segilly_staff_shifts_updated", reloadAll);
      window.removeEventListener("storage", reloadAll);
    };
  }, [reloadAll]);

  // Active current logged in staff member
  const currentStaff = useMemo(() => {
    return staffList.find((s) => s.id === activeStaffId) || staffList[0] || DEFAULT_STAFF[0];
  }, [staffList, activeStaffId]);

  // Current active open shift (if any)
  const currentOpenShift = useMemo(() => {
    return shifts.find((s) => s.status === "open");
  }, [shifts]);

  // Attendance status of today for the active staff
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayAttendance = useMemo(() => {
    return attendance.find((a) => a.staffId === currentStaff.id && a.date === todayStr);
  }, [attendance, currentStaff.id, todayStr]);

  // Calculate live financial summary for the currently open shift
  const currentShiftLiveStats = useMemo(() => {
    if (!currentOpenShift) return null;

    const openTime = new Date(currentOpenShift.openedAt).getTime();

    // Invoices created after shift opened
    const shiftInvoices = invoices.filter((inv) => {
      const invTime = new Date(inv.date || inv.id).getTime();
      return !isNaN(invTime) ? invTime >= openTime : true;
    });

    let totalCashSales = 0;
    let totalCardSales = 0;
    let totalInstallmentSales = 0;
    let totalDiscountsGiven = 0;

    shiftInvoices.forEach((inv) => {
      const total = Number(inv.total || 0);
      const paid = Number(inv.paid || 0);
      const discount = Number(inv.discountAmount || 0);
      totalDiscountsGiven += discount;

      // Classify payment method
      const pMethod = (inv.paymentMethod || "cash").toLowerCase();
      if (pMethod === "visa" || pMethod === "card" || pMethod === "bank" || pMethod === "instapay") {
        totalCardSales += paid;
      } else {
        totalCashSales += paid;
      }

      if (total > paid) {
        totalInstallmentSales += total - paid;
      }
    });

    // Expenses during shift
    const shiftExpenses = expenses.filter((exp) => {
      const expTime = new Date(exp.date || exp.id).getTime();
      return !isNaN(expTime) ? expTime >= openTime : false;
    });
    const totalExpensesAmount = shiftExpenses.reduce((acc, exp) => acc + Number(exp.amount || 0), 0);

    const totalGrossSales = totalCashSales + totalCardSales + totalInstallmentSales;
    const expectedDrawerCash = currentOpenShift.openingFloat + totalCashSales - totalExpensesAmount;

    return {
      shiftInvoices,
      invoicesCount: shiftInvoices.length,
      totalCashSales,
      totalCardSales,
      totalInstallmentSales,
      totalGrossSales,
      totalDiscountsGiven,
      totalExpensesAmount,
      expectedDrawerCash,
      durationHours: Math.max(
        0.1,
        (Date.now() - openTime) / (1000 * 60 * 60)
      ),
    };
  }, [currentOpenShift, invoices, expenses]);

  // Calculate Monthly Staff Commissions and Performance Metrics
  const staffCommissions = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    return staffList.map((st) => {
      // Find all shifts closed by this staff in current month
      const staffShifts = shifts.filter((s) => {
        return (
          s.staffId === st.id &&
          s.openedAt.startsWith(currentMonth)
        );
      });

      // Sum total sales achieved during their shifts
      const totalMonthSales = staffShifts.reduce((acc, s) => acc + (s.totalGrossSales || 0), 0);
      const totalInvoices = staffShifts.reduce((acc, s) => acc + (s.invoicesCount || 0), 0);
      const totalHours = staffShifts.reduce((acc, s) => {
        if (!s.closedAt) return acc + 1;
        const dur = (new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime()) / (1000 * 60 * 60);
        return acc + Math.max(0, dur);
      }, 0);

      const rate = st.commissionRatePct || 0;
      const commissionEarned = (totalMonthSales * rate) / 100;
      const baseSalary = st.baseSalary || 0;
      const totalPayout = baseSalary + commissionEarned;

      return {
        staff: st,
        shiftsCount: staffShifts.length,
        totalMonthSales,
        totalInvoices,
        totalHours: Math.round(totalHours * 10) / 10,
        commissionRate: rate,
        commissionEarned,
        baseSalary,
        totalPayout,
      };
    });
  }, [staffList, shifts]);

  // Switch active staff member
  const switchActiveStaff = useCallback((id: string) => {
    setActiveStaffId(id);
    saveStorage(STORAGE_KEY_ACTIVE_STAFF_ID, id);
  }, []);

  // CRUD Staff
  const addStaff = useCallback((input: Omit<StaffMember, "id" | "createdAt">) => {
    const newStaff: StaffMember = {
      ...input,
      id: `staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setStaffList((prev) => {
      const next = [...prev, newStaff];
      saveStorage(STORAGE_KEY_STAFF, next);
      return next;
    });
    return newStaff;
  }, []);

  const updateStaff = useCallback((id: string, patch: Partial<StaffMember>) => {
    setStaffList((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      saveStorage(STORAGE_KEY_STAFF, next);
      return next;
    });
  }, []);

  const deleteStaff = useCallback((id: string) => {
    setStaffList((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveStorage(STORAGE_KEY_STAFF, next);
      return next;
    });
  }, []);

  // CLOCK IN / CLOCK OUT ACTIONS
  const clockIn = useCallback(
    (targetStaff?: StaffMember, notes?: string) => {
      const st = targetStaff || currentStaff;
      const today = new Date().toISOString().slice(0, 10);
      const existing = attendance.find((a) => a.staffId === st.id && a.date === today);

      if (existing) {
        throw new Error(`تم تسجيل حضور ${st.name} بالفعل اليوم الساعة ${new Date(existing.clockIn).toLocaleTimeString("ar-EG")}`);
      }

      const newRecord: AttendanceRecord = {
        id: `att-${Date.now()}`,
        staffId: st.id,
        staffName: st.name,
        branchName: st.branchName || "الفرع الرئيسي",
        date: today,
        clockIn: new Date().toISOString(),
        clockOut: null,
        status: "present",
        notes,
      };

      setAttendance((prev) => {
        const next = [newRecord, ...prev];
        saveStorage(STORAGE_KEY_ATTENDANCE, next);
        return next;
      });

      return newRecord;
    },
    [attendance, currentStaff]
  );

  const clockOut = useCallback(
    (targetStaff?: StaffMember, notes?: string) => {
      const st = targetStaff || currentStaff;
      const today = new Date().toISOString().slice(0, 10);
      const existing = attendance.find((a) => a.staffId === st.id && a.date === today);

      if (!existing) {
        throw new Error(`لم يتم تسجيل حضور ${st.name} اليوم حتى يتم تسجيل الانصراف.`);
      }

      if (existing.clockOut) {
        throw new Error(`تم تسجيل انصراف ${st.name} مسبقاً الساعة ${new Date(existing.clockOut).toLocaleTimeString("ar-EG")}`);
      }

      const outTime = new Date();
      const inTime = new Date(existing.clockIn);
      const hours = Math.max(0.1, (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60));

      const updatedRecord: AttendanceRecord = {
        ...existing,
        clockOut: outTime.toISOString(),
        totalHours: Math.round(hours * 100) / 100,
        status: "completed",
        notes: notes || existing.notes,
      };

      setAttendance((prev) => {
        const next = prev.map((a) => (a.id === existing.id ? updatedRecord : a));
        saveStorage(STORAGE_KEY_ATTENDANCE, next);
        return next;
      });

      return updatedRecord;
    },
    [attendance, currentStaff]
  );

  // SHIFT MANAGEMENT ACTIONS
  const startNewShift = useCallback(
    (openingFloat: number, staff?: StaffMember, branchName?: string) => {
      if (currentOpenShift) {
        throw new Error("توجد وردية نشطة بالفعل، يرجى إغلاقها أولاً قبل فتح وردية جديدة.");
      }

      const activeUser = staff || currentStaff;
      const shiftNum = shifts.length + 1;

      const newShift: ShiftRecord = {
        id: `shift-${Date.now()}`,
        shiftNumber: shiftNum,
        staffId: activeUser.id,
        staffName: activeUser.name,
        staffRole: activeUser.role,
        branchName: branchName || activeUser.branchName || "الفرع الرئيسي",
        openedAt: new Date().toISOString(),
        closedAt: null,
        status: "open",
        openingFloat: Math.max(0, openingFloat),
        actualClosingCash: 0,
        expectedClosingCash: Math.max(0, openingFloat),
        cashVariance: 0,
        totalCashSales: 0,
        totalCardSales: 0,
        totalInstallmentSales: 0,
        totalGrossSales: 0,
        totalDiscountsGiven: 0,
        totalRefundsAmount: 0,
        totalExpensesAmount: 0,
        invoicesCount: 0,
        refundsCount: 0,
      };

      setShifts((prev) => {
        const next = [newShift, ...prev];
        saveStorage(STORAGE_KEY_SHIFTS, next);
        return next;
      });

      return newShift;
    },
    [currentOpenShift, currentStaff, shifts.length]
  );

  const closeCurrentShift = useCallback(
    (actualCountedCash: number, closeNotes?: string, denominations?: ShiftDrawerCount) => {
      if (!currentOpenShift) {
        throw new Error("لا توجد وردية مفتوحة حالياً لإغلاقها.");
      }

      const live = currentShiftLiveStats;
      const expected = live ? live.expectedDrawerCash : currentOpenShift.openingFloat;
      const variance = actualCountedCash - expected;

      const closedRecord: ShiftRecord = {
        ...currentOpenShift,
        closedAt: new Date().toISOString(),
        status: "closed",
        actualClosingCash: actualCountedCash,
        expectedClosingCash: expected,
        cashVariance: variance,
        totalCashSales: live ? live.totalCashSales : 0,
        totalCardSales: live ? live.totalCardSales : 0,
        totalInstallmentSales: live ? live.totalInstallmentSales : 0,
        totalGrossSales: live ? live.totalGrossSales : 0,
        totalDiscountsGiven: live ? live.totalDiscountsGiven : 0,
        totalExpensesAmount: live ? live.totalExpensesAmount : 0,
        invoicesCount: live ? live.invoicesCount : 0,
        closeNotes,
        denominationCounts: denominations,
      };

      setShifts((prev) => {
        const next = prev.map((s) => (s.id === currentOpenShift.id ? closedRecord : s));
        saveStorage(STORAGE_KEY_SHIFTS, next);
        return next;
      });

      return closedRecord;
    },
    [currentOpenShift, currentShiftLiveStats]
  );

  // Quick PIN Unlock Verification
  const verifyPin = useCallback(
    (enteredPin: string, targetStaffId?: string): boolean => {
      const target = targetStaffId
        ? staffList.find((s) => s.id === targetStaffId)
        : currentStaff;
      if (!target || !target.pinCode) return true; // If no PIN set, allow
      return target.pinCode.trim() === enteredPin.trim();
    },
    [staffList, currentStaff]
  );

  return {
    staffList,
    currentStaff,
    currentOpenShift,
    currentShiftLiveStats,
    shifts,
    attendance,
    todayAttendance,
    staffCommissions,
    switchActiveStaff,
    addStaff,
    updateStaff,
    deleteStaff,
    clockIn,
    clockOut,
    startNewShift,
    closeCurrentShift,
    verifyPin,
  };
}
