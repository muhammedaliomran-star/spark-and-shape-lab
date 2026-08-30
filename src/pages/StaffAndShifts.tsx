import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { usePrivacy } from "@/lib/privacy";
import { useDB, fmt, useShopSettings } from "@/lib/store";
import {
  useStaffAndShifts,
  type StaffMember,
  type StaffRole,
  type ShiftRecord,
  type AttendanceRecord,
  ROLE_DEFAULT_PERMISSIONS,
} from "@/lib/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Users,
  ShieldCheck,
  Clock,
  KeyRound,
  Plus,
  Play,
  Square,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Coins,
  Receipt,
  UserCheck,
  Calendar,
  CreditCard,
  Edit2,
  Trash2,
  DollarSign,
  TrendingUp,
  ArrowRightLeft,
  Search,
  Percent,
  Timer,
  LogIn,
  LogOut,
  Award,
} from "lucide-react";

type StaffPageTab = "live-shift" | "shifts-history" | "staff-list" | "commissions" | "attendance";

export default function StaffAndShifts() {
  const { privacy } = usePrivacy();
  const { settings: shop } = useShopSettings();
  const {
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
  } = useStaffAndShifts();

  const [activeTab, setActiveTab] = useState<StaffPageTab>("live-shift");
  const [historySearch, setHistorySearch] = useState("");
  const [attendanceSearch, setAttendanceSearch] = useState("");

  // Start Shift Modal State
  const [isOpenStartShift, setIsOpenStartShift] = useState(false);
  const [startOpeningFloat, setStartOpeningFloat] = useState("500");
  const [startStaffId, setStartStaffId] = useState(currentStaff.id);
  const [startBranchName, setStartBranchName] = useState("الفرع الرئيسي");

  // Close Shift Modal State
  const [isOpenCloseShift, setIsOpenCloseShift] = useState(false);
  const [actualDrawerCash, setActualDrawerCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  // Z-Report Print Modal
  const [selectedZReportShift, setSelectedZReportShift] = useState<ShiftRecord | null>(null);

  // Staff CRUD Modal State
  const [isOpenStaffModal, setIsOpenStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deleteTargetStaffId, setDeleteTargetStaffId] = useState<string | null>(null);

  // Staff Form
  const [staffName, setStaffName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRole>("cashier");
  const [staffPin, setStaffPin] = useState("0000");
  const [staffBranch, setStaffBranch] = useState("الفرع الرئيسي");
  const [staffCommissionRate, setStaffCommissionRate] = useState("2");
  const [staffBaseSalary, setStaffBaseSalary] = useState("4000");
  const [permChangePrice, setPermChangePrice] = useState(false);
  const [permViewCost, setPermViewCost] = useState(false);
  const [permDeleteInv, setPermDeleteInv] = useState(false);
  const [permDiscount, setPermDiscount] = useState(false);
  const [permMaxDiscount, setPermMaxDiscount] = useState("5");
  const [permReports, setPermReports] = useState(false);

  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  // Filtered shifts history
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      const matchSearch =
        s.staffName.toLowerCase().includes(historySearch.toLowerCase()) ||
        String(s.shiftNumber).includes(historySearch) ||
        (s.branchName && s.branchName.toLowerCase().includes(historySearch.toLowerCase()));
      return matchSearch;
    });
  }, [shifts, historySearch]);

  // Filtered Attendance history
  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      return (
        a.staffName.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
        a.date.includes(attendanceSearch) ||
        (a.branchName && a.branchName.toLowerCase().includes(attendanceSearch.toLowerCase()))
      );
    });
  }, [attendance, attendanceSearch]);

  const handleRoleChange = (role: StaffRole) => {
    setStaffRole(role);
    const def = ROLE_DEFAULT_PERMISSIONS[role];
    setPermChangePrice(def.canChangePrice);
    setPermViewCost(def.canViewCostAndProfit);
    setPermDeleteInv(def.canDeleteInvoice);
    setPermDiscount(def.canGiveCustomDiscount);
    setPermMaxDiscount(String(def.maxDiscountPct));
    setPermReports(def.canAccessReports);
  };

  const handleOpenNewStaff = () => {
    setEditingStaff(null);
    setStaffName("");
    setStaffPhone("");
    handleRoleChange("cashier");
    setStaffPin("0000");
    setStaffBranch("الفرع الرئيسي");
    setStaffCommissionRate("2");
    setStaffBaseSalary("4500");
    setIsOpenStaffModal(true);
  };

  const handleEditStaff = (st: StaffMember) => {
    setEditingStaff(st);
    setStaffName(st.name);
    setStaffPhone(st.phone);
    setStaffRole(st.role);
    setStaffPin(st.pinCode || "");
    setStaffBranch(st.branchName || "الفرع الرئيسي");
    setStaffCommissionRate(String(st.commissionRatePct || 0));
    setStaffBaseSalary(String(st.baseSalary || 0));
    setPermChangePrice(st.permissions.canChangePrice);
    setPermViewCost(st.permissions.canViewCostAndProfit);
    setPermDeleteInv(st.permissions.canDeleteInvoice);
    setPermDiscount(st.permissions.canGiveCustomDiscount);
    setPermMaxDiscount(String(st.permissions.maxDiscountPct));
    setPermReports(st.permissions.canAccessReports);
    setIsOpenStaffModal(true);
  };

  const handleSaveStaff = () => {
    if (!staffName.trim()) return toast.error("يرجى إدخال اسم الموظف");
    if (!staffPhone.trim()) return toast.error("يرجى إدخال رقم الهاتف");

    const customPerms = {
      canChangePrice: permChangePrice,
      canViewCostAndProfit: permViewCost,
      canDeleteInvoice: permDeleteInv,
      canGiveCustomDiscount: permDiscount,
      maxDiscountPct: Number(permMaxDiscount) || 5,
      canAccessReports: permReports,
      canAccessSettings: staffRole === "admin",
      canOpenCloseShift: true,
      canRefundInvoice: staffRole !== "cashier",
    };

    if (editingStaff) {
      updateStaff(editingStaff.id, {
        name: staffName.trim(),
        phone: staffPhone.trim(),
        role: staffRole,
        pinCode: staffPin.trim() || undefined,
        branchName: staffBranch.trim() || "الفرع الرئيسي",
        commissionRatePct: Number(staffCommissionRate) || 0,
        baseSalary: Number(staffBaseSalary) || 0,
        permissions: customPerms,
      });
      toast.success("تم تحديث بيانات وصلاحيات وعمولة الموظف");
    } else {
      addStaff({
        name: staffName.trim(),
        phone: staffPhone.trim(),
        role: staffRole,
        pinCode: staffPin.trim() || undefined,
        branchName: staffBranch.trim() || "الفرع الرئيسي",
        active: true,
        commissionRatePct: Number(staffCommissionRate) || 0,
        baseSalary: Number(staffBaseSalary) || 0,
        permissions: customPerms,
      });
      toast.success("تمت إضافة الموظف الجديد بنجاح ✓");
    }

    setIsOpenStaffModal(false);
  };

  const handleClockIn = () => {
    try {
      clockIn(currentStaff);
      toast.success(`تم تسجيل حضور ${currentStaff.name} بنجاح الساعة ${new Date().toLocaleTimeString("ar-EG")}`);
    } catch (e: any) {
      toast.error(e.message || "فشل تسجيل الحضور");
    }
  };

  const handleClockOut = () => {
    try {
      clockOut(currentStaff);
      toast.success(`تم تسجيل انصراف ${currentStaff.name} بنجاح الساعة ${new Date().toLocaleTimeString("ar-EG")}`);
    } catch (e: any) {
      toast.error(e.message || "فشل تسجيل الانصراف");
    }
  };

  const handleConfirmStartShift = () => {
    const floatVal = Number(startOpeningFloat);
    if (isNaN(floatVal) || floatVal < 0) return toast.error("يرجى إدخال رصيد بداية صحيح للدرج");
    const st = staffList.find((s) => s.id === startStaffId);

    try {
      startNewShift(floatVal, st, startBranchName);
      toast.success("تم فتح وردية جديدة بنجاح! جاهز لتسجيل المبيعات.");
      setIsOpenStartShift(false);
      setActiveTab("live-shift");
    } catch (err: any) {
      toast.error(err.message || "فشل فتح الوردية");
    }
  };

  const handleConfirmCloseShift = () => {
    const countedVal = Number(actualDrawerCash);
    if (isNaN(countedVal) || countedVal < 0) return toast.error("يرجى إدخال المبلغ الفعلي المعدود بالدرج");

    try {
      const closed = closeCurrentShift(countedVal, closeNotes);
      toast.success("تم إغلاق الوردية وحساب العجز/الزيادة بنجاح ✓");
      setIsOpenCloseShift(false);
      setSelectedZReportShift(closed);
    } catch (err: any) {
      toast.error(err.message || "فشل إغلاق الوردية");
    }
  };

  const printZReport = () => {
    window.print();
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="space-y-6 pb-12">
          {/* Header */}
          <PageHeader
            title="الموظفين والورديات والعمولات"
            subtitle="إدارة الكاشير، تقرير Z-Report، حساب عمولات ومكافآت المبيعات، وتسجيل الحضور والانصراف السريع"
            badge="الرقابة ونقاط البيع"
            actions={
              <div className="flex items-center gap-2">
                {currentOpenShift ? (
                  <Button
                    onClick={() => {
                      setActualDrawerCash(
                        currentShiftLiveStats ? String(Math.round(currentShiftLiveStats.expectedDrawerCash)) : "0"
                      );
                      setCloseNotes("");
                      setIsOpenCloseShift(true);
                    }}
                    size="sm"
                    className="gap-1.5 rounded-xl font-bold bg-danger text-danger-foreground hover:bg-danger/90 shadow-sm"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    تسليم وإغلاق الوردية
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setStartOpeningFloat("500");
                      setStartStaffId(currentStaff.id);
                      setIsOpenStartShift(true);
                    }}
                    size="sm"
                    className="gap-1.5 rounded-xl font-bold bg-success text-success-foreground hover:bg-success/90 shadow-sm"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    فتح وردية جديدة
                  </Button>
                )}

                <Button
                  onClick={handleOpenNewStaff}
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl font-bold border-border/50 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  موظف جديد
                </Button>
              </div>
            }
          />

          {/* Quick Active Staff Switcher Pill & Clock-In Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-card/60 border border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">المستخدم النشط حالياً:</div>
                <div className="text-sm font-bold text-foreground flex items-center gap-2">
                  {currentStaff.name}
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold py-0.5",
                      currentStaff.role === "admin"
                        ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                        : currentStaff.role === "manager"
                        ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    )}
                  >
                    {currentStaff.role === "admin" ? "مدير عام" : currentStaff.role === "manager" ? "مشرف فرع" : "كاشير / بائع"}
                  </Badge>
                  {currentStaff.commissionRatePct ? (
                    <Badge variant="secondary" className="text-[9px] font-mono">
                      عمولة {currentStaff.commissionRatePct}%
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Fast Clock-In / Clock-Out & Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Clock In / Out Buttons */}
              {!todayAttendance ? (
                <Button
                  onClick={handleClockIn}
                  size="sm"
                  className="gap-1.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  تسجيل حضور اليوم (Clock-In)
                </Button>
              ) : !todayAttendance.clockOut ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                    حاضر منذ {new Date(todayAttendance.clockIn).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <Button
                    onClick={handleClockOut}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-xl font-bold border-danger/40 text-danger hover:bg-danger/10 h-9 text-xs"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    تسجيل انصراف
                  </Button>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg">
                  تم الانصراف ({todayAttendance.totalHours} ساعة عمل)
                </span>
              )}

              {/* Staff Selector */}
              <Select value={currentStaff.id} onValueChange={switchActiveStaff}>
                <SelectTrigger className="w-44 h-9 text-xs rounded-xl border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((st) => (
                    <SelectItem key={st.id} value={st.id} className="text-xs">
                      {st.name} ({st.role === "admin" ? "مدير" : st.role === "manager" ? "مشرف" : "كاشير"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 border border-border/40 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("live-shift")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "live-shift"
                  ? "bg-card text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <Clock className="w-3.5 h-3.5 text-primary" />
              الوردية الحالية
              {currentOpenShift && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("commissions")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "commissions"
                  ? "bg-card text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <Award className="w-3.5 h-3.5 text-primary" />
              عمولات ومكافآت المبيعات
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "attendance"
                  ? "bg-card text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <Timer className="w-3.5 h-3.5 text-primary" />
              سجل الحضور والانصراف ({attendance.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("shifts-history")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "shifts-history"
                  ? "bg-card text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <Calendar className="w-3.5 h-3.5 text-primary" />
              أرشيف الورديات ({shifts.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("staff-list")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === "staff-list"
                  ? "bg-card text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              الموظفين والصلاحيات ({staffList.length})
            </button>
          </div>

          {/* TAB 1: LIVE SHIFT */}
          {activeTab === "live-shift" && (
            <div className="space-y-6">
              {currentOpenShift ? (
                <>
                  {/* Live Shift KPI Cards */}
                  <Reveal>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
                      <BezelCard
                        label="النقدية المتوقعة بالدرج"
                        icon={Coins}
                        value={
                          <span className={cn("font-mono font-black tabular-nums text-success text-xl", blurCls)}>
                            <CountUp value={currentShiftLiveStats?.expectedDrawerCash || 0} /> ج.م
                          </span>
                        }
                        sub={`بدء بـ ${fmt(currentOpenShift.openingFloat)} ج.م`}
                      />

                      <BezelCard
                        label="إجمالي مبيعات الوردية"
                        icon={TrendingUp}
                        value={
                          <span className={cn("font-mono font-bold tabular-nums text-foreground", blurCls)}>
                            <CountUp value={currentShiftLiveStats?.totalGrossSales || 0} /> ج.م
                          </span>
                        }
                        sub={`${currentShiftLiveStats?.invoicesCount || 0} فواتير مسجلة`}
                      />

                      <BezelCard
                        label="تحصيلات الكاش والفيزا"
                        icon={CreditCard}
                        value={
                          <span className={cn("font-mono font-bold tabular-nums text-primary", blurCls)}>
                            {fmt(currentShiftLiveStats?.totalCashSales || 0)} كاش
                          </span>
                        }
                        sub={`${fmt(currentShiftLiveStats?.totalCardSales || 0)} ج.م إلكتروني`}
                      />

                      <BezelCard
                        label="مدة الوردية الحالية"
                        icon={Clock}
                        value={
                          <span className="font-mono font-bold tabular-nums text-warning">
                            {new Date(currentOpenShift.openedAt).toLocaleTimeString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        }
                        sub={`كاشير: ${currentOpenShift.staffName}`}
                      />
                    </div>
                  </Reveal>

                  {/* Live Shift Detailed Status Box */}
                  <div className="p-5 rounded-2xl border border-border/40 bg-card/60 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-3">
                      <div>
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          وردية رقم #{currentOpenShift.shiftNumber} مفتوحة ونشطة
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          تاريخ البدء: {new Date(currentOpenShift.openedAt).toLocaleString("ar-EG")} — الفرع: {currentOpenShift.branchName}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => {
                            setActualDrawerCash(
                              currentShiftLiveStats ? String(Math.round(currentShiftLiveStats.expectedDrawerCash)) : "0"
                            );
                            setCloseNotes("");
                            setIsOpenCloseShift(true);
                          }}
                          size="sm"
                          className="gap-1.5 rounded-xl font-bold bg-danger text-danger-foreground text-xs"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          إنهاء الوردية وجرد الدرج (Z-Report)
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 text-xs">
                      <div className="p-3 rounded-xl bg-background/50 border border-border/30 space-y-1">
                        <span className="text-muted-foreground block">رصيد عهدة البداية (Float):</span>
                        <strong className="text-sm font-mono">{fmt(currentOpenShift.openingFloat)} ج.م</strong>
                      </div>

                      <div className="p-3 rounded-xl bg-background/50 border border-border/30 space-y-1">
                        <span className="text-muted-foreground block">إجمالي الخصومات الممنوحة:</span>
                        <strong className="text-sm font-mono text-warning">
                          {fmt(currentShiftLiveStats?.totalDiscountsGiven || 0)} ج.م
                        </strong>
                      </div>

                      <div className="p-3 rounded-xl bg-background/50 border border-border/30 space-y-1">
                        <span className="text-muted-foreground block">مصروفات نقدية مسحوبة:</span>
                        <strong className="text-sm font-mono text-danger">
                          {fmt(currentShiftLiveStats?.totalExpensesAmount || 0)} ج.م
                        </strong>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* No Active Shift Screen */
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/30 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                    <Lock className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">الدرج مغلق — لا توجد وردية مفتوحة حالياً</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
                      لبدء استقبال المبيعات وتسجيل فواتير الكاشير، يرجى فتح وردية جديدة وإدخال رصيد عهدة البداية.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setStartOpeningFloat("500");
                      setStartStaffId(currentStaff.id);
                      setIsOpenStartShift(true);
                    }}
                    className="gap-2 rounded-xl font-bold bg-success text-success-foreground hover:bg-success/90"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    فتح الوردية الآن
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB: COMMISSIONS & INCENTIVES */}
          {activeTab === "commissions" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-card/60 border border-border/40">
                <div>
                  <h3 className="font-bold text-sm">حساب عمولات ومكافآت مبيعات البائعين الشهرية</h3>
                  <p className="text-xs text-muted-foreground">
                    احتساب آلي للمكافأة الشهرية بناءً على نسبة مبيعات كل بائع وإجمالي فواتيره خلال الشهر الحالي.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {staffCommissions.map((comm) => (
                  <div
                    key={comm.staff.id}
                    className="p-4 rounded-2xl border border-border/40 bg-card/60 space-y-3 hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{comm.staff.name}</h4>
                        <span className="text-xs text-muted-foreground">{comm.staff.branchName || "الفرع الرئيسي"}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold font-mono">
                        نسبة العمولة: {comm.commissionRate}%
                      </Badge>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-xl bg-background/50 border border-border/30 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-sans">مبيعات الشهر الحالية:</span>
                        <strong className="text-foreground">{fmt(comm.totalMonthSales)} ج.م</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-sans">عدد الفواتير المنجزة:</span>
                        <span>{comm.totalInvoices} فاتورة</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-sans">ساعات العمل في الورديات:</span>
                        <span>{comm.totalHours} ساعة</span>
                      </div>
                      <div className="flex justify-between text-success font-bold pt-1.5 border-t border-border/20">
                        <span className="font-sans">العمولة المستحقة:</span>
                        <span>+{fmt(comm.commissionEarned)} ج.م</span>
                      </div>
                      {comm.baseSalary > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span className="font-sans">الراتب الأساسي:</span>
                          <span>{fmt(comm.baseSalary)} ج.م</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-primary pt-1.5 border-t border-border/20">
                        <span className="font-sans">إجمالي المستحق:</span>
                        <span>{fmt(comm.totalPayout)} ج.م</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: ATTENDANCE (CLOCK IN / CLOCK OUT) */}
          {activeTab === "attendance" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 p-3 rounded-2xl border border-border/40">
                <div className="relative flex-1">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={attendanceSearch}
                    onChange={(e) => setAttendanceSearch(e.target.value)}
                    placeholder="ابحث باسم الموظف أو التاريخ (YYYY-MM-DD)..."
                    className="pr-10 h-10 rounded-xl border-border/40 bg-background/50 text-xs"
                  />
                </div>
              </div>

              {filteredAttendance.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/30">
                  <Timer className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <h3 className="font-bold text-sm text-foreground">لا توجد سجلات حضور وانصراف بعد</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    يمكن للموظف تسجيل الحضور والانصراف بضغطة زر واحدة من الشريط العلوي يومياً.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card/60">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground bg-muted/20">
                        <th className="p-3 font-bold">التاريخ</th>
                        <th className="p-3 font-bold">الموظف</th>
                        <th className="p-3 font-bold">الفرع</th>
                        <th className="p-3 font-bold">وقت الحضور (Clock-In)</th>
                        <th className="p-3 font-bold">وقت الانصراف (Clock-Out)</th>
                        <th className="p-3 font-bold">إجمالي الساعات</th>
                        <th className="p-3 font-bold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {filteredAttendance.map((rec) => (
                        <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-mono font-bold text-foreground">{rec.date}</td>
                          <td className="p-3 font-medium text-foreground">{rec.staffName}</td>
                          <td className="p-3 text-muted-foreground">{rec.branchName}</td>
                          <td className="p-3 font-mono text-emerald-600">
                            {new Date(rec.clockIn).toLocaleTimeString("ar-EG")}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {rec.clockOut ? new Date(rec.clockOut).toLocaleTimeString("ar-EG") : "— قيد الدوام —"}
                          </td>
                          <td className="p-3 font-mono font-bold">
                            {rec.totalHours ? `${rec.totalHours} ساعة` : "—"}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] py-0.5",
                                rec.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                  : "bg-blue-500/10 text-blue-600 border-blue-500/30 animate-pulse"
                              )}
                            >
                              {rec.status === "completed" ? "دوام مكتمل" : "حاضر بالعمل"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SHIFTS HISTORY & Z-REPORTS */}
          {activeTab === "shifts-history" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 p-3 rounded-2xl border border-border/40">
                <div className="relative flex-1">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="ابحث برقم الوردية، اسم الكاشير، أو الفرع..."
                    className="pr-10 h-10 rounded-xl border-border/40 bg-background/50 text-xs"
                  />
                </div>
              </div>

              {filteredShifts.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/30">
                  <Clock className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <h3 className="font-bold text-sm text-foreground">لا توجد ورديات مسجلة حتى الآن</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    عند إغلاق أي وردية كاشير، سيتم حفظ تقرير الـ Z-Report المفصل هنا تلقائياً.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card/60">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground bg-muted/20">
                        <th className="p-3 font-bold">الوردية</th>
                        <th className="p-3 font-bold">الكاشير</th>
                        <th className="p-3 font-bold">تاريخ البدء / الإغلاق</th>
                        <th className="p-3 font-bold">المبيعات</th>
                        <th className="p-3 font-bold">الدرج الفعلي</th>
                        <th className="p-3 font-bold">العجز / الزيادة</th>
                        <th className="p-3 font-bold text-left">تقرير Z</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {filteredShifts.map((shift) => {
                        const isOver = shift.cashVariance > 0;
                        const isShort = shift.cashVariance < 0;

                        return (
                          <tr key={shift.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-bold font-mono">
                              #{shift.shiftNumber}
                              {shift.status === "open" && (
                                <Badge variant="outline" className="mr-2 text-[9px] bg-success/10 text-success border-success/30">
                                  نشطة حالياً
                                </Badge>
                              )}
                            </td>

                            <td className="p-3 font-medium text-foreground">
                              {shift.staffName}
                              <span className="block text-[10px] text-muted-foreground">{shift.branchName}</span>
                            </td>

                            <td className="p-3 text-[11px] text-muted-foreground">
                              <div>من: {new Date(shift.openedAt).toLocaleString("ar-EG")}</div>
                              {shift.closedAt && (
                                <div>إلى: {new Date(shift.closedAt).toLocaleString("ar-EG")}</div>
                              )}
                            </td>

                            <td className={cn("p-3 font-mono font-bold", blurCls)}>
                              {fmt(shift.totalGrossSales)} ج.م
                              <span className="block text-[10px] text-muted-foreground font-normal">
                                ({shift.invoicesCount} فواتير)
                              </span>
                            </td>

                            <td className={cn("p-3 font-mono font-bold text-foreground", blurCls)}>
                              {fmt(shift.actualClosingCash)} ج.م
                            </td>

                            <td className="p-3 font-mono">
                              {shift.status === "open" ? (
                                <span className="text-muted-foreground text-[10px]">— قيد التشغيل —</span>
                              ) : isShort ? (
                                <span className="text-danger font-bold">عجز {fmt(Math.abs(shift.cashVariance))} ج.م</span>
                              ) : isOver ? (
                                <span className="text-success font-bold">زيادة {fmt(shift.cashVariance)} ج.م</span>
                              ) : (
                                <span className="text-success font-bold">مطابق تماماً ✓</span>
                              )}
                            </td>

                            <td className="p-3 text-left">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedZReportShift(shift)}
                                className="h-7 px-2.5 rounded-lg text-[10px] font-bold border-border/40 gap-1"
                              >
                                <Printer className="w-3 h-3 text-primary" />
                                Z-Report
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STAFF & PERMISSIONS MATRIX */}
          {activeTab === "staff-list" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">قائمة الموظفين ومستويات الصلاحيات والعمولات</h3>
                  <p className="text-xs text-muted-foreground">
                    تحديد أدوار الموظفين، نسب العمولات، ومنع الكاشير من تغيير الأسعار لحماية الأرباح.
                  </p>
                </div>
                <Button onClick={handleOpenNewStaff} size="sm" className="gap-1.5 rounded-xl text-xs font-bold">
                  <Plus className="w-3.5 h-3.5" />
                  إضافة موظف
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {staffList.map((st) => {
                  const isAdmin = st.role === "admin";
                  const isManager = st.role === "manager";

                  return (
                    <div
                      key={st.id}
                      className="p-4 rounded-2xl border border-border/40 bg-card/60 flex flex-col justify-between hover:border-primary/40 transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                              {st.name}
                              {st.id === currentStaff.id && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-primary/10 text-primary font-mono">
                                  أنت
                                </span>
                              )}
                            </h4>
                            <span className="text-xs text-muted-foreground">{st.phone}</span>
                          </div>

                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-bold py-0.5",
                              isAdmin
                                ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                : isManager
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            )}
                          >
                            {isAdmin ? "مدير عام" : isManager ? "مشرف فرع" : "كاشير"}
                          </Badge>
                        </div>

                        {/* Permissions & Commission Info */}
                        <div className="space-y-1.5 my-3 pt-2 border-t border-border/20 text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">نسبة العمولة:</span>
                            <span className="font-mono font-bold text-primary">{st.commissionRatePct || 0}%</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">تعديل سعر البيع بالفاتورة:</span>
                            <span className={st.permissions.canChangePrice ? "text-success font-bold" : "text-danger"}>
                              {st.permissions.canChangePrice ? "مسموح" : "ممنوع 🔒"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">رؤية التكلفة وهامش الربح:</span>
                            <span className={st.permissions.canViewCostAndProfit ? "text-success font-bold" : "text-danger"}>
                              {st.permissions.canViewCostAndProfit ? "مسموح" : "مخفي 🔒"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">حذف الفواتير:</span>
                            <span className={st.permissions.canDeleteInvoice ? "text-success font-bold" : "text-danger"}>
                              {st.permissions.canDeleteInvoice ? "مسموح" : "ممنوع 🔒"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">أقصى نسبة خصم مسموحة:</span>
                            <span className="font-mono font-bold text-primary">{st.permissions.maxDiscountPct}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/20">
                        <span className="text-[10px] text-muted-foreground">
                          رمز PIN: <strong className="font-mono">{st.pinCode ? "••••" : "غير محدد"}</strong>
                        </span>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditStaff(st)}
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          {staffList.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTargetStaffId(st.id)}
                              className="h-7 w-7 text-muted-foreground hover:text-danger"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODAL 1: START NEW SHIFT */}
          <Dialog open={isOpenStartShift} onOpenChange={setIsOpenStartShift}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Play className="w-4 h-4 text-success fill-current" />
                  بدء وفتح وردية كاشير جديدة
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="space-y-1.5">
                  <Label>الموظف المسؤول (الكاشير):</Label>
                  <Select value={startStaffId} onValueChange={setStartStaffId}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map((st) => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name} ({st.role === "admin" ? "مدير" : "كاشير"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>رصيد عهدة البداية بالدرج (Opening Float):</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      value={startOpeningFloat}
                      onChange={(e) => setStartOpeningFloat(e.target.value)}
                      className="font-mono text-base font-bold pl-12 h-10"
                      placeholder="500"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                      ج.م
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    المبلغ النقدي (الفكة) الموجود في الدرج عند استلام الوردية.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>الفرع:</Label>
                  <Input
                    value={startBranchName}
                    onChange={(e) => setStartBranchName(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsOpenStartShift(false)}>
                  إلغاء
                </Button>
                <Button size="sm" onClick={handleConfirmStartShift} className="bg-success text-success-foreground font-bold">
                  تأكيد وفتح الوردية
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* MODAL 2: CLOSE SHIFT */}
          <Dialog open={isOpenCloseShift} onOpenChange={setIsOpenCloseShift}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base text-danger">
                  <Square className="w-4 h-4 fill-current" />
                  تسليم وإغلاق وردية الكاشير
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {currentShiftLiveStats && (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الرصيد المتوقع في الدرج:</span>
                      <strong className="font-mono text-sm text-foreground">
                        {fmt(currentShiftLiveStats.expectedDrawerCash)} ج.م
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>(بدء {fmt(currentOpenShift?.openingFloat || 0)} + كاش {fmt(currentShiftLiveStats.totalCashSales)} - مصاريف {fmt(currentShiftLiveStats.totalExpensesAmount)})</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="font-bold">المبلغ الفعلي المعدود بالدرج (العدّ الفعلي):</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      value={actualDrawerCash}
                      onChange={(e) => setActualDrawerCash(e.target.value)}
                      className="font-mono text-base font-black pl-12 h-10 text-foreground"
                      placeholder="0"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                      ج.م
                    </span>
                  </div>
                </div>

                {/* Variance Preview */}
                {actualDrawerCash && currentShiftLiveStats && (
                  (() => {
                    const variance = Number(actualDrawerCash) - currentShiftLiveStats.expectedDrawerCash;
                    return (
                      <div
                        className={cn(
                          "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between",
                          variance === 0
                            ? "bg-success/10 border-success/30 text-success"
                            : variance < 0
                            ? "bg-danger/10 border-danger/30 text-danger"
                            : "bg-warning/10 border-warning/30 text-warning"
                        )}
                      >
                        <span>نتيجة المطابقة:</span>
                        <span>
                          {variance === 0
                            ? "مطابق تماماً بدون عجز (0 ج.م)"
                            : variance < 0
                            ? `يوجد عجز في الدرج: ${fmt(Math.abs(variance))} ج.م`
                            : `توجد زيادة في الدرج: ${fmt(variance)} ج.م`}
                        </span>
                      </div>
                    );
                  })()
                )}

                <div className="space-y-1.5">
                  <Label>ملاحظات إغلاق الوردية (اختياري):</Label>
                  <Input
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder="مثال: تم توريد النقدية للمدير أو سبب فارق العجز..."
                    className="h-9"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsOpenCloseShift(false)}>
                  تراجع
                </Button>
                <Button size="sm" onClick={handleConfirmCloseShift} className="bg-danger text-danger-foreground font-bold">
                  إغلاق الوردية وإصدار Z-Report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* MODAL 3: Z-REPORT PRINTABLE DIALOG */}
          <Dialog open={!!selectedZReportShift} onOpenChange={(o) => !o && setSelectedZReportShift(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-primary" />
                    تقرير إغلاق الوردية (Z-Report)
                  </span>
                  <Button size="sm" variant="outline" onClick={printZReport} className="h-8 gap-1.5 text-xs font-bold">
                    <Printer className="w-3.5 h-3.5" />
                    طباعة
                  </Button>
                </DialogTitle>
              </DialogHeader>

              {selectedZReportShift && (
                <div className="p-4 rounded-xl border border-border/40 bg-background text-xs space-y-3 font-sans print:border-none">
                  {/* Shop header */}
                  <div className="text-center border-b border-border/30 pb-2">
                    <h3 className="font-black text-sm">{shop.shopName || "سِجلّي"}</h3>
                    <p className="text-[10px] text-muted-foreground">تقرير إغلاق وردية الكاشير (Z-Report)</p>
                    <span className="inline-block mt-1 font-mono font-bold px-2 py-0.5 rounded bg-muted/60 text-[10px]">
                      وردية #{selectedZReportShift.shiftNumber}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>الكاشير:</span>
                      <strong className="text-foreground">{selectedZReportShift.staffName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>الفرع:</span>
                      <strong className="text-foreground">{selectedZReportShift.branchName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>بدء الوردية:</span>
                      <span className="font-mono">{new Date(selectedZReportShift.openedAt).toLocaleString("ar-EG")}</span>
                    </div>
                    {selectedZReportShift.closedAt && (
                      <div className="flex justify-between">
                        <span>إغلاق الوردية:</span>
                        <span className="font-mono">{new Date(selectedZReportShift.closedAt).toLocaleString("ar-EG")}</span>
                      </div>
                    )}
                  </div>

                  {/* Sales breakdown */}
                  <div className="border-t border-b border-border/30 py-2 space-y-1.5">
                    <div className="flex justify-between font-bold text-foreground">
                      <span>إجمالي المبيعات:</span>
                      <span className="font-mono">{fmt(selectedZReportShift.totalGrossSales)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>- المبيعات النقدية (الكاش):</span>
                      <span className="font-mono">{fmt(selectedZReportShift.totalCashSales)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>- مبيعات فيزا / إلكتروني:</span>
                      <span className="font-mono">{fmt(selectedZReportShift.totalCardSales)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>- مبيعات آجل وأقساط:</span>
                      <span className="font-mono">{fmt(selectedZReportShift.totalInstallmentSales)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>- عدد الفواتير:</span>
                      <span className="font-mono">{selectedZReportShift.invoicesCount}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-warning">
                      <span>- إجمالي الخصومات:</span>
                      <span className="font-mono">{fmt(selectedZReportShift.totalDiscountsGiven)} ج.م</span>
                    </div>
                  </div>

                  {/* Drawer Reconciliation */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>عهد البداية (Float):</span>
                      <span className="font-mono">{fmt(selectedZReportShift.openingFloat)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>المتوقع بالدرج:</span>
                      <span className="font-mono">{fmt(selectedZReportShift.expectedClosingCash)} ج.م</span>
                    </div>
                    <div className="flex justify-between font-bold text-foreground">
                      <span>الفعلي المعدود:</span>
                      <span className="font-mono">{fmt(selectedZReportShift.actualClosingCash)} ج.م</span>
                    </div>
                    <div className="flex justify-between font-black text-sm pt-1 border-t border-border/20">
                      <span>فارق الدرج:</span>
                      <span
                        className={cn(
                          "font-mono",
                          selectedZReportShift.cashVariance < 0 ? "text-danger" : "text-success"
                        )}
                      >
                        {selectedZReportShift.cashVariance < 0
                          ? `عجز (${fmt(Math.abs(selectedZReportShift.cashVariance))} ج.م)`
                          : selectedZReportShift.cashVariance > 0
                          ? `زيادة (+${fmt(selectedZReportShift.cashVariance)} ج.م)`
                          : "مطابق تماماً (0 ج.م)"}
                      </span>
                    </div>
                  </div>

                  {selectedZReportShift.closeNotes && (
                    <div className="p-2 rounded bg-muted/40 text-[10px] text-muted-foreground">
                      ملاحظة: {selectedZReportShift.closeNotes}
                    </div>
                  )}

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-4 pt-6 text-center text-[10px] text-muted-foreground border-t border-border/30">
                    <div>
                      <span>توقيع الكاشير:</span>
                      <div className="mt-5 border-b border-dashed border-border/60" />
                    </div>
                    <div>
                      <span>توقيع المشرف / الإدارة:</span>
                      <div className="mt-5 border-b border-dashed border-border/60" />
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* MODAL 4: STAFF CREATE / EDIT DIALOG */}
          <Dialog open={isOpenStaffModal} onOpenChange={setIsOpenStaffModal}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  {editingStaff ? "تعديل بيانات وصلاحيات الموظف" : "إضافة موظف جديد وتعيين الصلاحيات والعمولة"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>اسم الموظف:</Label>
                    <Input
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="مثال: أحمد سامي"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>رقم الهاتف:</Label>
                    <Input
                      value={staffPhone}
                      onChange={(e) => setStaffPhone(e.target.value)}
                      placeholder="010XXXXXXXX"
                      className="h-9 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>الدور الوظيفي:</Label>
                    <Select value={staffRole} onValueChange={(v: StaffRole) => handleRoleChange(v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cashier">كاشير / بائع</SelectItem>
                        <SelectItem value="manager">مشرف فرع</SelectItem>
                        <SelectItem value="admin">مدير عام / مالك</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>نسبة العمولة %:</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={staffCommissionRate}
                      onChange={(e) => setStaffCommissionRate(e.target.value)}
                      className="h-9 font-mono"
                      placeholder="2"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>الراتب الأساسي ج.م:</Label>
                    <Input
                      type="number"
                      min="0"
                      value={staffBaseSalary}
                      onChange={(e) => setStaffBaseSalary(e.target.value)}
                      className="h-9 font-mono"
                      placeholder="4000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>رمز PIN السريع (4 أرقام):</Label>
                    <Input
                      type="password"
                      maxLength={6}
                      value={staffPin}
                      onChange={(e) => setStaffPin(e.target.value)}
                      placeholder="0000"
                      className="h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>الفرع التابع له:</Label>
                    <Input
                      value={staffBranch}
                      onChange={(e) => setStaffBranch(e.target.value)}
                      placeholder="الفرع الرئيسي"
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Granular Permissions Section */}
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <Label className="font-bold text-foreground block">مصفوفة الصلاحيات والحماية:</Label>

                  <div className="space-y-2 p-3 rounded-xl bg-muted/40 border border-border/30">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-medium text-foreground">السماح بتعديل سعر البيع في الفاتورة</span>
                        <p className="text-[10px] text-muted-foreground">عند القفل يلتزم الكاشير بالسعر المسجل بالسيستم فقط</p>
                      </div>
                      <Switch checked={permChangePrice} onCheckedChange={setPermChangePrice} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-medium text-foreground">الاطلاع على سعر التكلفة وصافي الأرباح</span>
                        <p className="text-[10px] text-muted-foreground">إخفاء التكلفة عن الكاشير لحماية أسرار المحل</p>
                      </div>
                      <Switch checked={permViewCost} onCheckedChange={setPermViewCost} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-medium text-foreground">السماح بحذف الفواتير</span>
                        <p className="text-[10px] text-muted-foreground">منع الكاشير من حذف الفواتير القديمة</p>
                      </div>
                      <Switch checked={permDeleteInv} onCheckedChange={setPermDeleteInv} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-medium text-foreground">الوصول لصفحات التقارير المالية</span>
                        <p className="text-[10px] text-muted-foreground">منع الموظف من رؤية الإحصائيات العامة للمحل</p>
                      </div>
                      <Switch checked={permReports} onCheckedChange={setPermReports} />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/20">
                      <span className="font-medium text-foreground">أقصى نسبة خصم مسموحة للبائع:</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={permMaxDiscount}
                          onChange={(e) => setPermMaxDiscount(e.target.value)}
                          className="w-16 h-7 text-center font-mono text-xs"
                        />
                        <span>%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsOpenStaffModal(false)}>
                  إلغاء
                </Button>
                <Button size="sm" onClick={handleSaveStaff} className="bg-primary text-primary-foreground font-bold">
                  حفظ بيانات الموظف
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ALERT DIALOG: DELETE STAFF */}
          <AlertDialog open={!!deleteTargetStaffId} onOpenChange={(o) => !o && setDeleteTargetStaffId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>حذف الموظف نهائياً؟</AlertDialogTitle>
                <AlertDialogDescription>
                  هل أنت متأكد من رغبتك في حذف هذا الموظف من قائمة المستخدمين؟ لن يتم حذف فواتيره أو وردياته السابقة المسجلة.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (deleteTargetStaffId) {
                      deleteStaff(deleteTargetStaffId);
                      toast.success("تم حذف الموظف");
                      setDeleteTargetStaffId(null);
                    }
                  }}
                  className="bg-danger text-danger-foreground font-bold"
                >
                  تأكيد الحذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PageTransition>
    </AppShell>
  );
}
