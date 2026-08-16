import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Banknote, Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, Calendar, User, Truck, Receipt, Trash2, Wallet } from "lucide-react";
import { useDB, PaymentVoucher } from "@/lib/store";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function PaymentsPage() {
  const { paymentVouchers, customers, suppliers, addPaymentVoucher, removePaymentVoucher, loading } = useDB();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "receipt" | "payment">("all");

  const filteredVouchers = useMemo(() => {
    return paymentVouchers.filter(v => {
      const customer = customers.find(c => c.id === v.customerId)?.name || "";
      const supplier = suppliers.find(s => s.id === v.supplierId)?.name || "";
      const matchesSearch = 
        customer.toLowerCase().includes(search.toLowerCase()) || 
        supplier.toLowerCase().includes(search.toLowerCase()) ||
        v.description?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || v.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [paymentVouchers, search, typeFilter, customers, suppliers]);

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
              className="rounded-full px-6 shadow-lg shadow-primary/20"
            >
              <Plus className="ml-2 h-4 w-4" />
              إضافة سند جديد
            </Button>
          } />

          {/* Metrics Grid */}
          <Reveal className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="plate p-6 flex flex-col gap-1 border-r-4 border-success">
              <span className="text-muted-foreground text-sm font-medium">إجمالي المقبوضات</span>
              <span className="text-3xl font-bold text-success" dir="ltr">{stats.receipts.toLocaleString()} <span className="text-sm">EGP</span></span>
            </div>
            <div className="plate p-6 flex flex-col gap-1 border-r-4 border-danger">
              <span className="text-muted-foreground text-sm font-medium">إجمالي المدفوعات</span>
              <span className="text-3xl font-bold text-danger" dir="ltr">{stats.payments.toLocaleString()} <span className="text-sm">EGP</span></span>
            </div>
            <div className="plate p-6 flex flex-col gap-1 border-r-4 border-primary">
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
            <div className="flex gap-2">
              <Button 
                variant={typeFilter === "all" ? "default" : "outline"} 
                onClick={() => setTypeFilter("all")}
                className="rounded-xl px-6 h-12"
              >
                الكل
              </Button>
              <Button 
                variant={typeFilter === "receipt" ? "default" : "outline"} 
                onClick={() => setTypeFilter("receipt")}
                className="rounded-xl px-6 h-12 gap-2"
              >
                <ArrowDownLeft className="h-4 w-4 text-success" />
                قبض
              </Button>
              <Button 
                variant={typeFilter === "payment" ? "default" : "outline"} 
                onClick={() => setTypeFilter("payment")}
                className="rounded-xl px-6 h-12 gap-2"
              >
                <ArrowUpRight className="h-4 w-4 text-danger" />
                صرف
              </Button>
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
                  <div className="plate bezel-lift group relative flex items-center gap-6 p-5">
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
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">المبلغ</span>
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
              <div className="py-20 text-center text-muted-foreground plate italic">
                {search || typeFilter !== "all" ? "لا توجد نتائج مطابقة للبحث" : "لا توجد سندات مسجلة حالياً"}
              </div>
            )}
          </div>
        </div>
      </PageTransition>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
          <div className="glass-header sticky top-0 z-10 border-b border-[var(--hairline)] px-8 py-6">
            <DialogTitle className="text-2xl font-bold">تسجيل سند جديد</DialogTitle>
          </div>
          <form onSubmit={handleSave} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-1 bg-muted rounded-2xl">
                <Button 
                  type="button" 
                  variant="ghost" 
                  className={cn("rounded-xl gap-2", typeFilter === "receipt" && "bg-background shadow-sm")}
                  onClick={() => setTypeFilter("receipt")}
                >
                  <ArrowDownLeft className="h-4 w-4 text-success" />
                  قبض
                </Button>
                <Button 
                  type="button" 
                  variant="ghost"
                  className={cn("rounded-xl gap-2", typeFilter === "payment" && "bg-background shadow-sm")}
                  onClick={() => setTypeFilter("payment")}
                >
                  <ArrowUpRight className="h-4 w-4 text-danger" />
                  صرف
                </Button>
                <input type="hidden" name="type" value={typeFilter === "all" ? "receipt" : typeFilter} />
              </div>

              <div className="space-y-2">
                <Label>{typeFilter === "payment" ? "المورد" : "العميل"}</Label>
                <Select name="partyId" required>
                  <SelectTrigger className="h-12 rounded-2xl pr-4">
                    <SelectValue placeholder={typeFilter === "payment" ? "اختر المورد..." : "اختر العميل..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {typeFilter === "payment" 
                      ? suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                      : customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">المبلغ</Label>
                  <Input id="amount" name="amount" type="number" required placeholder="0.00" className="h-12 rounded-2xl text-center text-lg font-bold" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voucherDate">تاريخ السند</Label>
                  <Input id="voucherDate" name="voucherDate" type="date" defaultValue={format(new Date(), "yyyy-MM-dd")} className="h-12 rounded-2xl" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>طريقة الدفع</Label>
                <Select name="paymentMethod" defaultValue="كاش">
                  <SelectTrigger className="h-12 rounded-2xl pr-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="كاش">نقدي (كاش)</SelectItem>
                    <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                    <SelectItem value="شيك">شيك بنكي</SelectItem>
                    <SelectItem value="فودافون كاش">فودافون كاش</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">ملاحظات / وصف</Label>
                <Input id="description" name="description" placeholder="اكتب تفاصيل إضافية هنا..." className="h-12 rounded-2xl" />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20">
              تسجيل السند
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
