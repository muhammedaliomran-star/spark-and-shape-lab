import { useState } from "react";
import { Plus, X, ShoppingBag, UserPlus, Wallet, Receipt, ShoppingCart } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, useDB } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExpenseFormDialog } from "@/pages/Expenses";
import { NewPurchaseDialog } from "@/pages/Suppliers";

type Mode = null | "sale" | "customer" | "payment" | "expense" | "purchase";

export function QuickActionsFab() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const { customers, invoices } = useDB();

  const close = () => { setMode(null); setOpen(false); };

  return (
    <>
      {/* FAB */}
      <div className="fixed bottom-20 md:bottom-8 left-6 z-40 flex flex-col-reverse items-start gap-3">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="إجراء سريع"
          className={cn(
            "w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/40 grid place-items-center transition-[transform,box-shadow] duration-300 hover:scale-110 animate-fab-spring",
            open && "rotate-45"
          )}
        >
          {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
        {open && (
          <>
            <FabItem label="بيع سريع" icon={<ShoppingBag className="w-5 h-5" />} onClick={() => setMode("sale")} delay={0} />
            <FabItem label="إضافة عميل" icon={<UserPlus className="w-5 h-5" />} onClick={() => setMode("customer")} delay={60} />
            <FabItem label="تسجيل دفعة" icon={<Wallet className="w-5 h-5" />} onClick={() => setMode("payment")} delay={120} />
            <FabItem label="إضافة مصروف" icon={<Receipt className="w-5 h-5" />} onClick={() => setMode("expense")} delay={180} />
          </>
        )}
      </div>

      <Dialog open={mode !== null && mode !== "expense"} onOpenChange={(v) => !v && close()}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">
              {mode === "sale" && "بيع سريع"}
              {mode === "customer" && "إضافة عميل جديد"}
              {mode === "payment" && "تسجيل دفعة"}
            </DialogTitle>
          </DialogHeader>
          {mode === "sale" && <QuickSaleForm customers={customers} onDone={close} />}
          {mode === "customer" && <QuickCustomerForm onDone={close} />}
          {mode === "payment" && <QuickPaymentForm customers={customers} invoices={invoices} onDone={close} />}
        </DialogContent>
      </Dialog>

      <ExpenseFormDialog
        open={mode === "expense"}
        onOpenChange={(v) => { if (!v) close(); }}
        editing={null}
      />
    </>
  );
}

function FabItem({ label, icon, onClick, delay }: { label: string; icon: React.ReactNode; onClick: () => void; delay: number }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-full bg-card border border-primary/30 text-foreground shadow-lg hover:border-primary hover:bg-primary/10 transition-[background-color,border-color,transform] animate-[slide-up_0.25s_ease-out_both]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="w-8 h-8 rounded-full bg-primary/15 text-primary grid place-items-center">{icon}</span>
      <span className="text-sm font-bold pr-1">{label}</span>
    </button>
  );
}

function TypeToggle({ value, onChange }: { value: "installment" | "cash"; onChange: (v: "installment" | "cash") => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-foreground/[0.04] p-1.5">
      {([
        { key: "installment" as const, label: "قسط", hint: "دفعات شهرية" },
        { key: "cash" as const, label: "فوري (نقدي)", hint: "سداد كامل" },
      ]).map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          aria-pressed={value === opt.key}
          className={cn(
            "rounded-[1.1rem] px-3 py-2 text-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
            value === opt.key
              ? "bg-primary/15 text-primary ring-1 ring-primary/40"
              : "text-muted-foreground hover:bg-foreground/[0.04]",
          )}
        >
          <span className="block text-sm font-extrabold">{opt.label}</span>
          <span className="mt-0.5 block text-[11px] opacity-70">{opt.hint}</span>
        </button>
      ))}
    </div>
  );
}

function QuickCustomerForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [opening, setOpening] = useState("0");
  const [customerType, setCustomerType] = useState<"installment" | "cash">("installment");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error("اكتب اسم العميل");
    setBusy(true);
    try {
      await db.addCustomer({
        name: name.trim(), phone: phone.trim(), rating: 3, status: "neutral",
        customerType,
        notes: null, frozen: false, address: null,
        joiningDate: new Date().toISOString().slice(0, 10),
        creditLimit: 0, dueDay: 1, openingBalance: Number(opening) || 0,
      });
      toast.success("تمت إضافة العميل");
      onDone();
    } catch (e: any) { toast.error(e.message || "خطأ"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div><Label>نوع العميل</Label><TypeToggle value={customerType} onChange={setCustomerType} /></div>
      <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><Label>رقم الهاتف</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" /></div>
      <div><Label>رصيد افتتاحي (اختياري)</Label><Input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} /></div>
      <Button onClick={submit} disabled={busy} className="w-full">حفظ</Button>
    </div>
  );
}

