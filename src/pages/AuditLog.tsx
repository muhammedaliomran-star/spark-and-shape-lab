import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { MetricCard } from "@/components/MetricCard";
import { ActionButton } from "@/components/ActionButton";
import { Reveal } from "@/components/Reveal";
import { usePrivacy } from "@/lib/privacy";
import { fmt } from "@/lib/store";
import {
  useAuditLogs,
  type AuditLogEntry,
  type AuditModule,
  type AuditSeverity,
  type AuditActionType,
  ACTION_TYPE_META,
  MODULE_META,
} from "@/lib/audit";
import { useStaffAndShifts } from "@/lib/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Download,
  Filter,
  FileSpreadsheet,
  FileText,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Activity,
  Layers,
  ChevronDown,
  Info,
  Sliders,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";

export default function AuditLog() {
  const { privacy } = usePrivacy();
  const { logs, stats, clearLogs } = useAuditLogs();
  const { staffList } = useStaffAndShifts();

  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [viewLog, setViewLog] = useState<AuditLogEntry | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedModule !== "all" && log.module !== selectedModule) return false;
      if (selectedSeverity !== "all" && log.severity !== selectedSeverity) return false;
      if (selectedStaff !== "all" && log.staffName !== selectedStaff) return false;
      if (selectedDate && !log.timestamp.startsWith(selectedDate)) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchTitle = log.title.toLowerCase().includes(q);
        const matchDetails = log.details?.toLowerCase().includes(q);
        const matchStaff = log.staffName.toLowerCase().includes(q);
        const matchEntity = log.entityName?.toLowerCase().includes(q);
        if (!matchTitle && !matchDetails && !matchStaff && !matchEntity) return false;
      }

      return true;
    });
  }, [logs, selectedModule, selectedSeverity, selectedStaff, selectedDate, search]);

  const severityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive" className="bg-rose-600 text-white text-[10px] font-bold">حرج جداً</Badge>;
      case "danger":
        return <Badge variant="destructive" className="bg-red-500 text-white text-[10px] font-bold">عالي الخطورة</Badge>;
      case "warning":
        return <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">تنبيه / تعديل</Badge>;
      case "info":
      default:
        return <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">اعتيادي</Badge>;
    }
  };

  const exportCSV = () => {
    const headers = ["التاريخ والوقت", "الموظف", "الرتبة", "الفرع", "القسم", "الإجراء", "البيان", "ملاحظات وتفاصيل"];
    const body = filteredLogs.map((l) => [
      new Date(l.timestamp).toLocaleString("ar-EG"),
      l.staffName,
      l.staffRole,
      l.branchName || "—",
      MODULE_META[l.module]?.label || l.module,
      l.title,
      l.entityName || "—",
      l.details || "—",
    ]);

    const csv = "\uFEFF" + [headers, ...body]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير سجل التدقيق إلى Excel");
  };

  const exportPDF = () => {
    const rowsHtml = filteredLogs.slice(0, 100).map((l, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${new Date(l.timestamp).toLocaleTimeString("ar-EG")}</td>
        <td>${l.staffName}</td>
        <td>${MODULE_META[l.module]?.label || l.module}</td>
        <td><strong>${l.title}</strong></td>
        <td>${l.details || "—"}</td>
      </tr>
    `).join("");

    const html = pdfDocument({
      docTitle: "سجل تدقيق وتتبع حركات النظام — سِجلّي",
      badge: "تقرير رقابي",
      title: "سجل الرقابة وتتبع الحركات (Audit Trail)",
      lede: `إجمالي السجلات: ${filteredLogs.length} حركة مسجلة`,
      meta: [{ label: "تاريخ الاستخراج", value: new Date().toLocaleString("ar-EG") }],
      body: `
        <table>
          <thead>
            <tr><th>م</th><th>الوقت</th><th>الموظف</th><th>القسم</th><th>الإجراء</th><th>التفاصيل</th></tr>
          </thead>
          <tbody>${rowsHtml || `<tr><td colspan="6">لا توجد سجلات مطابقة</td></tr>`}</tbody>
        </table>
      `,
    });
    openPdfDocument(html);
  };

  return (
    <AppShell>
      <PageTransition>
        <PageHeader
          eyebrow="الرقابة الإدارية • سجل التدقيق والأمان"
          title="سجل حركات النظام (Audit Trail)"
          subtitle="تتبع وتدقيق جميع التعديلات، الحذف، إصدار الفواتير، الخصومات، والعمليات الحساسة لمنع التلاعب."
          action={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ActionButton tone="surface" icon={<Download className="h-4 w-4" />}>
                    <span className="inline-flex items-center gap-1">
                      تصدير السجل <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </span>
                  </ActionButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-right">
                  <DropdownMenuItem onClick={exportCSV}>
                    <FileSpreadsheet className="me-2 h-4 w-4" /> تصدير Excel / CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPDF}>
                    <FileText className="me-2 h-4 w-4" /> تقرير PDF رقابي
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <ActionButton
                tone="surface"
                onClick={() => setConfirmClearOpen(true)}
                icon={<Trash2 className="h-4 w-4 text-rose-500" />}
              >
                تفريغ السجل
              </ActionButton>
            </>
          }
        />

        {/* Metric Cards */}
        <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard
            label="إجمالي الحركات المسجلة"
            value={stats.total}
            isMoney={false}
            icon={Activity}
            tone="neutral"
            format={(n) => `${fmt(n)} حركة`}
            sub="سجل تاريخي كامل"
          />

          <MetricCard
            label="حركات اليوم"
            value={stats.todayCount}
            isMoney={false}
            icon={Clock}
            tone="positive"
            format={(n) => `${fmt(n)} عملية`}
            sub="نشاط الوردية الحالية"
          />

          <MetricCard
            label="إجراءات حرجة وتعديلات"
            value={stats.warningCount}
            isMoney={false}
            icon={ShieldAlert}
            tone={stats.warningCount > 0 ? "danger" : "positive"}
            format={(n) => `${fmt(n)} إجراء`}
            sub="تعديل أسعار، حذف، خصومات"
          />

          <MetricCard
            label="الموظفين المسجل نشاطهم"
            value={stats.staffActionCounts.length}
            isMoney={false}
            icon={User}
            tone="neutral"
            format={(n) => `${n} موظف`}
            sub="مستخدمين نشطين"
          />
        </div>

        {/* Filters and Search Bar */}
        <Reveal className="mb-6">
          <BezelCard variant="flat" innerClassName="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--hairline)]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-primary" /> فلاتر سريعة:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSeverity("all");
                    setSelectedModule("all");
                    setSelectedStaff("all");
                    setSelectedDate("");
                    setSearch("");
                  }}
                  className={cn(
                    "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                    selectedSeverity === "all" && selectedModule === "all" && !selectedDate
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  الكل ({logs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSeverity("critical")}
                  className={cn(
                    "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                    selectedSeverity === "critical"
                      ? "bg-rose-600 text-white"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                  )}
                >
                  حرج وحذف فقط
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModule("invoices")}
                  className={cn(
                    "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                    selectedModule === "invoices"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                  )}
                >
                  الفواتير
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModule("inventory")}
                  className={cn(
                    "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                    selectedModule === "inventory"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                  )}
                >
                  المخزن
                </button>
              </div>

              <span className="text-xs font-mono font-bold text-muted-foreground">
                المعروض: {filteredLogs.length} من {logs.length}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <Label className="text-xs mb-1.5 block">بحث في الحركات</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute end-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث بالموظف، البيان، أو نوع العملية..."
                    className="pe-9 h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">القسم / الوحدة</Label>
                <Select value={selectedModule} onValueChange={setSelectedModule}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="all">كل الأقسام</SelectItem>
                    {Object.entries(MODULE_META).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">الموظف القائم بالإجراء</Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="all">كل الموظفين</SelectItem>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name} ({s.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">التاريخ</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-9 text-xs font-mono"
                  dir="ltr"
                />
              </div>
            </div>
          </BezelCard>
        </Reveal>

        {/* Audit Trail List */}
        <Reveal>
          <BezelCard variant="flat" innerClassName="p-0 overflow-hidden">
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[48rem] text-right text-xs">
                <thead>
                  <tr className="border-b border-[var(--hairline)] bg-muted/30 text-[11px] font-bold text-muted-foreground">
                    <th className="p-3.5">الوقت والتاريخ</th>
                    <th className="p-3.5">الموظف والرتبة</th>
                    <th className="p-3.5">القسم</th>
                    <th className="p-3.5">نوع الحركة</th>
                    <th className="p-3.5">التفاصيل والبيان</th>
                    <th className="p-3.5">الخطورة</th>
                    <th className="p-3.5 text-center">عرض</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)]">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-muted-foreground">
                        <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-primary opacity-60" />
                        لا توجد حركات أو سجلات تطابق الفلتر المحدد
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const mod = MODULE_META[log.module] || { label: log.module, color: "" };
                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-foreground/[0.02] transition-colors cursor-pointer"
                          onClick={() => setViewLog(log)}
                        >
                          <td className="p-3.5 font-mono text-muted-foreground whitespace-nowrap" dir="ltr">
                            {new Date(log.timestamp).toLocaleDateString("ar-EG")} {new Date(log.timestamp).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-3.5 font-semibold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              <span>{log.staffName}</span>
                              <span className="text-[10px] text-muted-foreground">({log.staffRole})</span>
                            </div>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold border", mod.color)}>
                              {mod.label}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-foreground whitespace-nowrap">
                            {log.title}
                          </td>
                          <td className="p-3.5 text-muted-foreground max-w-xs truncate">
                            {log.details || log.entityName || "—"}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {severityBadge(log.severity)}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                              تفاصيل
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </BezelCard>
        </Reveal>

        {/* View Log Details Modal */}
        <Dialog open={!!viewLog} onOpenChange={(v) => !v && setViewLog(null)}>
          <DialogContent dir="rtl" className="text-right sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-base font-bold">
                <span>تفاصيل الحركة المسجلة</span>
                {viewLog && severityBadge(viewLog.severity)}
              </DialogTitle>
            </DialogHeader>

            {viewLog && (
              <div className="space-y-3 py-2 text-xs">
                <div className="p-3 rounded-xl bg-muted/40 border border-[var(--hairline)] space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">عنوان الحركة:</span>
                    <strong className="text-foreground">{viewLog.title}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الوقت والتاريخ:</span>
                    <span className="font-mono text-foreground">{new Date(viewLog.timestamp).toLocaleString("ar-EG")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الموظف المنفذ:</span>
                    <span className="font-bold text-foreground">{viewLog.staffName} ({viewLog.staffRole})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الفرع:</span>
                    <span className="text-foreground">{viewLog.branchName || "الفرع الرئيسي"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">القسم:</span>
                    <span className="text-foreground">{MODULE_META[viewLog.module]?.label || viewLog.module}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-card border border-[var(--hairline)] space-y-1.5">
                  <span className="font-bold text-foreground block">بيان وتفاصيل العملية:</span>
                  <p className="text-muted-foreground leading-relaxed">{viewLog.details || "لا توجد تفاصيل إضافية مسجلة."}</p>
                </div>

                {(viewLog.oldValue !== undefined || viewLog.newValue !== undefined) && (
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/30 border border-[var(--hairline)]">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">القيمة السابقة (قبل):</span>
                      <strong className="font-mono text-rose-500">{String(viewLog.oldValue ?? "—")}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">القيمة الجديدة (بعد):</span>
                      <strong className="font-mono text-emerald-500">{String(viewLog.newValue ?? "—")}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setViewLog(null)} className="w-full rounded-xl text-xs font-bold">
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clear Logs Confirm */}
        <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
          <AlertDialogContent dir="rtl" className="text-right">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> تأكيد تفريغ سجل التدقيق
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs">
                هل أنت متأكد من مسح وتفريغ سجل الحركات بالكامل؟ لا يمكن التراجع عن هذه الخطوة، وتُستخدم فقط في بداية السنوات المالية الجديدة.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-xl text-xs">إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  clearLogs();
                  toast.success("تم تفريغ سجل الحركات بنجاح");
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
              >
                تأكيد التفريغ
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageTransition>
    </AppShell>
  );
}
