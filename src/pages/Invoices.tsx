import { Link, useNavigate } from "@tanstack/react-router";
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
import { useDB, db, daysLate, fmt, customerBalance, getShopSettings, invoiceNumber, useShopSettings, type Invoice, type Customer, type InvoiceItem } from "@/lib/store";
import { getTreasuryAccounts, addManualTransaction } from "@/lib/cashbox-system";
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
import { Checkbox } from "@/components/ui/checkbox";
import { InstallmentScheduleMatrix } from "@/components/InstallmentScheduleMatrix";
import { CreateInvoiceShipmentDialog } from "@/components/CreateInvoiceShipmentDialog";
import { InvoicePrintCustomizerDialog } from "@/components/InvoicePrintCustomizerDialog";
import { Plus, Search, Wallet, AlertTriangle, Printer, ShieldAlert, Eye, Pencil, Trash2, Bell, History, TrendingUp, CalendarDays, AlertCircle, MessageCircle, EyeOff, Download, FileSpreadsheet, FileText, X, ChevronsUpDown, Check, Package, ScanLine, Info, CreditCard, Receipt, Undo2, Copy, Share2, MoreVertical, Layers, CheckCircle2, Truck, CheckSquare, Square } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";

import { findStockByBarcode } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Banknote } from "lucide-react";
import { usePrivacy } from "@/lib/privacy";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [viewInv, setViewInv] = useState<Invoice | null>(null);
  const [editInv, setEditInv] = useState<Invoice | null>(null);
  const [reminderInv, setReminderInv] = useState<Invoice | null>(null);
  const [returnInv, setReturnInv] = useState<Invoice | null>(null);
  const [shareInv, setShareInv] = useState<Invoice | null>(null);
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const { settings: shopSettings } = useShopSettings();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [searchScanOpen, setSearchScanOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customPrintInv, setCustomPrintInv] = useState<Invoice | null>(null);
  const [shipmentInv, setShipmentInv] = useState<Invoice | null>(null);
  const [directPayState, setDirectPayState] = useState<{
    invoiceId: string;
    max: number;
    invoiceNo?: string;
    customerName?: string;
    initialAmount?: number;
  } | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === list.length && list.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map((i) => i.id)));
    }
  };

  const handleBulkPrint = () => {
    if (selectedIds.size === 0) return toast.error("حدد فواتير للطباعة أولاً");
    const targetInvoices = list.filter((i) => selectedIds.has(i.id));
    const cur = shopSettings.currency || "ج.م";
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    let sumTotal = 0;
    let sumPaid = 0;
    let sumRemaining = 0;

    const invoicesHtml = targetInvoices.map((inv, idx) => {
      const cust = findCustomer(inv.customerId);
      const remaining = Math.max(0, inv.total - inv.paid);
      sumTotal += inv.total;
      sumPaid += inv.paid;
      sumRemaining += remaining;
      const invItems = data.invoiceItems.filter((it) => it.invoiceId === inv.id);

      return `
        <div style="page-break-after: always; padding: 20px 0; border-bottom: 2px dashed #cbd5e1; margin-bottom: 30px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 14px;">
            <div>
              <h3 style="margin: 0; font-size: 16px; color: #0f172a;">فاتورة مبيعات #${invoiceNumber(data.invoices, inv.id, shopSettings.invoicePrefix)}</h3>
              <span style="font-size: 11px; color: #64748b;">تاريخ: ${format(new Date(inv.createdAt), "dd/MM/yyyy")}</span>
            </div>
            <div style="text-align: left;">
              <b style="font-size: 14px; color: #0f172a;">${escapeHtml(cust?.name || "عميل")}</b>
              <span style="font-size: 11px; color: #64748b; display: block;" dir="ltr">${escapeHtml(cust?.phone || "—")}</span>
            </div>
          </div>

          <table style="width: 100%; font-size: 11px; border-collapse: collapse; margin-bottom: 14px;">
            <thead>
              <tr style="background: #f8fafc; text-align: right;">
                <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">الصنف</th>
                <th style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">الكمية</th>
                <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">السعر</th>
                <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${invItems.length > 0 ? invItems.map((it) => `
                <tr>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${escapeHtml(it.name)}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${it.quantity || 1}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${fmt(it.price)} ${cur}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${fmt(it.price * (it.quantity || 1))} ${cur}</td>
                </tr>
              `).join("") : `
                <tr>
                  <td colspan="4" style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${escapeHtml(inv.notes || "مبيعات عامة")}</td>
                </tr>
              `}
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; background: #f1f5f9; padding: 10px 14px; border-radius: 8px; font-size: 12px; font-weight: bold;">
            <span>الإجمالي: ${fmt(inv.total)} ${cur}</span>
            <span style="color: #16a34a;">المدفوع: ${fmt(inv.paid)} ${cur}</span>
            <span style="color: ${remaining > 0 ? '#dc2626' : '#16a34a'};">المتبقي: ${fmt(remaining)} ${cur}</span>
          </div>
        </div>
      `;
    }).join("");

    const html = pdfDocument({
      docTitle: `طباعة مجمعة — ${targetInvoices.length} فاتورة`,
      badge: "طباعة مجمعة",
      title: "دفتر الفواتير المحددة",
      lede: `طباعة مجمعة لعدد ${targetInvoices.length} فاتورة مختارة.`,
      brandSub: shopSettings.shopName || undefined,
      meta: [
        { label: "تاريخ الطباعة", value: today },
        { label: "عدد الفواتير", value: String(targetInvoices.length) },
      ],
      kpis: [
        { label: "إجمالي المبيعات", value: `${fmt(sumTotal)} ${cur}`, tone: "brand" },
        { label: "إجمالي المحصل", value: `${fmt(sumPaid)} ${cur}` },
        { label: "إجمالي المتبقي", value: `${fmt(sumRemaining)} ${cur}`, tone: sumRemaining > 0 ? "danger" : "brand" },
      ],
      body: invoicesHtml,
      footerNote: shopSettings.footerNote || undefined,
    });

    openPdfDocument(html, { autoPrint: true });
  };

  const handleBulkExportCSV = () => {
    if (selectedIds.size === 0) return toast.error("حدد فواتير للتصدير أولاً");
    const targetInvoices = list.filter((i) => selectedIds.has(i.id));
    const headers = ["رقم الفاتورة", "العميل", "الهاتف", "العنوان", "الإجمالي", "المسدد", "المتبقي", "القسط الشهري", "تاريخ الاستحقاق", "تاريخ الإنشاء", "الحالة"];
    const rows = targetInvoices.map((inv) => {
      const c = findCustomer(inv.customerId);
      const remaining = inv.total - inv.paid;
      const late = daysLate(inv);
      const status = remaining === 0 ? "مسددة" : late > 0 ? `متأخرة ${late} يوم` : "نشطة";
      return [
        invoiceNumber(data.invoices, inv.id, shopSettings.invoicePrefix),
        c?.name ?? "—",
        c?.phone ?? "—",
        c?.address ?? "—",
        inv.total,
        inv.paid,
        remaining,
        inv.monthlyInstallment,
        isoToDDMMYYYY(inv.firstDueDate),
        format(new Date(inv.createdAt), "dd/MM/yyyy"),
        status,
      ];
    });

    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `selected-invoices-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير ${targetInvoices.length} فاتورة بنجاح`);
  };

  const handleBulkWhatsApp = () => {
    if (selectedIds.size === 0) return toast.error("حدد فواتير أولاً");
    const targetInvoices = list.filter((i) => selectedIds.has(i.id));
    const overdueOnes = targetInvoices.filter((i) => (i.total - i.paid) > 0);

    if (overdueOnes.length === 0) {
      return toast.info("جميع الفواتير المحددة مسددة بالكامل ولا توجد عليها مديونيات!");
    }

    // Prepare reminders and copy or open first one
    const firstOverdue = overdueOnes[0];
    const firstCust = findCustomer(firstOverdue.customerId);
    if (firstCust?.phone) {
      const remaining = firstOverdue.total - firstOverdue.paid;
      const msg = `مرحباً ${firstCust.name}، نود تذكيركم بموعد سداد القسط المستحق على فاتورتكم #${invoiceNumber(data.invoices, firstOverdue.id, shopSettings.invoicePrefix)} بقيمة ${fmt(remaining)} ج.م لدى ${shopSettings.shopName || "المحل"}. شكراً لتعاملكم معنا.`;
      const cleanPhone = firstCust.phone.replace(/\D/g, "");
      const waPhone = cleanPhone.startsWith("0") ? "2" + cleanPhone : cleanPhone;
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, "_blank");
      toast.success(`تم فتح واتساب للعميل ${firstCust.name} (${overdueOnes.length} فاتورة عليها متبقي)`);
    } else {
      toast.error("لا يوجد رقم هاتف مسجل لأول فاتورة متأخرة");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    try {
      for (const id of Array.from(selectedIds) as string[]) {
        await db.removeInvoice(id);
      }
      setSelectedIds(new Set());
      toast.success(`تم حذف ${count} فاتورة بنجاح`);
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء الحذف الجماعي");
    }
  };
  const handleCloneInvoice = (inv: Invoice) => {
    const invItems = data.invoiceItems.filter((it) => it.invoiceId === inv.id);
    const monthsCount = inv.monthlyInstallment > 0
      ? Math.max(1, Math.round((inv.total - inv.downPayment) / Math.max(1, inv.monthlyInstallment)))
      : 6;
    const payload = {
      customerId: inv.customerId,
      products: invItems.map((it) => ({
        name: it.name,
        cost: it.cost,
        price: it.price,
        quantity: it.quantity || 1,
      })),
      notes: inv.notes,
      saleType: inv.monthlyInstallment > 0 ? "installments" : "cash",
      down: inv.downPayment,
      monthly: inv.monthlyInstallment,
      count: monthsCount,
      discountPct: inv.discountPct,
      taxPct: inv.taxPct,
    };
    sessionStorage.setItem("segilly_clone_invoice", JSON.stringify(payload));
    navigate({ to: "/invoices/new" });
  };

  const counts = useMemo(() => {
    let active = 0, overdue = 0, settled = 0;
    for (const i of data.invoices) {
      const remaining = i.total - i.paid;
      if (remaining <= 0) settled++;
      else if (daysLate(i) > 0) { overdue++; active++; }
      else active++;
    }
    return { active, overdue, settled, all: data.invoices.length };
  }, [data.invoices, data.returns]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    let totalPaid = 0;
    let totalSales = 0;
    let invoiceCount = data.invoices.length;
    let overdueCount = 0;
    let monthCollections = 0;
    let activeSalesTotal = 0;
    let monthSales = 0;

    for (const i of data.invoices) {
      totalSales += i.total;
      totalPaid += i.paid;
      const remaining = i.total - i.paid;
      if (remaining > 0) activeSalesTotal += remaining;
      if (remaining > 0 && daysLate(i) > 0) overdueCount++;
      
      const invDate = new Date(i.createdAt);
      if (invDate >= monthStart && invDate <= monthEnd) {
        monthSales += i.total;
      }
    }

    for (const p of data.payments) {
      const d = new Date(p.paidAt);
      if (d >= monthStart && d <= monthEnd) monthCollections += p.amount;
    }

    const collectionRate = totalSales > 0 ? (totalPaid / totalSales) * 100 : 0;
    const avgInvoiceValue = invoiceCount > 0 ? totalSales / invoiceCount : 0;

    return { 
      totalPaid, 
      totalSales, 
      invoiceCount, 
      overdueCount, 
      monthCollections, 
      activeSalesTotal, 
      collectionRate, 
      avgInvoiceValue, 
      monthSales 
    };
  }, [data.invoices, data.payments]);

  const list = useMemo(() => {
    // Filtered list based on tab and search
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
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
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
            <Button asChild className="gap-2"><Link to="/invoices/new"><Plus className="w-4 h-4" /> فاتورة جديدة</Link></Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <StatCard icon={<Wallet className="w-5 h-5" />} label="إجمالي المسدد" value={`${fmt(stats.totalPaid)} ج.م`} tone="neutral" trend="up" valueClassName={blurCls} />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="إجمالي المبيعات" value={`${fmt(stats.totalSales)} ج.م`} tone="neutral" trend="up" valueClassName={blurCls} />
        <StatCard icon={<FileText className="w-5 h-5" />} label="عدد الفواتير" value={String(stats.invoiceCount)} tone="neutral" valueClassName={blurCls} />
        
        <StatCard icon={<AlertCircle className="w-5 h-5" />} label="الفواتير المتعثرة" value={String(stats.overdueCount)} tone="danger" trend="down" valueClassName={blurCls} />
        <StatCard icon={<CalendarDays className="w-5 h-5" />} label="تحصيلات الشهر الحالي" value={`${fmt(stats.monthCollections)} ج.م`} tone="neutral" trend="up" valueClassName={blurCls} />
        <StatCard icon={<Wallet className="w-5 h-5" />} label="إجمالي المبيعات النشطة" value={`${fmt(stats.activeSalesTotal)} ج.م`} tone="neutral" trend="up" valueClassName={blurCls} />

        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="نسبة التحصيل" value={`%${stats.collectionRate.toFixed(1)}`} tone="neutral" trend="up" valueClassName={blurCls} />
        <StatCard icon={<FileText className="w-5 h-5" />} label="متوسط قيمة الفاتورة" value={`${fmt(stats.avgInvoiceValue)} ج.م`} tone="neutral" valueClassName={blurCls} />
        <StatCard icon={<CalendarDays className="w-5 h-5" />} label="مبيعات الشهر الحالي" value={`${fmt(stats.monthSales)} ج.م`} tone="neutral" trend="up" valueClassName={blurCls} />
      </div>

      <div className="sticky-search-bar">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto">
          <TabsTrigger value="active" className="gap-1.5 data-[state=active]:bg-foreground/[0.06] data-[state=active]:text-foreground">
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

          {list.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-foreground/[0.03] border border-border/50 text-xs">
              <Checkbox
                checked={selectedIds.size === list.length && list.length > 0}
                onCheckedChange={toggleSelectAll}
                id="select-all-invoices"
              />
              <label htmlFor="select-all-invoices" className="cursor-pointer text-muted-foreground font-medium select-none">
                تحديد الكل ({list.length})
              </label>
            </div>
          )}

          <div className="md:ms-auto text-xs text-muted-foreground">
            {list.length} فاتورة
          </div>
        </div>

        {/* شريط الإجراءات الجماعية العائم */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="p-3 rounded-2xl bg-foreground/95 text-background shadow-xl flex flex-wrap items-center justify-between gap-3 border border-border"
            >
              <div className="flex items-center gap-2.5">
                <Badge variant="secondary" className="font-bold text-xs bg-background text-foreground">
                  {selectedIds.size} فاتورة محددة
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-7 text-xs text-background/70 hover:text-background hover:bg-background/10"
                >
                  إلغاء التحديد
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleBulkPrint}
                  className="h-8 gap-1.5 text-xs font-bold bg-background text-foreground hover:bg-background/90"
                >
                  <Printer className="w-3.5 h-3.5 text-primary" /> طباعة مجمعة
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleBulkExportCSV}
                  className="h-8 gap-1.5 text-xs font-bold bg-background text-foreground hover:bg-background/90"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-success" /> تصدير إكسل
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleBulkWhatsApp}
                  className="h-8 gap-1.5 text-xs font-bold bg-background text-foreground hover:bg-background/90"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-success" /> تذكير واتساب
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 gap-1.5 text-xs font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> حذف المحدد
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-right">حذف الفواتير المحددة ({selectedIds.size})</AlertDialogTitle>
                      <AlertDialogDescription className="text-right">
                        هل أنت متأكد من حذف {selectedIds.size} فاتورة نهائياً؟ سيتم إرجاع كميات المخزون وحذف كافة السجلات المالية المرتبطة بها.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-danger text-danger-foreground">
                        نعم، حذف الكل
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Reveal delay={140}>
        <div className="flex flex-col gap-3">
          {list.length === 0 ? (
            <BezelCard variant="flat" className="px-6 py-10">
                <EmptyState
                  icon={Receipt}
                  title={tab === "active" ? "لا توجد فواتير نشطة." : tab === "overdue" ? "لا توجد فواتير متأخرة." : "لا توجد فواتير."}
                  hint={tab === "active" ? "كل الفواتير مسددة بالكامل." : tab === "overdue" ? "لا توجد مديونيات متأخرة حالياً." : "سجّل أول فاتورة وابدأ تتبع التحصيلات."}
                />
            </BezelCard>
          ) : (
            list.map((inv, idx) => {
              const remaining = inv.total - inv.paid;
              const late = daysLate(inv);
              const isOverdue = remaining > 0 && late > 0;
              const status = remaining === 0 ? "مسددة" : isOverdue ? `متأخرة (${late} يوم)` : "نشطة";
              const cust = findCustomer(inv.customerId);
              const isSelected = selectedIds.has(inv.id);
              
              return (
                <div
                  key={inv.id}
                  className={cn(
                    "group bezel-shell bezel-lift animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)] both transition-all",
                    isSelected ? "ring-2 ring-primary bg-primary/[0.02]" : ""
                  )}
                  style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                >
                  <div className="bezel-core grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-6">
                    {/* الهوية */}
                    <div className="flex min-w-0 items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(inv.id)}
                        className="shrink-0"
                      />
                      <div className={cn(
                        "text-display grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-bold ring-1",
                        remaining === 0 ? "bg-success/12 text-success ring-success/25" : 
                        isOverdue ? "bg-danger/12 text-danger ring-danger/25" : 
                        "bg-primary/12 text-primary ring-primary/25"
                      )}>
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 text-right">
                        <div className="font-mono text-xs font-bold text-muted-foreground">#{invoiceNumber(data.invoices, inv.id, shopSettings.invoicePrefix)}</div>
                        <div className="font-bold truncate">{cust?.name ?? "عميل محذوف"}</div>
                      </div>
                    </div>

                    {/* المبالغ */}
                    <div className="min-w-0 w-full md:w-auto">
                      <div className="flex items-center justify-between md:justify-start gap-4">
                        <div className="flex flex-col text-right">
                          <div className="text-[10px] text-muted-foreground mb-0.5">الإجمالي</div>
                          <div className={cn("text-numeric font-bold", privacy && "privacy-blur")}>{fmt(inv.total)}</div>
                        </div>
                        <div className="flex flex-col text-right">
                          <div className="text-[10px] text-muted-foreground mb-0.5">المتبقي</div>
                          <div className={cn("text-numeric text-xl font-extrabold", remaining > 0 ? "text-danger" : "text-success", privacy && "privacy-blur")}>{fmt(remaining)}</div>
                        </div>
                      </div>
                    </div>

                    {/* الإجراءات */}
                    <div className="flex items-center justify-end gap-1.5 md:opacity-70 md:transition-opacity md:group-hover:opacity-100">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => setViewInv(inv)}>
                              <Info className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>تفاصيل البنود والتقسيط</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-success hover:bg-success/10" onClick={() => setShareInv(inv)}>
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>مشاركة واتساب</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => setCustomPrintInv(inv)}>
                              <Printer className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>تخصيص وطباعة الفاتورة</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {remaining > 0 && (
                        <PaymentDialog
                          invoiceId={inv.id}
                          max={remaining}
                          invoiceNo={invoiceNumber(data.invoices, inv.id, shopSettings.invoicePrefix)}
                          customerName={cust?.name}
                        />
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:bg-foreground/5">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-right w-52">
                          <DropdownMenuItem onClick={() => setViewInv(inv)} className="gap-2 justify-end">
                            <span>عرض التفاصيل وجدول الأقساط</span>
                            <Eye className="w-4 h-4 text-primary" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCustomPrintInv(inv)} className="gap-2 justify-end">
                            <span>تخصيص وطباعة الإيصال (حراري/A4)</span>
                            <Printer className="w-4 h-4 text-primary" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShipmentInv(inv)} className="gap-2 justify-end">
                            <span>تحويل إلى شحنة وبوليصة توصيل</span>
                            <Truck className="w-4 h-4 text-indigo-500" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setReturnInv(inv)} className="gap-2 justify-end">
                            <span>مرتجع بضاعة من الفاتورة</span>
                            <Undo2 className="w-4 h-4 text-warning" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShareInv(inv)} className="gap-2 justify-end">
                            <span>إيصال رقمي / واتساب</span>
                            <Share2 className="w-4 h-4 text-success" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCloneInvoice(inv)} className="gap-2 justify-end">
                            <span>استنساخ / تكرار الفاتورة</span>
                            <Copy className="w-4 h-4 text-blue-500" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditInv(inv)} className="gap-2 justify-end">
                            <span>تعديل الفاتورة</span>
                            <Pencil className="w-4 h-4 text-amber-500" />
                          </DropdownMenuItem>
                          {remaining > 0 && (
                            <DropdownMenuItem onClick={() => setReminderInv(inv)} className="gap-2 justify-end">
                              <span>تذكير بالقسط المستحق</span>
                              <Bell className="w-4 h-4 text-danger" />
                            </DropdownMenuItem>
                          )}
                          {cust && (
                            <DropdownMenuItem onClick={() => setHistoryFor(cust)} className="gap-2 justify-end">
                              <span>سجل حساب العميل</span>
                              <History className="w-4 h-4 text-indigo-500" />
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm("هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إرجاع المنتجات للمخزن وحذف القيود المتعلقة بها.")) {
                                db.removeInvoice(inv.id);
                                toast.success("تم حذف الفاتورة");
                              }
                            }}
                            className="gap-2 justify-end text-danger focus:text-danger focus:bg-danger/10"
                          >
                            <span>حذف الفاتورة</span>
                            <Trash2 className="w-4 h-4" />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Reveal>
      <HistoryDialog customer={historyFor} onClose={() => setHistoryFor(null)} invoices={data.invoices} payments={data.payments} items={data.invoiceItems} blurCls={blurCls} onEditInvoice={(i) => { setHistoryFor(null); setEditInv(i); }} />
      <ViewInvoiceDialog
        inv={viewInv}
        customer={viewInv ? findCustomer(viewInv.customerId) ?? null : null}
        items={data.invoiceItems}
        payments={data.payments}
        onClose={() => setViewInv(null)}
        onOpenReturn={(i) => { setViewInv(null); setReturnInv(i); }}
        onOpenShare={(i) => { setViewInv(null); setShareInv(i); }}
        onOpenCustomPrint={(i) => { setViewInv(null); setCustomPrintInv(i); }}
        onOpenShipment={(i) => { setViewInv(null); setShipmentInv(i); }}
        onClone={(i) => handleCloneInvoice(i)}
        onEdit={(i) => { setViewInv(null); setEditInv(i); }}
        onDirectPay={(i, amount) => {
          const cust = findCustomer(i.customerId);
          const remaining = Math.max(0, i.total - i.paid);
          setDirectPayState({
            invoiceId: i.id,
            max: remaining,
            invoiceNo: invoiceNumber(data.invoices, i.id, shopSettings.invoicePrefix),
            customerName: cust?.name,
            initialAmount: Math.min(amount, remaining),
          });
        }}
      />
      <InvoiceReturnDialog
        inv={returnInv}
        customer={returnInv ? findCustomer(returnInv.customerId) ?? null : null}
        items={data.invoiceItems}
        onClose={() => setReturnInv(null)}
      />
      <ShareInvoiceDialog
        inv={shareInv}
        customer={shareInv ? findCustomer(shareInv.customerId) ?? null : null}
        items={data.invoiceItems}
        shopSettings={shopSettings}
        onClose={() => setShareInv(null)}
      />
      <CreateInvoiceShipmentDialog
        inv={shipmentInv}
        customer={shipmentInv ? findCustomer(shipmentInv.customerId) ?? null : null}
        items={shipmentInv ? data.invoiceItems.filter((it) => it.invoiceId === shipmentInv.id) : []}
        carriers={data.carriers}
        zones={data.zones}
        onClose={() => setShipmentInv(null)}
      />
      <InvoicePrintCustomizerDialog
        inv={customPrintInv}
        customer={customPrintInv ? findCustomer(customPrintInv.customerId) ?? null : null}
        items={customPrintInv ? data.invoiceItems.filter((it) => it.invoiceId === customPrintInv.id) : []}
        payments={data.payments}
        allInvoices={data.invoices}
        shopSettings={shopSettings}
        onClose={() => setCustomPrintInv(null)}
      />
      {directPayState && (
        <PaymentDialog
          invoiceId={directPayState.invoiceId}
          max={directPayState.max}
          invoiceNo={directPayState.invoiceNo}
          customerName={directPayState.customerName}
          initialAmount={directPayState.initialAmount}
          controlledOpen={true}
          onControlledClose={() => setDirectPayState(null)}
        />
      )}
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

