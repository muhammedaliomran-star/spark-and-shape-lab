import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Banknote, Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, Calendar, User, Truck, Receipt, Trash2, Wallet } from "lucide-react";
import { useDB, PaymentVoucher } from "@/lib/store";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ar } from "date-fns/locale";


export default function PaymentsPage() {
  const { paymentVouchers, customers, suppliers, addPaymentVoucher, removePaymentVoucher, loading } = useDB();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "receipt" | "payment">("all");
  const [dateFilter, setDateFilter] = useState<{ from: string; to: string }>({
    from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    to: format(endOfMonth(new Date()), "yyyy-MM-dd")
  });


  const filteredVouchers = useMemo(() => {
    return paymentVouchers.filter(v => {
      const customer = customers.find(c => c.id === v.customerId)?.name || "";
      const supplier = suppliers.find(s => s.id === v.supplierId)?.name || "";
      const matchesSearch = 
        customer.toLowerCase().includes(search.toLowerCase()) || 
        supplier.toLowerCase().includes(search.toLowerCase()) ||
        v.description?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || v.type === typeFilter;
      
      const vDate = new Date(v.voucherDate);
      const matchesDate = isWithinInterval(vDate, {
        start: new Date(dateFilter.from),
        end: new Date(dateFilter.to)
      });

      return matchesSearch && matchesType && matchesDate;
    });
  }, [paymentVouchers, search, typeFilter, dateFilter, customers, suppliers]);


  const stats = useMemo(() => {
    const receipts = paymentVouchers.filter(v => v.type === "receipt").reduce((s, v) => s + v.amount, 0);
    const payments = paymentVouchers.filter(v => v.type === "payment").reduce((s, v) => s + v.amount, 0);
    return { receipts, payments, balance: receipts - payments };
  }, [paymentVouchers]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const partyId = formData.get("partyId") as string;
    const type = formData.get("type") as "receipt" | "payment";
    
    const data = {
      amount: Number(formData.get("amount")),
      type,
      paymentMethod: formData.get("paymentMethod") as string,
      description: formData.get("description") as string,
      voucherDate: formData.get("voucherDate") as string,
      customerId: type === "receipt" ? partyId : null,
      supplierId: type === "payment" ? partyId : null,
    };

    try {
      await addPaymentVoucher(data);
      toast.success("تم تسجيل السند بنجاح");
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("حدث خطأ أثناء التسجيل");
    }
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="flex flex-col gap-8">
          <PageHeader 
            title="الدفعات" 
            icon={<Banknote className="h-7 w-7" />} 
            subtitle="إدارة سندات القبض والصرف" 
            action={
            <Button 
              onClick={() => setIsDialogOpen(true)}
              className="rounded-full px-6 shadow-sm"
            >
              <Plus className="ml-2 h-4 w-4" />
              إضافة سند جديد
            </Button>
          } />

          {/* Metrics Grid */}
          <Reveal className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-6 flex flex-col gap-1 border-r-4 border-success">
              <span className="text-muted-foreground text-sm font-medium">إجمالي المقبوضات</span>
              <span className="text-3xl font-bold text-success" dir="ltr">{stats.receipts.toLocaleString()} <span className="text-sm">EGP</span></span>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-6 flex flex-col gap-1 border-r-4 border-danger">
              <span className="text-muted-foreground text-sm font-medium">إجمالي المدفوعات</span>
              <span className="text-3xl font-bold text-danger" dir="ltr">{stats.payments.toLocaleString()} <span className="text-sm">EGP</span></span>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-6 flex flex-col gap-1 border-r-4 border-primary">
              <span className="text-muted-foreground text-sm font-medium">صافي الحركة</span>
              <span className={cn("text-3xl font-bold", stats.balance >= 0 ? "text-success" : "text-danger")} dir="ltr">
                {stats.balance.toLocaleString()} <span className="text-sm">EGP</span>
              </span>
            </div>
          </Reveal>

          {/* Filters Bar */}
          <div className="sticky-search-bar flex flex-col md:flex-row gap-4 p-2">
            <div className="relative flex-1">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="ابحث عن عميل، مورد، أو وصف..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 pr-11 rounded-2xl bg-background/50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
              />
            </div>
            <div className="flex gap-2 items-center rounded-2xl border border-foreground/10 bg-background/50 p-1.5">
              <div className="flex items-center gap-2 px-3 border-l border-[var(--hairline)]">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-1">
                  <Input 
                    type="date" 
                    value={dateFilter.from} 
                    onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                    className="h-8 w-32 border-none bg-transparent p-0 text-xs font-bold"
                  />
                  <span className="text-[10px] font-bold text-muted-foreground">إلى</span>
                  <Input 
                    type="date" 
                    value={dateFilter.to} 
                    onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                    className="h-8 w-32 border-none bg-transparent p-0 text-xs font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant={typeFilter === "all" ? "default" : "ghost"} 
                  onClick={() => setTypeFilter("all")}
                  className="rounded-xl px-4 h-9 text-xs font-bold"
                >
                  الكل
                </Button>
                <Button 
                  variant={typeFilter === "receipt" ? "default" : "ghost"} 
                  onClick={() => setTypeFilter("receipt")}
                  className="rounded-xl px-4 h-9 gap-2 text-xs font-bold"
                >
                  <ArrowDownLeft className="h-3 w-3 text-success" />
                  قبض
                </Button>
                <Button 
                  variant={typeFilter === "payment" ? "default" : "ghost"} 
                  onClick={() => setTypeFilter("payment")}
                  className="rounded-xl px-4 h-9 gap-2 text-xs font-bold"
                >
                  <ArrowUpRight className="h-3 w-3 text-danger" />
                  صرف
                </Button>
              </div>
            </div>
          </div>


          {/* Vouchers List */}
          <div className="flex flex-col gap-3">
            {filteredVouchers.map((voucher, idx) => {
              const customer = customers.find(c => c.id === voucher.customerId);
              const supplier = suppliers.find(s => s.id === voucher.supplierId);
              const partyName = customer?.name || supplier?.name || "جهة غير محددة";
              
              return (
                <Reveal key={voucher.id} delay={idx * 0.05}>
                  <div className="group relative flex items-center gap-6 rounded-2xl border border-foreground/10 bg-card/70 p-5">
                    {/* Status Stripe */}
                    <div className={cn(
                      "absolute right-0 top-0 bottom-0 w-1.5 rounded-r-full",
                      voucher.type === "receipt" ? "bg-success" : "bg-danger"
                    )} />
                    
                    {/* Identity Column */}
                    <div className="flex flex-1 items-center gap-4 min-w-0">
                      <div className={cn(
                        "h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center ring-1",
                        voucher.type === "receipt" ? "bg-success/10 ring-success/20 text-success" : "bg-danger/10 ring-danger/20 text-danger"
                      )}>
                        {voucher.type === "receipt" ? <ArrowDownLeft className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-lg truncate">{partyName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-bold text-muted-foreground uppercase">
                            {voucher.type === "receipt" ? "سند قبض" : "سند صرف"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(voucher.voucherDate), "dd MMMM yyyy", { locale: ar })}
                          </span>
                          <span className="flex items-center gap-1 truncate max-w-[200px]">
                            <Receipt className="h-3 w-3" />
                            {voucher.description || "بدون وصف"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Value Column */}
                    <div className="flex flex-col items-end gap-1 px-8 border-x border-[var(--hairline)]">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em]">المبلغ</span>
                      <span className={cn(
                        "text-2xl font-black tabular-nums",
                        voucher.type === "receipt" ? "text-success" : "text-danger"
                      )} dir="ltr">
                        {voucher.type === "receipt" ? "+" : "-"}{voucher.amount.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">{voucher.paymentMethod}</span>
                    </div>

                    {/* Actions Column */}
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          if (confirm("هل أنت متأكد من حذف هذا السند؟")) removePaymentVoucher(voucher.id);
                        }}
                        className="h-10 w-10 rounded-full text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Reveal>
              );
            })}

            {filteredVouchers.length === 0 && !loading && (
              <div className="py-20 text-center text-muted-foreground rounded-2xl border border-dashed border-foreground/10 bg-card/50 italic">
                {search || typeFilter !== "all" ? "لا توجد نتائج مطابقة للبحث" : "لا توجد سندات مسجلة حالياً"}
              </div>
            )}
          </div>
        </div>
      </PageTransition>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-8 py-6">
            <DialogTitle className="text-2xl font-bold">تسجيل سند جديد</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">قم بتسجيل عملية دفع أو تحصيل مالي جديدة</p>
          </div>
          <form onSubmit={handleSave} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-1 bg-muted rounded-2xl">
                <Button 
                  type="button" 
                  variant="ghost" 
                  className={cn("rounded-xl gap-2 h-11 transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300", typeFilter === "receipt" && "bg-background shadow-sm text-success")}
                  onClick={() => setTypeFilter("receipt")}
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  سند قبض
                </Button>
                <Button 
                  type="button" 
                  variant="ghost"
                  className={cn("rounded-xl gap-2 h-11 transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300", typeFilter === "payment" && "bg-background shadow-sm text-danger")}
                  onClick={() => setTypeFilter("payment")}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  سند صرف
                </Button>
                <input type="hidden" name="type" value={typeFilter === "all" ? "receipt" : typeFilter} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground pr-1">
                  {typeFilter === "payment" ? "جهة الصرف (المورد)" : "جهة القبض (العميل)"}
                </Label>
                <Select name="partyId" required>
                  <SelectTrigger className="h-12 rounded-2xl pr-4 bg-foreground/[0.02] border-foreground/5 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]">
                    <SelectValue placeholder={typeFilter === "payment" ? "اختر المورد..." : "اختر العميل..."} />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {typeFilter === "payment" 
                      ? suppliers.map(s => <SelectItem key={s.id} value={s.id} className="font-bold">{s.name}</SelectItem>)
                      : customers.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground pr-1">المبلغ</Label>
                  <div className="relative">
                    <Banknote className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                    <Input 
                      id="amount" 
                      name="amount" 
                      type="number" 
                      required 
                      placeholder="0.00" 
                      className="h-12 rounded-2xl text-center text-xl font-black bg-foreground/[0.02] border-foreground/5 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity] pr-11" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground pr-1">تاريخ السند</Label>
                  <div className="relative">
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="voucherDate" 
                      name="voucherDate" 
                      type="date" 
                      defaultValue={format(new Date(), "yyyy-MM-dd")} 
                      className="h-12 rounded-2xl bg-foreground/[0.02] border-foreground/5 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity] pr-11 text-xs font-bold" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground pr-1">طريقة الدفع</Label>
                <Select name="paymentMethod" defaultValue="كاش">
                  <SelectTrigger className="h-12 rounded-2xl pr-4 bg-foreground/[0.02] border-foreground/5 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-foreground" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="كاش" className="font-bold">نقدي (كاش)</SelectItem>
                    <SelectItem value="تحويل بنكي" className="font-bold">تحويل بنكي</SelectItem>
                    <SelectItem value="شيك" className="font-bold">شيك بنكي</SelectItem>
                    <SelectItem value="فودافون كاش" className="font-bold">فودافون كاش</SelectItem>
                    <SelectItem value="أخرى" className="font-bold">وسيلة أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground pr-1">ملاحظات / وصف</Label>
                <div className="relative">
                  <Receipt className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="description" 
                    name="description" 
                    placeholder="اكتب تفاصيل إضافية هنا..." 
                    className="h-12 rounded-2xl bg-foreground/[0.02] border-foreground/5 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity] pr-11 text-sm" 
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 h-12 rounded-2xl font-black text-lg shadow-sm bg-primary text-black transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:scale-[1.02] active:scale-[0.98]">
                تسجيل السند
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="h-12 px-6 rounded-2xl border-foreground/10 hover:bg-foreground/5 transition-[background-color,border-color,color,box-shadow,transform,opacity]">
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}
