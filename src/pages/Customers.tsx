import { BezelCard } from "@/components/BezelCard";
import { EmptyState } from "@/components/EmptyState";
import { Users } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StarRating } from "@/components/StarRating";
import { StatusBadge } from "@/components/StatusBadge";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";
import { useDB, db, fmt, aiScript, daysLate, type Customer, type CustomerStatus, type CustomerType, type Invoice } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, MessageCircle, Pencil, Trash2, Sparkles, Star, Info, User, Eye, EyeOff, FileDown, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, History, Share2, Wallet, Printer, ShoppingBag, Receipt, CreditCard, Banknote, Coins, Award, Gift, Copy, Check } from "lucide-react";
import type { Payment } from "@/lib/store";
import { toArabicDigits } from "@/lib/arabic-digits";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";
import { usePrivacy } from "@/lib/privacy";
import { useDiscounts, generateCustomerLoyaltyVoucher } from "@/lib/discounts";

const EG_PHONE_RE = /^01[0125]\d{8}$/;

// Egypt locale: DD/MM/YYYY display, ISO (YYYY-MM-DD) for storage
function isoToDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}
function ddmmyyyyToIso(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dd = Number(d), mm = Number(mo);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${y}-${mo}-${d}`;
}
const RATING_TIPS: Record<number, { text: string; cls: string }> = {
  5: { text: "★5: عميل موثوق — يمكن البيع بدون مقدم.", cls: "bg-success/15 text-success border-success/30" },
  4: { text: "★4: التزام جيد — شروط مرنة.", cls: "bg-success/10 text-success border-success/20" },
  3: { text: "★3: عادي — اتبع السياسة المعتادة.", cls: "bg-warning/15 text-warning border-warning/30" },
  2: { text: "★2: ضعيف — اطلب مقدم أعلى.", cls: "bg-warning/15 text-warning border-warning/30" },
  1: { text: "★1: خطر مرتفع — أوقف البيع الآجل.", cls: "bg-danger/15 text-danger border-danger/30" },
};
const STATUS_TABS: { value: CustomerStatus; label: string; dot: string; active: string }[] = [
  { value: "committed", label: "ملتزم", dot: "bg-success", active: "data-[state=active]:bg-success/15 data-[state=active]:text-success" },
  { value: "neutral", label: "عادي", dot: "bg-warning", active: "data-[state=active]:bg-warning/15 data-[state=active]:text-warning" },
  { value: "defaulter", label: "مماطل", dot: "bg-danger", active: "data-[state=active]:bg-danger/15 data-[state=active]:text-danger" },
];

export default function Page() { return (<AppShell><PageTransition><CustomersPage /></PageTransition></AppShell>); }

type FilterTab = "all" | "installment" | "cash" | "overdue" | "bajah" | "settled";

const FILTERS: { value: FilterTab; label: string; activeCls: string }[] = [
  { value: "all", label: "الكل", activeCls: "bg-primary text-primary-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.45)]" },
  { value: "installment", label: "عملاء قسط", activeCls: "bg-foreground text-background shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]" },
  { value: "cash", label: "عملاء فوري", activeCls: "bg-foreground text-background shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]" },
  { value: "overdue", label: "المتأخرون", activeCls: "bg-foreground text-background shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]" },
  { value: "bajah", label: "عملاء بجحين", activeCls: "bg-foreground text-background shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]" },
  { value: "settled", label: "الخالصون", activeCls: "bg-foreground text-background shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]" },
];

function SortChip({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-[transform,color,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]",
        active ? "bg-foreground text-background ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {active ? (
        dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

function customerMetrics(invoices: Invoice[], c: Customer) {
  const mine = invoices.filter((i) => i.customerId === c.id);
  const totalCharged = mine.reduce((s, i) => s + i.total, 0) + (c.openingBalance || 0);
  const totalPaid = mine.reduce((s, i) => s + i.paid, 0);
  const balance = totalCharged - totalPaid;
  const worstLate = Math.max(0, ...mine.map(daysLate));
  const paidPct = totalCharged > 0 ? Math.min(100, Math.round((totalPaid / totalCharged) * 100)) : 0;
  return { balance, worstLate, paidPct, totalCharged, totalPaid };
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.86 11.86 0 0012.06 0C5.5 0 .17 5.33.17 11.9c0 2.1.55 4.14 1.6 5.95L0 24l6.32-1.65a11.9 11.9 0 005.74 1.46h.01c6.55 0 11.88-5.33 11.88-11.9 0-3.18-1.24-6.16-3.43-8.43zM12.07 21.8h-.01a9.9 9.9 0 01-5.05-1.38l-.36-.21-3.75.98 1-3.65-.24-.38a9.86 9.86 0 01-1.51-5.26c0-5.46 4.45-9.9 9.92-9.9 2.65 0 5.14 1.03 7.01 2.91a9.84 9.84 0 012.9 7c0 5.47-4.44 9.89-9.91 9.89zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
    </svg>
  );
}

type SortKey = "name" | "balance";
type SortDir = "asc" | "desc";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function CustomersPage() {
  const data = useDB();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [scriptFor, setScriptFor] = useState<Customer | null>(null);
  const [viewFor, setViewFor] = useState<Customer | null>(null);
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [redeemedVoucher, setRedeemedVoucher] = useState<{ customer: Customer; coupon: any } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const { privacy, toggle } = usePrivacy();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { loyaltyConfig, customerLoyaltyStats, generateCustomerLoyaltyVoucher } = useDiscounts();

  const loyaltyMap = useMemo(() => {
    const map = new Map<string, typeof customerLoyaltyStats[0]>();
    for (const stat of customerLoyaltyStats) {
      map.set(stat.customer.id, stat);
    }
    return map;
  }, [customerLoyaltyStats]);

  // Generate sequential customer code (1, 2, 3...) based on creation order
  const customerCodeMap = useMemo(() => {
    const sorted = [...data.customers].sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      if (tA !== tB) return tA - tB;
      return a.id.localeCompare(b.id);
    });
    const map = new Map<string, number>();
    sorted.forEach((c, idx) => {
      map.set(c.id, idx + 1);
    });
    return map;
  }, [data.customers]);

  const enriched = useMemo(
    () => data.customers.map((c) => ({ c, m: customerMetrics(data.invoices, c), code: customerCodeMap.get(c.id) || 1 })),
    [data.customers, data.invoices, customerCodeMap],
  );

  const counts = useMemo(() => {
    let overdue = 0, bajah = 0, settled = 0, installment = 0, cash = 0;
    for (const { c, m } of enriched) {
      if (m.worstLate > 1) overdue++;
      if (c.status === "defaulter" || m.worstLate > 30) bajah++;
      if (m.balance <= 0) settled++;
      if (c.customerType === "cash") cash++; else installment++;
    }
    return { all: enriched.length, installment, cash, overdue, bajah, settled };
  }, [enriched]);

  const debtStats = useMemo(() => {
    const totalDebt = enriched.reduce((s, x) => s + Math.max(0, x.m.balance), 0);
    const now = Date.now();
    const week = 7 * 86400000;
    let thisWeek = 0, prevWeek = 0;
    for (const p of data.payments) {
      const t = new Date(p.paidAt).getTime();
      if (now - t <= week) thisWeek += p.amount;
      else if (now - t <= 2 * week) prevWeek += p.amount;
    }
    const debtors = enriched.filter((x) => x.m.balance > 0).length;
    const trendPct = prevWeek > 0 ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : (thisWeek > 0 ? 100 : 0);
    return { totalDebt, thisWeek, trendPct, debtors };
  }, [enriched, data.payments]);

  const list = useMemo(() => {
    const qClean = q.trim().toLowerCase();
    const filtered = enriched
      .filter(({ c, m, code }) => {
        if (filter === "installment") return c.customerType !== "cash";
        if (filter === "cash") return c.customerType === "cash";
        if (filter === "overdue") return m.worstLate > 1;
        if (filter === "bajah") return c.status === "defaulter" || m.worstLate > 30;
        if (filter === "settled") return m.balance <= 0;
        return true;
      })
      .filter(({ c, code }) => {
        if (!qClean) return true;
        const codeStr = String(code);
        return (
          c.name.toLowerCase().includes(qClean) ||
          c.phone.includes(qClean) ||
          codeStr === qClean.replace(/^[#\s]+/, "") ||
          `#${codeStr}`.includes(qClean)
        );
      });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "balance") return (a.m.balance - b.m.balance) * dir;
      return a.c.name.localeCompare(b.c.name, "ar") * dir;
    });
  }, [enriched, q, filter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "balance" ? "desc" : "asc"); }
  };

  const exportPDF = () => {
    const tabLabel: Record<FilterTab, string> = { all: "كل العملاء", installment: "عملاء الأقساط", cash: "العملاء الفوريون", overdue: "العملاء المتأخرون", bajah: "العملاء البجحون", settled: "العملاء الخالصون" };
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const rows = list.map(({ c, m }, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(c.name)}</td>
        <td dir="ltr">${escapeHtml(c.phone)}</td>
        <td>${escapeHtml(c.address || "—")}</td>
        <td class="num">${fmt(m.totalCharged)}</td>
        <td class="num ok">${fmt(m.totalPaid)}</td>
        <td class="num ${m.balance > 0 ? "due" : ""}">${fmt(m.balance)}</td>
        <td>${m.worstLate > 0 ? `<span class="tag purchase">${m.worstLate} يوم</span>` : "—"}</td>
      </tr>`).join("");
    const totalDue = list.reduce((s, x) => s + Math.max(0, x.m.balance), 0);
    const totalCharged = list.reduce((s, x) => s + x.m.totalCharged, 0);
    const totalPaid = list.reduce((s, x) => s + x.m.totalPaid, 0);
    const body = `
<h2 class="sec">بيانات العملاء</h2>
<div class="t-wrap"><table>
  <thead><tr>
    <th>م</th><th>اسم العميل</th><th>الهاتف</th><th>العنوان</th>
    <th class="num">إجمالي المعاملات</th><th class="num">إجمالي المسدد</th><th class="num">المتبقي</th><th>أقصى تأخير</th>
  </tr></thead>
  <tbody>${rows || `<tr><td colspan="8" class="empty">لا توجد بيانات</td></tr>`}</tbody>
  <tfoot><tr>
    <td colspan="4">الإجماليات</td>
    <td class="num">${fmt(totalCharged)}</td>
    <td class="num">${fmt(totalPaid)}</td>
    <td class="num">${fmt(totalDue)}</td>
    <td>—</td>
  </tr></tfoot>
</table></div>
<div class="sig"><div>توقيع المسؤول</div><div>الختم الرسمي</div></div>`;
    const html = pdfDocument({
      docTitle: "كشف حساب العملاء — سِجلّي",
      badge: "كشف حساب عملاء",
      title: "كشف حساب العملاء",
      lede: `تقرير رسمي يوضّح أرصدة العملاء والمتأخرات — ${tabLabel[filter]}.`,
      meta: [
        { label: "تاريخ التقرير", value: today },
        { label: "التصنيف", value: tabLabel[filter] },
        { label: "عدد العملاء", value: String(list.length) },
      ],
      kpis: [
        { label: "عدد العملاء", value: String(list.length) },
        { label: "إجمالي المعاملات", value: `${fmt(totalCharged)} ج.م`, tone: "brand" },
        { label: "إجمالي المسدد", value: `${fmt(totalPaid)} ج.م` },
        { label: "الديون بالخارج", value: `${fmt(totalDue)} ج.م`, tone: "danger" },
      ],
      body,
      page: "A4 landscape",
    });
    if (!openPdfDocument(html, { autoPrint: true, features: "width=980,height=760" })) {
      toast.error("الرجاء السماح بفتح النوافذ المنبثقة لتصدير PDF");
      return;
    }
    toast.success("جاري تجهيز كشف الحساب...");
  };


  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle="سجل العملاء، المديونيات، وسجل المشتريات والدفعات."
        action={
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={privacy ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={toggle}
                    aria-pressed={privacy}
                  >
                    {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {privacy ? "إظهار" : "إخفاء الأرقام"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  يطمس كل المبالغ المالية في الجدول لإخفائها عن أعين المتطفلين.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={exportPDF} disabled={list.length === 0}>
              <FileDown className="w-4 h-4" />
              تصدير كشف حساب (PDF)
            </Button>
            <CustomerDialog trigger={<Button className="gap-2"><Plus className="w-4 h-4" /> إضافة عميل</Button>} />
          </div>
        }
      />

      {/* ===== Bento: KPI + بحث + فلاتر ===== */}
      <Reveal className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* البطاقة الكبيرة */}
        <BezelCard variant="flat" className="md:col-span-7 flex h-full flex-col justify-between gap-6 p-6 md:p-7">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <span className="mb-1 inline-flex items-center rounded-full bg-foreground/[0.06] px-3 py-1 text-[11px] font-bold tracking-[0.06em] text-muted-foreground ring-1 ring-border">Outstanding</span>
                <div className="mt-3 text-xs font-medium text-muted-foreground">إجمالي الديون بالخارج</div>
                <div className={cn("text-numeric mt-1.5 text-4xl font-extrabold leading-none text-foreground md:text-5xl", privacy && "privacy-blur")}>
                  {fmt(debtStats.totalDebt)}
                  <span className="ms-2 align-middle text-base font-bold text-muted-foreground">ج.م</span>
                </div>
              </div>
              <div
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold bg-foreground/[0.06] text-muted-foreground ring-1 ring-border",
                )}
              >
                {debtStats.trendPct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {debtStats.trendPct >= 0 ? "تحصيل" : "تراجع"} {Math.abs(debtStats.trendPct)}٪
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
              موزعة على {debtStats.debtors} عميل من إجمالي {counts.all}
            </div>
          </BezelCard>

        {/* عمود مصغّر */}
        <div className="grid gap-4 md:col-span-5">
          <BezelCard variant="flat" className="p-6">
              <div className="text-xs font-medium text-muted-foreground">محصّل هذا الأسبوع</div>
              <div className={cn("text-numeric mt-1.5 text-3xl font-extrabold leading-none text-success", privacy && "privacy-blur")}>
                {fmt(debtStats.thisWeek)}
                <span className="ms-2 align-middle text-sm font-bold text-muted-foreground">ج.م</span>
              </div>
          </BezelCard>
          <BezelCard variant="flat" className="grid grid-cols-2 gap-4 p-6">
              <div>
                <div className="text-xs font-medium text-muted-foreground">متأخرون</div>
                <div className="text-numeric mt-1 text-2xl font-extrabold leading-none text-warning">{counts.overdue}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">خالصون</div>
                <div className="text-numeric mt-1 text-2xl font-extrabold leading-none text-success">{counts.settled}</div>
              </div>
          </BezelCard>
        </div>
      </Reveal>

      {/* شريط التحكّم: فلاتر + بحث */}
      <Reveal delay={80} className="sticky-search-bar mb-8">
        <BezelCard variant="flat" className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الهاتف..."
                className="h-11 rounded-full border-0 bg-background/40 pr-11 shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.06)] focus-visible:ring-1 focus-visible:ring-primary/40"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => {
                const active = filter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold transition-[transform,box-shadow,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]",
                      active
                        ? f.activeCls
                        : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                    )}
                  >
                    {f.label}
                    <span
                      className={cn(
                        "text-numeric grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold",
                        active ? "bg-background/25" : "bg-foreground/[0.06]",
                      )}
                    >
                      {counts[f.value]}
                    </span>
                  </button>
                );
              })}
            </div>
          </BezelCard>
      </Reveal>

      {/* ===== قائمة العملاء: صفوف-بطاقات ===== */}
      <Reveal delay={140}>
        <div className="mb-3 flex items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-1.5">
            <SortChip label="الاسم" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
            <SortChip label="الديون" active={sortKey === "balance"} dir={sortDir} onClick={() => toggleSort("balance")} />
          </div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{list.length} / {counts.all}</div>
        </div>

        {list.length === 0 ? (
          <BezelCard variant="flat" className="px-6 py-10">
            <EmptyState
              icon={Users}
              title="لا يوجد عملاء بعد."
              hint="أضف أول عميل وابدأ تسجيل فواتيره وأقساطه من مكان واحد."
              action={
                <CustomerDialog
                  trigger={
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" /> إضافة أول عميل
                    </Button>
                  }
                />
              }
            />
          </BezelCard>
        ) : (
          <ScrollArea className="max-h-[64vh]">
            <div className="flex flex-col gap-3 pl-1">
              {list.map(({ c, m, code }, idx) => {
                const overdue7 = m.worstLate > 7;
                const lateLabel = m.worstLate > 0 ? `متأخر ${m.worstLate} يوم` : null;
                const message = aiScript(c, m.balance, m.worstLate);
                const waPhone = c.phone.replace(/^0/, "20");
                const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
                const overLimit = c.creditLimit > 0 && m.balance >= c.creditLimit;
                const initial = c.name.trim().slice(0, 1) || "؟";
                return (
                  <div
                    key={c.id}
                    className="group bezel-shell bezel-lift animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)_both]"
                    style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                  >
                    <div className="bezel-core grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] md:gap-6">
                      {/* الهوية */}
                      <div
                        className="flex min-w-0 items-center gap-3 cursor-pointer select-none"
                        onClick={() => setViewFor(c)}
                        role="button"
                        tabIndex={0}
                        title="انقر لعرض تفاصيل العميل ونقاط الولاء"
                      >
                        <span
                          className={cn(
                            "text-display grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-bold transition-transform group-hover:scale-105",
                            c.status === "defaulter"
                              ? "bg-danger/12 text-danger ring-1 ring-danger/25"
                              : c.status === "committed"
                                ? "bg-success/12 text-success ring-1 ring-success/25"
                                : "bg-primary/12 text-primary ring-1 ring-primary/25",
                          )}
                        >
                          {initial}
                        </span>
                        <div className="min-w-0">
                          {/* كود العميل فوق الاسم */}
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 border border-primary/25 px-1.5 py-0.2 text-[10px] font-mono font-extrabold text-primary tracking-wide">
                              كود: #{code}
                            </span>
                            {c.frozen && (
                              <span className="inline-flex items-center rounded-md bg-warning/15 border border-warning/30 px-1.5 py-0.2 text-[9px] font-bold text-warning">
                                مجمد
                              </span>
                            )}
                          </div>
                          <div className="truncate font-bold text-base leading-tight hover:text-primary transition-colors">{c.name}</div>
                          <div className="text-numeric mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">{c.phone}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {c.status === "defaulter" && c.notes ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help"><StatusBadge status={c.status} /></span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-right">
                                    <div className="mb-1 font-bold">ملاحظات سابقة:</div>
                                    <div className="whitespace-pre-wrap text-xs">{c.notes}</div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <StatusBadge status={c.status} />
                            )}
                            <CustomerTypeBadge type={c.customerType} />
                            <StarRating value={c.rating} />
                            {loyaltyConfig.enabled && (() => {
                              const lStat = loyaltyMap.get(c.id);
                              const pts = lStat?.availablePoints || 0;
                              const discountVal = lStat?.availableDiscountEgp || 0;
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setViewFor(c);
                                        }}
                                        className={cn(
                                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold cursor-pointer transition-all",
                                          pts > 0
                                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30 hover:bg-amber-500/25"
                                            : "bg-muted/40 text-muted-foreground ring-1 ring-border/50 hover:bg-muted/60"
                                        )}
                                      >
                                        <Coins className="h-3 w-3 text-amber-500" />
                                        <span>{pts} نقطة</span>
                                        {pts > 0 && <span className="text-[9px] opacity-80">({fmt(discountVal)} ج.م)</span>}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-right">
                                      <div className="text-xs">
                                        رصيد الولاء: <strong>{pts} نقطة</strong> ({fmt(discountVal)} ج.م خصم متاح)
                                        <div className="text-[10px] text-muted-foreground mt-0.5">انقر لفتح التفاصيل واستبدال النقاط</div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* المديونية */}
                      <div className="min-w-0">
                        {m.balance <= 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className={cn("text-numeric text-xl font-extrabold leading-none text-emerald-600 dark:text-emerald-400", privacy && "privacy-blur")}>
                                0 <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <Check className="h-3 w-3" />
                                الحساب خالص
                              </span>
                            </div>
                            <div className={cn("text-[11px] text-muted-foreground", privacy && "privacy-blur")}>
                              إجمالي التعاملات: {fmt(m.totalCharged)} ج.م (مسدد بالكامل)
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2">
                              <div className={cn("text-numeric text-xl font-extrabold leading-none", overdue7 ? "text-danger" : "text-foreground", privacy && "privacy-blur")}>
                                {fmt(m.balance)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                              </div>
                              {lateLabel && (
                                <span className="rounded-full bg-danger/12 px-2 py-0.5 text-[10px] font-bold text-danger ring-1 ring-danger/25">{lateLabel}</span>
                              )}
                              {overLimit && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="grid h-6 w-6 shrink-0 cursor-help place-items-center rounded-full bg-danger/15 text-danger ring-1 ring-danger/40" aria-label="تجاوز سقف المديونية">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs text-right">
                                      <div className="mb-0.5 font-bold text-danger">⚠ تجاوز سقف المديونية</div>
                                      <div className="text-xs">المديونية ({fmt(m.balance)} ج.م) وصلت لسقف الائتمان ({fmt(c.creditLimit)} ج.م). يُمنع البيع الآجل لهذا العميل.</div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <Progress value={m.paidPct} className="mt-2.5 h-1.5" />
                            <div className={cn("mt-1.5 text-[11px] text-muted-foreground flex items-center justify-between", privacy && "privacy-blur")}>
                              <span>مسدد {m.paidPct}٪</span>
                              <span>من {fmt(m.totalCharged)} ج.م</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* الإجراءات السريعة */}
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setScriptFor(c)}
                          className="island-btn group/cta bg-primary/12 text-primary ring-1 ring-primary/25 hover:bg-primary/20"
                        >
                          هقوله إيه؟
                          <span className="island-btn-icon bg-primary/20 text-primary transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/cta:-translate-x-0.5 group-hover/cta:scale-105">
                            <MessageCircle className="h-4 w-4" />
                          </span>
                        </button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="action-btn grid h-9 w-9 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                aria-label="إرسال واتساب"
                              >
                                <WhatsAppIcon className="h-4 w-4" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent side="top">إرسال الرسالة المقترحة على واتساب</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="action-btn rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20" onClick={() => setHistoryFor(c)} aria-label="سجل المدفوعات">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">عرض سجل المدفوعات الكامل</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="action-btn rounded-full bg-muted/40 text-foreground border border-border/60 hover:bg-muted/80" onClick={() => setViewFor(c)} aria-label="تفاصيل العميل">
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">تفاصيل العميل وكشف الحساب والولاء</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <CustomerDialog
                          customer={c}
                          customerCode={code}
                          trigger={<Button size="icon" variant="ghost" className="action-btn rounded-full bg-muted/40 text-foreground border border-border/60 hover:bg-muted/80" aria-label="تعديل"><Pencil className="h-4 w-4" /></Button>}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="action-btn danger rounded-full bg-danger/10 text-danger border border-danger/25 hover:bg-danger/20" aria-label="حذف"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-right">حذف العميل</AlertDialogTitle>
                              <AlertDialogDescription className="text-right">هل أنت متأكد من حذف {c.name}؟ سيتم حذف كل فواتيره وسجلاته أيضاً.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => { db.removeCustomer(c.id); toast.success("تم حذف العميل"); }}>حذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Reveal>

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-end">
              سجل المدفوعات
              <History className="w-5 h-5 text-primary" />
            </DialogTitle>
            <DialogDescription className="text-right">
              {historyFor ? `كل عمليات السداد المسجلة للعميل ${historyFor.name}` : ""}
            </DialogDescription>
          </DialogHeader>
          {historyFor && (() => {
            const myInvoiceIds = new Set(data.invoices.filter((i) => i.customerId === historyFor.id).map((i) => i.id));
            const payments = data.payments
              .filter((p) => myInvoiceIds.has(p.invoiceId))
              .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
            const total = payments.reduce((s, p) => s + p.amount, 0);
            const m = customerMetrics(data.invoices, historyFor);
            return (
              <div className="space-y-3 text-right">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl hairline bg-foreground/[0.035] p-2.5">
                    <div className="text-[11px] text-muted-foreground">عدد العمليات</div>
                    <div className="font-bold text-lg">{payments.length}</div>
                  </div>
                  <div className="rounded-2xl hairline bg-success/10 p-2.5">
                    <div className="text-[11px] text-muted-foreground">إجمالي المسدد</div>
                    <div className={cn("font-bold text-lg text-success", privacy && "privacy-blur")}>{fmt(total)} ج.م</div>
                  </div>
                  <div className="rounded-2xl hairline bg-danger/10 p-2.5">
                    <div className="text-[11px] text-muted-foreground">المتبقي</div>
                    <div className={cn("font-bold text-lg", m.balance > 0 ? "text-danger" : "text-success", privacy && "privacy-blur")}>{fmt(m.balance)} ج.م</div>
                  </div>
                </div>
                <ScrollArea className="max-h-[50vh] rounded-2xl hairline">
                  {payments.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-10">لا توجد مدفوعات مسجلة بعد</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-foreground/[0.04] text-muted-foreground sticky top-0">
                        <tr>
                          <th className="text-right p-2.5 font-medium">#</th>
                          <th className="text-right p-2.5 font-medium">التاريخ</th>
                          <th className="text-right p-2.5 font-medium">الوقت</th>
                          <th className="text-right p-2.5 font-medium">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p, i) => {
                          const d = new Date(p.paidAt);
                          return (
                            <tr key={p.id} className="border-t border-[var(--hairline)] hover:bg-foreground/[0.035]">
                              <td className="p-2.5 text-muted-foreground">{payments.length - i}</td>
                              <td className="p-2.5" dir="ltr">{d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })}</td>
                              <td className="p-2.5 text-muted-foreground" dir="ltr">{d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
                              <td className={cn("p-2.5 font-bold text-success", privacy && "privacy-blur")}>+ {fmt(p.amount)} ج.م</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </ScrollArea>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setHistoryFor(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!scriptFor} onOpenChange={(o) => !o && setScriptFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-end">
              المساعد الذكي
              <Sparkles className="w-5 h-5 text-primary" />
            </DialogTitle>
            <DialogDescription className="text-right">رسالة مقترحة بناءً على حالة العميل ومدة التأخر.</DialogDescription>
          </DialogHeader>
          {scriptFor && (() => {
            const m = customerMetrics(data.invoices, scriptFor);
            const msg = aiScript(scriptFor, m.balance, m.worstLate);
            const tone =
              m.worstLate <= 0 ? { label: "ودود", cls: "bg-success/15 text-success border-success/30" } :
              m.worstLate < 7 ? { label: "تذكير لطيف", cls: "bg-success/15 text-success border-success/30" } :
              m.worstLate <= 30 ? { label: "متابعة جادة", cls: "bg-warning/15 text-warning border-warning/30" } :
              { label: "إنذار حازم", cls: "bg-danger/15 text-danger border-danger/30" };
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  {m.worstLate > 0 && (
                    <Badge className="bg-danger text-danger-foreground border-0">متأخر {m.worstLate} يوم</Badge>
                  )}
                  <Badge variant="outline" className={tone.cls}>نبرة: {tone.label}</Badge>
                </div>
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-right leading-loose">{msg}</div>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" onClick={() => { navigator.clipboard.writeText(toArabicDigits(msg)); toast.success("تم النسخ"); }}>نسخ النص</Button>
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => {
                    const phone = scriptFor.phone.replace(/^0/, "20");
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(toArabicDigits(msg))}`, "_blank");
                  }}>إرسال واتساب</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Drawer open={!!viewFor} onOpenChange={(o) => !o && setViewFor(null)} direction="right">
        <DrawerContent className="ml-auto h-full w-full max-w-md rounded-none">
          {viewFor && (() => {
            const m = customerMetrics(data.invoices, viewFor);
            const myInvoices = data.invoices
              .filter((i) => i.customerId === viewFor.id)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const myPayments = data.payments
              .filter((p) => myInvoices.some((i) => i.id === p.invoiceId))
              .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
            const initials = viewFor.name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("");
            return (
              <>
                <DrawerHeader className="border-b border-[var(--hairline)]">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 hairline">
                      <AvatarFallback className="bg-primary/15 text-primary font-bold">{initials || <User className="w-5 h-5" />}</AvatarFallback>
                    </Avatar>
                    <div className="text-right flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <DrawerTitle className="text-lg">{viewFor.name}</DrawerTitle>
                        <Badge variant="outline" className="font-mono font-bold text-xs bg-primary/10 text-primary border-primary/25">
                          كود: #{customerCodeMap.get(viewFor.id) || 1}
                        </Badge>
                      </div>
                      <DrawerDescription dir="ltr" className="text-right mt-0.5">{viewFor.phone}</DrawerDescription>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5 col-span-2"
                      onClick={() => exportStatementPDF(viewFor!, m, myInvoices, myPayments, false)}
                    >
                      <FileDown className="w-4 h-4" />
                      كشف حساب تاريخي (PDF)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => exportStatementPDF(viewFor!, m, myInvoices, myPayments, true)}
                      aria-label="طباعة"
                    >
                      <Printer className="w-4 h-4" />
                      طباعة
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="col-span-3 gap-2 border-success/40 text-success hover:bg-success/10"
                      onClick={() => shareStatement(viewFor!, m, myInvoices, myPayments)}
                    >
                      <Share2 className="w-4 h-4" />
                      مشاركة عبر واتساب
                    </Button>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-right">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl hairline bg-foreground/[0.035] p-3">
                      <div className="text-[11px] text-muted-foreground">المتبقي</div>
                      <div className={cn("font-bold text-lg", m.balance > 0 ? "text-danger" : "text-success", privacy && "privacy-blur")}>
                        {fmt(m.balance)} ج.م
                      </div>
                    </div>
                    <div className="rounded-2xl hairline bg-foreground/[0.035] p-3">
                      <div className="text-[11px] text-muted-foreground">إجمالي المعاملات</div>
                      <div className={cn("font-bold text-lg", privacy && "privacy-blur")}>{fmt(m.totalCharged)} ج.م</div>
                    </div>
                    <div className="rounded-2xl hairline bg-foreground/[0.035] p-3">
                      <div className="text-[11px] text-muted-foreground">المسدد</div>
                      <div className={cn("font-bold text-lg text-success", privacy && "privacy-blur")}>{fmt(m.totalPaid)} ج.م</div>
                    </div>
                    <div className="rounded-2xl hairline bg-foreground/[0.035] p-3">
                      <div className="text-[11px] text-muted-foreground">أقصى تأخير</div>
                      <div className={cn("font-bold text-lg", m.worstLate > 30 ? "text-danger" : "text-foreground")}>
                        {m.worstLate > 0 ? `${m.worstLate} يوم` : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="rounded-2xl hairline p-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">العنوان</span><span className="font-medium">{viewFor.address || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">تاريخ الانضمام</span><span className="font-medium" dir="ltr">{isoToDDMMYYYY(viewFor.joiningDate)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">سقف المديونية</span><span className={cn("font-medium", privacy && "privacy-blur")}>{viewFor.creditLimit > 0 ? `${fmt(viewFor.creditLimit)} ج.م` : "بدون حد"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">يوم القسط</span><span className="font-medium">يوم {viewFor.dueDay} من الشهر</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">نوع العميل</span><CustomerTypeBadge type={viewFor.customerType} /></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">الحالة</span><StatusBadge status={viewFor.status} /></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">التقييم</span><StarRating value={viewFor.rating} /></div>
                    {viewFor.frozen && <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">حساب مجمّد</Badge>}
                  </div>

                  {/* Loyalty & Rewards Card */}
                  {loyaltyConfig.enabled && (() => {
                    const lStat = loyaltyMap.get(viewFor.id);
                    const points = lStat?.availablePoints || 0;
                    const val = lStat?.availableDiscountEgp || 0;
                    const tier = lStat?.tier || "bronze";
                    const tierMeta =
                      tier === "platinum"
                        ? { label: "بلاتيني VIP", cls: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" }
                        : tier === "gold"
                        ? { label: "ذهبي مميز", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" }
                        : tier === "silver"
                        ? { label: "فضي نشط", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" }
                        : { label: "برونزي", cls: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" };

                    return (
                      <div className="rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/10 via-warning/5 to-transparent p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={tierMeta.cls}>
                            <Award className="w-3 h-3 ml-1" />
                            مستوى {tierMeta.label}
                          </Badge>
                          <span className="flex items-center gap-1.5 font-bold text-sm text-warning-foreground">
                            <Coins className="w-4 h-4 text-warning" />
                            برنامج نقاط الولاء والمكافآت
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-xl bg-background/80 p-2 hairline">
                            <div className="text-[11px] text-muted-foreground">النقاط المتاحة</div>
                            <div className="font-extrabold text-lg text-warning">{points} <span className="text-xs">نقطة</span></div>
                          </div>
                          <div className="rounded-xl bg-background/80 p-2 hairline">
                            <div className="text-[11px] text-muted-foreground">القيمة الشرائية</div>
                            <div className={cn("font-extrabold text-lg text-success", privacy && "privacy-blur")}>{fmt(val)} <span className="text-xs">ج.م</span></div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!lStat || !lStat.canRedeem}
                            className="flex-1 gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90"
                            onClick={() => {
                              if (!lStat || !lStat.canRedeem) {
                                toast.error(`الحد الأدنى لاستبدال النقاط هو ${loyaltyConfig.minPointsToRedeem} نقطة`);
                                return;
                              }
                              const coupon = generateCustomerLoyaltyVoucher(viewFor, points);
                              setRedeemedVoucher({ customer: viewFor, coupon });
                              toast.success(`تم استبدال ${points} نقطة بنجاح وتوليد كوبون خصم!`);
                            }}
                          >
                            <Gift className="w-3.5 h-3.5" />
                            استبدال بكوبون خصم
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1 border-warning/40 text-warning hover:bg-warning/10"
                            onClick={() => {
                              const waPhone = viewFor.phone.replace(/^0/, "20");
                              const msg = `مرحباً ${viewFor.name} ✨\nيسعدنا إعلامك بأن رصيدك الحالي في برنامج المكافآت هو *${points} نقطة ولاء* (بقيمة *${fmt(val)} ج.م* خصم مباشر على مشترياتك القادمة).\nشكراً لثقتك الدائمة بنا!`;
                              window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                            }}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            إرسال الرصيد
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Unified Transaction Timeline */}
                  <div>
                    <h3 className="font-bold mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <QuickAddInvoice customerId={viewFor.id} blocked={viewFor.frozen || viewFor.status === "defaulter"} />
                        <QuickAddPayment invoices={myInvoices} />
                      </div>
                      <span className="flex items-center gap-2">
                        <History className="w-4 h-4 text-primary" />
                        سجل الحركات الكامل
                      </span>
                    </h3>
                    {(() => {
                      const timeline = buildTimeline(viewFor, myInvoices, myPayments);
                      if (timeline.length === 0) {
                        return <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-2xl">لا توجد حركات منذ تاريخ الانضمام</div>;
                      }
                      return (
                        <div className="relative space-y-2 pr-4 border-r-2 border-border/60">
                          {timeline.map((t) => {
                            const isPurchase = t.kind === "purchase";
                            const isOpening = t.kind === "opening";
                            const entityId =
                              t.id.startsWith("inv-") || t.id.startsWith("down-")
                                ? t.id.replace(/^(inv|down)-/, "")
                                : t.id.startsWith("pay-")
                                  ? t.id.replace(/^pay-/, "")
                                  : null;
                            const editableInvoice =
                              (t.id.startsWith("inv-") || t.id.startsWith("down-")) && entityId
                                ? myInvoices.find((i) => i.id === entityId)
                                : null;
                            const editablePayment =
                              t.id.startsWith("pay-") && entityId
                                ? myPayments.find((p) => p.id === entityId)
                                : null;
                            const canEdit = !!editableInvoice || !!editablePayment;
                            return (
                              <div key={t.id} className="relative animate-[fade-in_0.3s_ease-out_both]">
                                <span className={cn(
                                  "absolute -right-[22px] top-2 h-3.5 w-3.5 rounded-full border-2 border-background",
                                  isPurchase ? "bg-danger" : isOpening ? "bg-warning" : "bg-success",
                                )} />
                                <div className={cn(
                                  "rounded-2xl border p-2.5 text-sm",
                                  isPurchase ? "border-danger/30 bg-danger/5" : isOpening ? "border-warning/30 bg-warning/5" : "border-success/30 bg-success/5",
                                )}>
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <Badge variant="outline" className={cn(
                                      "gap-1 text-[10px] font-bold",
                                      isPurchase ? "bg-danger/15 text-danger border-danger/40" : isOpening ? "bg-warning/15 text-warning border-warning/40" : "bg-success/15 text-success border-success/40",
                                    )}>
                                      {isPurchase ? <ShoppingBag className="w-3 h-3" /> : isOpening ? <AlertTriangle className="w-3 h-3" /> : <Receipt className="w-3 h-3" />}
                                      {isPurchase ? "مشترى" : isOpening ? "رصيد افتتاحي" : "سداد"}
                                    </Badge>
                                    <div className="flex items-center gap-1">
                                      {canEdit && (
                                        <>
                                          {editableInvoice && (
                                            <EditInvoiceDialog invoice={editableInvoice} />
                                          )}
                                          {editablePayment && (
                                            <EditPaymentDialog payment={editablePayment} invoices={myInvoices} />
                                          )}
                                          <DeleteTimelineEntry
                                            kind={editableInvoice ? "invoice" : "payment"}
                                            id={(editableInvoice ?? editablePayment)!.id}
                                          />
                                        </>
                                      )}
                                      <span className="text-[11px] text-muted-foreground mr-1" dir="ltr">{isoToDDMMYYYY(t.date.slice(0, 10))}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-xs text-muted-foreground flex-1">{t.description}</div>
                                    <div className={cn(
                                      "font-bold whitespace-nowrap",
                                      isPurchase || isOpening ? "text-danger" : "text-success",
                                      privacy && "privacy-blur",
                                    )}>
                                      {isPurchase || isOpening ? "+" : "−"} {fmt(t.amount)} ج.م
                                    </div>
                                  </div>
                                  <div className="mt-1.5 pt-1.5 border-t border-[var(--hairline)] flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">الرصيد المتبقي:</span>
                                    <span className={cn("font-bold tabular-nums", t.runningBalance > 0 ? "text-danger" : "text-success", privacy && "privacy-blur")}>
                                      {fmt(t.runningBalance)} ج.م
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <DrawerFooter className="border-t border-[var(--hairline)]">
                  <DrawerClose asChild>
                    <Button variant="outline" className="w-full">إغلاق</Button>
                  </DrawerClose>
                </DrawerFooter>
              </>
            );
          })()}
        </DrawerContent>
      </Drawer>

      {/* Dialog for newly generated Loyalty Voucher */}
      <Dialog open={!!redeemedVoucher} onOpenChange={(o) => !o && setRedeemedVoucher(null)}>
        <DialogContent className="max-w-md text-right">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-end text-warning">
              كوبون مكافأة ولاء جاهز!
              <Gift className="w-5 h-5" />
            </DialogTitle>
            <DialogDescription className="text-right">
              تم تحويل نقاط العميل إلى كود خصم مخصص ومربوط بحسابه.
            </DialogDescription>
          </DialogHeader>
          {redeemedVoucher && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-dashed border-warning/50 bg-warning/5 p-4 text-center space-y-2">
                <div className="text-xs text-muted-foreground">كود الخصم للعميل {redeemedVoucher.customer.name}</div>
                <div className="font-mono text-2xl font-black text-warning tracking-widest selection:bg-warning selection:text-black">
                  {redeemedVoucher.coupon.code}
                </div>
                <div className="text-sm font-bold text-success">
                  قيمة الخصم: {redeemedVoucher.coupon.discountValue} {redeemedVoucher.coupon.discountType === "percentage" ? "%" : "ج.م"}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(redeemedVoucher.coupon.code);
                    setCopiedCode(true);
                    toast.success("تم نسخ كود الخصم بنجاح!");
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                >
                  {copiedCode ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  {copiedCode ? "تم النسخ" : "نسخ الكود"}
                </Button>

                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-success/40 text-success hover:bg-success/10"
                  onClick={() => {
                    const waPhone = redeemedVoucher.customer.phone.replace(/^0/, "20");
                    const msg = `مرحباً ${redeemedVoucher.customer.name} 🎁\nهدية خاصة لك من متجرنا تقديراً لولائك!\nتم إصدار كود خصم بقيمة *${redeemedVoucher.coupon.discountValue} ج.م*.\nكود الخصم: *${redeemedVoucher.coupon.code}*\nاستخدم الكود عند شرائك القادم للحصول على الخصم فوراً!`;
                    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                  }}
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  إرسال عبر واتساب
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setRedeemedVoucher(null)}>
              تم الإغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type TimelineEntry = {
  id: string;
  date: string; // ISO datetime
  kind: "opening" | "purchase" | "payment";
  description: string;
  amount: number;
  runningBalance: number;
};

function buildTimeline(c: Customer, invoices: Invoice[], payments: Payment[]): TimelineEntry[] {
  type Raw = { id: string; date: string; kind: TimelineEntry["kind"]; description: string; amount: number };
  const raw: Raw[] = [];

  if (c.openingBalance && c.openingBalance > 0) {
    raw.push({
      id: `opening-${c.id}`,
      date: `${c.joiningDate}T00:00:00`,
      kind: "opening",
      description: "رصيد افتتاحي عند الانضمام",
      amount: c.openingBalance,
    });
  }
  for (const inv of invoices) {
    raw.push({
      id: `inv-${inv.id}`,
      date: inv.createdAt,
      kind: "purchase",
      description: inv.notes?.trim() ? inv.notes : `فاتورة بتاريخ استحقاق ${isoToDDMMYYYY(inv.firstDueDate)}`,
      amount: inv.total,
    });
    if (inv.downPayment > 0) {
      raw.push({
        id: `down-${inv.id}`,
        date: inv.createdAt,
        kind: "payment",
        description: `مقدم على فاتورة (${(inv.notes || "").trim() || "بدون وصف"})`,
        amount: inv.downPayment,
      });
    }
  }
  for (const p of payments) {
    const inv = invoices.find((i) => i.id === p.invoiceId);
    raw.push({
      id: `pay-${p.id}`,
      date: p.paidAt,
      kind: "payment",
      description: `سداد على فاتورة ${inv?.notes ? `«${inv.notes}»` : `#${p.invoiceId.slice(0, 6)}`}`,
      amount: p.amount,
    });
  }

  raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let bal = 0;
  const ascending: TimelineEntry[] = raw.map((r) => {
    bal += r.kind === "payment" ? -r.amount : r.amount;
    return { ...r, runningBalance: bal };
  });
  return ascending.reverse();
}

function escapeHtml2(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function exportStatementPDF(
  c: Customer,
  m: { balance: number; totalCharged: number; totalPaid: number; worstLate: number },
  invoices: Invoice[],
  payments: Payment[],
  autoPrint: boolean,
) {
  const timelineDesc = buildTimeline(c, invoices, payments);
  const timeline = [...timelineDesc].reverse(); // chronological for the report
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const joining = isoToDDMMYYYY(c.joiningDate);

  const rows = timeline.map((t, i) => {
    const isPay = t.kind === "payment";
    const typeLabel = t.kind === "purchase" ? "مشترى" : t.kind === "opening" ? "رصيد افتتاحي" : "سداد";
    return `
      <tr>
        <td>${i + 1}</td>
        <td dir="ltr">${escapeHtml2(isoToDDMMYYYY(t.date.slice(0, 10)))}</td>
        <td><span class="tag ${t.kind}">${typeLabel}</span></td>
        <td>${escapeHtml2(t.description)}</td>
        <td class="num ${isPay ? "pay" : "buy"}">${isPay ? "−" : "+"} ${fmt(t.amount)}</td>
        <td class="num ${t.runningBalance > 0 ? "due" : "ok"}">${fmt(t.runningBalance)}</td>
      </tr>`;
  }).join("");

  const body = `
<div class="info">
  <div class="box"><b>اسم العميل</b> ${escapeHtml2(c.name)}</div>
  <div class="box"><b>رقم الهاتف</b> <span dir="ltr">${escapeHtml2(c.phone)}</span></div>
  <div class="box"><b>العنوان</b> ${escapeHtml2(c.address || "—")}</div>
  <div class="box"><b>تاريخ الانضمام</b> <span dir="ltr">${escapeHtml2(joining)}</span></div>
</div>
<h2 class="sec">حركة الحساب</h2>
<div class="t-wrap"><table>
  <thead><tr>
    <th>م</th><th>التاريخ</th><th>نوع الحركة</th><th>البيان</th><th class="num">المبلغ (ج.م)</th><th class="num">الرصيد المتبقي (ج.م)</th>
  </tr></thead>
  <tbody>${rows || `<tr><td colspan="6" class="empty">لا توجد حركات منذ تاريخ الانضمام</td></tr>`}</tbody>
  <tfoot><tr>
    <td colspan="4">الرصيد النهائي المستحق على العميل</td>
    <td class="num" colspan="2">${fmt(m.balance)} ج.م</td>
  </tr></tfoot>
</table></div>
<div class="total-bar"><span>الرصيد المستحق حالياً</span><span class="v">${fmt(m.balance)} ج.م</span></div>
<div class="sig"><div>توقيع المسؤول</div><div>توقيع العميل</div><div>الختم الرسمي</div></div>`;

  const html = pdfDocument({
    docTitle: `كشف حساب — ${escapeHtml2(c.name)} — سِجلّي`,
    badge: "مستند رسمي",
    title: "كشف حساب تاريخي للعميل",
    lede: `يشمل كل الحركات منذ ${escapeHtml2(joining)}.`,
    brandSub: "نظام إدارة العملاء والأقساط — كشف حساب رسمي",
    meta: [
      { label: "تاريخ الإصدار", value: today },
      { label: "رقم الكشف", value: `SG-${c.id.slice(0, 8).toUpperCase()}` },
    ],
    kpis: [
      { label: "عدد الحركات", value: String(timeline.length) },
      { label: "إجمالي المستحق", value: `${fmt(m.totalCharged)} ج.م`, tone: "danger" },
      { label: "إجمالي المسدد", value: `${fmt(m.totalPaid)} ج.م`, tone: "brand" },
      { label: "الرصيد المتبقي", value: `${fmt(m.balance)} ج.م`, tone: m.balance > 0 ? "danger" : "brand" },
    ],
    body,
    page: "A4",
  });

  if (!openPdfDocument(html, { autoPrint, features: "width=1000,height=800" })) {
    toast.error("الرجاء السماح بفتح النوافذ المنبثقة لتصدير PDF");
    return;
  }
  toast.success(autoPrint ? "جاري تجهيز الطباعة..." : "تم تجهيز كشف الحساب التاريخي");
}


function shareStatement(
  c: Customer,
  m: { balance: number; totalCharged: number; totalPaid: number; worstLate: number },
  invoices: Invoice[],
  payments: { id: string; invoiceId: string; amount: number; paidAt: string }[],
) {
  const lines: string[] = [];
  lines.push(`📋 كشف حساب — ${c.name}`);
  lines.push(`📞 ${c.phone}`);
  lines.push(`📅 ${new Date().toLocaleDateString("en-US")}`);
  lines.push("―――――――――――――");
  lines.push(`💰 إجمالي المعاملات: ${fmt(m.totalCharged)} ج.م`);
  lines.push(`✅ إجمالي المسدد: ${fmt(m.totalPaid)} ج.م`);
  lines.push(`🔴 المتبقي: ${fmt(m.balance)} ج.م`);
  if (m.worstLate > 0) lines.push(`⏰ أقصى تأخير: ${m.worstLate} يوم`);
  lines.push("");
  if (invoices.length) {
    lines.push("🧾 الفواتير:");
    invoices.forEach((inv, i) => {
      const rem = inv.total - inv.paid;
      lines.push(`${i + 1}) ${fmt(inv.total)} ج.م — متبقي ${fmt(rem)} — استحقاق ${inv.firstDueDate}`);
    });
    lines.push("");
  }
  if (payments.length) {
    lines.push("💵 آخر المدفوعات:");
    payments.slice(0, 5).forEach((p) => {
      lines.push(`• ${fmt(p.amount)} ج.م — ${new Date(p.paidAt).toLocaleDateString("en-US")}`);
    });
  }
  lines.push("");
  lines.push("— سِجلّي");
  const text = lines.join("\n");
  const phone = c.phone.replace(/^0/, "20");
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(toArabicDigits(text))}`, "_blank");
  toast.success("جاري فتح واتساب لمشاركة الكشف");
}

function QuickAddInvoice({ customerId, blocked }: { customerId: string; blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [cost, setCost] = useState("");
  const [total, setTotal] = useState("");
  const [down, setDown] = useState("0");
  const [monthly, setMonthly] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [notes, setNotes] = useState("");

  const remaining = Math.max(0, Number(total || 0) - Number(down || 0));
  const installmentsCount = Number(monthly) > 0 ? Math.ceil(remaining / Number(monthly)) : 0;
  const costNum = Number(cost || 0);
  const totalNum = Number(total || 0);
  const profit = totalNum - costNum;
  const profitPct = costNum > 0 ? (profit / costNum) * 100 : 0;

  const submit = () => {
    if (blocked) return toast.error("هذا العميل محظور من فتح فواتير جديدة");
    if (!productName.trim()) return toast.error("أدخل اسم المنتج");
    const t = Number(total), d = Number(down), mo = Number(monthly);
    if (!t || !mo || !dateInput) return toast.error("املأ كل البيانات");
    const iso = ddmmyyyyToIso(dateInput);
    if (!iso) return toast.error("صيغة التاريخ يجب أن تكون DD/MM/YYYY");
    const productNotes = `${productName}${notes ? ` — ${notes}` : ""}`;
    db.addInvoice({ customerId, total: t, downPayment: d, monthlyInstallment: mo, firstDueDate: iso, notes: productNotes });
    toast.success("تمت إضافة الفاتورة");
    setOpen(false);
    setProductName(""); setCost(""); setTotal(""); setDown("0"); setMonthly(""); setDateInput(""); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" className="h-7 w-7 text-primary border-primary/30 hover:bg-primary/10" aria-label="إضافة فاتورة">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">إنشاء فاتورة جديدة</DialogTitle>
          <DialogDescription className="text-right">إضافة عملية بيع جديدة بالتقسيط.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-right">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>اسم المنتج</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="اسم المنتج..." maxLength={100} />
            </div>
            <div>
              <Label>تكلفة المنتج (ج.م)</Label>
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>سعر المنتج (ج.م)</Label>
              <Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div>
              <Label>المقدم (ج.م)</Label>
              <Input type="number" value={down} onChange={(e) => setDown(e.target.value)} />
            </div>
          </div>
          <div className="rounded-2xl bg-foreground/[0.035] p-3 flex items-center justify-between">
            <span className="text-primary font-bold">{fmt(remaining)} ج.م</span>
            <span className="text-sm text-muted-foreground">المبلغ المتبقي للتقسيط:</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>القسط الشهري (ج.م)</Label>
              <Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </div>
            <div>
              <Label>عدد الأقساط</Label>
              <Input type="number" value={installmentsCount || ""} readOnly className="bg-foreground/[0.04]" />
            </div>
            <div>
              <Label>تاريخ أول قسط</Label>
              <Input value={dateInput} onChange={(e) => setDateInput(e.target.value)} placeholder="DD/MM/YYYY" dir="ltr" inputMode="numeric" />
            </div>
          </div>
          <div>
            <Label>ملاحظات السلعة</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="وصف المنتج..." maxLength={200} />
          </div>
          <div className="rounded-2xl hairline bg-foreground/[0.03] p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">{fmt(costNum)} ج.م</span>
              <span className="text-muted-foreground">تكلفة الفاتورة:</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">{fmt(totalNum)} ج.م</span>
              <span className="text-muted-foreground">المبلغ المباع به:</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className={cn("font-bold", profit >= 0 ? "text-success" : "text-danger")}>{fmt(profit)} ج.م</span>
              <span className="text-muted-foreground">صافي الربح:</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className={cn("font-bold", profit >= 0 ? "text-success" : "text-danger")}>{profitPct.toFixed(1)}%</span>
              <span className="text-muted-foreground">نسبة الربح:</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="w-full" disabled={blocked}>إنشاء الفاتورة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickAddPayment({ invoices }: { invoices: Invoice[] }) {
  const open_invoices = invoices.filter((i) => i.paid < i.total);
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");

  const inv = open_invoices.find((i) => i.id === invoiceId);
  const max = inv ? inv.total - inv.paid : 0;

  const submit = () => {
    if (!invoiceId) return toast.error("اختر فاتورة");
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("أدخل مبلغ صحيح");
    db.recordPayment(invoiceId, Math.min(n, max));
    toast.success("تم تسجيل الدفعة");
    setOpen(false);
    setInvoiceId(""); setAmount("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" className="h-7 w-7 text-success border-success/30 hover:bg-success/10" aria-label="تسجيل دفعة" disabled={open_invoices.length === 0}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-right">تسجيل دفعة</DialogTitle>
          <DialogDescription className="text-right">اختر الفاتورة وأدخل المبلغ.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-right">
          <div>
            <Label>الفاتورة</Label>
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger><SelectValue placeholder="اختر فاتورة" /></SelectTrigger>
              <SelectContent>
                {open_invoices.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {(i.notes || "فاتورة")} — متبقي {fmt(i.total - i.paid)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>المبلغ (ج.م) — أقصى {fmt(max)}</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="w-full gap-2"><Wallet className="w-4 h-4" /> تأكيد</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditInvoiceDialog({ invoice }: { invoice: Invoice }) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(String(invoice.total));
  const [down, setDown] = useState(String(invoice.downPayment));
  const [monthly, setMonthly] = useState(String(invoice.monthlyInstallment));
  const [dateInput, setDateInput] = useState(isoToDDMMYYYY(invoice.firstDueDate));
  const [notes, setNotes] = useState(invoice.notes ?? "");

  const submit = async () => {
    const t = Number(total), d = Number(down), mo = Number(monthly);
    if (!t || !mo || !dateInput) return toast.error("املأ كل البيانات");
    const iso = ddmmyyyyToIso(dateInput);
    if (!iso) return toast.error("صيغة التاريخ يجب أن تكون DD/MM/YYYY");
    try {
      await db.updateInvoice(invoice.id, { total: t, downPayment: d, monthlyInstallment: mo, firstDueDate: iso, notes });
      toast.success("تم تحديث الفاتورة");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "تعذّر التحديث");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-success hover:bg-success/10 action-btn" aria-label="تعديل">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">تعديل الفاتورة</DialogTitle>
          <DialogDescription className="text-right">سيُعاد احتساب الرصيد المتبقي تلقائياً.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-right">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>سعر المنتج (ج.م)</Label><Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} /></div>
            <div><Label>المقدم (ج.م)</Label><Input type="number" value={down} onChange={(e) => setDown(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>القسط الشهري (ج.م)</Label><Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></div>
            <div><Label>تاريخ أول قسط</Label><Input value={dateInput} onChange={(e) => setDateInput(e.target.value)} placeholder="DD/MM/YYYY" dir="ltr" inputMode="numeric" /></div>
          </div>
          <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></div>
        </div>
        <DialogFooter><Button onClick={submit} className="w-full">حفظ التعديلات</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPaymentDialog({ payment, invoices }: { payment: Payment; invoices: Invoice[] }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const inv = invoices.find((i) => i.id === payment.invoiceId);

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("أدخل مبلغ صحيح");
    try {
      await db.updatePayment(payment.id, n);
      toast.success("تم تحديث الدفعة");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "تعذّر التحديث");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-success hover:bg-success/10 action-btn" aria-label="تعديل">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-right">تعديل الدفعة</DialogTitle>
          <DialogDescription className="text-right">
            {inv ? `على فاتورة: ${inv.notes || "بدون وصف"}` : "دفعة"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-right">
          <div><Label>المبلغ (ج.م)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit} className="w-full">حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTimelineEntry({ kind, id }: { kind: "invoice" | "payment"; id: string }) {
  const onConfirm = async () => {
    try {
      if (kind === "invoice") await db.removeInvoice(id);
      else await db.removePayment(id);
      toast.success("تم الحذف وتحديث الرصيد");
    } catch (e: any) {
      toast.error(e.message || "تعذّر الحذف");
    }
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-danger hover:bg-danger/10 action-btn danger" aria-label="حذف">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-right">هل أنت متأكد؟</AlertDialogTitle>
          <AlertDialogDescription className="text-right">
            سيتم تحديث إجمالي مديونية العميل بناءً على هذا الحذف. لا يمكن التراجع.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-danger text-danger-foreground hover:bg-danger/90">حذف</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CustomerDialog({ customer, customerCode, trigger }: { customer?: Customer; customerCode?: number; trigger: React.ReactNode }) {
  const { data } = useDB();
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [rating, setRating] = useState<number>(customer?.rating ?? 3);
  const [status, setStatus] = useState<CustomerStatus>(customer?.status ?? "neutral");
  const [customerType, setCustomerType] = useState<CustomerType>(customer?.customerType ?? "installment");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [frozen, setFrozen] = useState(customer?.frozen ?? false);
  const [address, setAddress] = useState(customer?.address ?? "");
  const [creditLimit, setCreditLimit] = useState<string>(String(customer?.creditLimit ?? 0));
  const [openingBalance, setOpeningBalance] = useState<string>(String(customer?.openingBalance ?? 0));
  const [dueDay, setDueDay] = useState<number>(customer?.dueDay ?? 1);
  const [joiningDateInput, setJoiningDateInput] = useState<string>(isoToDDMMYYYY(customer?.joiningDate ?? today));
  const [pressed, setPressed] = useState(false);

  const phoneValid = EG_PHONE_RE.test(phone);
  const initials = name.trim() ? name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("") : "";
  const assignedCode = customerCode ?? (data.customers.length + 1);

  // Real-time duplicate phone validation
  const duplicateCustomer = useMemo(() => {
    if (!phone || phone.length < 11) return null;
    return data.customers.find((c) => c.phone === phone && c.id !== customer?.id);
  }, [phone, data.customers, customer]);

  const submit = () => {
    if (!name.trim()) return toast.error("الاسم مطلوب");
    if (!phoneValid) return toast.error("رقم الهاتف يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقم");
    if (duplicateCustomer) return toast.error(`رقم الهاتف مسجل مسبقاً للعميل (${duplicateCustomer.name})`);
    const iso = ddmmyyyyToIso(joiningDateInput);
    if (!iso) return toast.error("تاريخ الانضمام غير صحيح. الصيغة: يوم/شهر/سنة");
    const payload = {
      name, phone, rating: rating as any, status, customerType,
      notes, frozen,
      address: address || null, joiningDate: iso,
      creditLimit: Number(creditLimit) || 0, dueDay,
      openingBalance: Number(openingBalance) || 0,
    };
    if (customer) {
      db.updateCustomer(customer.id, payload);
      toast.success("تم تحديث بيانات العميل");
    } else {
      db.addCustomer(payload);
      toast.success(`تم إضافة العميل بنجاح (كود: #${assignedCode})`);
    }
    setOpen(false);
  };

  const tip = RATING_TIPS[rating] || RATING_TIPS[3];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="border-b border-border/40 pb-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="font-mono font-bold text-xs bg-primary/10 text-primary border-primary/25 px-2.5 py-1">
              كود العميل: #{assignedCode}
            </Badge>
            <DialogTitle className="text-right text-lg font-bold">
              {customer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-right text-xs text-muted-foreground mt-1">
            {customer ? `تعديل بيانات العميل ${customer.name} والتصنيف الائتماني.` : "سجل عميلاً جديداً بالمنظومة مع ربط تسلسلي فوري."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Duplicate phone alert */}
          {duplicateCustomer && (
            <div className="rounded-xl bg-danger/10 border border-danger/30 p-2.5 text-right text-xs text-danger flex items-center justify-between gap-2">
              <span className="font-medium">⚠️ هذا الرقم مسجل بالفعل للعميل: <strong>{duplicateCustomer.name}</strong></span>
              <AlertTriangle className="w-4 h-4 shrink-0" />
            </div>
          )}

          {/* 2-Column Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* الاسم */}
            <div className="sm:col-span-2">
              <Label className="text-xs font-bold text-foreground">اسم العميل *</Label>
              <div className="flex items-center gap-2.5 mt-1">
                <Avatar className="h-10 w-10 hairline shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {initials || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد محمود إبراهيم"
                  maxLength={100}
                  className="flex-1"
                />
              </div>
            </div>

            {/* الهاتف */}
            <div>
              <Label className="text-xs font-bold text-foreground">رقم الهاتف (11 رقم) *</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="01XXXXXXXXX"
                maxLength={11}
                dir="ltr"
                className={cn("mt-1", phone && (!phoneValid || duplicateCustomer) && "border-danger focus-visible:ring-danger")}
                inputMode="numeric"
              />
              {phone && !phoneValid && (
                <p className="text-[11px] text-danger mt-1">يجب أن يبدأ بـ 010 / 011 / 012 / 015</p>
              )}
            </div>

            {/* تاريخ الانضمام */}
            <div>
              <Label className="text-xs font-bold text-foreground">تاريخ الانضمام</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={joiningDateInput}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^\d/]/g, "").slice(0, 10);
                  const digits = v.replace(/\//g, "");
                  if (digits.length >= 5) v = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
                  else if (digits.length >= 3) v = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                  else v = digits;
                  setJoiningDateInput(v);
                }}
                placeholder="يوم/شهر/سنة"
                dir="ltr"
                maxLength={10}
                className="mt-1"
              />
            </div>

            {/* العنوان */}
            <div className="sm:col-span-2">
              <Label className="text-xs font-bold text-foreground">العنوان / المنطقة</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="الشارع، الحي، المحافظة..."
                maxLength={300}
                className="mt-1"
              />
            </div>

            {/* نوع المعاملات */}
            <div className="sm:col-span-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                نوع المعاملات
              </Label>
              <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-foreground/[0.04] p-1.5">
                {([
                  { key: "installment" as const, label: "أقساط", hint: "بيع آجل بدفعات شهرية" },
                  { key: "cash" as const, label: "فوري (نقدي)", hint: "سداد كامل عند الشراء" },
                ]).map((opt) => {
                  const active = customerType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setCustomerType(opt.key);
                        if (opt.key === "cash") { setCreditLimit("0"); setDueDay(1); }
                      }}
                      aria-pressed={active}
                      className={cn(
                        "rounded-[1.1rem] px-3 py-2 text-center transition-all duration-300",
                        active
                          ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                          : "text-muted-foreground hover:bg-foreground/[0.04]",
                      )}
                    >
                      <span className="block text-sm font-extrabold">{opt.label}</span>
                      <span className="text-[10px] opacity-75 block">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* لوح خاص بنوع العميل */}
          <AnimatePresence mode="wait" initial={false}>
            {customerType === "installment" ? (
              <motion.div
                key="type-installment"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 space-y-3.5"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <CreditCard className="h-4 w-4" />
                  <span>إعدادات الائتمان والأقساط الشهرية</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold">يوم القسط من الشهر</Label>
                    <Select value={String(dueDay)} onValueChange={(v) => setDueDay(Number(v))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-56">
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <SelectItem key={d} value={String(d)}>يوم {d} من كل شهر</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold">سقف المديونية (ج.م)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      placeholder="0 = بدون حد أقصى"
                      dir="ltr"
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* حالة الالتزام والتقييم المتزامن */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/30">
                  <div>
                    <Label className="text-xs font-bold mb-1 block">حالة الالتزام المالي</Label>
                    <Tabs 
                      value={status} 
                      onValueChange={(v) => {
                        const newStatus = v as CustomerStatus;
                        setStatus(newStatus);
                        if (newStatus === "committed") setRating(5);
                        else if (newStatus === "neutral") setRating(3);
                        else if (newStatus === "defaulter") setRating(1);
                      }}
                    >
                      <TabsList className="grid grid-cols-3 w-full">
                        {STATUS_TABS.map((t) => (
                          <TabsTrigger key={t.value} value={t.value} className={cn("gap-1 text-xs py-1", t.active)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", t.dot)} />
                            {t.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>

                  <div>
                    <Label className="text-xs font-bold mb-1 block">التقييم الائتماني (النجوم)</Label>
                    <div className="flex items-center gap-1.5 mt-1" dir="ltr">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setRating(n);
                            if (n >= 4) setStatus("committed");
                            else if (n === 3) setStatus("neutral");
                            else setStatus("defaulter");
                          }}
                          className="p-0.5 hover:scale-110 transition-transform"
                          aria-label={`${n} stars`}
                        >
                          <Star
                            className={cn("w-5 h-5 transition-colors", n <= rating ? "fill-warning text-warning" : "text-muted-foreground/30")}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-muted-foreground mr-1.5 font-mono">({rating}/5)</span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 bg-background/80 p-2 rounded-xl border border-border/40">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-primary" />
                  <span>{tip.text}</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="type-cash"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300"
              >
                <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>عميل فوري: يسدد الفاتورة فورياً نقداً، لا يتطلب تحديد يوم قسط أو سقف ائتماني.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* رصيد افتتاحي وملاحظات */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold flex items-center gap-1.5 justify-end">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="معلومات">
                        <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      لتسجيل مديونية قديمة من الدفاتر الورقية بدون إنشاء فاتورة وهمية. يضاف فوراً إلى إجمالي ديون العميل.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span>رصيد افتتاحي / ديون قديمة (ج.م)</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0"
                dir="ltr"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">ملاحظات إضافية (اختياري)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات حول العميل..."
                maxLength={300}
                className="mt-1"
              />
            </div>
          </div>

          {/* تجميد الحساب */}
          <div className="flex items-center justify-between rounded-xl bg-muted/20 border border-border/40 p-2.5">
            <Switch checked={frozen} onCheckedChange={setFrozen} />
            <div className="text-right">
              <span className="text-xs font-bold block">تجميد حساب العميل</span>
              <span className="text-[10px] text-muted-foreground">يمنع إصدار أي فواتير جديدة لهذا العميل</span>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            onClick={submit}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            onTouchStart={() => setPressed(true)}
            onTouchEnd={() => setPressed(false)}
            className={cn("w-full py-2.5 font-bold transition-transform duration-100", pressed && "scale-95")}
          >
            {customer ? "حفظ التعديلات" : `إضافة العميل (كود #${assignedCode})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
