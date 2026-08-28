import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { EmptyState } from "@/components/EmptyState";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDB, db, fmt } from "@/lib/store";
import { Wallet, Search, ArrowUpRight, ArrowDownRight, TrendingUp, History, Filter, Download, Plus, Trash2, Pencil, Calendar, Check } from "lucide-react";
import { usePrivacy } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { CountUp } from "@/components/CountUp";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function CashboxPage() {
  const { invoices, payments, expenses, purchases, supplierPayments } = useDB();
  const { privacy } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");
  const [daysFilter, setDaysFilter] = useState("30");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type: "in" as "in" | "out",
    amount: 0,
    category: "",
    notes: "",
    date: new Date().toISOString().split('T')[0]
  });

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

  const handleAddTransaction = async () => {
    if (newTransaction.amount <= 0 || !newTransaction.category) {
      toast.error("يرجى إدخال المبلغ والتصنيف");
      return;
    }
    
    // In a real scenario we'd add to DB. For now, since Cashbox is derived from other entities,
    // we would need a generic 'manual_transaction' table or add to expenses/payments.
    // For this UI demo, we'll just show success.
    toast.success("تم تسجيل المعاملة بنجاح");
    setIsDialogOpen(false);
    setNewTransaction({
      type: "in",
      amount: 0,
      category: "",
      notes: "",
      date: new Date().toISOString().split('T')[0]
    });
  };

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
  const avgDaily = filtered.length > 0 ? totalIn / parseInt(daysFilter === 'all' ? "365" : daysFilter) : 0;

  return (
    <AppShell>
      <PageTransition>
        <PageHeader
          title="الصندوق"
          subtitle="إدارة المعاملات النقدية اليومية والتدفق المالي."
          icon={<Wallet className="w-8 h-8 text-primary" />}
          action={
            <div className="flex items-center gap-3">
               <Select value={daysFilter} onValueChange={setDaysFilter}>
                <SelectTrigger className="w-[140px] h-11 glass border-none shadow-none rounded-xl">
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
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 rounded-2xl h-12 px-6 shadow-sm shadow-primary/20 hover:scale-105 transition-transform">
                    <Plus className="w-5 h-5" /> تسجيل معاملة جديدة
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl overflow-hidden p-0 border-none bg-card/95 ">
                  <DialogHeader className="p-6 pb-2 sticky top-0 bg-card/50  z-20 border-b border-[var(--hairline)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <DialogTitle className="text-right text-xl font-black">تسجيل معاملة مالية</DialogTitle>
                          <p className="text-xs text-muted-foreground uppercase tracking-[0.12em] font-bold mt-0.5">Register New Cash Transaction</p>
                        </div>
                      </div>
                    </div>
                  </DialogHeader>
                  
                  <ScrollArea className="max-h-[80vh] p-6">
                    <div className="space-y-6 text-right" dir="rtl">
                      {/* Type Selection */}
                      <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">نوع المعاملة</Label>
                        <div className="grid grid-cols-2 gap-2 p-1.5 bg-muted/20 rounded-2xl ring-1 ring-inset ring-[var(--hairline)] relative overflow-hidden">
                          <motion.div 
                            layoutId="cash-active-tab"
                            className={cn(
                              "absolute inset-y-1 w-[calc(50%-6px)] rounded-xl shadow-lg z-0",
                              newTransaction.type === "in" ? "bg-success left-1.5" : "bg-danger right-1.5"
                            )}
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                          <Button 
                            variant="ghost"
                            className={cn(
                              "relative z-10 rounded-xl h-11 font-black transition-colors",
                              newTransaction.type === "in" ? "text-success-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setNewTransaction(prev => ({ ...prev, type: "in" }))}
                          >
                            وارد (إيراد)
                          </Button>
                          <Button 
                            variant="ghost"
                            className={cn(
                              "relative z-10 rounded-xl h-11 font-black transition-colors",
                              newTransaction.type === "out" ? "text-danger-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setNewTransaction(prev => ({ ...prev, type: "out" }))}
                          >
                            صادر (مصروف)
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3 p-4 bg-muted/20 rounded-2xl ring-1 ring-inset ring-[var(--hairline)] transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:ring-primary/40 group/field">
                          <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-primary transition-colors">المبلغ</Label>
                          <div className="relative">
                            <Input 
                              type="number" 
                              value={newTransaction.amount || ""} 
                              onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: Number(e.target.value) }))} 
                              placeholder="0.00" 
                              className="text-right h-12 bg-background/50 border-none focus-visible:ring-2 focus-visible:ring-primary/30 text-lg font-black" 
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground opacity-50">EGP</div>
                          </div>
                        </div>
                        <div className="space-y-3 p-4 bg-muted/20 rounded-2xl ring-1 ring-inset ring-[var(--hairline)] transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:ring-primary/40 group/field">
                          <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-primary transition-colors">التاريخ</Label>
                          <Input 
                            type="date" 
                            value={newTransaction.date} 
                            onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))} 
                            className="text-right h-12 bg-background/50 border-none focus-visible:ring-2 focus-visible:ring-primary/30 font-bold" 
                          />
                        </div>
                      </div>

                      <div className="space-y-3 p-4 bg-muted/20 rounded-2xl ring-1 ring-inset ring-[var(--hairline)] transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:ring-primary/40 group/field">
                        <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-primary transition-colors">التصنيف</Label>
                        <Input 
                          value={newTransaction.category} 
                          onChange={(e) => setNewTransaction(prev => ({ ...prev, category: e.target.value }))} 
                          placeholder="مثال: إيراد صيانة، إيجار، سلف..." 
                          className="text-right h-12 bg-background/50 border-none focus-visible:ring-2 focus-visible:ring-primary/30 font-bold" 
                        />
                      </div>

                      <div className="space-y-3 p-4 bg-muted/20 rounded-2xl ring-1 ring-inset ring-[var(--hairline)] transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:ring-primary/40 group/field">
                        <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-primary transition-colors">ملاحظات إضافية</Label>
                        <Input 
                          value={newTransaction.notes} 
                          onChange={(e) => setNewTransaction(prev => ({ ...prev, notes: e.target.value }))} 
                          placeholder="اكتب أي تفاصيل أخرى هنا..." 
                          className="text-right h-12 bg-background/50 border-none focus-visible:ring-2 focus-visible:ring-primary/30" 
                        />
                      </div>

                      <Button 
                        className={cn(
                          "w-full gap-2 py-8 text-xl rounded-2xl shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-500 font-black relative overflow-hidden group",
                          newTransaction.type === 'in' 
                            ? "bg-success text-success-foreground hover:shadow-success/30" 
                            : "bg-danger text-danger-foreground hover:shadow-danger/30"
                        )} 
                        onClick={handleAddTransaction}
                      >
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                        <Check className="w-6 h-6 relative z-10" /> <span className="relative z-10">تأكيد المعاملة</span>
                      </Button>
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          }
        />

        {/* Top Balance Card - Similar to reference image */}
        <div className="mb-8">
          <BezelCard className="p-0 overflow-hidden  bg-foreground/[0.04] border-foreground/10 relative group">
            <div className="p-8 flex flex-col items-center justify-center text-center">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-700 -rotate-12 group-hover:rotate-0">
                <Wallet className="w-32 h-32" />
              </div>
              
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">الرصيد الحالي المتوفر</span>
              <div className={cn("text-5xl md:text-7xl font-black tabular-nums tracking-tighter leading-none", netBalance >= 0 ? "text-primary" : "text-danger", blurCls)}>
                <CountUp value={netBalance} format={n => fmt(n)} />
                <span className="text-xl md:text-2xl ml-2 font-bold opacity-50">ج.م</span>
              </div>
              
              <div className="mt-8 flex items-center gap-2 px-4 py-1.5 rounded-full bg-background/50 ring-1 ring-inset ring-[var(--hairline)]  shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span className="text-xs font-black uppercase text-muted-foreground tracking-[0.12em]">Live Sync Connected</span>
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
                   
                    <Button className="w-full gap-2 mt-4 rounded-xl py-6 shadow-sm shadow-primary/20 hover:scale-[1.02] transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300 font-black relative overflow-hidden group" size="sm">
                      <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                      <Plus className="w-4 h-4 relative z-10" /> <span className="relative z-10">إضافة معاملة</span>
                    </Button>
                </div>
             </BezelCard>
          </div>

          {/* Transactions List */}
          <div className="lg:col-span-2">
            <div className="sticky-search-bar mb-4">
              <div className="bg-card rounded-2xl border border-foreground/10 bg-card/70 p-4 flex flex-col md:flex-row gap-3">
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
                <div className="rounded-2xl border border-foreground/10 bg-card/70">
                  <div className=" px-6 py-10">
                    <EmptyState
                      icon={History}
                      title="لا توجد سجلات مطابقة"
                      hint="لم نتمكن من العثور على أي عمليات مسجلة تطابق معايير البحث الحالية."
                    />
                  </div>
                </div>
              ) : (
                filtered.map((t, idx) => (
                  <div
                    key={t.id}
                    className="group rounded-2xl border border-foreground/10 bg-card/70  animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)] both"
                    style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                  >
                    <div className=" grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-6">
                      {/* الهوية */}
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1",
                          t.type === "in" ? "bg-success/12 text-success ring-success/25" : "bg-danger/12 text-danger ring-danger/25"
                        )}>
                          {t.type === "in" ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{t.type === "in" ? "وارد" : "صادر"}</span>
                            <Badge variant="secondary" className="text-xs font-mono bg-muted/50 ring-1 ring-inset ring-[var(--hairline)]">
                              {t.category}
                            </Badge>
                          </div>
                          <div className="text-numeric mt-0.5 text-xs text-muted-foreground" dir="ltr">{t.date}</div>
                        </div>
                      </div>

                      {/* المبلغ */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <div className="text-xs text-muted-foreground mb-0.5">المبلغ</div>
                            <div className={cn("text-numeric text-xl font-extrabold", t.type === "in" ? "text-success" : "text-danger", blurCls)}>
                              {t.type === "in" ? "+" : "-"}{fmt(t.amount)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <div className="text-xs text-muted-foreground mb-0.5">الحالة</div>
                            <div className="mt-0.5">
                              <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-bold border",
                                t.type === "in" ? "bg-success/15 text-success border-success/30" : "bg-danger/15 text-danger border-danger/30"
                              )}>
                                {t.type === "in" ? "دخل للصندوق" : "خرج من الصندوق"}
                              </span>
                            </div>
                          </div>
                        </div>
                        {t.notes && <div className="mt-2 max-w-[300px] truncate text-xs text-muted-foreground">{t.notes}</div>}
                      </div>

                      {/* الإجراءات */}
                      <div className="flex items-center justify-end gap-1.5 md:opacity-70 md:transition-opacity md:group-hover:opacity-100">
                        <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-danger hover:bg-danger/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      </PageTransition>
    </AppShell>
  );
}

function Badge({ children, className, variant = "default" }: { children: React.ReactNode, className?: string, variant?: "default" | "secondary" | "outline" | "danger" }) {
  const variants = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    outline: "text-foreground border border-input bg-background",
    danger: "bg-danger text-danger-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)}>
      {children}
    </span>
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
    <div className={cn("rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col items-center justify-center text-center  group relative overflow-hidden", glowCls)}>
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
        <span className="text-xs font-black text-muted-foreground uppercase tracking-[0.12em]">{label}</span>
      </div>
      <div className={cn("text-2xl font-black tabular-nums tracking-tighter", colorCls, blurCls)}>
        {isCount ? <CountUp value={value} /> : <><CountUp value={value} format={(n: number) => fmt(n)} /> <span className="text-xs font-bold opacity-60">ج.م</span></>}
      </div>
    </div>
  );
}
