import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { ChartEmpty } from "@/components/ChartEmpty";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  BarChart3, Download, FileSpreadsheet, FileText, TrendingUp, TrendingDown,
  Wallet, Receipt, Users, Package, Eye, EyeOff,
} from "lucide-react";
import { useDB, useShopSettings, fmt, expenseCategoryLabel, type ExpenseCategory } from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <ReportsPage />
      </PageTransition>
    </AppShell>
  );
}

type Range = "3" | "6" | "12";

const MONTHS_AR = ["يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTHS_AR[Number(m) - 1]} ${String(y).slice(2)}`;
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function ReportsPage() {
  const { customers, invoices, invoiceItems, payments, expenses, purchases, stockItems } = useDB();
  const { settings } = useShopSettings();
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "";
  const [range, setRange] = useState<Range>("6");

  const months = useMemo(() => {
    const n = Number(range);
    const out: string[] = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }
    return out;
  }, [range]);

  const from = useMemo(() => new Date(`${months[0]}-01T00:00:00`), [months]);

  /** Gross profit per invoice, from its line items (price - cost). */
  const invoiceProfit = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of invoiceItems) {
      map.set(it.invoiceId, (map.get(it.invoiceId) ?? 0) + (it.price - it.cost));
    }
    return map;
  }, [invoiceItems]);

  const series = useMemo(() => {
    const base = new Map(months.map((m) => [m, { month: m, label: monthLabel(m), sales: 0, collected: 0, expenses: 0, profit: 0 }]));

    for (const inv of invoices) {
      const k = monthKey(new Date(inv.createdAt));
      const row = base.get(k);
      if (!row) continue;
      row.sales += inv.total;
      row.collected += inv.downPayment;
      row.profit += invoiceProfit.get(inv.id) ?? 0;
    }
    for (const p of payments) {
      const row = base.get(monthKey(new Date(p.paidAt)));
      if (row) row.collected += p.amount;
    }
    for (const e of expenses) {
      const row = base.get(monthKey(new Date(e.expenseDate)));
      if (row) row.expenses += e.amount;
    }
    for (const pu of purchases) {
      if (pu.paymentType !== "cash") continue;
      const row = base.get(monthKey(new Date(pu.purchaseDate)));
      if (row) row.expenses += pu.total;
    }
    return months.map((m) => {
      const r = base.get(m)!;
      return { ...r, net: r.profit - r.expenses };
    });
  }, [months, invoices, payments, expenses, purchases, invoiceProfit]);

  const totals = useMemo(() => {
    const t = series.reduce(
      (s, r) => ({
        sales: s.sales + r.sales,
        collected: s.collected + r.collected,
        expenses: s.expenses + r.expenses,
        profit: s.profit + r.profit,
      }),
      { sales: 0, collected: 0, expenses: 0, profit: 0 },
    );
    return { ...t, net: t.profit - t.expenses };
  }, [series]);

  const outstanding = useMemo(
    () => invoices.reduce((s, i) => s + Math.max(0, i.total - i.paid), 0),
    [invoices],
  );

  const topCustomers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sales: number; paid: number; due: number }>();
    for (const c of customers) map.set(c.id, { id: c.id, name: c.name, sales: 0, paid: 0, due: c.openingBalance });
    for (const inv of invoices) {
      const row = map.get(inv.customerId);
      if (!row) continue;
      row.sales += inv.total;
      row.paid += inv.paid;
      row.due += Math.max(0, inv.total - inv.paid);
    }
    return [...map.values()].filter((r) => r.sales > 0 || r.due > 0).sort((a, b) => b.sales - a.sales).slice(0, 10);
  }, [customers, invoices]);

  const topItems = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number; profit: number }>();
    for (const it of invoiceItems) {
      const inv = invoices.find((i) => i.id === it.invoiceId);
      if (inv && new Date(inv.createdAt) < from) continue;
      const row = map.get(it.name) ?? { name: it.name, count: 0, revenue: 0, profit: 0 };
      row.count += 1;
      row.revenue += it.price;
      row.profit += it.price - it.cost;
      map.set(it.name, row);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [invoiceItems, invoices, from]);

  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      if (new Date(e.expenseDate) < from) continue;
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()]
      .map(([category, amount]) => ({ category, label: expenseCategoryLabel(category as ExpenseCategory), amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, from]);

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(series.map((r) => ({
        "الشهر": r.label,
        "المبيعات": Math.round(r.sales),
        "التحصيلات": Math.round(r.collected),
        "المصروفات": Math.round(r.expenses),
        "مجمل الربح": Math.round(r.profit),
        "صافي الربح": Math.round(r.net),
      }))), "ملخص شهري");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topCustomers.map((c) => ({
        "العميل": c.name, "إجمالي المشتريات": Math.round(c.sales), "المسدد": Math.round(c.paid), "المتبقي": Math.round(c.due),
      }))), "أفضل العملاء");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topItems.map((i) => ({
        "الصنف": i.name, "عدد مرات البيع": i.count, "الإيراد": Math.round(i.revenue), "الربح": Math.round(i.profit),
      }))), "أكثر الأصناف مبيعاً");
      XLSX.writeFile(wb, `reports-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("تم تصدير ملف Excel");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر التصدير");
    }
  };

  const exportPDF = () => {
    const shopName = settings.shopName || "سِجلّي";
    const meta = [
      { label: "المحل", value: escapeHtml(shopName) },
      ...(settings.phone ? [{ label: "تليفون", value: escapeHtml(settings.phone) }] : []),
      { label: "الفترة", value: `${monthLabel(months[0])} — ${monthLabel(months[months.length - 1])}` },
      { label: "تاريخ التقرير", value: new Date().toLocaleDateString("en-US") },
    ];
    const body = `
<h2 class="sec">الملخص الشهري</h2>
<div class="t-wrap"><table><thead><tr><th>الشهر</th><th class="num">المبيعات</th><th class="num">التحصيلات</th><th class="num">المصروفات</th><th class="num">مجمل الربح</th><th class="num">صافي الربح</th></tr></thead><tbody>
${series.map((r) => `<tr><td>${r.label}</td><td class="num">${fmt(r.sales)}</td><td class="num">${fmt(r.collected)}</td><td class="num due">${fmt(r.expenses)}</td><td class="num">${fmt(r.profit)}</td><td class="num ${r.net >= 0 ? "ok" : "due"}">${fmt(r.net)}</td></tr>`).join("")}
</tbody><tfoot><tr><td>الإجمالي</td><td class="num">${fmt(totals.sales)}</td><td class="num">${fmt(totals.collected)}</td><td class="num">${fmt(totals.expenses)}</td><td class="num">${fmt(totals.profit)}</td><td class="num">${fmt(totals.net)}</td></tr></tfoot></table></div>
<h2 class="sec">أفضل العملاء</h2>
<div class="t-wrap"><table><thead><tr><th>العميل</th><th class="num">إجمالي المشتريات</th><th class="num">المسدد</th><th class="num">المتبقي</th></tr></thead><tbody>
${topCustomers.map((c) => `<tr><td>${escapeHtml(c.name)}</td><td class="num">${fmt(c.sales)}</td><td class="num ok">${fmt(c.paid)}</td><td class="num due">${fmt(c.due)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">لا توجد بيانات</td></tr>`}
</tbody></table></div>
<h2 class="sec">أكثر الأصناف مبيعاً</h2>
<div class="t-wrap"><table><thead><tr><th>الصنف</th><th class="num">عدد مرات البيع</th><th class="num">الإيراد</th><th class="num">الربح</th></tr></thead><tbody>
${topItems.map((i) => `<tr><td>${escapeHtml(i.name)}</td><td class="num">${fmt(i.count)}</td><td class="num">${fmt(i.revenue)}</td><td class="num ok">${fmt(i.profit)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">لا توجد بيانات</td></tr>`}
</tbody></table></div>`;
    const html = pdfDocument({
      docTitle: `تقرير الأداء — ${escapeHtml(shopName)}`,
      badge: `تقرير أداء · ${months.length} شهور`,
      title: "تقرير الأداء والأرباح",
      lede: `ملخّص المبيعات والتحصيلات والمصروفات وصافي الربح خلال آخر ${months.length} شهور.`,
      meta,
      kpis: [
        { label: "إجمالي المبيعات", value: fmt(totals.sales), tone: "brand" },
        { label: "التحصيلات", value: fmt(totals.collected) },
        { label: "المصروفات", value: fmt(totals.expenses), tone: "danger" },
        { label: "صافي الربح", value: fmt(totals.net), tone: totals.net >= 0 ? "brand" : "danger" },
      ],
      body,
      footerNote: settings.footerNote ? escapeHtml(settings.footerNote) : undefined,
      page: "A4",
    });
    if (!openPdfDocument(html, { autoPrint: true })) toast.error("اسمح بفتح النوافذ المنبثقة");
  };


  const hasData = series.some((r) => r.sales || r.collected || r.expenses);

  return (
    <>
      <PageHeader
        title="التقارير"
        subtitle="أرباحك وتحصيلاتك ومصروفاتك شهرًا بشهر، وأفضل عملائك وأكثر أصنافك مبيعًا."
        icon={<BarChart3 className="w-7 h-7" />}
        action={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">تصدير</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportExcel} className="gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-success" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF} className="gap-2">
                  <FileText className="w-4 h-4 text-danger" /> PDF مطبوع
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant={privacy ? "default" : "outline"} size="sm" className="gap-1.5" onClick={toggle} title="إخفاء الأرقام">
              {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">إخفاء الأرقام</span>
            </Button>
          </div>
        }
      />

      <Tabs value={range} onValueChange={(v) => setRange(v as Range)} className="mb-6">
        <TabsList className="grid grid-cols-3 w-full sm:w-72 h-auto">
          <TabsTrigger value="3">3 شهور</TabsTrigger>
          <TabsTrigger value="6">6 شهور</TabsTrigger>
          <TabsTrigger value="12">سنة</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <SummaryBox label="المبيعات" value={totals.sales} icon={<Receipt className="w-5 h-5" />} tone="primary" blurCls={blurCls} />
        <SummaryBox label="التحصيلات" value={totals.collected} icon={<Wallet className="w-5 h-5" />} tone="success" blurCls={blurCls} />
        <SummaryBox label="المصروفات" value={totals.expenses} icon={<TrendingDown className="w-5 h-5" />} tone="danger" blurCls={blurCls} />
        <SummaryBox label="صافي الربح" value={totals.net} icon={<TrendingUp className="w-5 h-5" />} tone={totals.net >= 0 ? "success" : "danger"} blurCls={blurCls} />
      </div>

      <div className="mb-6 grid gap-px overflow-hidden rounded-[1.5rem] hairline/70 bg-border/40 sm:grid-cols-3">
        {[
          { label: "المتبقي على العملاء", value: fmt(outstanding), tone: "text-warning" },
          {
            label: "قيمة المخزن",
            value: fmt(stockItems.reduce((s, i) => s + i.quantity * i.lastUnitCost, 0)),
            tone: "text-foreground",
          },
          { label: "مجمل الربح قبل المصروفات", value: fmt(totals.profit), tone: "text-success" },
        ].map((row) => (
          <div
            key={row.label}
            className="bg-card/60 px-5 py-4 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-card/80"
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{row.label}</p>
            <p className={cn("mt-1.5 text-base font-bold tabular-nums", row.tone, blurCls)}>
              {row.value} ج.م
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 mb-6">
        <BezelCard innerClassName="p-6">
          <h2 className="text-sm font-bold mb-4">المبيعات مقابل التحصيلات</h2>
          {hasData ? (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={60} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, direction: "rtl" }}
                    formatter={(v: number) => `${fmt(Number(v))} ج.م`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar name="المبيعات" dataKey="sales" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar name="التحصيلات" dataKey="collected" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty title="لسه مفيش بيانات كفاية" hint="سجّل فواتير ودفعات وهتلاقي الرسم البياني اتعبّى." />
          )}
        </BezelCard>

        <BezelCard innerClassName="p-6">
          <h2 className="text-sm font-bold mb-4">صافي الربح شهريًا</h2>
          {hasData ? (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={60} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, direction: "rtl" }}
                    formatter={(v: number) => `${fmt(Number(v))} ج.م`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line name="مجمل الربح" type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line name="صافي الربح" type="monotone" dataKey="net" stroke="hsl(var(--success))" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line name="المصروفات" type="monotone" dataKey="expenses" stroke="hsl(var(--danger))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty title="لسه مفيش بيانات كفاية" hint="أضف مصروفات وفواتير عشان نحسب صافي الربح." />
          )}
        </BezelCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <BezelCard innerClassName="p-0 overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold">أفضل 10 عملاء</h2>
          </div>
          {topCustomers.length === 0 ? (
            <EmptyState icon={Users} title="مفيش عملاء بمشتريات لسه." hint="سجّل أول فاتورة عشان يظهر الترتيب." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-foreground/[0.04] text-muted-foreground">
                  <tr>
                    <th className="text-right p-3 font-medium">العميل</th>
                    <th className="text-right p-3 font-medium">المشتريات</th>
                    <th className="text-right p-3 font-medium">المسدد</th>
                    <th className="text-right p-3 font-medium">المتبقي</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c, idx) => (
                    <tr key={c.id} className="border-t border-[var(--hairline)] hover:bg-foreground/[0.035]">
                      <td className="p-3 font-bold text-primary">
                        <span className="text-muted-foreground font-normal ml-1.5">{idx + 1}.</span>{c.name}
                      </td>
                      <td className={cn("p-3 tabular-nums", blurCls)}>{fmt(c.sales)}</td>
                      <td className={cn("p-3 tabular-nums text-success", blurCls)}>{fmt(c.paid)}</td>
                      <td className={cn("p-3 tabular-nums", c.due > 0 ? "text-warning font-bold" : "text-muted-foreground", blurCls)}>{fmt(c.due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </BezelCard>

        <BezelCard innerClassName="p-0 overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <Package className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold">أكثر الأصناف مبيعًا</h2>
          </div>
          {topItems.length === 0 ? (
            <EmptyState icon={Package} title="مفيش أصناف مباعة في الفترة دي." hint="أضف أصناف داخل الفواتير عشان نحلّلها." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-foreground/[0.04] text-muted-foreground">
                  <tr>
                    <th className="text-right p-3 font-medium">الصنف</th>
                    <th className="text-right p-3 font-medium">مرات البيع</th>
                    <th className="text-right p-3 font-medium">الإيراد</th>
                    <th className="text-right p-3 font-medium">الربح</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((i) => (
                    <tr key={i.name} className="border-t border-[var(--hairline)] hover:bg-foreground/[0.035]">
                      <td className="p-3 font-medium">{i.name}</td>
                      <td className="p-3"><Badge variant="secondary" className="rounded-full tabular-nums">{fmt(i.count)}</Badge></td>
                      <td className={cn("p-3 tabular-nums", blurCls)}>{fmt(i.revenue)}</td>
                      <td className={cn("p-3 tabular-nums font-bold", i.profit >= 0 ? "text-success" : "text-danger", blurCls)}>{fmt(i.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </BezelCard>
      </div>

      {expenseBreakdown.length > 0 && (
        <BezelCard className="mt-5" innerClassName="p-6">
          <h2 className="text-sm font-bold mb-4">المصروفات حسب البند</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {expenseBreakdown.map((e) => (
              <div key={e.category} className="flex items-center justify-between rounded-2xl hairline/60 bg-foreground/[0.03] px-3 py-2">
                <span className="text-sm text-muted-foreground">{e.label}</span>
                <span className={cn("text-sm font-bold tabular-nums", blurCls)}>{fmt(e.amount)} ج.م</span>
              </div>
            ))}
          </div>
        </BezelCard>
      )}
    </>
  );
}

function SummaryBox({
  label, value, icon, tone, blurCls,
}: {
  label: string; value: number; icon: React.ReactNode;
  tone: "primary" | "success" | "danger"; blurCls: string;
}) {
  const toneCls = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-primary";
  return (
    <div className="rounded-[1.25rem] hairline/70 bg-card/70 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={toneCls}>{icon}</span>
      </div>
      <div className={cn("text-2xl font-extrabold tabular-nums", toneCls, blurCls)}>{fmt(value)} ج.م</div>
    </div>
  );
}