function QuickSaleForm({ customers, onDone }: { customers: any[]; onDone: () => void }) {
  const [customerId, setCustomerId] = useState("");
  const [saleType, setSaleType] = useState<"installment" | "cash">("installment");
  const [total, setTotal] = useState("");
  const [down, setDown] = useState("0");
  const [installment, setInstallment] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const customer = customers.find((c) => c.id === customerId);
  const isCash = saleType === "cash";

  const submit = async () => {
    if (!customerId) return toast.error("اختر عميل");
    const t = Number(total);
    const d = isCash ? t : (Number(down) || 0);
    const m = isCash ? 0 : (Number(installment) || 0);
    if (!t || t <= 0) return toast.error("أدخل إجمالي الفاتورة");
    if (!isCash && customer?.customerType === "cash") {
      return toast.error("العميل مسجّل «فوري (نقدي)» — لا يسمح بالتقسيط");
    }
    if (!isCash && !m) return toast.error("أدخل القسط الشهري");
    setBusy(true);
    try {
      const due = new Date(); due.setMonth(due.getMonth() + 1);
      await db.addInvoice({
        customerId, total: t, downPayment: d, monthlyInstallment: m,
        firstDueDate: isCash ? new Date().toISOString().slice(0, 10) : due.toISOString().slice(0, 10),
        notes: notes || null, paid: d,
      });
      toast.success(isCash ? "تم إنشاء فاتورة بيع نقدي ✓ مسددة" : "تم إنشاء الفاتورة");
      onDone();
    } catch (e: any) { toast.error(e.message || "خطأ"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>العميل</Label>
        <Select
          value={customerId}
          onValueChange={(v) => {
            setCustomerId(v);
            const c = customers.find((x) => x.id === v);
            setSaleType(c?.customerType === "cash" ? "cash" : "installment");
          }}
        >
          <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} — {c.customerType === "cash" ? "فوري" : "قسط"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>نوع البيع</Label>
        <TypeToggle
          value={saleType}
          onChange={(v) => {
            if (v === "installment" && customer?.customerType === "cash") {
              toast.error("هذا عميل فوري (نقدي) — غيّر نوعه من صفحة العملاء أولًا");
              return;
            }
            setSaleType(v);
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>إجمالي</Label><Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} /></div>
        {!isCash && <div><Label>مقدم</Label><Input type="number" value={down} onChange={(e) => setDown(e.target.value)} /></div>}
      </div>
      {!isCash && <div><Label>القسط الشهري</Label><Input type="number" value={installment} onChange={(e) => setInstallment(e.target.value)} /></div>}
      <div><Label>ملاحظات</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <Button onClick={submit} disabled={busy} className="w-full">حفظ الفاتورة</Button>

    </div>
  );
}

function QuickPaymentForm({ customers, invoices, onDone }: { customers: any[]; invoices: any[]; onDone: () => void }) {
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const customerInvoices = invoices.filter((i) => i.customerId === customerId && i.total > i.paid);

  const submit = async () => {
    if (!invoiceId) return toast.error("اختر فاتورة");
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("أدخل المبلغ");
    setBusy(true);
    try {
      await db.recordPayment(invoiceId, n);
      toast.success("تم تسجيل الدفعة");
      onDone();
    } catch (e: any) { toast.error(e.message || "خطأ"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>العميل</Label>
        <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setInvoiceId(""); }}>
          <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
          <SelectContent>
            {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {customerId && (
        <div>
          <Label>الفاتورة</Label>
          <Select value={invoiceId} onValueChange={setInvoiceId}>
            <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
            <SelectContent>
              {customerInvoices.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">لا توجد فواتير مفتوحة</div>}
              {customerInvoices.map((i) => (
                <SelectItem key={i.id} value={i.id}>متبقي {Math.round(i.total - i.paid)} ج.م</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <Button onClick={submit} disabled={busy} className="w-full">تسجيل الدفعة</Button>
    </div>
  );
}