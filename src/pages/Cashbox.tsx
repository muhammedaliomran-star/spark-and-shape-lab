import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDB, fmt } from "@/lib/store";
import { Wallet, Search, ArrowUpRight, ArrowDownRight, TrendingUp, History, Filter, Download, Plus, Trash2, Pencil, Calendar } from "lucide-react";
import { usePrivacy } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { CountUp } from "@/components/CountUp";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function CashboxPage() {
  const { invoices, payments, expenses, purchases, supplierPayments, loading } = useDB();
  const { privacy } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");
  const [daysFilter, setDaysFilter] = useState("30");

  // Transactions are derived from:
  // 1. Payments (Customer installments) -> IN
  // 2. Expenses -> OUT
  // 3. Supplier Payments -> OUT
  // 4. Cash Invoices (downPayment on creation) -> IN
  // 5. Cash Purchases -> OUT

  const transactions = useMemo(() => {
    const list: any[] = [];
    
    // 1. Payments (Installments)
    payments.forEach(p => {
      const inv = invoices.find(i => i.id === p.invoiceId);
      list.push({
        id: p.id,
        date: p.paidAt,
        amount: p.amount,
        type: 'in',
        category: 'قسط عميل',
        notes: `تحصيل قسط${inv ? ` - فاتورة ${inv.id.slice(0, 4)}` : ''}`,
        rawDate: new Date(p.paidAt)
      });
    });

    // 2. Expenses
    expenses.forEach(e => {
      list.push({
        id: e.id,
        date: e.expenseDate,
        amount: e.amount,
        type: 'out',
        category: 'مصروفات',
        notes: e.notes || 'مصروف عام',
        rawDate: new Date(e.expenseDate)
      });
    });

    // 3. Supplier Payments
    supplierPayments.forEach(sp => {
      list.push({
        id: sp.id,
        date: sp.paidAt,
        amount: sp.amount,
        type: 'out',
        category: 'دفعة مورد',
        notes: 'سداد مديونية مورد',
        rawDate: new Date(sp.paidAt)
      });
    });

    // 4. Cash Invoices & Down Payments
    invoices.forEach(inv => {
      if (inv.downPayment > 0) {
        list.push({
          id: `inv-dp-${inv.id}`,
          date: inv.createdAt.split('T')[0],
          amount: inv.downPayment,
          type: 'in',
          category: 'مقدم فاتورة',
          notes: `مقدم/كاش - فاتورة ${inv.id.slice(0, 4)}`,
          rawDate: new Date(inv.createdAt)
        });
      }
    });

    // 5. Cash Purchases
    purchases.forEach(pur => {
      if (pur.paymentType === 'cash') {
        list.push({
          id: `pur-cash-${pur.id}`,
          date: pur.purchaseDate,
          amount: pur.total,
          type: 'out',
          category: 'مشتريات كاش',
          notes: pur.notes || 'شراء بضاعة',
          rawDate: new Date(pur.purchaseDate)
        });
      }
    });

    return list.sort((a, b) => b.rawDate - a.rawDate);
  }, [payments, expenses, supplierPayments, invoices, purchases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(now.getDate() - parseInt(daysFilter));

    return transactions.filter(t => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (daysFilter !== "all" && t.rawDate < threshold) return false;
      if (q) {
        const txt = `${t.category} ${t.notes}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, search, filterType, daysFilter]);

  const totalIn = filtered.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIn - totalOut;
  const avgDaily = filtered.length > 0 ? totalIn / parseInt(daysFilter || "1") : 0;

  return (
    <AppShell>
      <PageTransition>
        <PageHeader
          title="الصندوق"
          subtitle="إدارة المعاملات النقدية اليومية والتدفق المالي."
          icon={<Wallet className="w-7 h-7" />}
          action={
            <div className="flex items-center gap-2">
               <Select value={daysFilter} onValueChange={setDaysFilter}>
                <SelectTrigger className="w-[140px] h-9 glass border-none shadow-none">
                  <Calendar className="w-4 h-4 ml-2 opacity-50" />
                  <SelectValue placeholder="الفترة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">آخر 7 أيام</SelectItem>
                  <SelectItem value="30">آخر 30 يوم</SelectItem>
                  <SelectItem value="90">آخر 3 أشهر</SelectItem>
                  <SelectItem value="all">كل الأوقات</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-2 text-danger hover:bg-danger/10 border-danger/20">
                <History className="w-4 h-4" />
                استعادة المحذوفة
              </Button>
            </div>
          }
        />

        {/* Top Balance Card - Similar to reference image */}
        <div className="mb-8">
          <BezelCard className="p-0 overflow-hidden bezel-lift bg-primary/5 border-primary/20 relative group">
            <div className="p-8 flex flex-col items-center justify-center text-center">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-all duration-700 -rotate-12 group-hover:rotate-0">
                <Wallet className="w-32 h-32" />
              </div>
              
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">الرصيد الحالي المتوفر</span>
              <div className={cn("text-5xl md:text-7xl font-black tabular-nums tracking-tighter leading-none", netBalance >= 0 ? "text-primary" : "text-danger", blurCls)}>
                <CountUp value={netBalance} format={n => fmt(n)} />
                <span className="text-xl md:text-2xl ml-2 font-bold opacity-50">ج.م</span>
              </div>
              
              <div className="mt-8 flex items-center gap-2 px-4 py-1.5 rounded-full bg-background/50 ring-1 ring-inset ring-[var(--hairline)] backdrop-blur-xl shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Live Sync Connected</span>
              </div>
            </div>
          </BezelCard>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard 
            label="إجمالي الدخل" 
            value={totalIn} 
            icon={<ArrowUpRight className="w-4 h-4 text-success" />} 
            color="success" 
            privacy={privacy}
            glow
          />
          <MetricCard 
            label="إجمالي المصروفات" 
            value={totalOut} 
            icon={<ArrowDownRight className="w-4 h-4 text-danger" />} 
            color="danger" 
            privacy={privacy}
            glow
          />
          <MetricCard 
            label="صافي التدفق" 
            value={netBalance} 
            icon={<TrendingUp className="w-4 h-4 text-primary" />} 
            color="primary" 
            privacy={privacy}
            glow
          />
          <MetricCard 
            label="متوسط يومي" 
            value={avgDaily} 
            icon={<History className="w-4 h-4 text-muted-foreground" />} 
            color="muted" 
            privacy={privacy}
            glow
          />
        </div>

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charts/Summary Placeholder Area (Left in RTL, Right in LTR) */}
          <div className="lg:col-span-1 flex flex-col gap-6">
             <BezelCard className="p-0 overflow-hidden">
                <div className="p-4 border-b border-[var(--hairline)] flex items-center justify-between">
                  <span className="font-bold text-sm">توزيع المصروفات</span>
                  <ArrowDownRight className="w-4 h-4 text-danger" />
                </div>
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground/50">
                   <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                      <ArrowDownRight className="w-8 h-8" />
                   </div>
                   <p className="text-sm font-medium">لا توجد مصروفات في هذه الفترة</p>
                </div>
             </BezelCard>
             
             <BezelCard className="p-0 overflow-hidden">
                <div className="p-4 border-b border-[var(--hairline)] flex items-center justify-between">
                  <span className="font-bold text-sm">توزيع الإيرادات</span>
                  <ArrowUpRight className="w-4 h-4 text-success" />
                </div>
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground/50">
                   <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                      <ArrowUpRight className="w-8 h-8" />
                   </div>
                   <p className="text-sm font-medium">لا توجد إيرادات في هذه الفترة</p>
                </div>
             </BezelCard>

             <BezelCard className="p-0 overflow-hidden">
                <div className="p-4 border-b border-[var(--hairline)] flex items-center justify-between">
                  <span className="font-bold text-sm">الإحصائيات</span>
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div className="p-4 space-y-4">
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">إجمالي المعاملات</span>
                      <span className="font-bold">{filtered.length}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">دخل هذا الشهر</span>
                      <span className={cn("font-bold text-success", blurCls)}>{fmt(totalIn)} ج.م</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">مصروفات هذا الشهر</span>
                      <span className={cn("font-bold text-danger", blurCls)}>{fmt(totalOut)} ج.م</span>
                   </div>
                   
                   <Button className="w-full gap-2 mt-4" size="sm">
                      <Plus className="w-4 h-4" /> إضافة معاملة
                   </Button>
                </div>
             </BezelCard>
          </div>

          {/* Transactions List */}
          <div className="lg:col-span-2">
            <div className="sticky-search-bar mb-4">
              <div className="bg-card plate p-4 flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="بحث في المعاملات..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                    <SelectTrigger className="w-[120px]">
                      <Filter className="w-4 h-4 ml-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="in">وارد (دخل)</SelectItem>
                      <SelectItem value="out">صادر (خرج)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" title="تصدير PDF">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {filtered.length === 0 ? (
                 <div className="plate p-12 text-center text-muted-foreground">
                    لا توجد معاملات تطابق البحث
                 </div>
              ) : (
                filtered.map((t, idx) => (
                  <Reveal key={t.id} delay={idx * 30}>
                    <div className="group plate p-4 bezel-lift flex items-center gap-4 transition-all">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ring-1",
                        t.type === 'in' 
                          ? "bg-success/12 text-success ring-success/20" 
                          : "bg-danger/12 text-danger ring-danger/20"
                      )}>
                        {t.type === 'in' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold truncate">{t.notes}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold uppercase">
                            {t.category}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5" dir="ltr">
                          {t.date}
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className={cn(
                          "text-lg font-black tabular-nums",
                          t.type === 'in' ? "text-success" : "text-danger",
                          blurCls
                        )}>
                          {t.type === 'in' ? '+' : '-'}{fmt(t.amount)} <span className="text-[10px] font-bold">ج.م</span>
                        </div>
                      </div>

                      <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary">
                            <Pencil className="w-3.5 h-3.5" />
                         </Button>
                         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-danger hover:bg-danger/10">
                            <Trash2 className="w-3.5 h-3.5" />
                         </Button>
                      </div>
                    </div>
                  </Reveal>
                ))
              )}
            </div>
          </div>
        </div>
      </PageTransition>
    </AppShell>
  );
}

function MetricCard({ label, value, icon, color, privacy, isCount, glow }: { label: string, value: number, icon: React.ReactNode, color: string, privacy: boolean, isCount?: boolean, glow?: boolean }) {
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const colorCls = {
    success: "text-success",
    danger: "text-danger",
    primary: "text-primary",
    warning: "text-warning",
    muted: "text-muted-foreground"
  }[color as "success" | "danger" | "primary" | "warning" | "muted"] || "text-foreground";

  const glowCls = glow ? {
    success: "shadow-[0_0_30px_-10px_hsl(var(--success)/0.3)]",
    danger: "shadow-[0_0_30px_-10px_hsl(var(--danger)/0.3)]",
    primary: "shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]",
    warning: "shadow-[0_0_30px_-10px_hsl(var(--warning)/0.3)]",
    muted: "shadow-none"
  }[color as "success" | "danger" | "primary" | "warning" | "muted"] : "";

  return (
    <div className={cn("plate p-5 flex flex-col items-center justify-center text-center bezel-lift group relative overflow-hidden", glowCls)}>
      {glow && (
        <div className={cn(
          "absolute -right-4 -top-4 w-12 h-12 blur-2xl opacity-20 transition-opacity group-hover:opacity-40",
          color === 'primary' ? "bg-primary" : color === 'success' ? "bg-success" : color === 'danger' ? "bg-danger" : "bg-muted"
        )} />
      )}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1.5 rounded-lg bg-muted/20 ring-1 ring-inset ring-[var(--hairline)]">
          {icon}
        </div>
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">{label}</span>
      </div>
      <div className={cn("text-2xl font-black tabular-nums tracking-tighter", colorCls, blurCls)}>
        {isCount ? <CountUp value={value} /> : <><CountUp value={value} format={(n: number) => fmt(n)} /> <span className="text-xs font-bold opacity-60">ج.م</span></>}
      </div>
    </div>
  );
}
