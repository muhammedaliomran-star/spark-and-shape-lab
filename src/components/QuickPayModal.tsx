import { useState, useMemo } from "react";
import { useDB, db, fmt, customerBalance } from "@/lib/store";
import { enqueueOfflinePayment } from "@/lib/offline-sync";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2, User, Receipt, Banknote, Search } from "lucide-react";
import { toast } from "sonner";

interface QuickPayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCustomerId?: string;
}

export function QuickPayModal({ open, onOpenChange, defaultCustomerId }: QuickPayModalProps) {
  const { customers, invoices } = useDB();
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(defaultCustomerId || "");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === (selectedCustomerId || defaultCustomerId));
  }, [customers, selectedCustomerId, defaultCustomerId]);

  const customerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return invoices.filter(
      (inv) => inv.customerId === selectedCustomer.id && inv.status !== "cancelled" && (inv.paid || 0) < inv.total
    );
  }, [invoices, selectedCustomer]);

  const activeInvoice = customerInvoices[0]; // الفاتورة الأقدم المستحقة أولاً

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers.slice(0, 5);
    const q = search.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    ).slice(0, 5);
  }, [customers, search]);

  const totalBalance = useMemo(() => {
    if (!selectedCustomer) return 0;
    return customerBalance(invoices, selectedCustomer.id, selectedCustomer.openingBalance);
  }, [invoices, selectedCustomer]);

  const handlePay = async (amountToPay: number) => {
    if (!activeInvoice) {
      toast.error("لا توجد فواتير مفتوحة لهذا العميل");
      return;
    }
    if (amountToPay <= 0) {
      toast.error("أدخل مبلغ صحيح");
      return;
    }

    setIsProcessing(true);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        // تسجيل أوفلاين
        enqueueOfflinePayment({
          invoiceId: activeInvoice.id,
          amount: amountToPay,
          customerName: selectedCustomer?.name,
        });
        toast.success(`تم حفظ الدفعة (${fmt(amountToPay)} ج.م) محلياً — سيتم المزامنة عند عودة النت ✓`);
      } else {
        await db.recordPayment(activeInvoice.id, amountToPay);
        toast.success(`تم تحصيل ${fmt(amountToPay)} ج.م بنجاح ✓`);
      }
      onOpenChange(false);
      setCustomAmount("");
      setSelectedCustomerId("");
    } catch (e: any) {
      toast.error(e?.message || "تعذر تسجيل الدفعة");
    } finally {
      setIsProcessing(false);
    }
  };

  const installmentAmount = activeInvoice?.monthlyInstallment || 0;
  const remainingInvoice = activeInvoice ? activeInvoice.total - activeInvoice.paid : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-5 rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-primary">
            <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
            تحصيل سريع بلمسة واحدة
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ابحث عن العميل وحصّل القسط فوراً في ثانية واحدة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* اختيار العميل */}
          {!selectedCustomer ? (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">ابحث عن العميل (الاسم أو الموبايل):</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="اكتب اسم العميل أو رقم الموبايل..."
                  className="pr-9 h-10"
                  autoFocus
                />
              </div>
              <div className="divide-y divide-border border rounded-lg overflow-hidden mt-2">
                {filteredCustomers.map((c) => {
                  const debt = customerBalance(invoices, c.id, c.openingBalance);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="w-full text-right p-2.5 flex items-center justify-between hover:bg-muted/60 transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-sm">{c.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.phone}</div>
                      </div>
                      <div className="text-left">
                        <Badge variant={debt > 0 ? "destructive" : "outline"} className="text-xs">
                          {debt > 0 ? `${fmt(debt)} ج.م متبقي` : "خالص"}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* بطاقة ملخص العميل */}
              <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="font-bold text-sm">{selectedCustomer.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{selectedCustomer.phone}</span>
                </div>
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">إجمالي المديونية</div>
                  <div className="text-base font-bold text-destructive font-mono">{fmt(totalBalance)} ج.م</div>
                </div>
              </div>

              {activeInvoice ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" />
                    <span>فاتورة جارية: متبقي منها {fmt(remainingInvoice)} ج.م</span>
                  </div>

                  {/* أزرار التحصيل السريع */}
                  <div className="grid grid-cols-1 gap-2">
                    {installmentAmount > 0 && installmentAmount <= remainingInvoice && (
                      <Button
                        type="button"
                        onClick={() => handlePay(installmentAmount)}
                        disabled={isProcessing}
                        className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-md shadow-primary/20"
                      >
                        <Zap className="w-4 h-4 fill-current" />
                        سداد قسط هذا الشهر ({fmt(installmentAmount)} ج.م) بلمسة واحدة
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handlePay(remainingInvoice)}
                      disabled={isProcessing}
                      className="w-full h-10 text-xs font-semibold border-border hover:bg-muted"
                    >
                      سداد كامل المتبقي من الفاتورة ({fmt(remainingInvoice)} ج.م)
                    </Button>
                  </div>

                  {/* إدخال مبلغ مخصص */}
                  <div className="pt-2 border-t border-border/60">
                    <Label className="text-xs text-muted-foreground mb-1 block">أو أدخل مبلغ آخر:</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="المبلغ بالجنيه"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="h-9 font-mono"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!customAmount || Number(customAmount) <= 0 || isProcessing}
                        onClick={() => handlePay(Number(customAmount))}
                        className="h-9 px-4 text-xs font-bold"
                      >
                        تحصيل
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
                  لا توجد فواتير أو أقساط متبقية على هذا العميل!
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomerId("")}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                ← اختيار عميل آخر
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