function StatCard({ icon, label, value, tone, trend, valueClassName }: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "success" | "danger" | "neutral"; trend?: "up" | "down"; valueClassName?: string }) {
  const toneCls = tone === "primary" ? "bg-primary/10 text-primary border-primary/30" : tone === "success" ? "bg-success/10 text-success border-success/30" : tone === "danger" ? "bg-danger/10 text-danger border-danger/30" : "bg-foreground/[0.06] text-foreground border-border";
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
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            style={{ overflow: "hidden" }}
                            className="origin-top"
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

function InvoiceReturnDialog({
  inv,
  customer,
  items,
  onClose,
}: {
  inv: Invoice | null;
  customer: Customer | null;
  items: InvoiceItem[];
  onClose: () => void;
}) {
  const [selectedItems, setSelectedItems] = useState<{ [itemId: string]: { selected: boolean; quantity: number } }>({});
  const [reason, setReason] = useState("رغبة العميل");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const invItems = useMemo(() => {
    if (!inv) return [];
    return items.filter((it) => it.invoiceId === inv.id);
  }, [inv, items]);

  useEffect(() => {
    if (inv && invItems.length > 0) {
      const initial: { [itemId: string]: { selected: boolean; quantity: number } } = {};
      invItems.forEach((it) => {
        initial[it.id] = { selected: false, quantity: it.quantity || 1 };
      });
      setSelectedItems(initial);
      setReason("رغبة العميل");
      setNotes("");
    }
  }, [inv, invItems]);

  if (!inv) return null;

  const returnPayload = invItems
    .filter((it) => selectedItems[it.id]?.selected && (selectedItems[it.id]?.quantity || 0) > 0)
    .map((it) => ({
      name: it.name,
      unitPrice: it.price,
      quantity: Math.min(it.quantity || 1, selectedItems[it.id]?.quantity || 1),
    }));

  const totalReturnValue = returnPayload.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

  const handleSubmitReturn = async () => {
    if (returnPayload.length === 0) {
      toast.error("حدد صنفاً واحداً على الأقل لإرجاعه");
      return;
    }
    setLoading(true);
    try {
      await db.addReturn({
        invoiceId: inv.id,
        type: "sale",
        totalAmount: totalReturnValue,
        reason: notes ? `${reason} - ${notes}` : reason,
        notes: notes || null,
        items: returnPayload,
      });
      toast.success(`تم تسجيل مرتجع بقيمة ${fmt(totalReturnValue)} ج.م وإعادة الأصناف للمخزن بنجاح`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "تعذر تسجيل المرتجع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end text-right">
            مرتجع بضاعة — فاتورة #{inv.id.slice(0, 6)}
            <Undo2 className="w-5 h-5 text-warning" />
          </DialogTitle>
          <DialogDescription className="text-right">
            حدد الأصناف والكميات المراد إرجاعها إلى المخزن وتسوية حساب الفاتورة مع العميل {customer?.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-right">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground">أصناف الفاتورة المتاحة للإرجاع</Label>
            {invItems.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3 border rounded-xl text-center">
                لا توجد أصناف مفصلة لهذه الفاتورة.
              </div>
            ) : (
              <div className="border rounded-2xl divide-y overflow-hidden max-h-56 overflow-y-auto">
                {invItems.map((it) => {
                  const state = selectedItems[it.id] || { selected: false, quantity: it.quantity || 1 };
                  return (
                    <div key={it.id} className={cn("p-3 flex items-center justify-between gap-3 transition-colors", state.selected ? "bg-warning/10" : "bg-card")}>
                      <div className="flex items-center gap-2">
                        {state.selected && (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={1}
                              max={it.quantity || 1}
                              value={state.quantity}
                              onChange={(e) => {
                                const q = Math.max(1, Math.min(it.quantity || 1, Number(e.target.value) || 1));
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [it.id]: { ...prev[it.id], quantity: q },
                                }));
                              }}
                              className="w-16 h-8 text-center text-xs"
                            />
                            <span className="text-[11px] text-muted-foreground">من {it.quantity || 1}</span>
                          </div>
                        )}
                        <span className="font-bold text-xs tabular-nums text-muted-foreground">
                          {fmt(it.price * (state.selected ? state.quantity : (it.quantity || 1)))} ج.م
                        </span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer flex-1 justify-end">
                        <span className="text-sm font-medium">{it.name}</span>
                        <input
                          type="checkbox"
                          checked={state.selected}
                          onChange={(e) => {
                            setSelectedItems((prev) => ({
                              ...prev,
                              [it.id]: { ...prev[it.id], selected: e.target.checked },
                            }));
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-warning focus:ring-warning"
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">سبب الإرجاع</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="رغبة العميل">رغبة العميل (استرجاع عادي)</SelectItem>
                  <SelectItem value="عيب صناعة / تالف">عيب صناعة / تالف</SelectItem>
                  <SelectItem value="تبديل مقاس / لون">تبديل مقاس أو مواصفات</SelectItem>
                  <SelectItem value="خطأ في الطلب">خطأ في الطلب أو الشحن</SelectItem>
                  <SelectItem value="أخرى">أسباب أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">ملاحظات إضافية</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="تفاصيل العيب أو المرتجع..."
                className="text-xs"
                maxLength={100}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-warning/10 border border-warning/30 p-3 flex items-center justify-between">
            <span className="font-extrabold text-warning text-lg tabular-nums">{fmt(totalReturnValue)} ج.م</span>
            <span className="text-xs font-bold text-warning-foreground">إجمالي قيمة المرتجع المسترد:</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button
            onClick={handleSubmitReturn}
            disabled={loading || returnPayload.length === 0}
            className="gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90 font-bold"
          >
            <Undo2 className="w-4 h-4" /> تأكيد المرتجع واسترداد للمخزن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareInvoiceDialog({
  inv,
  customer,
  items,
  shopSettings,
  onClose,
}: {
  inv: Invoice | null;
  customer: Customer | null;
  items: InvoiceItem[];
  shopSettings: any;
  onClose: () => void;
}) {
  if (!inv || !customer) return null;

  const invItems = items.filter((it) => it.invoiceId === inv.id);
  const remaining = inv.total - inv.paid;
  const invNo = inv.id.slice(0, 6);
  const shopName = shopSettings?.shopName || "المتجر";
  const cur = shopSettings?.currency || "ج.م";

  const itemsText = invItems.length > 0
    ? invItems.map((it) => `• ${it.name} (الكمية: ${it.quantity || 1}) - ${fmt(it.price * (it.quantity || 1))} ${cur}`).join("\n")
    : `• ${inv.notes || "مبيعات عامة"} - ${fmt(inv.total)} ${cur}`;

  const message =
    `🧾 *فاتورة مبيعات رقم #${invNo}*\n` +
    `🏢 *${shopName}*\n` +
    `👤 *العميل:* ${customer.name}\n` +
    `📅 *التاريخ:* ${format(new Date(inv.createdAt), "dd/MM/yyyy")}\n` +
    `──────────────────\n` +
    `📦 *المنتجات:*\n` +
    `${itemsText}\n` +
    `──────────────────\n` +
    `💵 *إجمالي الفاتورة:* ${fmt(inv.total)} ${cur}\n` +
    `💰 *المسدد حتى الآن:* ${fmt(inv.paid)} ${cur}\n` +
    `⏳ *المتبقي المستحق:* ${fmt(remaining)} ${cur}\n` +
    (inv.monthlyInstallment > 0
      ? `📅 *القسط الشهري:* ${fmt(inv.monthlyInstallment)} ${cur} (أول استحقاق: ${isoToDDMMYYYY(inv.firstDueDate)})\n`
      : `✅ *طريقة الدفع:* نقدي (كاش فوري)\n`) +
    (shopSettings?.phone ? `📞 *خدمة العملاء:* ${shopSettings.phone}\n` : "") +
    `\nشكراً لتعاملكم معنا ونرحب بكم دائماً! 🌸`;

  const cleanPhone = (customer.phone || "").replace(/[^\d]/g, "");
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end text-right">
            مشاركة الفاتورة الرقمية
            <MessageCircle className="w-5 h-5 text-success" />
          </DialogTitle>
          <DialogDescription className="text-right">
            إيصال رقمي منسق جاهز للمشاركة مع العميل {customer.name} عبر واتساب أو الرسائل.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-right">
          <div className="bg-foreground/[0.035] p-3.5 rounded-2xl hairline max-h-60 overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-line select-all" dir="rtl">
            {message}
          </div>

          <div className="text-[11px] text-muted-foreground text-center">
            رقم الهاتف المسجل: <span dir="ltr" className="font-bold text-foreground">{customer.phone || "غير مسجل"}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(toArabicDigits(message));
              toast.success("تم نسخ نص الفاتورة للحافظة بنجاح");
            }}
            className="gap-1.5"
          >
            <Copy className="w-4 h-4" /> نسخ النص
          </Button>
          <Button
            asChild
            className="gap-2 bg-success hover:bg-success/90 text-success-foreground font-bold"
          >
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4" /> إرسال عبر واتساب
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewInvoiceDialog({
  inv,
  customer,
  items,
  payments,
  onClose,
  onOpenReturn,
  onOpenShare,
  onOpenCustomPrint,
  onOpenShipment,
  onClone,
  onEdit,
  onDirectPay,
}: {
  inv: Invoice | null;
  customer: Customer | null;
  items: InvoiceItem[];
  payments: import("@/lib/store").Payment[];
  onClose: () => void;
  onOpenReturn?: (i: Invoice) => void;
  onOpenShare?: (i: Invoice) => void;
  onOpenCustomPrint?: (i: Invoice) => void;
  onOpenShipment?: (i: Invoice) => void;
  onClone?: (i: Invoice) => void;
  onEdit?: (i: Invoice) => void;
  onDirectPay?: (i: Invoice, amount: number) => void;
}) {
  const { privacy } = usePrivacy();
  const { settings: shop } = useShopSettings();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  if (!inv) return null;

  const remaining = inv.total - inv.paid;
  const late = daysLate(inv);
  const isOverdue = remaining > 0 && late > 0;
  const invItems = items.filter((it) => it.invoiceId === inv.id);
  const invPayments = payments.filter((p) => p.invoiceId === inv.id);

  const totalCost = invItems.reduce((acc, it) => acc + ((it.cost || 0) * (it.quantity || 1)), 0);
  const totalProfit = inv.total - totalCost;
  const paidPct = Math.min(100, Math.round((inv.paid / Math.max(1, inv.total)) * 100));

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn(
                "font-bold text-xs px-2.5 py-0.5",
                remaining === 0 ? "bg-success/15 text-success border-success/30" :
                isOverdue ? "bg-danger/15 text-danger border-danger/30" :
                "bg-primary/15 text-primary border-primary/30"
              )}>
                {remaining === 0 ? "مسددة بالكامل" : isOverdue ? `متأخرة ${late} يوم` : "نشطة وجارية"}
              </Badge>
            </div>
            <div className="text-right">
              <DialogTitle className="text-lg font-bold">فاتورة #{inv.id.slice(0, 6)}</DialogTitle>
              <DialogDescription className="text-xs">{customer?.name ?? "عميل محذوف"} {customer?.phone ? `• ${customer.phone}` : ""}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* شريط الإجراءات السريعة في رأس التفاصيل */}
        <div className="flex flex-wrap items-center justify-end gap-2 bg-foreground/[0.03] p-2.5 rounded-2xl border border-border/50">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenCustomPrint?.(inv)}
            className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 font-bold"
          >
            <Printer className="w-3.5 h-3.5" /> تخصيص وطباعة
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenShipment?.(inv)}
            className="gap-1.5 text-xs text-indigo-600 border-indigo-500/30 hover:bg-indigo-500/10 font-bold"
          >
            <Truck className="w-3.5 h-3.5" /> تحويل لشحنة
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenShare?.(inv)}
            className="gap-1.5 text-xs text-success border-success/30 hover:bg-success/10 font-bold"
          >
            <MessageCircle className="w-3.5 h-3.5" /> مشاركة واتساب
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenReturn?.(inv)}
            className="gap-1.5 text-xs text-warning border-warning/30 hover:bg-warning/10 font-bold"
          >
            <Undo2 className="w-3.5 h-3.5" /> مرتجع بضاعة
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onClone?.(inv)}
            className="gap-1.5 text-xs text-blue-500 border-blue-500/30 hover:bg-blue-500/10 font-bold"
          >
            <Copy className="w-3.5 h-3.5" /> استنساخ
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit?.(inv)}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="w-3.5 h-3.5" /> تعديل
          </Button>
        </div>

        {/* بطاقات الإحصائيات الأربعة */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-right">
          <div className="p-3 rounded-2xl bg-card border border-border/60">
            <div className="text-[11px] text-muted-foreground font-medium mb-1">إجمالي الفاتورة</div>
            <div className={cn("text-base font-extrabold tabular-nums", blurCls)}>{fmt(inv.total)} ج.م</div>
          </div>
          <div className="p-3 rounded-2xl bg-success/5 border border-success/20">
            <div className="text-[11px] text-success font-medium mb-1">المسدد</div>
            <div className={cn("text-base font-extrabold text-success tabular-nums", blurCls)}>{fmt(inv.paid)} ج.م</div>
          </div>
          <div className={cn("p-3 rounded-2xl border", remaining > 0 ? "bg-danger/5 border-danger/20" : "bg-card border-border/60")}>
            <div className={cn("text-[11px] font-medium mb-1", remaining > 0 ? "text-danger" : "text-muted-foreground")}>المتبقي المستحق</div>
            <div className={cn("text-base font-extrabold tabular-nums", remaining > 0 ? "text-danger" : "text-success", blurCls)}>{fmt(remaining)} ج.م</div>
          </div>
          <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20">
            <div className="text-[11px] text-primary font-medium mb-1">صافي الربح التقديري</div>
            <div className={cn("text-base font-extrabold text-primary tabular-nums", blurCls)}>{fmt(totalProfit)} ج.م</div>
          </div>
        </div>

        {/* شريط نسبة التحصيل */}
        <div className="space-y-1.5 text-right">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tabular-nums text-muted-foreground">{paidPct}% مسدد</span>
            <span className="text-muted-foreground font-medium">نسبة سداد الفاتورة</span>
          </div>
          <div className="h-2 w-full rounded-full bg-foreground/[0.08] overflow-hidden">
            <div
              className={cn("h-full transition-all duration-500 rounded-full", remaining === 0 ? "bg-success" : "bg-primary")}
              style={{ width: `${paidPct}%` }}
            />
          </div>
        </div>

        {/* جدول بنود وأصناف الفاتورة الكامل */}
        <div className="space-y-2 text-right">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px]">{invItems.length} صنف</Badge>
            <Label className="text-xs font-bold">بنود ومنتجات الفاتورة</Label>
          </div>
          {invItems.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3 border rounded-xl text-center">
              لا توجد منتجات مفصلة مسجلة في الفاتورة (مبيعات عامة).
            </div>
          ) : (
            <div className="border border-border/60 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-xs">
                <thead className="bg-foreground/[0.035] text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="text-right p-2 font-bold">المنتج</th>
                    <th className="text-center p-2 font-bold w-16">الكمية</th>
                    <th className="text-right p-2 font-bold">سعر البيع</th>
                    <th className="text-right p-2 font-bold">التكلفة</th>
                    <th className="text-right p-2 font-bold">الإجمالي</th>
                    <th className="text-right p-2 font-bold text-success">الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {invItems.map((it) => {
                    const q = it.quantity || 1;
                    const rowTotal = it.price * q;
                    const rowCost = (it.cost || 0) * q;
                    const rowProfit = rowTotal - rowCost;
                    return (
                      <tr key={it.id} className="hover:bg-foreground/[0.02]">
                        <td className="p-2 font-medium text-foreground">{it.name}</td>
                        <td className="p-2 text-center tabular-nums font-bold">{q}</td>
                        <td className={cn("p-2 tabular-nums", blurCls)}>{fmt(it.price)} ج.م</td>
                        <td className={cn("p-2 tabular-nums text-muted-foreground", blurCls)}>{fmt(it.cost || 0)} ج.م</td>
                        <td className={cn("p-2 tabular-nums font-bold", blurCls)}>{fmt(rowTotal)} ج.م</td>
                        <td className={cn("p-2 tabular-nums font-bold text-success", blurCls)}>+{fmt(rowProfit)} ج.م</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* مصفوفة وجدول الأقساط المحسوب تلقائياً */}
        {inv.monthlyInstallment > 0 && (
          <div className="pt-2">
            <InstallmentScheduleMatrix
              inv={inv}
              customer={customer}
              payments={payments}
              onPayInstallment={(amt) => onDirectPay?.(inv, amt)}
            />
          </div>
        )}

        {/* تفاصيل الدفع والأقساط */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right text-xs">
          <div className="p-3 rounded-2xl border border-border/60 space-y-2">
            <div className="font-bold text-foreground border-b border-border/40 pb-1 flex items-center justify-end gap-1.5">
              بيانات الدفع والتقسيط
              <CreditCard className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-bold tabular-nums">{fmt(inv.downPayment)} ج.م</span>
              <span className="text-muted-foreground">الدفعة المقدمة:</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-bold tabular-nums">{fmt(inv.monthlyInstallment)} ج.م</span>
              <span className="text-muted-foreground">القسط الشهري:</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-bold tabular-nums" dir="ltr">{isoToDDMMYYYY(inv.firstDueDate)}</span>
              <span className="text-muted-foreground">تاريخ أول قسط:</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-bold tabular-nums" dir="ltr">{format(new Date(inv.createdAt), "dd/MM/yyyy")}</span>
              <span className="text-muted-foreground">تاريخ إنشاء الفاتورة:</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl border border-border/60 space-y-2">
            <div className="font-bold text-foreground border-b border-border/40 pb-1 flex items-center justify-end gap-1.5">
              سجل سدادات الفاتورة ({invPayments.length})
              <Wallet className="w-3.5 h-3.5 text-success" />
            </div>
            {invPayments.length === 0 ? (
              <div className="text-muted-foreground text-center py-3 text-[11px]">
                لم يتم تسجيل دفعات بعد على هذه الفاتورة.
              </div>
            ) : (
              <div className="max-h-28 overflow-y-auto divide-y divide-border/40">
                {invPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-1 text-[11px]">
                    <span className="font-bold text-success tabular-nums">+{fmt(p.amount)} ج.م</span>
                    <span className="text-muted-foreground tabular-nums" dir="ltr">{format(new Date(p.paidAt), "dd/MM/yyyy")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {inv.notes && (
          <div className="p-3 rounded-2xl bg-foreground/[0.02] border border-border/50 text-right text-xs">
            <span className="text-muted-foreground font-bold ml-1">ملاحظات:</span>
            <span className="text-foreground">{inv.notes}</span>
          </div>
        )}

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
        ? items.map((it) => ({ id: it.id, name: it.name, cost: String(it.cost), price: String(it.price), quantity: String(it.quantity) }))
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

  const totalCost = products.reduce((s, p) => s + Number(p.cost || 0) * Number(p.quantity || 1), 0);
  const totalPrice = products.reduce((s, p) => s + Number(p.price || 0) * Number(p.quantity || 1), 0);
  const remaining = Math.max(0, totalPrice - Number(down || 0));
  const profit = totalPrice - totalCost;
  const isCash = totalPrice > 0 && Number(down) >= totalPrice;

  const addProduct = () => setProducts((p) => [...p, { id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" }]);
  const removeProduct = (id: string) => setProducts((p) => p.length > 1 ? p.filter((x) => x.id !== id) : p);
  const updateProduct = (id: string, patch: Partial<ProductRow>) =>
    setProducts((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));

  const submit = async () => {
    const valid = products.filter((p) => p.name.trim() && Number(p.price) > 0 && Number(p.quantity) > 0);
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
      const payload = { name: p.name.trim(), cost: Number(p.cost || 0), price: Number(p.price || 0), quantity: Math.max(1, Math.floor(Number(p.quantity || 1))) };
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
                  initial={{ opacity: 0, scale: 0.98, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                  className="origin-top"
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
              <motion.div key="inst" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} style={{ overflow: "hidden" }} className="origin-top">
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
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
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


function PaymentDialog({
  invoiceId,
  max,
  invoiceNo,
  customerName,
  controlledOpen,
  onControlledClose,
  initialAmount,
}: {
  invoiceId: string;
  max: number;
  invoiceNo?: string;
  customerName?: string;
  controlledOpen?: boolean;
  onControlledClose?: () => void;
  initialAmount?: number;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === "boolean";
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (o: boolean) => {
    if (isControlled) {
      if (!o) onControlledClose?.();
    } else {
      setInternalOpen(o);
    }
  };

  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "");
  const accounts = useMemo(() => getTreasuryAccounts().filter((a) => a.active), [open]);
  const [accountId, setAccountId] = useState(accounts[0]?.id || "acc-cash-main");

  useEffect(() => {
    if (open && initialAmount) {
      setAmount(String(initialAmount));
    }
  }, [open, initialAmount]);

  const handleConfirm = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    const payAmount = Math.min(n, max);
    await db.recordPayment(invoiceId, payAmount);

    const selectedAcc = accounts.find((a) => a.id === accountId);
    if (selectedAcc) {
      addManualTransaction({
        accountId: selectedAcc.id,
        type: "in",
        category: "سداد فاتورة",
        amount: payAmount,
        title: `تحصيل قسط فاتورة #${invoiceNo || invoiceId.slice(0, 6)} - ${customerName || "عميل"}`,
        date: format(new Date(), "yyyy-MM-dd"),
        notes: `دفعة محصلة للفاتورة #${invoiceNo || invoiceId.slice(0, 6)}`,
        performedBy: "النظام",
      });
    }

    toast.success(`تم تسجيل تحصيل ${fmt(payAmount)} ج.م وإيداعها في «${selectedAcc?.name || "الخزينة"}»`);
    setOpen(false);
    setAmount("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 border-success/40 text-success hover:bg-success/10 font-bold">
            <Wallet className="w-3.5 h-3.5" /> دفع
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-right">تسجيل دفعة للفاتورة</DialogTitle>
          <DialogDescription className="text-right">
            المتبقي على الفاتورة: <span className="font-bold text-danger">{fmt(max)} ج.م</span> {customerName ? `— العميل: ${customerName}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-right">
          <div>
            <Label className="text-xs font-bold">المبلغ المدفوع (ج.م)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`أقصى مبلغ: ${max}`}
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs font-bold">إيداع الدفعة في الخزينة / الحساب</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="text-right">
                <SelectValue placeholder="اختر الخزينة..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type === "cash" ? "درج نقدية" : acc.type === "ewallet" ? "محفظة إلكترونية" : "بنك"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              سيتم تسجيل حركة الإيداع تلقائياً في كشف حساب الخزينة المحددة.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full bg-success hover:bg-success/90 text-success-foreground font-bold" onClick={handleConfirm}>
            تأكيد استلام الدفعة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type ProductRow = {
  id: string;
  name: string;
  cost: string;
  price: string;
  stockId?: string;
  quantity: string;
  discount?: string;
  notes?: string;
};

export function StockProductPicker({ value, name, stockItems, onPick, onClear }: {
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
