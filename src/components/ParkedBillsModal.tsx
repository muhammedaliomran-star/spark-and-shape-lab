import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PauseCircle, Play, Trash2, Clock, ShoppingCart, User } from "lucide-react";
import { useParkedBills, type ParkedBill } from "@/lib/pos";
import { fmt, useShopSettings } from "@/lib/store";
import { toast } from "sonner";

interface ParkedBillsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResume?: (bill: ParkedBill) => void;
  onSelectBill?: (bill: ParkedBill) => void;
}

export function ParkedBillsModal({ open, onOpenChange, onResume, onSelectBill }: ParkedBillsModalProps) {
  const { bills, removeBill } = useParkedBills();
  const { settings: shop } = useShopSettings();

  const handleResume = (bill: ParkedBill) => {
    removeBill(bill.id);
    (onResume ?? onSelectBill)?.(bill);
    onOpenChange(false);
    toast.success(`تم استرجاع الفاتورة المعلقة رقم #${bill.parkNumber}`);
  };

  const handleDelete = (id: string, num: number) => {
    removeBill(id);
    toast.info(`تم حذف الفاتورة المعلقة #${num}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto text-right">
        <DialogHeader>
          <div className="flex items-center justify-between pb-2 border-b">
            <Badge variant="outline" className="font-mono">
              {bills.length} فاتورة معلقة
            </Badge>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              الفواتير المعلقة (Parked Bills)
              <PauseCircle className="w-5 h-5 text-amber-500" />
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            يمكنك استرجاع أي فاتورة تم تعليقها للعميل لمتابعة محاسبته فوراً.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {bills.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mx-auto opacity-30" />
              <div className="text-xs">لا توجد أي فواتير معلقة حالياً.</div>
            </div>
          ) : (
            bills.map((bill) => (
              <div
                key={bill.id}
                className="p-3.5 rounded-2xl border bg-card/70 hover:border-primary/40 transition flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-danger hover:bg-danger/10 hover:text-danger"
                      onClick={() => handleDelete(bill.id, bill.parkNumber)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-primary font-bold text-xs"
                      onClick={() => handleResume(bill)}
                    >
                      <Play className="w-3.5 h-3.5" />
                      استرجاع الفاتورة
                    </Button>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="font-bold text-sm">
                        {bill.customerName || "عميل كاش"}
                      </span>
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 border-amber-500/30">
                        معلقة #{bill.parkNumber}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end mt-0.5" dir="ltr">
                      <span>{new Date(bill.parkedAt).toLocaleTimeString("ar-EG")}</span>
                      <Clock className="w-3 h-3" />
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-muted/40 text-xs flex items-center justify-between">
                  <span className="font-bold font-mono text-primary text-sm">
                    {fmt(bill.total ?? bill.totalAmount ?? 0)} {shop.currency}
                  </span>
                  <span className="text-muted-foreground">
                    {bill.products.length} صنف (
                    {bill.products.map((p) => `${p.name} × ${p.quantity}`).slice(0, 2).join("، ")}
                    {bill.products.length > 2 ? "..." : ""})
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
