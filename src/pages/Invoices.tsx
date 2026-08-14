import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useEffect, useMemo, useState } from "react";
import { format, addMonths } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useDB, db, daysLate, fmt, customerBalance, getShopSettings, invoiceNumber, useShopSettings, type Invoice, type Customer } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Wallet, AlertTriangle, Printer, ShieldAlert, Eye, Pencil, Trash2, Bell, History, TrendingUp, CalendarDays, AlertCircle, MessageCircle, EyeOff, Download, FileSpreadsheet, FileText, X, ChevronsUpDown, Check, Package, ScanLine, Info, CreditCard } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";

import { findStockByBarcode } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Banknote } from "lucide-react";
import { usePrivacy } from "@/lib/privacy";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { toArabicDigits } from "@/lib/arabic-digits";
import { cn } from "@/lib/utils";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";

type Tab = "active" | "overdue" | "settled" | "all";

function isoToDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export default function Page() { return (<AppShell><PageTransition><InvoicesPage /></PageTransition></AppShell>); }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function InvoicesPage() {
  const data = useDB();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [viewInv, setViewInv] = useState<Invoice | null>(null);
  const [editInv, setEditInv] = useState<Invoice | null>(null);
  const [reminderInv, setReminderInv] = useState<Invoice | null>(null);
  const { privacy, toggle } = usePrivacy();
  const { settings: shopSettings } = useShopSettings();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [searchScanOpen, setSearchScanOpen] = useState(false);
  const mask = (s: string) => s;
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  const counts = useMemo(() => {
    let active = 0, overdue = 0, settled = 0;
    for (const i of data.invoices) {
      const remaining = i.total - i.paid;
      if (remaining <= 0) settled++;
      else if (daysLate(i) > 0) { overdue++; active++; }
      else active++;
    }
    return { active, overdue, settled, all: data.invoices.length };
  }, [data.invoices]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    let activeSalesTotal = 0;
    let monthCollections = 0;
    let overdueCount = 0;
    for (const i of data.invoices) {
      const remaining = i.total - i.paid;
      if (remaining > 0) activeSalesTotal += remaining;
      if (remaining > 0 && daysLate(i) > 0) overdueCount++;
    }
    for (const p of data.payments) {
      const d = new Date(p.paidAt);
      if (d >= monthStart && d <= monthEnd) monthCollections += p.amount;
    }
    return { activeSalesTotal, monthCollections, overdueCount };
  }, [data.invoices, data.payments]);

  const list = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).getTime() : null;
    const toTs = dateTo ? new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59).getTime() : null;
    return data.invoices
      .filter((i) => {
        const remaining = i.total - i.paid;
        if (tab === "active") return remaining > 0;
        if (tab === "overdue") return remaining > 0 && daysLate(i) > 0;
        if (tab === "settled") return remaining <= 0;
        return true;
      })
      .filter((i) => {
        if (!q) return true;
        const c = data.customers.find((c) => c.id === i.customerId);
        return c?.name.includes(q) || c?.phone.includes(q);
      })
      .filter((i) => {
        if (!fromTs && !toTs) return true;
        const t = new Date(i.createdAt).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
        return true;
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [data, q, tab, dateFrom, dateTo]);

  const findCustomer = (id: string) => data.customers.find((c) => c.id === id);

  const exportCSV = () => {
    const headers = ["رقم الفاتورة", "العميل", "الهاتف", "الإجمالي", "المسدد", "المتبقي", "القسط الشهري", "تاريخ أول قسط", "تاريخ الإنشاء", "الحالة"];
    const rows = list.map((inv) => {
      const c = findCustomer(inv.customerId);
      const remaining = inv.total - inv.paid;
      const late = daysLate(inv);
      const status = remaining === 0 ? "مسددة" : late > 0 ? `متأخرة ${late} يوم` : "نشطة";
      return [inv.id.slice(0, 6), c?.name ?? "—", c?.phone ?? "—", inv.total, inv.paid, remaining, inv.monthlyInstallment, isoToDDMMYYYY(inv.firstDueDate), format(new Date(inv.createdAt), "dd/MM/yyyy"), status];
    });
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `invoices-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير الملف");
  };

  const exportPDF = () => {
    const today = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
    let sumTotal = 0, sumPaid = 0, sumRemaining = 0, lateCount = 0;
    const rowsHtml = list.map((inv) => {
      const c = findCustomer(inv.customerId);
      const remaining = inv.total - inv.paid;
      const late = daysLate(inv);
      sumTotal += inv.total; sumPaid += inv.paid; sumRemaining += Math.max(0, remaining);
      if (remaining > 0 && late > 0) lateCount++;
      const status = remaining === 0 ? "مسددة" : late > 0 ? `متأخرة ${late} يوم` : "نشطة";
      const tag = remaining === 0 ? "payment" : late > 0 ? "purchase" : "opening";
      return `<tr><td>#${escapeHtml(inv.id.slice(0,6))}</td><td>${escapeHtml(c?.name ?? "—")}</td><td class="num">${fmt(inv.total)}</td><td class="num ok">${fmt(inv.paid)}</td><td class="num ${remaining > 0 ? "due" : ""}">${fmt(remaining)}</td><td dir="ltr">${escapeHtml(isoToDDMMYYYY(inv.firstDueDate))}</td><td><span class="tag ${tag}">${escapeHtml(status)}</span></td></tr>`;
    }).join("");
    const body = `
<h2 class="sec">قائمة الفواتير</h2>
<div class="t-wrap"><table><thead><tr><th>رقم</th><th>العميل</th><th class="num">الإجمالي</th><th class="num">المسدد</th><th class="num">المتبقي</th><th>الاستحقاق</th><th>الحالة</th></tr></thead>
<tbody>${rowsHtml || `<tr><td colspan="7" class="empty">لا توجد فواتير</td></tr>`}</tbody>
<tfoot><tr><td colspan="2">الإجماليات</td><td class="num">${fmt(sumTotal)}</td><td class="num">${fmt(sumPaid)}</td><td class="num">${fmt(sumRemaining)}</td><td colspan="2">—</td></tr></tfoot></table></div>`;
    const html = pdfDocument({
      docTitle: "تقرير الفواتير — سِجلّي",
      badge: "تقرير فواتير",
      title: "تقرير الفواتير والمبيعات",
      lede: "ملخّص الفواتير مع حالة السداد والاستحقاقات.",
      meta: [
        { label: "تاريخ التقرير", value: today },
        { label: "عدد الفواتير", value: String(list.length) },
      ],
      kpis: [
        { label: "إجمالي الفواتير", value: fmt(sumTotal), tone: "brand" },
        { label: "المسدد", value: fmt(sumPaid) },
        { label: "المتبقي", value: fmt(sumRemaining), tone: "danger" },
        { label: "فواتير متأخرة", value: String(lateCount), tone: "warn" },
      ],
      body,
      page: "A4 landscape",
    });
    if (!openPdfDocument(html)) toast.error("الرجاء السماح بفتح النوافذ المنبثقة");
  };


  return (
    <>
      <PageHeader
        title="الفواتير والمبيعات"
        subtitle="إدارة الأقساط والمبيعات."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={privacy ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={toggle}
              title="إخفاء الأرقام"
            >
              {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">إخفاء الأرقام</span>
            </Button>
            <NewInvoiceDialog trigger={<Button className="gap-2"><Plus className="w-4 h-4" /> فاتورة جديدة</Button>} />
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="إجمالي المبيعات النشطة" value={`${fmt(stats.activeSalesTotal)} ج.م`} tone="success" trend="up" valueClassName={blurCls} />
        <StatCard icon={<CalendarDays className="w-5 h-5" />} label="تحصيلات الشهر الحالي" value={`${fmt(stats.monthCollections)} ج.م`} tone="success" trend="up" valueClassName={blurCls} />
        <StatCard icon={<AlertCircle className="w-5 h-5" />} label="الفواتير المتعثرة" value={String(stats.overdueCount)} tone="danger" trend="down" valueClassName={blurCls} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto">
          <TabsTrigger value="active" className="gap-1.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            فواتير نشطة <Badge variant="secondary" className="rounded-full">{counts.active}</Badge>
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1.5 data-[state=active]:bg-danger/15 data-[state=active]:text-danger">
            متأخرة <Badge variant="secondary" className="rounded-full">{counts.overdue}</Badge>
          </TabsTrigger>
          <TabsTrigger value="settled" className="gap-1.5 data-[state=active]:bg-success/15 data-[state=active]:text-success">
            تم التحصيل <Badge variant="secondary" className="rounded-full">{counts.settled}</Badge>
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            الكل <Badge variant="secondary" className="rounded-full">{counts.all}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-5 flex flex-col md:flex-row md:items-center gap-2">
        <div className="relative md:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهاتف..." className="pr-10 pl-10" />
          <button
            type="button"
            onClick={() => setSearchScanOpen(true)}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            title="مسح باركود"
          >
            <ScanLine className="w-4 h-4" />
          </button>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 justify-start font-normal">
              <CalendarIcon className="w-4 h-4" />
              {dateFrom || dateTo ? (
                <span dir="ltr" className="text-xs">
                  {dateFrom ? format(dateFrom, "dd/MM/yy") : "..."} – {dateTo ? format(dateTo, "dd/MM/yy") : "..."}
                </span>
              ) : <span>تصفية بالتاريخ</span>}
              {(dateFrom || dateTo) && (
                <X
                  className="w-3.5 h-3.5 opacity-60 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); setDateFrom(undefined); setDateTo(undefined); }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: dateFrom, to: dateTo }}
              onSelect={(r: any) => { setDateFrom(r?.from); setDateTo(r?.to); }}
              numberOfMonths={1}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              تصدير التقرير
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportCSV} className="gap-2">
              <FileSpreadsheet className="w-4 h-4 text-success" /> Excel (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPDF} className="gap-2">
              <FileText className="w-4 h-4 text-danger" /> PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="md:ms-auto text-xs text-muted-foreground">
          {list.length} فاتورة
        </div>
      </div>

      <div className="bg-card plate overflow-hidden animate-[fade-in_0.4s_ease-out]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.04] text-muted-foreground">
              <tr>
                <th className="text-right p-4 font-medium">رقم الفاتورة</th>
                <th className="text-right p-4 font-medium">العميل</th>
                <th className="text-right p-4 font-medium">القيمة / المتبقي</th>
                <th className="text-right p-4 font-medium">القسط / الاستحقاق</th>
                <th className="text-right p-4 font-medium">الحالة</th>
                <th className="text-right p-4 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((inv, idx) => {
                const remaining = inv.total - inv.paid;
                const late = daysLate(inv);
                const isOverdue = remaining > 0 && late > 0;
                const status = remaining === 0 ? "مسددة" : isOverdue ? `متأخرة (${late} يوم)` : "نشطة";
                const cls = remaining === 0 ? "bg-success/15 text-success border-success/30" : isOverdue ? "bg-danger/15 text-danger border-danger/30" : "bg-primary/15 text-primary border-primary/30";
                const cust = findCustomer(inv.customerId);
                return (
                  <tr
                    key={inv.id}
                    className={cn(
                      "border-t border-[var(--hairline)] transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] animate-[fade-in_0.3s_ease-out_both]",
                      isOverdue ? "bg-danger/5 hover:bg-danger/10" : "hover:bg-foreground/[0.035]"
                    )}
                    style={{ animationDelay: `${idx * 25}ms` }}
                  >
                    <td className="p-4 font-mono text-muted-foreground">{invoiceNumber(data.invoices, inv.id, shopSettings.invoicePrefix)}</td>
                    <td className="p-4">
                      {cust ? (
                        <button
                          onClick={() => setHistoryFor(cust)}
                          className="font-bold text-primary hover:underline underline-offset-4 decoration-primary/50 transition"
                          title="عرض سجل الحركات الكامل"
                        >
                          {cust.name}
                        </button>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-4">
                      <div className={cn("font-bold", blurCls)}>{`${fmt(inv.total)} ج.م`}</div>
                      <div className={cn("text-xs", remaining > 0 ? "text-danger" : "text-success", blurCls)}>متبقي: {`${fmt(remaining)} ج.م`}</div>
                    </td>
                    <td className="p-4">
                      <div className={blurCls}>{`${fmt(inv.monthlyInstallment)} ج.م`} / شهر</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">{isoToDDMMYYYY(inv.firstDueDate)}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-xl text-xs font-medium border", cls)}>{status}</span>
                        {isOverdue && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-warning hover:bg-warning/15 action-btn" title="تذكير العميل" onClick={() => setReminderInv(inv)}>
                            <Bell className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-0.5">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 action-btn" title="عرض" onClick={() => setViewInv(inv)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-warning hover:bg-warning/10 action-btn" title="تعديل" onClick={() => setEditInv(inv)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 action-btn" title="طباعة" onClick={() => printReceipt(inv, cust?.name ?? "—", cust?.phone ?? "", data.invoices)}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        {remaining > 0 && <PaymentDialog invoiceId={inv.id} max={remaining} />}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger/10 action-btn danger" title="حذف"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الفاتورة</AlertDialogTitle>
                              <AlertDialogDescription>هل أنت متأكد؟ سيتم تحديث رصيد العميل تلقائياً.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => { db.removeInvoice(inv.id); toast.success("تم الحذف"); }}>حذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.loading && list.length === 0 && <TableSkeleton rows={5} cols={6} />}
              {!data.loading && list.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4">
                    <EmptyState
                      icon={FileText}
                      title="لا توجد فواتير في هذا التصنيف"
                      hint="ابدأ بإصدار فاتورة جديدة وهتلاقيها هنا مع حالة السداد والأقساط."
                      action={<NewInvoiceDialog trigger={<Button className="gap-2"><Plus className="w-4 h-4" /> فاتورة جديدة</Button>} />}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <HistoryDialog customer={historyFor} onClose={() => setHistoryFor(null)} invoices={data.invoices} payments={data.payments} items={data.invoiceItems} blurCls={blurCls} onEditInvoice={(i) => { setHistoryFor(null); setEditInv(i); }} />
      <ViewInvoiceDialog inv={viewInv} customer={viewInv ? findCustomer(viewInv.customerId) ?? null : null} onClose={() => setViewInv(null)} />
      <EditInvoiceDialog inv={editInv} onClose={() => setEditInv(null)} />
      <ReminderDialog inv={reminderInv} customer={reminderInv ? findCustomer(reminderInv.customerId) ?? null : null} onClose={() => setReminderInv(null)} />
      <BarcodeScanner
        open={searchScanOpen}
        onClose={() => setSearchScanOpen(false)}
        onDetected={(code) => {
          setSearchScanOpen(false);
          const found = findStockByBarcode(data.stockItems, code);
          if (found) {
            setQ(found.name);
            toast.success(`بحث عن: ${found.name}`);
          } else {
            toast.error(`لم يتم العثور على منتج بالكود: ${code}`);
          }
        }}
        title="مسح باركود — بحث سريع"
      />
    </>
  );
}

function StatCard({ icon, label, value, tone, trend, valueClassName }: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "success" | "danger"; trend?: "up" | "down"; valueClassName?: string }) {
  const toneCls = tone === "primary" ? "bg-primary/10 text-primary border-primary/30" : tone === "success" ? "bg-success/10 text-success border-success/30" : "bg-danger/10 text-danger border-danger/30";
  const valueCls = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "";
  return (
    <div className={cn("rounded-[1.25rem] bg-card/70 p-4 flex items-center gap-3 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] animate-[fade-in_0.4s_ease-out]", tone === "success" ? "border-success/30 hover:border-success/60" : tone === "danger" ? "border-danger/30 hover:border-danger/60" : "border-border hover:border-primary/40")}>
      <div className={cn("w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0", toneCls)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {label}
          {trend === "up" && <TrendingUp className="w-3 h-3 text-success" />}
          {trend === "down" && <TrendingUp className="w-3 h-3 text-danger rotate-180" />}
        </div>
        <div className={cn("text-lg font-extrabold tabular-nums truncate", valueCls, valueClassName)}>{value}</div>
      </div>
    </div>
  );
}

function HistoryDialog({ customer, onClose, invoices, payments, items, blurCls, onEditInvoice }: { customer: Customer | null; onClose: () => void; invoices: Invoice[]; payments: { id: string; invoiceId: string; amount: number; paidAt: string }[]; items: import("@/lib/store").InvoiceItem[]; blurCls: string; onEditInvoice: (inv: Invoice) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<import("@/lib/store").InvoiceItem | null>(null);
  if (!customer) return null;
  const myInvoices = invoices.filter((i) => i.customerId === customer.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const myInvoiceIds = new Set(myInvoices.map((i) => i.id));
  const payList = payments.filter((p) => myInvoiceIds.has(p.invoiceId)).sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt));
  const totalPaid = payList.reduce((s, p) => s + p.amount, 0);
  const balance = customerBalance(invoices, customer.id, customer.openingBalance);
  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end">
            سجل الحركات الكامل
            <History className="w-5 h-5 text-primary" />
          </DialogTitle>
          <DialogDescription className="text-right">كل فواتير ومنتجات ومدفوعات العميل {customer.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-right">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl hairline bg-foreground/[0.035] p-2.5">
              <div className="text-[11px] text-muted-foreground">عدد الفواتير</div>
              <div className="font-bold text-lg">{myInvoices.length}</div>
            </div>
            <div className="rounded-2xl hairline bg-success/10 p-2.5">
              <div className="text-[11px] text-muted-foreground">إجمالي المسدد</div>
              <div className={cn("font-bold text-lg text-success", blurCls)}>{fmt(totalPaid)} ج.م</div>
            </div>
            <div className="rounded-2xl hairline bg-danger/10 p-2.5">
              <div className="text-[11px] text-muted-foreground">المتبقي</div>
              <div className={cn("font-bold text-lg", balance > 0 ? "text-danger" : "text-success", blurCls)}>{fmt(balance)} ج.م</div>
            </div>
          </div>

          <ScrollArea className="max-h-[55vh] rounded-2xl hairline">
            {myInvoices.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10">لا توجد فواتير لهذا العميل</div>
            ) : (
              <div className="divide-y divide-border">
                {myInvoices.map((inv) => {
                  const invItems = items.filter((it) => it.invoiceId === inv.id);
                  const isOpen = expanded === inv.id;
                  const remaining = inv.total - inv.paid;
                  return (
                    <div key={inv.id}>
                      <div className="w-full flex items-center justify-between p-3 hover:bg-foreground/[0.035] transition text-right gap-2">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-warning hover:bg-warning/10" title="تعديل الفاتورة" onClick={(e) => { e.stopPropagation(); onEditInvoice(inv); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-danger hover:bg-danger/10" title="حذف الفاتورة" onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف الفاتورة</AlertDialogTitle>
                                <AlertDialogDescription>سيتم حذف الفاتورة وكل بنودها. لا يمكن التراجع.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => { await db.removeInvoice(inv.id); toast.success("تم حذف الفاتورة"); }}>حذف</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Badge variant="outline" className="text-[10px]">{invItems.length} منتج</Badge>
                          <span className={cn("text-xs", remaining > 0 ? "text-danger" : "text-success", blurCls)}>متبقي {fmt(remaining)} ج.م</span>
                        </div>
                        <button
                          onClick={() => setExpanded(isOpen ? null : inv.id)}
                          className="flex items-center gap-2 flex-1 justify-end"
                        >
                          <span className="text-xs text-muted-foreground" dir="ltr">{format(new Date(inv.createdAt), "dd/MM/yyyy")}</span>
                          <span className={cn("font-bold tabular-nums", blurCls)}>{fmt(inv.total)} ج.م</span>
                          <span className="font-mono text-xs text-muted-foreground">#{inv.id.slice(0, 4)}</span>
                        </button>
                      </div>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            style={{ overflow: "hidden" }}
                          >
                            <div className="bg-foreground/[0.03] px-3 pb-3 pt-1">
                              {invItems.length === 0 ? (
                                <div className="text-xs text-muted-foreground py-3 text-center">
                                  لا توجد منتجات مفصّلة لهذه الفاتورة (قد تكون فاتورة قديمة).
                                </div>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead className="text-muted-foreground">
                                    <tr>
                                      <th className="text-right p-1.5 font-medium">المنتج</th>
                                      <th className="text-right p-1.5 font-medium">التكلفة</th>
                                      <th className="text-right p-1.5 font-medium">السعر</th>
                                      <th className="text-right p-1.5 font-medium">إجراءات</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {invItems.map((it) => (
                                      <tr key={it.id} className="border-t border-[var(--hairline)]">
                                        <td className="p-1.5 font-medium">{it.name}</td>
                                        <td className={cn("p-1.5 tabular-nums", blurCls)}>{fmt(it.cost)} ج.م</td>
                                        <td className={cn("p-1.5 tabular-nums font-bold", blurCls)}>{fmt(it.price)} ج.م</td>
                                        <td className="p-1.5">
                                          <div className="flex items-center gap-0.5">
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-warning hover:bg-warning/10" title="تعديل" onClick={() => setEditing(it)}>
                                              <Pencil className="w-3 h-3" />
                                            </Button>
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-danger hover:bg-danger/10" title="حذف">
                                                  <Trash2 className="w-3 h-3" />
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>حذف المنتج</AlertDialogTitle>
                                                  <AlertDialogDescription>سيتم حذف "{it.name}" من هذه الفاتورة.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                  <AlertDialogAction onClick={async () => { await db.removeInvoiceItem(it.id); toast.success("تم الحذف"); }}>حذف</AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {payList.length > 0 && (
            <div className="rounded-2xl hairline">
              <div className="px-3 py-2 text-xs font-bold text-muted-foreground bg-foreground/[0.035]">المدفوعات ({payList.length})</div>
              <div className="max-h-40 overflow-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {payList.map((p, i) => (
                      <tr key={p.id} className="border-t border-[var(--hairline)] hover:bg-foreground/[0.035]">
                        <td className="p-2 text-muted-foreground w-10">{payList.length - i}</td>
                        <td className="p-2" dir="ltr">{format(new Date(p.paidAt), "dd/MM/yyyy")}</td>
                        <td className={cn("p-2 font-bold text-success", blurCls)}>+ {fmt(p.amount)} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="w-full" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>

      <EditInvoiceItemDialog item={editing} onClose={() => setEditing(null)} />
    </Dialog>
  );
}

function EditInvoiceItemDialog({ item, onClose }: { item: import("@/lib/store").InvoiceItem | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  useEffect(() => {
    if (item) { setName(item.name); setCost(String(item.cost)); setPrice(String(item.price)); }
  }, [item]);
  if (!item) return null;
  const submit = async () => {
    if (!name.trim()) return toast.error("أدخل اسم المنتج");
    await db.updateInvoiceItem(item.id, { name: name.trim(), cost: Number(cost || 0), price: Number(price || 0) });
    toast.success("تم تحديث المنتج");
    onClose();
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-right">تعديل المنتج</DialogTitle>
          <DialogDescription className="text-right">تحديث بيانات المنتج داخل الفاتورة.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-right">
          <div><Label>اسم المنتج</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>التكلفة (ج.م)</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
            <div><Label>سعر البيع (ج.م)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="w-full">حفظ التعديلات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewInvoiceDialog({ inv, customer, onClose }: { inv: Invoice | null; customer: Customer | null; onClose: () => void }) {
  if (!inv) return null;
  const remaining = inv.total - inv.paid;
  const late = daysLate(inv);
  const rows: [string, string, boolean?][] = [
    ["العميل", customer?.name ?? "—"],
    ["الهاتف", customer?.phone ?? "—", true],
    ["إجمالي الفاتورة", `${fmt(inv.total)} ج.م`],
    ["المقدم", `${fmt(inv.downPayment)} ج.م`],
    ["المسدد", `${fmt(inv.paid)} ج.م`],
    ["المتبقي", `${fmt(remaining)} ج.م`],
    ["القسط الشهري", `${fmt(inv.monthlyInstallment)} ج.م`],
    ["تاريخ أول قسط", isoToDDMMYYYY(inv.firstDueDate), true],
    ["تاريخ الإنشاء", format(new Date(inv.createdAt), "dd/MM/yyyy"), true],
    ["الحالة", remaining === 0 ? "مسددة" : late > 0 ? `متأخرة ${late} يوم` : "نشطة"],
    ["ملاحظات", inv.notes || "—"],
  ];
  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-right">تفاصيل الفاتورة #{inv.id.slice(0, 6)}</DialogTitle>
          <DialogDescription className="text-right">{customer?.name ?? "—"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1 text-right text-sm">
          {rows.map(([k, v, ltr]) => (
            <div key={k} className="flex items-center justify-between border-b border-[var(--hairline)] py-1.5">
              <span className="font-bold tabular-nums" dir={ltr ? "ltr" : "rtl"}>{v}</span>
              <span className="text-muted-foreground">{k}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" className="w-full" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditInvoiceDialog({ inv, onClose }: { inv: Invoice | null; onClose: () => void }) {
  const data = useDB();
  const { privacy } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [down, setDown] = useState("");
  const [monthly, setMonthly] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (inv) {
      const items = data.invoiceItems.filter((it) => it.invoiceId === inv.id);
      const rows: ProductRow[] = items.length > 0
        ? items.map((it) => ({ id: it.id, name: it.name, cost: String(it.cost), price: String(it.price), quantity: "1" }))
        : [{ id: crypto.randomUUID(), name: inv.notes || "منتج", cost: "0", price: String(inv.total), quantity: "1" }];
      setProducts(rows);
      setDown(String(inv.downPayment));
      setMonthly(String(inv.monthlyInstallment));
      setDate(new Date(inv.firstDueDate));
      setNotes(inv.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.id]);

  if (!inv) return null;

  const totalCost = products.reduce((s, p) => s + Number(p.cost || 0), 0);
  const totalPrice = products.reduce((s, p) => s + Number(p.price || 0), 0);
  const remaining = Math.max(0, totalPrice - Number(down || 0));
  const profit = totalPrice - totalCost;
  const isCash = totalPrice > 0 && Number(down) >= totalPrice;

  const addProduct = () => setProducts((p) => [...p, { id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" }]);
  const removeProduct = (id: string) => setProducts((p) => p.length > 1 ? p.filter((x) => x.id !== id) : p);
  const updateProduct = (id: string, patch: Partial<ProductRow>) =>
    setProducts((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));

  const submit = async () => {
    const valid = products.filter((p) => p.name.trim() && Number(p.price) > 0);
    if (valid.length === 0) return toast.error("أضف منتج واحد على الأقل");
    if (!isCash && (!Number(monthly) || !date)) return toast.error("املأ بيانات الأقساط");
    const iso = isCash ? format(new Date(), "yyyy-MM-dd") : format(date as Date, "yyyy-MM-dd");

    // Update invoice header
    await db.updateInvoice(inv.id, {
      total: totalPrice,
      downPayment: isCash ? totalPrice : Number(down || 0),
      monthlyInstallment: isCash ? 0 : Number(monthly),
      firstDueDate: iso,
      notes,
    });

    // Sync items: remove old that aren't kept, update existing, insert new
    const existingIds = new Set(data.invoiceItems.filter((it) => it.invoiceId === inv.id).map((it) => it.id));
    const keptIds = new Set(valid.filter((p) => existingIds.has(p.id)).map((p) => p.id));
    for (const oldId of existingIds) if (!keptIds.has(oldId)) await db.removeInvoiceItem(oldId);
    for (const p of valid) {
      const payload = { name: p.name.trim(), cost: Number(p.cost || 0), price: Number(p.price || 0) };
      if (existingIds.has(p.id)) await db.updateInvoiceItem(p.id, payload);
      else await db.addInvoiceItem(inv.id, payload);
    }

    toast.success("تم تحديث الفاتورة");
    onClose();
  };

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-right">تعديل الفاتورة #{inv.id.slice(0, 6)}</DialogTitle>
          <DialogDescription className="text-right">تحديث بيانات الفاتورة والمنتجات.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-right">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Button type="button" size="sm" variant="outline" onClick={addProduct} className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
                <Plus className="w-4 h-4" /> إضافة منتج آخر
              </Button>
              <Label className="text-base font-bold">المنتجات ({products.length})</Label>
            </div>
            <AnimatePresence initial={false}>
              {products.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="rounded-2xl hairline bg-foreground/[0.03] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeProduct(p.id)} disabled={products.length === 1} className="h-7 w-7 text-muted-foreground hover:text-danger hover:bg-danger/10" title="حذف المنتج">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground font-bold">منتج #{idx + 1}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div><Label className="text-xs">اسم المنتج</Label><Input value={p.name} onChange={(e) => updateProduct(p.id, { name: e.target.value })} maxLength={100} /></div>
                      <div><Label className="text-xs">التكلفة (ج.م)</Label><Input type="number" value={p.cost} onChange={(e) => updateProduct(p.id, { cost: e.target.value })} className={blurCls} /></div>
                      <div><Label className="text-xs">سعر البيع (ج.م)</Label><Input type="number" value={p.price} onChange={(e) => updateProduct(p.id, { price: e.target.value })} className={blurCls} /></div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div><Label>المقدم (ج.م)</Label><Input type="number" value={down} onChange={(e) => setDown(e.target.value)} className={blurCls} /></div>

          <div className="rounded-2xl bg-foreground/[0.035] p-3 flex items-center justify-between">
            <span className={cn("text-primary font-bold", blurCls)}>{fmt(remaining)} ج.م</span>
            <span className="text-sm text-muted-foreground">المبلغ المتبقي للتقسيط:</span>
          </div>

          <AnimatePresence>
            {isCash && (
              <motion.div key="cash" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ type: "spring", stiffness: 400, damping: 14 }} className="flex justify-center">
                <Badge className="gap-1.5 bg-success/15 text-success border border-success/40 text-sm py-1.5 px-3">
                  <Banknote className="w-4 h-4" /> بيع نقدي — لا توجد أقساط
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {!isCash && (
              <motion.div key="inst" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} style={{ overflow: "hidden" }}>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>القسط الشهري (ج.م)</Label><Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} className={blurCls} /></div>
                  <div>
                    <Label>تاريخ أول قسط</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal text-right">
                          {date ? <span dir="ltr">{format(date, "dd/MM/yyyy")}</span> : <span className="text-muted-foreground">DD/MM/YYYY</span>}
                          <CalendarIcon className="h-4 w-4 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></div>

          <div className={cn("rounded-2xl border p-3 text-sm flex items-center justify-between", profit >= 0 ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5")}>
            <span className={cn("font-extrabold", blurCls, profit >= 0 ? "text-success" : "text-danger")}>{fmt(profit)} ج.م</span>
            <span className="text-muted-foreground">صافي الربح المتوقع:</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="w-full">حفظ التعديلات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReminderDialog({ inv, customer, onClose }: { inv: Invoice | null; customer: Customer | null; onClose: () => void }) {
  if (!inv || !customer) return null;
  const remaining = inv.total - inv.paid;
  const late = daysLate(inv);
  const overdueAmount = Math.min(inv.monthlyInstallment, remaining);
  const message =
    `مرحباً ${customer.name}،\n` +
    `نود تذكيرك بقسط الفاتورة رقم #${inv.id.slice(0, 6)} المستحق منذ ${late} يوم.\n\n` +
    `• قيمة القسط المتأخر: ${fmt(overdueAmount)} ج.م\n` +
    `• إجمالي المتبقي على الفاتورة: ${fmt(remaining)} ج.م\n` +
    `• تاريخ الاستحقاق: ${isoToDDMMYYYY(inv.firstDueDate)}\n\n` +
    `نرجو سرعة السداد. شكراً لتعاونك.`;

  const phone = customer.phone.replace(/[^\d]/g, "");
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end">
            رسالة تذكير
            <Bell className="w-5 h-5 text-warning" />
          </DialogTitle>
          <DialogDescription className="text-right">رسالة جاهزة للإرسال للعميل {customer.name}</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl hairline bg-foreground/[0.035] p-3 text-right whitespace-pre-line text-sm leading-relaxed">
          {message}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(toArabicDigits(message)); toast.success("تم نسخ الرسالة"); }}>نسخ</Button>
          <Button asChild className="gap-2 bg-success hover:bg-success/90 text-success-foreground">
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4" /> إرسال عبر واتساب
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function printReceipt(
  inv: { id: string; total: number; paid: number; downPayment: number; monthlyInstallment: number; firstDueDate: string; notes: string | null; createdAt: string },
  customerName: string,
  phone: string,
  allInvoices: import("@/lib/store").Invoice[] = [],
) {
  const shop = getShopSettings();
  const cur = shop.currency || "ج.م";
  const invNo = invoiceNumber(allInvoices, inv.id, shop.invoicePrefix);
  const remaining = inv.total - inv.paid;
  const today = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const body = `
<div class="info">
  <div class="box"><b>اسم العميل</b> ${escapeHtml(customerName)}</div>
  <div class="box"><b>الهاتف</b> <span dir="ltr">${escapeHtml(phone || "—")}</span></div>
  <div class="box" style="grid-column:1/-1"><b>وصف السلعة</b> ${escapeHtml(inv.notes || "—")}</div>
</div>
<h2 class="sec">تفاصيل التقسيط</h2>
<div class="t-wrap"><table>
  <tbody>
    <tr><th>تاريخ أول قسط</th><td dir="ltr">${escapeHtml(isoToDDMMYYYY(inv.firstDueDate))}</td><th>القسط الشهري</th><td class="num">${fmt(inv.monthlyInstallment)} ${escapeHtml(cur)}</td></tr>
    <tr><th>إجمالي الفاتورة</th><td class="num">${fmt(inv.total)} ${escapeHtml(cur)}</td><th>المقدم</th><td class="num">${fmt(inv.downPayment)} ${escapeHtml(cur)}</td></tr>
    <tr><th>المسدد حتى تاريخه</th><td class="num ok">${fmt(inv.paid)} ${escapeHtml(cur)}</td><th>المتبقي</th><td class="num ${remaining > 0 ? "due" : "ok"}">${fmt(remaining)} ${escapeHtml(cur)}</td></tr>
  </tbody>
</table></div>
<div class="total-bar"><span>المتبقي المستحق</span><span class="v">${fmt(remaining)} ${escapeHtml(cur)}</span></div>
<div class="sig"><div>توقيع العميل</div><div>توقيع البائع</div></div>`;
  const html = pdfDocument({
    docTitle: "إيصال — سِجلّي",
    badge: "إيصال معتمد",
    title: "إيصال بيع بالتقسيط",
    lede: "إيصال رسمي يوضّح تفاصيل الفاتورة والأقساط.",
    brandSub: shop.shopName || undefined,
    meta: [
      { label: "تاريخ الإصدار", value: today },
      { label: "رقم الفاتورة", value: escapeHtml(invNo) },
      ...(shop.phone ? [{ label: "هاتف المحل", value: escapeHtml(shop.phone) }] : []),
      ...(shop.address ? [{ label: "العنوان", value: escapeHtml(shop.address) }] : []),
      ...(shop.taxNumber ? [{ label: "الرقم الضريبي", value: escapeHtml(shop.taxNumber) }] : []),
    ],
    kpis: [
      { label: "إجمالي الفاتورة", value: `${fmt(inv.total)} ${cur}`, tone: "brand" },
      { label: "المقدم", value: `${fmt(inv.downPayment)} ${cur}` },
      { label: "القسط الشهري", value: `${fmt(inv.monthlyInstallment)} ${cur}` },
      { label: "المتبقي", value: `${fmt(remaining)} ${cur}`, tone: remaining > 0 ? "danger" : "brand" },
    ],
    body,
    footerNote: shop.footerNote || undefined,
    page: "A4",
    paper: shop.printPaper,
  });
  if (!openPdfDocument(html, { autoPrint: true, features: shop.printPaper === "thermal" ? "width=420,height=760" : "width=880,height=760" })) {
    toast.error("الرجاء السماح بفتح النوافذ المنبثقة لطباعة الإيصال");
    return;
  }
  toast.success("جاري تجهيز الإيصال...");
}


function PaymentDialog({ invoiceId, max }: { invoiceId: string; max: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 border-success/40 text-success hover:bg-success/10"><Wallet className="w-3.5 h-3.5" /> دفع</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-right">تسجيل دفعة</DialogTitle>
          <DialogDescription className="text-right">المتبقي على الفاتورة: {fmt(max)} ج.م</DialogDescription>
        </DialogHeader>
        <div>
          <Label>المبلغ المدفوع (ج.م)</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={() => {
            const n = Number(amount);
            if (!n || n <= 0) { toast.error("أدخل مبلغ صحيح"); return; }
            db.recordPayment(invoiceId, Math.min(n, max));
            toast.success("تم تسجيل الدفعة");
            setOpen(false);
            setAmount("");
          }}>تأكيد الدفعة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ProductRow = { id: string; name: string; cost: string; price: string; stockId?: string; quantity: string };

function StockProductPicker({ value, name, stockItems, onPick, onClear }: {
  value?: string;
  name: string;
  stockItems: import("@/lib/store").StockItem[];
  onPick: (item: import("@/lib/store").StockItem) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = stockItems.find((s) => s.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal text-right"
        >
          <ChevronsUpDown className="h-4 w-4 opacity-60 shrink-0" />
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : (name || "اختر منتج من المخزون...")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="ابحث في المخزون..." />
          <CommandList>
            <CommandEmpty>لا توجد منتجات. أضفها من صفحة المخزون.</CommandEmpty>
            <CommandGroup>
              {stockItems.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.name}
                  onSelect={() => { onPick(s); setOpen(false); }}
                  className="flex items-center justify-between gap-2"
                >
                  <span className={cn("text-xs", s.quantity > 0 ? "text-muted-foreground" : "text-danger font-bold")}>
                    {s.quantity > 0 ? `متوفر: ${s.quantity}` : "نفد"}
                  </span>
                  <span className="flex items-center gap-2">
                    {value === s.id && <Check className="w-4 h-4 text-success" />}
                    <span className="font-medium">{s.name}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {selected && (
          <div className="border-t p-2">
            <Button type="button" variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => { onClear(); setOpen(false); }}>
              مسح الاختيار
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NewInvoiceDialog({ trigger }: { trigger: React.ReactNode }) {
  const data = useDB();
  const { settings: shop } = useShopSettings();
  const { privacy } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([
    { id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" },
  ]);
  const [down, setDown] = useState("0");
  const [monthly, setMonthly] = useState("");
  const [count, setCount] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [saleType, setSaleType] = useState<"cash" | "installments">("installments");
  const [cashPaid, setCashPaid] = useState("");

  /** أول تاريخ استحقاق مقترح = «يوم القسط الافتراضي» من الشهر الجاي. */
  const defaultFirstDue = () => {
    const day = Math.min(28, Math.max(1, shop.defaultDueDay || 1));
    const d = new Date();
    const next = new Date(d.getFullYear(), d.getMonth() + 1, day);
    return next;
  };

  // تطبيق الإعدادات الافتراضية كل مرة يتفتح فيها الحوار.
  useEffect(() => {
    if (!open) return;
    setCount((c) => c || String(Math.max(1, shop.defaultInstallmentMonths || 6)));
    setDate((d) => d ?? defaultFirstDue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shop.defaultInstallmentMonths, shop.defaultDueDay]);

  const handleScan = (code: string) => {
    setScanOpen(false);
    const found = findStockByBarcode(data.stockItems, code);
    if (!found) {
      toast.error(`لا يوجد منتج بالباركود: ${code}`, {
        description: "يمكنك إضافته كمنتج جديد للمخزن.",
        action: {
          label: "إضافة منتج جديد",
          onClick: async () => {
            try {
              await db.addStockItem({ name: `منتج ${code.slice(-4)}`, barcode: code });
              toast.success("تمت إضافة المنتج للمخزن — حدّث بياناته من صفحة المخزن");
            } catch (e: any) { toast.error(e?.message ?? "تعذر الإضافة"); }
          },
        },
      });
      return;
    }
    setProducts((prev) => {
      const existingIdx = prev.findIndex((r) => r.stockId === found.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], quantity: String((Number(next[existingIdx].quantity) || 0) + 1) };
        return next;
      }
      const emptyIdx = prev.findIndex((r) => !r.name && !r.stockId);
      const newRow: ProductRow = {
        id: crypto.randomUUID(),
        stockId: found.id,
        name: found.name,
        cost: String(found.lastUnitCost || 0),
        price: String(found.salePrice || 0),
        quantity: "1",
      };
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = { ...newRow, id: prev[emptyIdx].id };
        return next;
      }
      return [...prev, newRow];
    });
    toast.success(`تمت إضافة: ${found.name}`);
  };

  const customer = data.customers.find((c) => c.id === customerId);
  const blocked = customer && (customer.frozen || customer.status === "defaulter");

  const totalCost = products.reduce((s, p) => s + Number(p.cost || 0) * Number(p.quantity || 1), 0);
  const totalPrice = products.reduce((s, p) => s + Number(p.price || 0) * Number(p.quantity || 1), 0);
  const remaining = Math.max(0, totalPrice - Number(down || 0));
  const profit = totalPrice - totalCost;
  const profitPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  const downNum = Number(down || 0);
  const countNum = Number(count || 0);
  const monthlyNum = Number(monthly || 0);
  const cashPaidNum = Number(cashPaid || 0);
  const change = Math.max(0, cashPaidNum - totalPrice);
  const cashShort = Math.max(0, totalPrice - cashPaidNum);
  const isCashMode = saleType === "cash" || (totalPrice > 0 && downNum >= totalPrice);
  const totalDue = downNum + monthlyNum * countNum;

  /** جدول الأقساط المتوقّع — عرض فقط قبل الحفظ. */
  const schedule = useMemo(() => {
    if (isCashMode || !date || countNum <= 0 || monthlyNum <= 0) return [];
    const rows: { n: number; due: Date; amount: number }[] = [];
    let left = remaining;
    for (let i = 0; i < Math.min(countNum, 60); i++) {
      const amount = i === countNum - 1 ? Math.max(0, left) : Math.min(monthlyNum, Math.max(0, left));
      left -= amount;
      rows.push({ n: i + 1, due: addMonths(date, i), amount });
    }
    return rows;
  }, [isCashMode, date, countNum, monthlyNum, remaining]);

  const hasValidProduct = products.some((p) => p.name.trim() && Number(p.price) > 0 && Number(p.quantity) > 0);
  const blockReason = !customerId
    ? "اختر العميل أولًا"
    : blocked
      ? "العميل محظور من فتح فواتير جديدة"
      : !hasValidProduct
        ? "أضف منتج واحد على الأقل بسعر صحيح"
        : !isCashMode && (!monthlyNum || !date)
          ? "أكمل بيانات الأقساط (القسط الشهري وتاريخ أول قسط)"
          : !isCashMode && customer?.customerType === "cash"
            ? "العميل فوري (نقدي) — لا يسمح بالتقسيط"
            : null;


  useEffect(() => {
    const n = Number(count);
    if (n > 0 && remaining > 0) setMonthly(String(Math.ceil(remaining / n)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, totalPrice, down]);

  const customerInfo = useMemo(() => {
    if (!customer) return null;
    const balance = customerBalance(data.invoices, customer.id, customer.openingBalance);
    const limit = customer.creditLimit || 0;
    const wouldExceed = limit > 0 && (balance + remaining) > limit;
    return { balance, limit, wouldExceed };
  }, [customer, data.invoices, remaining]);

  const addProduct = () => setProducts((p) => [...p, { id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" }]);
  const removeProduct = (id: string) => setProducts((p) => p.length > 1 ? p.filter((x) => x.id !== id) : p);
  const updateProduct = (id: string, patch: Partial<ProductRow>) =>
    setProducts((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));

  const reset = () => {
    setCustomerId(""); setProducts([{ id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" }]);
    setDown("0"); setMonthly("");
    setCount(String(Math.max(1, shop.defaultInstallmentMonths || 6)));
    setDate(defaultFirstDue());
    setNotes("");
    setSaleType("installments");
    setCashPaid("");
  };

  const submit = async () => {
    if (!customerId) return toast.error("اختر عميل");
    if (blocked) return toast.error("هذا العميل محظور من فتح فواتير جديدة");
    const validProducts = products.filter((p) => p.name.trim() && Number(p.price) > 0 && Number(p.quantity) > 0);
    if (validProducts.length === 0) return toast.error("أضف منتج واحد على الأقل بسعر صحيح");
    // Stock check
    for (const p of validProducts) {
      if (!p.stockId) continue;
      const stock = data.stockItems.find((s) => s.id === p.stockId);
      const qty = Number(p.quantity || 0);
      if (!stock) return toast.error(`المنتج "${p.name}" غير موجود في المخزون`);
      if (stock.quantity <= 0) return toast.error(`المنتج "${stock.name}" نفد من المخزون`);
      if (stock.quantity < qty) return toast.error(`الكمية المتاحة من "${stock.name}" هي ${stock.quantity} فقط`);
    }
    const t = totalPrice;
    const d = Number(down);
    const isCash = saleType === "cash" || (t > 0 && d >= t);
    const m = isCash ? 0 : Number(monthly);
    if (!isCash && (!m || !date)) return toast.error("املأ بيانات الأقساط");
    if (!isCash && customer?.customerType === "cash") {
      return toast.error("العميل مسجّل «فوري (نقدي)» — لازم تحصيل كامل المبلغ أو تغيّر نوعه لعميل قسط");
    }
    if (customerInfo?.wouldExceed && !isCash) {
      return toast.error(`تجاوز سقف المديونية (${fmt(customerInfo.limit)} ج.م) — عدّل المقدم أو ارفع السقف`);
    }
    const iso = isCash ? format(new Date(), "yyyy-MM-dd") : format(date as Date, "yyyy-MM-dd");
    const summary = validProducts.map((p) => `${p.name.trim()}${Number(p.quantity) > 1 ? ` ×${p.quantity}` : ""}`).join("، ");
    const productNotes = `${summary}${notes ? ` — ${notes}` : ""}`;
    try {
      await db.addInvoice({
        customerId, total: t, downPayment: isCash ? t : d, monthlyInstallment: m,
        firstDueDate: iso, notes: productNotes, paid: isCash ? t : d,
        items: validProducts.flatMap((p) => {
          const qty = Math.max(1, Number(p.quantity || 1));
          // Store one row per unit so totals match qty*price
          return Array.from({ length: qty }, () => ({
            name: p.name.trim(), cost: Number(p.cost || 0), price: Number(p.price || 0),
          }));
        }),
      });
      // Deduct from stock
      const deductions = validProducts
        .filter((p) => p.stockId)
        .map((p) => ({ stockId: p.stockId!, quantity: Number(p.quantity || 0) }));
      if (deductions.length > 0) await db.deductStock(deductions);
      toast.success(isCash ? "تم إنشاء فاتورة بيع نقدي ✓ مسددة" : "تم إنشاء الفاتورة");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر إنشاء الفاتورة");
      return;
    }
    setOpen(false);

    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-foreground/10 bg-background/80 px-6 py-5 backdrop-blur-xl">
          <span className="mr-auto w-max rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">فاتورة جديدة</span>
          <DialogTitle className="text-right text-2xl font-extrabold tracking-tight">إنشاء فاتورة جديدة</DialogTitle>
          <DialogDescription className="text-right">
            {isCashMode ? "بيع فوري — سداد كامل المبلغ الآن." : "بيع بالتقسيط — مقدم ودفعات شهرية."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 pb-8 text-right">
          <div className="rounded-[1.75rem] border border-foreground/10 bg-foreground/[0.02] p-1.5">
           <div className="space-y-2 rounded-[calc(1.75rem-0.375rem)] bg-background/60 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">العميل</Label>
            <Select
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v);
                const c = data.customers.find((x) => x.id === v);
                if (c?.customerType === "cash") {
                  setSaleType("cash");
                  setDown("0");
                  setMonthly(""); setCount("");
                } else if (c) {
                  setSaleType("installments");
                  if (!date) setDate(addMonths(new Date(), 1));
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
              <SelectContent>
                {data.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.customerType === "cash" ? "فوري" : "قسط"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

          {customer && customerInfo && (
            <div className="flex flex-wrap items-center gap-2 animate-[fade-in_0.2s_ease-out]">
              <CustomerTypeBadge type={customer.customerType} />
              <Badge variant="outline" className={cn("gap-1 font-bold",
                customerInfo.balance > 0 ? "bg-danger/10 text-danger border-danger/40" : "bg-success/10 text-success border-success/40"
              )}>
                مديونية حالية: <span className={blurCls}>{fmt(customerInfo.balance)} ج.م</span>
              </Badge>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/40 font-bold">
                سقف الائتمان: <span className={blurCls}>{customerInfo.limit > 0 ? `${fmt(customerInfo.limit)} ج.م` : "بدون حد"}</span>
              </Badge>
              {customerInfo.wouldExceed && (
                <Badge variant="outline" className="bg-warning/15 text-warning border-warning/40 gap-1">
                  <ShieldAlert className="w-3 h-3" /> سيتجاوز السقف الائتماني
                </Badge>
              )}
            </div>
          )}

           </div>
          </div>

          {blocked && (
            <div className="rounded-2xl border-2 border-danger/40 bg-danger/10 p-3 text-sm text-danger flex items-start gap-2 animate-[scale-in_0.2s_ease-out]">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div>هذا العميل {customer?.frozen ? "مجمد" : "مماطل"}. النظام لا يسمح بفتح فاتورة جديدة قبل تسوية حسابه.</div>
            </div>
          )}

          <div className="rounded-[1.75rem] border border-foreground/10 bg-foreground/[0.02] p-1.5">
            <div className="space-y-3 rounded-[calc(1.75rem-0.375rem)] bg-background/60 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
              <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">نوع الفاتورة</Label>
              <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-foreground/[0.04] p-1.5">
                {([
                  { key: "installments" as const, label: "أقساط", hint: "دفع على دفعات شهرية" },
                  { key: "cash" as const, label: "فوري (نقدي)", hint: "سداد كامل الآن" },
                ]).map((opt) => {
                  const active = saleType === opt.key;
                  const locked = opt.key === "installments" && customer?.customerType === "cash";
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        if (locked) {
                          toast.error("هذا عميل فوري (نقدي) — غيّر نوع العميل لقسط أولًا لو عايز تقسيط");
                          return;
                        }
                        setSaleType(opt.key);
                        if (opt.key === "installments" && !date) setDate(addMonths(new Date(), 1));
                        if (opt.key === "cash") setDown("0");
                      }}
                      aria-pressed={active}
                      className={cn(
                        "rounded-[1.1rem] px-4 py-3 text-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
                        active
                          ? "bg-primary/15 text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] ring-1 ring-primary/40"
                          : "text-muted-foreground hover:bg-foreground/[0.04]",
                        locked && "cursor-not-allowed opacity-40 hover:bg-transparent",
                      )}
                    >
                      <span className="block text-sm font-extrabold">{opt.label}</span>
                      <span className="mt-0.5 block text-[11px] opacity-70">{locked ? "غير متاح لعميل فوري" : opt.hint}</span>
                    </button>
                  );
                })}
              </div>
              {customer && (
                <p className="text-[11px] text-muted-foreground">
                  {customer.customerType === "cash"
                    ? "تم ضبط النوع تلقائيًا: العميل مسجّل «فوري (نقدي)» — التحصيل كامل عند البيع."
                    : "تم ضبط النوع تلقائيًا حسب تسجيل العميل «قسط» — تقدر تحوّله لبيع فوري لو سدّد كامل المبلغ."}
                </p>
              )}
            </div>

          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={addProduct} className="gap-1.5 rounded-full border-primary/40 px-4 text-primary transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-primary/10 active:scale-[0.98]">
                  <Plus className="w-4 h-4" /> إضافة منتج آخر
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setScanOpen(true)} className="gap-1.5 rounded-full border-success/40 px-4 text-success transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-success/10 active:scale-[0.98]">
                  <ScanLine className="w-4 h-4" /> مسح باركود
                </Button>
              </div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">المنتجات ({products.length})</Label>
            </div>
            <AnimatePresence initial={false}>
              {products.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, height: 0, y: -8, filter: "blur(4px)" }}
                  animate={{ opacity: 1, height: "auto", y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, height: 0, y: -8, filter: "blur(4px)" }}
                  transition={{ duration: 0.45, delay: Math.min(idx, 4) * 0.05, ease: [0.32, 0.72, 0, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="mb-3 rounded-[1.75rem] border border-foreground/10 bg-foreground/[0.03] p-1.5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-primary/25">
                   <div className="space-y-2 rounded-[calc(1.75rem-0.375rem)] bg-background/60 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
                    <div className="flex items-center justify-between">
                      <Button
                        type="button" size="icon" variant="ghost"
                        onClick={() => removeProduct(p.id)}
                        disabled={products.length === 1}
                        className="h-7 w-7 text-muted-foreground hover:text-danger hover:bg-danger/10"
                        title="حذف المنتج"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground font-bold">منتج #{idx + 1}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="sm:col-span-2">
                        <Label className="text-xs">اسم المنتج</Label>
                        <StockProductPicker
                          value={p.stockId}
                          name={p.name}
                          stockItems={data.stockItems}
                          onPick={(item) => updateProduct(p.id, {
                            stockId: item.id,
                            name: item.name,
                            cost: String(item.lastUnitCost || 0),
                            price: p.price || (item.salePrice ? String(item.salePrice) : ""),
                          })}
                          onClear={() => updateProduct(p.id, { stockId: undefined, name: "" })}
                        />
                        {p.stockId && (() => {
                          const s = data.stockItems.find((x) => x.id === p.stockId);
                          const qty = Number(p.quantity || 0);
                          if (!s) return null;
                          const ok = s.quantity >= qty && qty > 0;
                          return (
                            <div className={cn("text-xs mt-1 flex items-center gap-1", ok ? "text-success" : "text-danger")}>
                              <Package className="w-3 h-3" /> المتوفر في المخزون: {s.quantity}
                            </div>
                          );
                        })()}
                      </div>
                      <div>
                        <Label className="text-xs">الكمية</Label>
                        <Input type="number" min="1" value={p.quantity} onChange={(e) => updateProduct(p.id, { quantity: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">تكلفة الوحدة (ج.م)</Label>
                        <Input type="number" value={p.cost} onChange={(e) => updateProduct(p.id, { cost: e.target.value })} className={blurCls} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">سعر البيع للوحدة (ج.م)</Label>
                        <Input type="number" value={p.price} onChange={(e) => updateProduct(p.id, { price: e.target.value })} className={blurCls} />
                      </div>
                    </div>
                   </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* لوح الدفع الموحّد — يتبدّل بحركة حسب نوع الفاتورة */}
          <div className="rounded-[1.75rem] border border-foreground/10 bg-foreground/[0.02] p-1.5">
            <div className="rounded-[calc(1.75rem-0.375rem)] bg-background/60 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
              <AnimatePresence mode="wait" initial={false}>
                {isCashMode ? (
                  <motion.div
                    key="pay-cash"
                    initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                    transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Badge className="gap-1.5 border border-success/40 bg-success/15 px-3 py-1 text-success">
                        <Banknote className="h-3.5 w-3.5" /> بيع نقدي
                      </Badge>
                      <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">تفاصيل السداد</Label>
                    </div>

                    <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-primary/[0.06] px-4 py-3">
                      <span className={cn("text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold leading-none tracking-tight text-primary", blurCls)}>{fmt(totalPrice)} ج.م</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">المطلوب دفعه الآن</span>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">المبلغ المستلم من العميل (ج.م)</Label>
                      <Input type="number" value={cashPaid} onChange={(e) => setCashPaid(e.target.value)} placeholder={`${totalPrice || 0}`} className={blurCls} />
                      <div className="flex flex-wrap gap-1.5">
                        {[totalPrice, 50, 100, 200, 500].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v, i) => (
                          <button
                            key={`${v}-${i}`}
                            type="button"
                            onClick={() => setCashPaid(String(i === 0 ? v : (Number(cashPaid || 0) + v)))}
                            className="rounded-full bg-foreground/[0.05] px-3 py-1 text-[11px] font-bold text-muted-foreground transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-primary/10 hover:text-primary active:scale-[0.96]"
                          >
                            {i === 0 ? "المبلغ بالظبط" : `+ ${fmt(v)}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {cashPaidNum > 0 && (
                      <div className={cn(
                        "flex items-baseline justify-between gap-3 rounded-2xl px-4 py-3",
                        cashShort > 0 ? "bg-warning/10" : "bg-success/10",
                      )}>
                        <span className={cn("text-[clamp(1.1rem,3.5vw,1.5rem)] font-extrabold leading-none tracking-tight", cashShort > 0 ? "text-warning" : "text-success", blurCls)}>
                          {fmt(cashShort > 0 ? cashShort : change)} ج.م
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          {cashShort > 0 ? "ناقص من المبلغ" : "الفكّة للعميل"}
                        </span>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="pay-inst"
                    initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                    transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">المقدم (ج.م)</Label>
                      <Input type="number" value={down} onChange={(e) => setDown(e.target.value)} className={blurCls} />
                      <div className="flex flex-wrap gap-1.5">
                        {[0, 10, 25, 50].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setDown(String(Math.round((totalPrice * pct) / 100)))}
                            className="rounded-full bg-foreground/[0.05] px-3 py-1 text-[11px] font-bold text-muted-foreground transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-primary/10 hover:text-primary active:scale-[0.96]"
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-primary/[0.06] px-4 py-3">
                      <span className={cn("text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold leading-none tracking-tight text-primary", blurCls)}>{fmt(remaining)} ج.م</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">المتبقي للتقسيط</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs">عدد الأقساط</Label>
                        <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} placeholder="مثال: 6" />
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {[3, 6, 9, 12].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setCount(String(n))}
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[11px] font-bold transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]",
                                countNum === n ? "bg-primary/15 text-primary ring-1 ring-primary/40" : "bg-foreground/[0.05] text-muted-foreground hover:bg-primary/10 hover:text-primary",
                              )}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">القسط الشهري (ج.م)</Label>
                        <Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} className={cn(countNum > 0 && "border-success/40 bg-success/5", blurCls)} />
                      </div>
                      <div>
                        <Label className="text-xs">تاريخ أول قسط</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-between font-normal text-right", !date && "text-muted-foreground")}>
                              {date ? <span dir="ltr">{format(date, "dd/MM/yyyy")}</span> : <span>DD/MM/YYYY</span>}
                              <CalendarIcon className="h-4 w-4 opacity-60" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDate(addMonths(new Date(), 1))}
                            className="rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-primary/10 hover:text-primary active:scale-[0.96]"
                          >
                            بعد شهر
                          </button>
                          <button
                            type="button"
                            onClick={() => { const n = addMonths(new Date(), 1); setDate(new Date(n.getFullYear(), n.getMonth(), 1)); }}
                            className="rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-primary/10 hover:text-primary active:scale-[0.96]"
                          >
                            أول الشهر الجاي
                          </button>
                        </div>
                      </div>
                    </div>

                    {schedule.length > 0 && (
                      <div className="space-y-2 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-muted-foreground">
                            إجمالي المستحق: <span className={cn("text-foreground", blurCls)}>{fmt(totalDue)} ج.م</span>
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">معاينة جدول الأقساط</span>
                        </div>
                        <div className="max-h-40 space-y-1 overflow-y-auto pl-1">
                          {schedule.map((row) => (
                            <div key={row.n} className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-1.5 text-xs">
                              <span className={cn("font-extrabold text-foreground", blurCls)}>{fmt(row.amount)} ج.م</span>
                              <span className="text-muted-foreground">
                                قسط {row.n} — <span dir="ltr">{format(row.due, "dd/MM/yyyy")}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                        {Math.abs(totalDue - totalPrice) > 1 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-warning">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            إجمالي المقدم والأقساط لا يساوي إجمالي الفاتورة ({fmt(totalPrice)} ج.م)
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div>
            <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">ملاحظات إضافية</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات..." maxLength={200} />
          </div>

          <div className={cn("rounded-[1.75rem] border p-1.5 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
            profit > 0 ? "border-success/40 bg-success/5" : profit < 0 ? "border-danger/40 bg-danger/5" : "border-foreground/10 bg-foreground/[0.03]"
          )}>
            <div className="rounded-[calc(1.75rem-0.375rem)] bg-background/60 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">إجمالي التكلفة</span>
                  <span className={cn("block text-lg font-bold tracking-tight", blurCls)}>{fmt(totalCost)} ج.م</span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">إجمالي سعر البيع</span>
                  <span className={cn("block text-lg font-bold tracking-tight", blurCls)}>{fmt(totalPrice)} ج.م</span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">صافي الربح</span>
                  <span className={cn("block text-[clamp(1.35rem,4.5vw,2rem)] font-extrabold leading-none tracking-tight", blurCls, profit > 0 ? "text-success" : profit < 0 ? "text-danger" : "text-muted-foreground")}>{fmt(profit)} ج.م</span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">نسبة الربح</span>
                  <span className={cn("block text-[clamp(1.35rem,4.5vw,2rem)] font-extrabold leading-none tracking-tight", blurCls, profit > 0 ? "text-success" : profit < 0 ? "text-danger" : "text-muted-foreground")}>{profitPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 flex-col gap-3 border-t border-foreground/10 bg-background/80 px-6 py-4 backdrop-blur-xl sm:flex-col">
          <div className="flex w-full items-center justify-between gap-3 text-right">
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {isCashMode ? "المطلوب الآن" : "المقدم الآن"}
              </span>
              <span className={cn("block text-lg font-extrabold leading-tight text-primary", blurCls)}>
                {fmt(isCashMode ? totalPrice : downNum)} ج.م
              </span>
            </div>
            <div className="min-w-0 text-left">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">إجمالي الفاتورة</span>
              <span className={cn("block text-lg font-extrabold leading-tight text-foreground", blurCls)}>{fmt(totalPrice)} ج.م</span>
            </div>
          </div>
          {blockReason && (
            <div className="w-full text-right text-[11px] font-bold text-warning">{blockReason}</div>
          )}
          <Button
            onClick={submit}
            disabled={!!blockReason}
            className="group w-full justify-between gap-3 rounded-full py-6 pl-2 pr-6 text-base font-bold transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-[1px] group-hover:translate-x-1 group-hover:scale-105">
              <Plus className="h-4 w-4" />
            </span>
            <span>إنشاء الفاتورة</span>
          </Button>
        </DialogFooter>
        <BarcodeScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={handleScan}
          title="مسح باركود — إضافة منتج للفاتورة"
        />
      </DialogContent>
    </Dialog>
  );
}

