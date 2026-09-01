import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { CountUp } from "@/components/CountUp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useDB,
  Branch,
  fmt,
  StockItem,
  useShopSettings,
} from "@/lib/store";
import {
  calculateBranchStockValuation,
  getBranchStockList,
  getProductStockInBranch,
  setBranchStockAbsolute,
  getBranchTransfers,
  createBranchTransfer,
  dispatchBranchTransfer,
  receiveBranchTransfer,
  cancelBranchTransfer,
  printBranchTransferNote,
  calculateBranchCashboxSummary,
  getBranchRemittances,
  addBranchRemittance,
  getBranchShifts,
  closeBranchShift,
  printBranchShiftZReport,
  calculateBranchProfitability,
  getBranchStaff,
  addBranchStaffMember,
  updateBranchStaffMember,
  removeBranchStaffMember,
  getActiveBranchId,
  setActiveBranchId,
  BranchTransfer,
  BranchTransferItem,
  BranchStaffMember,
  getExpensesForBranch,
  linkExpenseToBranch,
} from "@/lib/branch-system";
import {
  GitBranch,
  MapPin,
  Phone,
  User,
  Plus,
  Pencil,
  Trash2,
  Boxes,
  ArrowLeftRight,
  Wallet,
  Receipt,
  BarChart3,
  Users,
  Building2,
  TrendingUp,
  AlertTriangle,
  FileText,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  ShieldAlert,
  SlidersHorizontal,
  DollarSign,
  TrendingDown,
  Percent,
  Check,
  Send,
  Eye,
  ScanBarcode,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CircleDollarSign,
  Award,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

export default function BranchesPage() {
  const {
    branches,
    addBranch,
    updateBranch,
    removeBranch,
    stockItems,
    invoices,
    expenses,
    payments,
    loading,
  } = useDB();
  const { settings: shopSettings } = useShopSettings();
  const cur = shopSettings.currency || "ج.م";

  // Navigation tabs state
  const [activeTab, setActiveTab] = useState("branches");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  // Sync with global branch
  useEffect(() => {
    const active = getActiveBranchId();
    if (active !== "all") {
      setSelectedBranchId(active);
    } else if (branches.length > 0) {
      const main = branches.find((b) => b.isMain) || branches[0];
      setSelectedBranchId(main.id);
    }
  }, [branches]);

  // Branch CRUD state
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Transfer State
  const [transfers, setTransfers] = useState<BranchTransfer[]>(getBranchTransfers());
  const [isCreateTransferOpen, setIsCreateTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferDriver, setTransferDriver] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferItems, setTransferItems] = useState<BranchTransferItem[]>([]);
  const [inspectTransfer, setInspectTransfer] = useState<BranchTransfer | null>(null);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveTargetTransfer, setReceiveTargetTransfer] = useState<BranchTransfer | null>(null);
  const [receivedItemInputs, setReceivedItemInputs] = useState<
    Record<string, { receivedQty: number; damagedQty: number; notes: string }>
  >({});

  // Cashbox & Remittance & Shift State
  const [remittances, setRemittances] = useState(getBranchRemittances());
  const [shifts, setShifts] = useState(getBranchShifts());
  const [isRemittanceOpen, setIsRemittanceOpen] = useState(false);
  const [isZReportOpen, setIsZReportOpen] = useState(false);
  const [remittanceAmount, setRemittanceAmount] = useState("");
  const [remittanceDest, setRemittanceDest] = useState<"main_vault" | "bank">("main_vault");
  const [remittanceDestName, setRemittanceDestName] = useState("الخزينة المركزية");
  const [remittanceRef, setRemittanceRef] = useState("");
  const [remittanceNotes, setRemittanceNotes] = useState("");
  const [zOpeningCash, setZOpeningCash] = useState("500");
  const [zActualCash, setZActualCash] = useState("");
  const [zCashierName, setZCashierName] = useState("كاشير الفرع");
  const [zVarianceReason, setZVarianceReason] = useState("");

  // Staff State
  const [staffList, setStaffList] = useState<BranchStaffMember[]>(getBranchStaff());
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<BranchStaffMember | null>(null);
  const [roleSimulatorBranch, setRoleSimulatorBranch] = useState<string>("all");

  // Stock inventory filter
  const [stockSearch, setStockSearch] = useState("");
  const [stockFilterLow, setStockFilterLow] = useState(false);

  // Refresh helper
  const refreshBranchData = () => {
    setTransfers(getBranchTransfers());
    setRemittances(getBranchRemittances());
    setShifts(getBranchShifts());
    setStaffList(getBranchStaff());
  };

  useEffect(() => {
    const listener = () => refreshBranchData();
    window.addEventListener("segilly_branch_data_updated", listener);
    return () => window.removeEventListener("segilly_branch_data_updated", listener);
  }, []);

  const activeBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0];
  }, [branches, selectedBranchId]);

  // Overall stats
  const totalValuation = useMemo(() => {
    let cost = 0;
    let retail = 0;
    branches.forEach((b) => {
      const v = calculateBranchStockValuation(b.id, stockItems);
      cost += v.totalCostValue;
      retail += v.totalRetailValue;
    });
    return { cost, retail };
  }, [branches, stockItems]);

  // Branch CRUD handler
  const handleSaveBranch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      location: formData.get("location") as string,
      phone: formData.get("phone") as string,
      managerName: formData.get("managerName") as string,
      isMain: formData.get("isMain") === "on",
    };
    const profilePatch = {
      code: (formData.get("branchCode") as string) || "",
      taxNumber: (formData.get("taxNumber") as string) || "",
      commercialRecord: (formData.get("commercialRecord") as string) || "",
      email: (formData.get("branchEmail") as string) || "",
    };

    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, data);
        saveBranchProfile(editingBranch.id, profilePatch);
        toast.success("تم تحديث بيانات الفرع بنجاح");
      } else {
        const created = await addBranch(data);
        const newId = (created as any)?.id;
        if (newId) saveBranchProfile(newId, profilePatch);
        toast.success("تمت إضافة الفرع الجديد بنجاح");
      }
      setIsBranchDialogOpen(false);
      setEditingBranch(null);
    } catch {
      toast.error("حدث خطأ أثناء حفظ الفرع");
    }
  };

  // Add Item to Transfer
  const handleAddTransferItem = (stockItem: StockItem) => {
    const existing = transferItems.find((i) => i.stockItemId === stockItem.id);
    if (existing) {
      setTransferItems((prev) =>
        prev.map((i) =>
          i.stockItemId === stockItem.id ? { ...i, requestedQty: i.requestedQty + 1, sentQty: i.sentQty + 1 } : i
        )
      );
    } else {
      setTransferItems((prev) => [
        ...prev,
        {
          stockItemId: stockItem.id,
          name: stockItem.name,
          barcode: stockItem.barcode,
          requestedQty: 1,
          sentQty: 1,
          receivedQty: 0,
          damagedQty: 0,
          unitCost: stockItem.lastUnitCost || 0,
          salePrice: stockItem.salePrice || 0,
        },
      ]);
    }
    toast.success(`تمت إضافة ${stockItem.name} لأمر التحويل`);
  };

  // Create Transfer Submission
  const handleCreateTransferSubmit = () => {
    if (!transferFrom || !transferTo) {
      toast.error("يرجى اختيار فرع المصدر وفرع الوجهة");
      return;
    }
    if (transferFrom === transferTo) {
      toast.error("لا يمكن التحويل لنفس الفرع!");
      return;
    }
    if (transferItems.length === 0) {
      toast.error("يرجى إضافة صنف واحد على الأقل للتحويل");
      return;
    }

    createBranchTransfer({
      fromBranchId: transferFrom,
      toBranchId: transferTo,
      items: transferItems,
      notes: transferNotes,
      driverName: transferDriver,
      createdBy: "المدير العام",
    });

    toast.success("تم إنشاء أمر التحويل كمسودة بنجاح");
    setIsCreateTransferOpen(false);
    setTransferItems([]);
    setTransferNotes("");
    setTransferDriver("");
    refreshBranchData();
  };

  // Dispatch Transfer
  const handleDispatch = (id: string) => {
    const ok = dispatchBranchTransfer(id, "أمين مخزن الإرسال");
    if (ok) {
      toast.success("تم إرسال الشحنة وخصم الكميات من فرع المصدر بنجاح");
      refreshBranchData();
    } else {
      toast.error("تعذر إرسال الشحنة");
    }
  };

  // Open Receive Modal
  const handleOpenReceive = (t: BranchTransfer) => {
    setReceiveTargetTransfer(t);
    const inputs: Record<string, { receivedQty: number; damagedQty: number; notes: string }> = {};
    t.items.forEach((item) => {
      inputs[item.stockItemId] = {
        receivedQty: item.sentQty,
        damagedQty: 0,
        notes: "",
      };
    });
    setReceivedItemInputs(inputs);
    setReceiveModalOpen(true);
  };

  // Submit Receive
  const handleConfirmReceive = () => {
    if (!receiveTargetTransfer) return;
    const receivedList = Object.entries(receivedItemInputs).map(([stockItemId, val]: [string, { receivedQty: number; damagedQty: number; notes: string }]) => ({
      stockItemId,
      receivedQty: val.receivedQty,
      damagedQty: val.damagedQty,
      notes: val.notes,
    }));

    const ok = receiveBranchTransfer({
      transferId: receiveTargetTransfer.id,
      receivedItems: receivedList,
      receivedBy: "أمين مخزن الاستلام",
    });

    if (ok) {
      toast.success("تم استلام الشحنة وإيداع البضاعة بمخزون الفرع بنجاح");
      setReceiveModalOpen(false);
      refreshBranchData();
    } else {
      toast.error("فشل تأكيد الاستلام");
    }
  };

  // Cancel Transfer
  const handleCancelTransfer = (id: string) => {
    if (confirm("هل أنت متأكد من إلغاء أمر التحويل؟ سيتم إرجاع أي كميات مخصومة لفرع المصدر.")) {
      cancelBranchTransfer(id);
      toast.success("تم إلغاء أمر التحويل");
      refreshBranchData();
    }
  };

  // Submit Remittance
  const handleAddRemittanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(remittanceAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (!activeBranch) return;

    addBranchRemittance({
      branchId: activeBranch.id,
      amount: amt,
      destinationType: remittanceDest,
      destinationName: remittanceDestName,
      referenceNumber: remittanceRef || `REM-${Date.now().toString().slice(-4)}`,
      remittanceDate: new Date().toISOString().split("T")[0],
      performedBy: "كاشير الفرع",
      status: "completed",
      notes: remittanceNotes,
    });

    toast.success(`تم تسجيل توريد ${fmt(amt)} ${cur} بنجاح`);
    setIsRemittanceOpen(false);
    setRemittanceAmount("");
    setRemittanceNotes("");
    refreshBranchData();
  };

  // Submit Shift Close (Z-Report)
  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const actual = parseFloat(zActualCash);
    const opening = parseFloat(zOpeningCash) || 0;
    if (isNaN(actual) || actual < 0) {
      toast.error("يرجى إدخال النقدية الفعلية المحصية بالدرج");
      return;
    }
    if (!activeBranch) return;

    const shift = closeBranchShift({
      branchId: activeBranch.id,
      cashierName: zCashierName,
      openingBalance: opening,
      actualCashCounted: actual,
      invoices,
      payments,
      expenses,
      varianceReason: zVarianceReason,
      notes: "تم الإغلاق بنهاية الوردية",
    });

    toast.success(`تم تقفيل الوردية رقم ${shift.shiftNumber} بنجاح`);
    setIsZReportOpen(false);
    refreshBranchData();

    // Prompt to print Z-Report
    printBranchShiftZReport(shift, activeBranch, shopSettings, "thermal");
  };

  // Save Staff Member
  const handleSaveStaff = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const memberData: Omit<BranchStaffMember, "id"> = {
      branchId: form.get("branchId") as string,
      name: form.get("name") as string,
      role: form.get("role") as any,
      phone: form.get("phone") as string,
      salary: parseFloat(form.get("salary") as string) || 0,
      nationalId: form.get("nationalId") as string,
      active: form.get("active") === "on",
      hiredDate: (form.get("hiredDate") as string) || new Date().toISOString().split("T")[0],
    };

    if (editingStaff) {
      updateBranchStaffMember(editingStaff.id, memberData);
      toast.success("تم تحديث بيانات الموظف بنجاح");
    } else {
      addBranchStaffMember(memberData);
      toast.success("تمت إضافة الموظف الجديد بنجاح");
    }
    setIsStaffDialogOpen(false);
    setEditingStaff(null);
    refreshBranchData();
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="flex flex-col gap-6" dir="rtl">
          {/* Header */}
          <PageHeader
            title="إدارة الفروع والمخزون المتعدد"
            icon={<GitBranch className="h-7 w-7 text-primary" />}
            subtitle="المنظومة المركزية لإدارة الفروع، حركة المخزون، التحويلات، الخزن والورديات، وقوائم الأرباح"
            action={
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    setEditingBranch(null);
                    setIsBranchDialogOpen(true);
                  }}
                  className="rounded-full px-5 shadow-sm font-semibold text-xs sm:text-sm"
                >
                  <Plus className="ml-1.5 h-4 w-4" />
                  إضافة فرع جديد
                </Button>
              </div>
            }
          />

          {/* KPI High-Level Highlights */}
          <Reveal className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>إجمالي الفروع النشطة</span>
                <Building2 className="h-4 w-4 text-primary" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums mt-1">
                <CountUp value={branches.length} />
              </div>
              <span className="text-[11px] text-muted-foreground">
                {branches.filter((b) => b.isMain).length} فرع رئيسي معتمد
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>تقييم مخزون الفروع (تكلفة)</span>
                <Boxes className="h-4 w-4 text-emerald-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {fmt(totalValuation.cost)} <span className="text-xs font-normal">{cur}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                القيمة البيعية: {fmt(totalValuation.retail)} {cur}
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>التحويلات الجارية</span>
                <Truck className="h-4 w-4 text-amber-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                {transfers.filter((t) => t.status === "in_transit").length}
              </div>
              <span className="text-[11px] text-muted-foreground">
                من إجمالي {transfers.length} أمر تحويل مسجل
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>كادر وموظفي الفروع</span>
                <Users className="h-4 w-4 text-indigo-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
                {staffList.filter((s) => s.active).length}
              </div>
              <span className="text-[11px] text-muted-foreground">
                موزعين على {branches.length} مواقع تشغيلية
              </span>
            </div>
          </Reveal>

          {/* Multi-Tab Navigation for all 7 features */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--hairline)] pb-4">
              <TabsList className="h-auto p-1.5 bg-card/80 border border-foreground/10 rounded-2xl flex-wrap justify-start gap-1">
                <TabsTrigger value="branches" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  1. الفروع والمقرات
                </TabsTrigger>

                <TabsTrigger value="inventory" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Boxes className="h-3.5 w-3.5" />
                  2. مخزون الفروع
                </TabsTrigger>

                <TabsTrigger value="transfers" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  3. التحويلات والنقل
                  {transfers.filter((t) => t.status === "in_transit").length > 0 && (
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                </TabsTrigger>

                <TabsTrigger value="cashbox" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  4. الخزن والورديات (Z-Report)
                </TabsTrigger>

                <TabsTrigger value="profitability" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Receipt className="h-3.5 w-3.5" />
                  5. الأرباح والمصروفات (P&L)
                </TabsTrigger>

                <TabsTrigger value="analytics" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <BarChart3 className="h-3.5 w-3.5" />
                  6. المقارنات والتحليلات
                </TabsTrigger>

                <TabsTrigger value="staff" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Users className="h-3.5 w-3.5" />
                  7. الموظفين والصلاحيات
                </TabsTrigger>
              </TabsList>

              {/* Branch Selector for Active Tab Context */}
              {activeTab !== "branches" && activeTab !== "analytics" && (
                <div className="flex items-center gap-2 bg-card/60 border border-foreground/10 px-3 py-1.5 rounded-full">
                  <span className="text-xs text-muted-foreground font-semibold">عرض بيانات الفرع:</span>
                  <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                    <SelectTrigger className="h-8 w-44 rounded-full text-xs font-bold border-none bg-primary/10 text-primary">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.name} {b.isMain ? "⭐ (رئيسي)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* 1️⃣ تبويب: الفروع والمقرات (Branches Directory) */}
            {/* ========================================================================= */}
            <TabsContent value="branches" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {branches.map((branch) => {
                  const val = calculateBranchStockValuation(branch.id, stockItems);
                  const staffCount = staffList.filter((s) => s.branchId === branch.id).length;

                  return (
                    <div
                      key={branch.id}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border p-5 bg-card/80 transition-all shadow-sm hover:shadow-md",
                        branch.isMain ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-foreground/10"
                      )}
                    >
                      {/* Ribbon */}
                      {branch.isMain && (
                        <div className="absolute top-0 left-0 bg-amber-500 text-black text-[10px] font-black px-3 py-0.5 rounded-br-xl uppercase tracking-wider">
                          الفرع الرئيسي
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg",
                              branch.isMain ? "bg-amber-500/15 text-amber-600" : "bg-primary/10 text-primary"
                            )}
                          >
                            <GitBranch className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg leading-tight">{branch.name}</h3>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {branch.location || "بدون عنوان مسجل"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => {
                              setEditingBranch(branch);
                              setIsBranchDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-danger hover:bg-danger/10"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف ${branch.name}؟`)) {
                                removeBranch(branch.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-3 py-3 border-y border-[var(--hairline)] text-xs mb-4">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">المدير المسؤول</span>
                          <span className="font-semibold flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {branch.managerName || "غير محدد"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">رقم الهاتف</span>
                          <span className="font-semibold flex items-center gap-1 mt-0.5" dir="ltr">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {branch.phone || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">قيمة المخزون</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block tabular-nums">
                            {fmt(val.totalCostValue)} {cur}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">فريق العمل</span>
                          <span className="font-semibold mt-0.5 block">{staffCount} موظفين</span>
                        </div>
                      </div>

                      {/* Action Shortcuts */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 rounded-xl text-xs font-semibold h-8"
                          onClick={() => {
                            setSelectedBranchId(branch.id);
                            setActiveTab("inventory");
                          }}
                        >
                          <Boxes className="ml-1 h-3.5 w-3.5" />
                          المخزون
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 rounded-xl text-xs font-semibold h-8"
                          onClick={() => {
                            setSelectedBranchId(branch.id);
                            setActiveTab("cashbox");
                          }}
                        >
                          <Wallet className="ml-1 h-3.5 w-3.5" />
                          الخزينة
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs font-semibold h-8"
                          onClick={() => {
                            setActiveBranchId(branch.id);
                            toast.success(`تم تفعيل العمل على "${branch.name}" في كل شاشات النظام`);
                          }}
                        >
                          <Check className="ml-1 h-3 w-3 text-primary" />
                          تعيين كنشط
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {branches.length === 0 && !loading && (
                  <div className="col-span-full py-16 text-center text-muted-foreground rounded-2xl border border-dashed border-foreground/10 bg-card/40">
                    <Building2 className="h-10 w-10 mx-auto opacity-30 mb-2" />
                    لا توجد فروع مسجلة حتى الآن. أضف أول فرع لبدء العمل.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ========================================================================= */}
            {/* 2️⃣ تبويب: مخزون الفروع (Multi-Location Inventory) */}
            {/* ========================================================================= */}
            <TabsContent value="inventory" className="space-y-6">
              {/* Branch Valuation Summary Card */}
              {activeBranch && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl border border-foreground/10 bg-gradient-to-r from-primary/5 via-card to-card">
                  {(() => {
                    const valuation = calculateBranchStockValuation(activeBranch.id, stockItems);
                    return (
                      <>
                        <div>
                          <span className="text-xs text-muted-foreground font-semibold block">إجمالي أصناف الفرع</span>
                          <span className="text-xl sm:text-2xl font-black tabular-nums">{valuation.totalItemsCount} صنف</span>
                          <span className="text-[10px] text-muted-foreground block">({valuation.totalUnitsCount} وحدة إجمالية)</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground font-semibold block">قيمة المخزون (سعر التكلفة)</span>
                          <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {fmt(valuation.totalCostValue)} {cur}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground font-semibold block">القيمة البيعية المتوقعة</span>
                          <span className="text-xl sm:text-2xl font-black text-primary tabular-nums">
                            {fmt(valuation.totalRetailValue)} {cur}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                            (أرباح متوقعة: {fmt(valuation.potentialProfit)} {cur})
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground font-semibold block">أصناف شارفت على النفاد</span>
                          <span className={cn("text-xl sm:text-2xl font-black tabular-nums", valuation.lowStockItemsCount > 0 ? "text-danger" : "text-emerald-500")}>
                            {valuation.lowStockItemsCount} صنف
                          </span>
                          {valuation.lowStockItemsCount > 0 && (
                            <span className="text-[10px] text-danger font-semibold flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> يحتاج لطلب تحويل
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Filters & Table */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative flex-1 w-full max-w-md">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="البحث باسم المنتج أو الباركود..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="h-10 pr-10 rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="low-stock-filter"
                      checked={stockFilterLow}
                      onCheckedChange={setStockFilterLow}
                    />
                    <Label htmlFor="low-stock-filter" className="text-xs font-semibold cursor-pointer">
                      إظهار النواقص والحد الأدنى فقط
                    </Label>
                  </div>

                  <Button
                    onClick={() => {
                      setTransferFrom(activeBranch ? activeBranch.id : "");
                      setIsCreateTransferOpen(true);
                    }}
                    className="rounded-full h-9 px-4 text-xs font-bold shadow-sm"
                  >
                    <ArrowLeftRight className="ml-1.5 h-3.5 w-3.5" />
                    طلب تحويل مخزون
                  </Button>
                </div>
              </div>

              {/* Inventory Stock Table */}
              <div className="rounded-2xl border border-foreground/10 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] bg-muted/40 text-muted-foreground font-bold">
                        <th className="p-3.5">المنتج والباركود</th>
                        <th className="p-3.5 text-center">الرصيد بهذا الفرع</th>
                        <th className="p-3.5 text-center">الحد الأدنى للفرع</th>
                        <th className="p-3.5 text-center">إجمالي رصيد الشركة</th>
                        <th className="p-3.5">سعر التكلفة</th>
                        <th className="p-3.5">سعر البيع</th>
                        <th className="p-3.5 text-center">الحالة</th>
                        <th className="p-3.5 text-left">إجراءات سريعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {stockItems
                        .filter((item) => {
                          const q = stockSearch.toLowerCase().trim();
                          const matchesQ = !q || item.name.toLowerCase().includes(q) || (item.barcode && item.barcode.includes(q));
                          if (!matchesQ) return false;

                          if (stockFilterLow && activeBranch) {
                            const stock = getProductStockInBranch(activeBranch.id, item.id, item.quantity);
                            return stock.quantity <= stock.minStock;
                          }
                          return true;
                        })
                        .map((item) => {
                          const branchStock = activeBranch
                            ? getProductStockInBranch(activeBranch.id, item.id, item.quantity)
                            : { quantity: item.quantity, minStock: item.minStock || 3 };

                          const isLow = branchStock.quantity <= branchStock.minStock;

                          return (
                            <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                              <td className="p-3.5">
                                <div className="font-bold text-sm">{item.name}</div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {item.barcode || "بدون باركود"}
                                </div>
                              </td>
                              <td className="p-3.5 text-center">
                                <span className={cn("text-base font-black tabular-nums", isLow ? "text-danger" : "text-foreground")}>
                                  {branchStock.quantity}
                                </span>
                              </td>
                              <td className="p-3.5 text-center font-bold tabular-nums text-muted-foreground">
                                {branchStock.minStock} قطع
                              </td>
                              <td className="p-3.5 text-center font-semibold tabular-nums text-muted-foreground">
                                {item.quantity}
                              </td>
                              <td className="p-3.5 tabular-nums">{fmt(item.lastUnitCost)} {cur}</td>
                              <td className="p-3.5 tabular-nums font-bold text-primary">{fmt(item.salePrice)} {cur}</td>
                              <td className="p-3.5 text-center">
                                {branchStock.quantity === 0 ? (
                                  <Badge variant="destructive" className="text-[10px] font-bold">
                                    منتهي تماماً
                                  </Badge>
                                ) : isLow ? (
                                  <Badge variant="outline" className="text-[10px] font-bold border-amber-500/30 text-amber-600 bg-amber-500/10">
                                    شارف على النفاد
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                                    متوفر بكفاءة
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3.5 text-left">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[11px] rounded-lg px-2.5"
                                    onClick={() => {
                                      const newQtyStr = prompt(`تعديل الكمية لمنتج "${item.name}" بالفرع الحالي:`, String(branchStock.quantity));
                                      if (newQtyStr !== null) {
                                        const newQty = parseInt(newQtyStr, 10);
                                        if (!isNaN(newQty) && newQty >= 0 && activeBranch) {
                                          setBranchStockAbsolute(activeBranch.id, item.id, newQty);
                                          toast.success("تم تحديث الرصيد بالفرع بنجاح");
                                          refreshBranchData();
                                        }
                                      }
                                    }}
                                  >
                                    تعديل الرصيد
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-[11px] rounded-lg px-2.5"
                                    onClick={() => {
                                      const minStr = prompt(`تعيين الحد الأدنى للتنبيه لـ "${item.name}":`, String(branchStock.minStock));
                                      if (minStr !== null) {
                                        const minVal = parseInt(minStr, 10);
                                        if (!isNaN(minVal) && minVal >= 0 && activeBranch) {
                                          setBranchStockAbsolute(activeBranch.id, item.id, branchStock.quantity, minVal);
                                          toast.success("تم تعيين الحد الأدنى للتنبيه");
                                          refreshBranchData();
                                        }
                                      }
                                    }}
                                  >
                                    حد التنبيه
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ========================================================================= */}
            {/* 3️⃣ تبويب: التحويلات بين الفروع (Stock Transfers) */}
            {/* ========================================================================= */}
            <TabsContent value="transfers" className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold">أوامر تحويل ونقل البضائع بين الفروع</h3>
                  <p className="text-xs text-muted-foreground">
                    دورة نقل متكاملة: إعداد المسودة ➔ خصم وشحن (In Transit) ➔ استلام وفحص التوالف (Received)
                  </p>
                </div>
                <Button
                  onClick={() => setIsCreateTransferOpen(true)}
                  className="rounded-full px-5 h-10 font-bold text-xs shadow-sm"
                >
                  <Plus className="ml-1.5 h-4 w-4" />
                  إنشاء أمر تحويل جديد
                </Button>
              </div>

              {/* Transfers List */}
              <div className="space-y-3">
                {transfers.map((trf) => {
                  const fromBranch = branches.find((b) => b.id === trf.fromBranchId);
                  const toBranch = branches.find((b) => b.id === trf.toBranchId);
                  const totalUnits = trf.items.reduce((s, i) => s + i.sentQty, 0);
                  const totalCost = trf.items.reduce((s, i) => s + i.sentQty * i.unitCost, 0);

                  const statusConfig = {
                    draft: { label: "مسودة", color: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
                    in_transit: { label: "قيد النقل والشحن", color: "bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse" },
                    received: { label: "تم الاستلام بنجاح", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
                    cancelled: { label: "ملغي", color: "bg-red-500/10 text-red-600 border-red-500/30" },
                  }[trf.status];

                  return (
                    <div
                      key={trf.id}
                      className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl border border-foreground/10 bg-card hover:border-foreground/20 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                          <Truck className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">{trf.transferNumber}</span>
                            <Badge variant="outline" className={cn("text-[10px] font-bold", statusConfig.color)}>
                              {statusConfig.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(trf.createdAt).toLocaleDateString("ar-EG")}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs mt-1.5 flex-wrap">
                            <span className="font-semibold text-foreground">
                              من: <span className="text-primary">{fromBranch?.name || "فرع محذوف"}</span>
                            </span>
                            <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold text-foreground">
                              إلى: <span className="text-emerald-600 dark:text-emerald-400">{toBranch?.name || "فرع محذوف"}</span>
                            </span>
                            <span className="text-muted-foreground">| {trf.items.length} أصناف ({totalUnits} قطعة)</span>
                            <span className="font-bold text-foreground">| القيمة: {fmt(totalCost)} {cur}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[var(--hairline)]">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-xl text-xs"
                          onClick={() => printBranchTransferNote(trf, fromBranch, toBranch, shopSettings)}
                        >
                          <Printer className="ml-1 h-3.5 w-3.5" />
                          إذن النقل (PDF)
                        </Button>

                        {trf.status === "draft" && (
                          <Button
                            size="sm"
                            className="h-8 rounded-xl text-xs bg-amber-600 hover:bg-amber-700 font-bold"
                            onClick={() => handleDispatch(trf.id)}
                          >
                            <Send className="ml-1 h-3.5 w-3.5" />
                            شحن البضاعة
                          </Button>
                        )}

                        {trf.status === "in_transit" && (
                          <Button
                            size="sm"
                            className="h-8 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 font-bold"
                            onClick={() => handleOpenReceive(trf)}
                          >
                            <CheckCircle2 className="ml-1 h-3.5 w-3.5" />
                            تأكيد الاستلام والفحص
                          </Button>
                        )}

                        {(trf.status === "draft" || trf.status === "in_transit") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-xl text-xs text-danger hover:bg-danger/10"
                            onClick={() => handleCancelTransfer(trf.id)}
                          >
                            إلغاء
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {transfers.length === 0 && (
                  <div className="py-16 text-center text-muted-foreground rounded-2xl border border-dashed border-foreground/10 bg-card/40">
                    <ArrowLeftRight className="h-10 w-10 mx-auto opacity-30 mb-2" />
                    لا توجد أوامر تحويل مسجلة حالياً.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ========================================================================= */}
            {/* 4️⃣ تبويب: الخزن والورديات (Branch Cashbox & Z-Reports) */}
            {/* ========================================================================= */}
            <TabsContent value="cashbox" className="space-y-6">
              {activeBranch && (
                <>
                  {/* Financial Balance Summary */}
                  {(() => {
                    const cashSummary = calculateBranchCashboxSummary(activeBranch.id, invoices, payments, expenses);
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col gap-1">
                          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-between">
                            <span>النقدية المتوفرة بدرج الفرع</span>
                            <Wallet className="h-4 w-4 text-emerald-600" />
                          </span>
                          <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                            {fmt(cashSummary.currentCashBalance)} <span className="text-xs font-normal">{cur}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            صافي المقبوضات بعد خصم المصروفات والتوريدات
                          </span>
                        </div>

                        <div className="p-5 rounded-2xl border border-foreground/10 bg-card flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground font-bold flex items-center justify-between">
                            <span>إجمالي المقبوضات النقدية (+)</span>
                            <ArrowUpRight className="h-4 w-4 text-primary" />
                          </span>
                          <div className="text-2xl font-black tabular-nums mt-1">
                            {fmt(cashSummary.totalInflow)} <span className="text-xs font-normal">{cur}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            (مبيعات كاش: {fmt(cashSummary.cashSales)} + أقساط: {fmt(cashSummary.installmentsCash)})
                          </span>
                        </div>

                        <div className="p-5 rounded-2xl border border-foreground/10 bg-card flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground font-bold flex items-center justify-between">
                            <span>إجمالي المدفوعات والتوريدات (-)</span>
                            <ArrowDownRight className="h-4 w-4 text-danger" />
                          </span>
                          <div className="text-2xl font-black text-danger tabular-nums mt-1">
                            {fmt(cashSummary.totalOutflow)} <span className="text-xs font-normal">{cur}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            (مصروفات: {fmt(cashSummary.pettyExpenses)} + توريدات: {fmt(cashSummary.remittancesOut)})
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Actions Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                    <div>
                      <h4 className="font-bold text-sm">عمليات الخزينة وإغلاق الوردية لـ "{activeBranch.name}"</h4>
                      <p className="text-xs text-muted-foreground">تسجيل توريدات النقدية للبنك/الخزينة العامة وطباعة تقرير Z-Report</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setIsRemittanceOpen(true)}
                        variant="outline"
                        className="rounded-full h-9 px-4 text-xs font-bold"
                      >
                        <CircleDollarSign className="ml-1.5 h-3.5 w-3.5 text-primary" />
                        توريد نقدية للخزينة / البنك
                      </Button>
                      <Button
                        onClick={() => setIsZReportOpen(true)}
                        className="rounded-full h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700"
                      >
                        <FileText className="ml-1.5 h-3.5 w-3.5" />
                        تقفيل وردية (Z-Report)
                      </Button>
                    </div>
                  </div>

                  {/* Remittances and Shifts History Tables */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Remittances */}
                    <div className="rounded-2xl border border-foreground/10 bg-card p-5 space-y-3">
                      <h5 className="font-bold text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <span>سجل توريدات النقدية</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {remittances.filter((r) => r.branchId === activeBranch.id).length} عملية
                        </Badge>
                      </h5>

                      <div className="divide-y divide-[var(--hairline)] max-h-72 overflow-y-auto no-scrollbar">
                        {remittances
                          .filter((r) => r.branchId === activeBranch.id)
                          .map((rem) => (
                            <div key={rem.id} className="py-3 flex items-center justify-between text-xs">
                              <div>
                                <div className="font-bold">{rem.destinationName}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {rem.remittanceDate} • الرقم المرجعي: {rem.referenceNumber || "—"}
                                </div>
                              </div>
                              <div className="text-left font-black text-sm text-primary tabular-nums">
                                {fmt(rem.amount)} {cur}
                              </div>
                            </div>
                          ))}

                        {remittances.filter((r) => r.branchId === activeBranch.id).length === 0 && (
                          <div className="py-8 text-center text-xs text-muted-foreground">
                            لا توجد توريدات نقدية مسجلة لهذا الفرع
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Shifts Z-Reports */}
                    <div className="rounded-2xl border border-foreground/10 bg-card p-5 space-y-3">
                      <h5 className="font-bold text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <span>سجل تقارير الورديات (Z-Reports)</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {shifts.filter((s) => s.branchId === activeBranch.id).length} إغلاق
                        </Badge>
                      </h5>

                      <div className="divide-y divide-[var(--hairline)] max-h-72 overflow-y-auto no-scrollbar">
                        {shifts
                          .filter((s) => s.branchId === activeBranch.id)
                          .map((sh) => (
                            <div key={sh.id} className="py-3 flex items-center justify-between text-xs">
                              <div>
                                <div className="font-bold flex items-center gap-1.5">
                                  <span>{sh.shiftNumber}</span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[9px] font-bold",
                                      sh.variance === 0 ? "text-emerald-600" : "text-danger"
                                    )}
                                  >
                                    {sh.variance === 0 ? "متطابق" : `فارق ${fmt(sh.variance)}`}
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  الكاشير: {sh.cashierName} • {new Date(sh.closedAt || sh.openedAt).toLocaleDateString("ar-EG")}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm tabular-nums">
                                  {fmt(sh.actualCash)} {cur}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-full"
                                  onClick={() => printBranchShiftZReport(sh, activeBranch, shopSettings, "thermal")}
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}

                        {shifts.filter((s) => s.branchId === activeBranch.id).length === 0 && (
                          <div className="py-8 text-center text-xs text-muted-foreground">
                            لا توجد ورديات مغلقة مسجلة بعد
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ========================================================================= */}
            {/* 5️⃣ تبويب: الأرباح والمصروفات (Branch P&L & Profitability) */}
            {/* ========================================================================= */}
            <TabsContent value="profitability" className="space-y-6">
              {activeBranch && (
                <>
                  {(() => {
                    const pl = calculateBranchProfitability(activeBranch, invoices, expenses);
                    const branchExpensesList = getExpensesForBranch(activeBranch.id, expenses);

                    return (
                      <div className="space-y-6">
                        {/* P&L Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-5 rounded-2xl border border-foreground/10 bg-card">
                            <span className="text-xs text-muted-foreground font-bold block">إجمالي إيرادات الفرع</span>
                            <span className="text-2xl font-black text-primary tabular-nums mt-1 block">
                              {fmt(pl.totalRevenue)} {cur}
                            </span>
                            <span className="text-[10px] text-muted-foreground">({pl.invoicesCount} فاتورة مسجلة)</span>
                          </div>

                          <div className="p-5 rounded-2xl border border-foreground/10 bg-card">
                            <span className="text-xs text-muted-foreground font-bold block">تكلفة البضاعة المباعة (COGS)</span>
                            <span className="text-2xl font-black text-muted-foreground tabular-nums mt-1 block">
                              {fmt(pl.totalCogs)} {cur}
                            </span>
                            <span className="text-[10px] text-muted-foreground">مجمل الربح: {fmt(pl.grossProfit)} {cur}</span>
                          </div>

                          <div className="p-5 rounded-2xl border border-foreground/10 bg-card">
                            <span className="text-xs text-muted-foreground font-bold block">المصروفات التشغيلية للفرع</span>
                            <span className="text-2xl font-black text-danger tabular-nums mt-1 block">
                              {fmt(pl.operatingExpenses)} {cur}
                            </span>
                            <span className="text-[10px] text-muted-foreground">إيجار، رواتب، كهرباء ونثريات</span>
                          </div>

                          <div className={cn(
                            "p-5 rounded-2xl border flex flex-col justify-between",
                            pl.netProfit >= 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-danger/30 bg-danger/10"
                          )}>
                            <span className="text-xs font-bold block text-foreground">صافي ربح الفرع (Net Profit)</span>
                            <div className={cn("text-2xl sm:text-3xl font-black tabular-nums mt-1", pl.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-danger")}>
                              {fmt(pl.netProfit)} {cur}
                            </div>
                            <span className="text-[11px] font-bold text-foreground/80">
                              هامش الربح الصافي: {pl.netMarginPct}%
                            </span>
                          </div>
                        </div>

                        {/* Detailed Expenses Allocation Table */}
                        <div className="rounded-2xl border border-foreground/10 bg-card p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm">المصروفات التشغيلية المسجلة لفرع "{activeBranch.name}"</h4>
                            <span className="text-xs text-muted-foreground">
                              المجموع: <strong className="text-danger">{fmt(pl.operatingExpenses)} {cur}</strong>
                            </span>
                          </div>

                          <div className="divide-y divide-[var(--hairline)]">
                            {branchExpensesList.map((exp) => (
                              <div key={exp.id} className="py-3 flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-bold">{exp.category}</span>
                                  <span className="text-muted-foreground block text-[11px]">{exp.notes || "بدون ملاحظات"}</span>
                                </div>
                                <div className="text-left font-black text-danger tabular-nums">
                                  {fmt(exp.amount)} {cur}
                                </div>
                              </div>
                            ))}

                            {branchExpensesList.length === 0 && (
                              <div className="py-8 text-center text-xs text-muted-foreground">
                                لم يتم تسجيل مصروفات خاصة بهذا الفرع بعد.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </TabsContent>

            {/* ========================================================================= */}
            {/* 6️⃣ تبويب: المقارنات والتحليلات (Branch Analytics & Leaderboard) */}
            {/* ========================================================================= */}
            <TabsContent value="analytics" className="space-y-6">
              {/* Leaderboard */}
              <div className="rounded-2xl border border-foreground/10 bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <Award className="h-5 w-5 text-amber-500" />
                      لوحة متصدري الفروع (Branches Leaderboard)
                    </h3>
                    <p className="text-xs text-muted-foreground">ترتيب الفروع حسب الإيرادات، صافي الأرباح ومعدل السلة</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {branches
                    .map((b) => calculateBranchProfitability(b, invoices, expenses))
                    .sort((a, b) => b.totalRevenue - a.totalRevenue)
                    .map((item, idx) => (
                      <div
                        key={item.branchId}
                        className={cn(
                          "relative rounded-2xl border p-4 flex flex-col justify-between gap-3",
                          idx === 0
                            ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20"
                            : "border-foreground/10 bg-card/60"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-7 w-7 rounded-full flex items-center justify-center text-xs font-black",
                                idx === 0
                                  ? "bg-amber-500 text-black"
                                  : idx === 1
                                  ? "bg-slate-300 text-black"
                                  : "bg-amber-700/40 text-amber-200"
                              )}
                            >
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-sm">{item.branchName}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-bold">
                            هامش {item.netMarginPct}%
                          </Badge>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">المبيعات:</span>
                            <strong className="text-primary tabular-nums">{fmt(item.totalRevenue)} {cur}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">صافي الربح:</span>
                            <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(item.netProfit)} {cur}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">متوسط الفاتورة:</span>
                            <strong className="tabular-nums">{fmt(item.averageTicketSize)} {cur}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Comparative Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-foreground/10 bg-card p-5 space-y-4">
                  <h4 className="font-bold text-sm">مقارنة الإيرادات بين الفروع</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={branches.map((b) => {
                          const pl = calculateBranchProfitability(b, invoices, expenses);
                          return { name: b.name, revenue: pl.totalRevenue, profit: pl.netProfit };
                        })}
                      >
                        <XAxis dataKey="name" stroke="#888888" fontSize={11} />
                        <YAxis stroke="#888888" fontSize={11} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" name="الإيرادات" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="profit" fill="#10b981" name="صافي الربح" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-foreground/10 bg-card p-5 space-y-4">
                  <h4 className="font-bold text-sm">توزيع قيمة المخزون عبر الفروع</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={branches.map((b) => {
                            const val = calculateBranchStockValuation(b.id, stockItems);
                            return { name: b.name, value: val.totalCostValue || 100 };
                          })}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          label
                        >
                          {branches.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={["#0ea5e9", "#10b981", "#f59e0b", "#6366f1"][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ========================================================================= */}
            {/* 7️⃣ تبويب: الموظفين والصلاحيات (Staff & Permissions) */}
            {/* ========================================================================= */}
            <TabsContent value="staff" className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold">إدارة موظفي وصلاحيات الفروع</h3>
                  <p className="text-xs text-muted-foreground">ربط الكاشير، البائعين والمديرين بالفروع وتحديد نطاق الرؤية</p>
                </div>

                <Button
                  onClick={() => {
                    setEditingStaff(null);
                    setIsStaffDialogOpen(true);
                  }}
                  className="rounded-full px-5 h-9 font-bold text-xs shadow-sm"
                >
                  <Plus className="ml-1.5 h-4 w-4" />
                  إضافة موظف جديد
                </Button>
              </div>

              {/* Role Scope Simulator */}
              <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <div>
                    <span className="text-xs font-bold block">محاكي نطاق الصلاحيات (Scope Simulator)</span>
                    <span className="text-[11px] text-muted-foreground">
                      تجربة عرض البيانات كما يراها موظف فرع معين فقط دون صلاحية المدير العام
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={roleSimulatorBranch}
                    onValueChange={(val) => {
                      setRoleSimulatorBranch(val);
                      setActiveBranchId(val);
                      toast.info(val === "all" ? "تم الرجوع لوضع المدير العام (كل الفروع)" : `تم تقييد الصلاحية لفرع محدد`);
                    }}
                  >
                    <SelectTrigger className="h-8 w-44 rounded-full text-xs font-semibold">
                      <SelectValue placeholder="اختر النطاق" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs font-bold">
                        صلاحية المدير العام (كل الفروع)
                      </SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          مقيد بفرع: {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Staff List Table */}
              <div className="rounded-2xl border border-foreground/10 bg-card overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hairline)] bg-muted/40 text-muted-foreground font-bold">
                      <th className="p-3.5">اسم الموظف</th>
                      <th className="p-3.5">الفرع المخصص</th>
                      <th className="p-3.5">الدور الوظيفي</th>
                      <th className="p-3.5">الهاتف</th>
                      <th className="p-3.5">الراتب الأساسي</th>
                      <th className="p-3.5 text-center">الحالة</th>
                      <th className="p-3.5 text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hairline)]">
                    {staffList.map((staff) => {
                      const branch = branches.find((b) => b.id === staff.branchId);
                      const roleMap = {
                        manager: { label: "مدير فرع", color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
                        cashier: { label: "كاشير", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
                        sales: { label: "بائع / مبيعات", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
                        inventory_keeper: { label: "أمين مخزن", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
                        accountant: { label: "محاسب", color: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
                      }[staff.role] || { label: staff.role, color: "bg-card" };

                      return (
                        <tr key={staff.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3.5 font-bold text-sm">{staff.name}</td>
                          <td className="p-3.5 font-semibold text-primary">{branch?.name || "الفرع الرئيسي"}</td>
                          <td className="p-3.5">
                            <Badge variant="outline" className={cn("text-[10px] font-bold", roleMap.color)}>
                              {roleMap.label}
                            </Badge>
                          </td>
                          <td className="p-3.5 tabular-nums" dir="ltr">{staff.phone}</td>
                          <td className="p-3.5 tabular-nums font-bold">{fmt(staff.salary)} {cur}</td>
                          <td className="p-3.5 text-center">
                            <Badge variant={staff.active ? "default" : "secondary"} className="text-[10px]">
                              {staff.active ? "نشط" : "معطل"}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-left">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() => {
                                  setEditingStaff(staff);
                                  setIsStaffDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-danger hover:bg-danger/10"
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من حذف ${staff.name}؟`)) {
                                    removeBranchStaffMember(staff.id);
                                    refreshBranchData();
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>

          {/* ==================== DIALOGS & MODALS ==================== */}

          {/* Branch Add / Edit Dialog */}
          <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
              <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-8 py-6">
                <DialogTitle className="text-xl font-bold">
                  {editingBranch ? "تعديل بيانات الفرع" : "إضافة فرع جديد"}
                </DialogTitle>
              </div>
              <form onSubmit={handleSaveBranch} className="p-8 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">اسم الفرع *</Label>
                  <Input id="name" name="name" defaultValue={editingBranch?.name} required placeholder="مثلاً: فرع المهندسين" className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">الموقع / العنوان التفصيلي</Label>
                  <Input id="location" name="location" defaultValue={editingBranch?.location || ""} placeholder="شارع سوريا، المهندسين، الجيزة" className="h-11 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف</Label>
                    <Input id="phone" name="phone" defaultValue={editingBranch?.phone || ""} placeholder="010..." className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="managerName">اسم المدير</Label>
                    <Input id="managerName" name="managerName" defaultValue={editingBranch?.managerName || ""} placeholder="محمد علي..." className="h-11 rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="branchCode">كود الفرع</Label>
                    <Input id="branchCode" name="branchCode" defaultValue={editingBranchProfile.code || ""} placeholder="BR-01" className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branchEmail">بريد الفرع</Label>
                    <Input id="branchEmail" name="branchEmail" defaultValue={editingBranchProfile.email || ""} placeholder="branch@store.com" className="h-11 rounded-xl" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxNumber">السجل الضريبي للفرع</Label>
                    <Input id="taxNumber" name="taxNumber" defaultValue={editingBranchProfile.taxNumber || ""} placeholder="100-200-300" className="h-11 rounded-xl" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commercialRecord">السجل التجاري للفرع</Label>
                    <Input id="commercialRecord" name="commercialRecord" defaultValue={editingBranchProfile.commercialRecord || ""} placeholder="12345" className="h-11 rounded-xl" dir="ltr" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-foreground/10 bg-card/50">
                  <div className="space-y-0.5">
                    <Label>تعيين كفرع رئيسي</Label>
                    <p className="text-xs text-muted-foreground">يكون المرجع الافتراضي للمخزون والعمليات</p>
                  </div>
                  <Switch name="isMain" defaultChecked={editingBranch?.isMain} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 h-11 rounded-xl font-bold">حفظ الفرع</Button>
                  <Button type="button" variant="outline" onClick={() => setIsBranchDialogOpen(false)} className="h-11 px-6 rounded-xl">إلغاء</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Create Stock Transfer Dialog */}
          <Dialog open={isCreateTransferOpen} onOpenChange={setIsCreateTransferOpen}>
            <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
              <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-6 py-5">
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-primary" />
                  إنشاء أمر تحويل ونقل بضائع
                </DialogTitle>
              </div>
              <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">فرع المصدر (الإرسال) *</Label>
                    <Select value={transferFrom} onValueChange={setTransferFrom}>
                      <SelectTrigger className="h-10 rounded-xl text-xs">
                        <SelectValue placeholder="اختر فرع المصدر" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">فرع الوجهة (الاستلام) *</Label>
                    <Select value={transferTo} onValueChange={setTransferTo}>
                      <SelectTrigger className="h-10 rounded-xl text-xs">
                        <SelectValue placeholder="اختر فرع الوجهة" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.filter((b) => b.id !== transferFrom).map((b) => (
                          <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">اسم السائق / شركة النقل (اختياري)</Label>
                  <Input
                    placeholder="مثلاً: كابتن محمود - 010..."
                    value={transferDriver}
                    onChange={(e) => setTransferDriver(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                {/* Add items to transfer */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-bold">اختيار الأصناف المراد تحويلها:</Label>
                  <Select onValueChange={(val) => {
                    const found = stockItems.find((s) => s.id === val);
                    if (found) handleAddTransferItem(found);
                  }}>
                    <SelectTrigger className="h-10 rounded-xl text-xs bg-muted/30">
                      <SelectValue placeholder="🔍 اضغط للبحث واختيار صنف..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stockItems.map((st) => (
                        <SelectItem key={st.id} value={st.id} className="text-xs">
                          {st.name} (المتاح إجمالاً: {st.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected Transfer Items Table */}
                {transferItems.length > 0 && (
                  <div className="rounded-xl border border-foreground/10 overflow-hidden text-xs">
                    <table className="w-full text-right">
                      <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-[var(--hairline)]">
                        <tr>
                          <th className="p-2.5">الصنف</th>
                          <th className="p-2.5 text-center w-28">الكمية المحولة</th>
                          <th className="p-2.5 text-left w-12">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--hairline)]">
                        {transferItems.map((item, idx) => (
                          <tr key={item.stockItemId}>
                            <td className="p-2.5 font-bold">{item.name}</td>
                            <td className="p-2.5 text-center">
                              <Input
                                type="number"
                                min={1}
                                value={item.sentQty}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 1;
                                  setTransferItems((prev) =>
                                    prev.map((i, iIdx) =>
                                      iIdx === idx ? { ...i, sentQty: val, requestedQty: val } : i
                                    )
                                  );
                                }}
                                className="h-8 w-20 text-center mx-auto rounded-lg font-bold"
                              />
                            </td>
                            <td className="p-2.5 text-left">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-danger rounded-full"
                                onClick={() => setTransferItems((prev) => prev.filter((_, iIdx) => iIdx !== idx))}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">ملاحظات التحويل</Label>
                  <Input
                    placeholder="تعليمات خاصة بالشحن أو التخزين..."
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleCreateTransferSubmit} className="flex-1 h-10 rounded-xl font-bold text-xs">
                    حفظ أمر التحويل
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateTransferOpen(false)} className="h-10 rounded-xl text-xs">
                    إلغاء
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Confirm Receive Modal */}
          <Dialog open={receiveModalOpen} onOpenChange={setReceiveModalOpen}>
            <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
              <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-6 py-5">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  تأكيد استلام وفحص الشحنة ({receiveTargetTransfer?.transferNumber})
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  أدخل الكميات السليمة المستلمة والتوالف إن وجدت قبل اعتماد الإيداع بمخزن الفرع
                </DialogDescription>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="divide-y divide-[var(--hairline)]">
                  {receiveTargetTransfer?.items.map((item) => {
                    const currentInput = receivedItemInputs[item.stockItemId] || {
                      receivedQty: item.sentQty,
                      damagedQty: 0,
                      notes: "",
                    };

                    return (
                      <div key={item.stockItemId} className="py-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold">{item.name}</span>
                          <span className="text-muted-foreground">المشحون: <strong>{item.sentQty}</strong> قطعة</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-[10px] text-emerald-600 font-bold">الكمية السليمة المستلمة</Label>
                            <Input
                              type="number"
                              min={0}
                              value={currentInput.receivedQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setReceivedItemInputs((prev) => ({
                                  ...prev,
                                  [item.stockItemId]: { ...prev[item.stockItemId], receivedQty: val },
                                }));
                              }}
                              className="h-8 rounded-lg text-center font-bold text-xs"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] text-danger font-bold">الكمية التالفة / المفقودة</Label>
                            <Input
                              type="number"
                              min={0}
                              value={currentInput.damagedQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setReceivedItemInputs((prev) => ({
                                  ...prev,
                                  [item.stockItemId]: { ...prev[item.stockItemId], damagedQty: val },
                                }));
                              }}
                              className="h-8 rounded-lg text-center font-bold text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-3">
                  <Button onClick={handleConfirmReceive} className="flex-1 h-10 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700">
                    اعتماد الاستلام وإيداع المخزون
                  </Button>
                  <Button variant="outline" onClick={() => setReceiveModalOpen(false)} className="h-10 rounded-xl text-xs">
                    إلغاء
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Cash Remittance Dialog */}
          <Dialog open={isRemittanceOpen} onOpenChange={setIsRemittanceOpen}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
              <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-6 py-5">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5 text-primary" />
                  توريد نقدية من الفرع للخزينة / البنك
                </DialogTitle>
              </div>
              <form onSubmit={handleAddRemittanceSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">المبلغ المراد توريده ({cur}) *</Label>
                  <Input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={remittanceAmount}
                    onChange={(e) => setRemittanceAmount(e.target.value)}
                    className="h-11 rounded-xl text-base font-black text-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">الجهة المحول إليها *</Label>
                  <Select
                    value={remittanceDest}
                    onValueChange={(val: any) => {
                      setRemittanceDest(val);
                      setRemittanceDestName(val === "main_vault" ? "الخزينة المركزية (المقر العام)" : "الحساب البنكي للشركة");
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main_vault" className="text-xs">الخزينة المركزية (المقر الرئيسي)</SelectItem>
                      <SelectItem value="bank" className="text-xs">الحساب البنكي / إيداع مباشر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">رقم إيصال الإيداع / المرجع</Label>
                  <Input
                    placeholder="مثلاً: REF-9874"
                    value={remittanceRef}
                    onChange={(e) => setRemittanceRef(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">ملاحظات التوريد</Label>
                  <Input
                    placeholder="اسم المندوب أو مستلم النقدية..."
                    value={remittanceNotes}
                    onChange={(e) => setRemittanceNotes(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 h-10 rounded-xl font-bold text-xs">
                    تأكيد التوريد
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsRemittanceOpen(false)} className="h-10 rounded-xl text-xs">
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Shift Closing & Z-Report Dialog */}
          <Dialog open={isZReportOpen} onOpenChange={setIsZReportOpen}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
              <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-6 py-5">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  تقفيل الوردية اليومية (Z-Report)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  جرد النقدية بالدرج ومطابقتها مع المبيعات والمصروفات المسجلة بالنظام
                </DialogDescription>
              </div>
              <form onSubmit={handleCloseShiftSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">اسم الكاشير المسؤول *</Label>
                  <Input
                    required
                    value={zCashierName}
                    onChange={(e) => setZCashierName(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">العهدة الافتتاحية ({cur})</Label>
                    <Input
                      type="number"
                      value={zOpeningCash}
                      onChange={(e) => setZOpeningCash(e.target.value)}
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-primary">النقدية الفعلية بالدرج ({cur}) *</Label>
                    <Input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={zActualCash}
                      onChange={(e) => setZActualCash(e.target.value)}
                      className="h-10 rounded-xl text-xs font-black"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">سبب الفارق (إن وجد عجز أو زيادة)</Label>
                  <Input
                    placeholder="مثلاً: فكة ناقصة، تم تسوية نثريات..."
                    value={zVarianceReason}
                    onChange={(e) => setZVarianceReason(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 h-10 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700">
                    اعتماد الإغلاق وطباعة Z-Report
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsZReportOpen(false)} className="h-10 rounded-xl text-xs">
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Staff Add / Edit Dialog */}
          <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
              <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-6 py-5">
                <DialogTitle className="text-base font-bold">
                  {editingStaff ? "تعديل بيانات الموظف" : "إضافة موظف جديد بالفرع"}
                </DialogTitle>
              </div>
              <form onSubmit={handleSaveStaff} className="p-6 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">اسم الموظف *</Label>
                  <Input name="name" defaultValue={editingStaff?.name} required placeholder="الاسم ثلاثي..." className="h-10 rounded-xl text-xs" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">الفرع المخصص *</Label>
                    <Select name="branchId" defaultValue={editingStaff?.branchId || (activeBranch ? activeBranch.id : "")}>
                      <SelectTrigger className="h-10 rounded-xl text-xs">
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">الدور الوظيفي *</Label>
                    <Select name="role" defaultValue={editingStaff?.role || "cashier"}>
                      <SelectTrigger className="h-10 rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager" className="text-xs">مدير فرع</SelectItem>
                        <SelectItem value="cashier" className="text-xs">كاشير</SelectItem>
                        <SelectItem value="sales" className="text-xs">بائع / مبيعات</SelectItem>
                        <SelectItem value="inventory_keeper" className="text-xs">أمين مخزن</SelectItem>
                        <SelectItem value="accountant" className="text-xs">محاسب</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">رقم الهاتف</Label>
                    <Input name="phone" defaultValue={editingStaff?.phone} placeholder="010..." className="h-10 rounded-xl text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">الراتب الأساسي ({cur})</Label>
                    <Input name="salary" type="number" defaultValue={editingStaff?.salary || 4500} className="h-10 rounded-xl text-xs" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-foreground/10 bg-card/50">
                  <span className="text-xs font-bold">الحساب نشط</span>
                  <Switch name="active" defaultChecked={editingStaff ? editingStaff.active : true} />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 h-10 rounded-xl font-bold text-xs">
                    حفظ بيانات الموظف
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsStaffDialogOpen(false)} className="h-10 rounded-xl text-xs">
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageTransition>
    </AppShell>
  );
}
