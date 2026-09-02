import { useState, useMemo, useRef } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { db, useDB, type Expense } from "@/lib/store";
import {
  getAllExpenseCategories,
  getExpenseMeta,
  encodeExpenseNotes,
  saveExpenseMetaLocal,
  ExpenseMeta,
  getCategoryInfo,
  issueVoucherNumber,
  linkVoucherToExpense,
  COST_CENTERS,
} from "@/lib/expenses-system";
import {
  getTreasuryAccounts,
  TreasuryAccount,
  calculateAccountBalance,
  getManualTransactions,
  getInternalTransfers,
} from "@/lib/cashbox-system";
import { fmt } from "@/lib/store";
import {
  Receipt,
  Wallet,
  Building2,
  Calendar,
  Upload,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Loader2,
  FileCheck,
  User,
  AlertTriangle,
  Target,
} from "lucide-react";

interface ExpenseFormModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Expense | null;
  onSaved?: () => void;
  defaultCategory?: string;
  defaultAccountId?: string;
  defaultBranchId?: string;
}

export function ExpenseFormModal({
  open,
  onOpenChange,
  editing,
  onSaved,
  defaultCategory,
  defaultAccountId,
  defaultBranchId,
}: ExpenseFormModalProps) {
  const { branches, invoices, payments, expenses } = useDB();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [accountId, setAccountId] = useState("acc-cash-main");
  const [branchId, setBranchId] = useState("all");
  const [costCenter, setCostCenter] = useState("none");
  const [recipientName, setRecipientName] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => getAllExpenseCategories(), [open]);
  const treasuryAccounts = useMemo(() => getTreasuryAccounts().filter((a) => a.active), [open]);

  // رصيد الخزينة المختارة الحالي (للتحقق من كفاية الرصيد قبل الصرف)
  const accountBalance = useMemo(() => {
    const acc = treasuryAccounts.find((a) => a.id === accountId);
    if (!acc) return null;
    const otherExpenses = editing ? expenses.filter((e) => e.id !== editing.id) : expenses;
    return calculateAccountBalance(acc, invoices, payments, otherExpenses, getManualTransactions(), getInternalTransfers()).currentBalance;
  }, [accountId, treasuryAccounts, invoices, payments, expenses, editing]);
  const numericAmount = Number(amount) || 0;
  const insufficient = accountBalance !== null && numericAmount > 0 && numericAmount > accountBalance;

  // Initialize data on open
  useMemo(() => {
    if (open) {
      if (editing) {
        const meta = getExpenseMeta(editing);
        setAmount(String(editing.amount));
        setCategory(editing.category || "other");
        setAccountId(meta.accountId || "acc-cash-main");
        setBranchId(meta.branchId || "all");
        setCostCenter(meta.costCenter || "none");
        setRecipientName(meta.recipientName || "");
        setExpenseDate(editing.expenseDate || new Date().toISOString().slice(0, 10));
        
        // Clean notes from metadata tags
        const clean = (editing.notes || "").replace(/<!--seg_meta:.*?-->/gs, "").trim();
        setNotes(clean);
        setReceiptUrl(meta.receiptUrl || null);
        setReceiptName(meta.receiptName || "");
      } else {
        setAmount("");
        setCategory(defaultCategory || "other");
        setAccountId(defaultAccountId || "acc-cash-main");
        setBranchId(defaultBranchId || "all");
        setCostCenter("none");
        setRecipientName("");
        setExpenseDate(new Date().toISOString().slice(0, 10));
        setNotes("");
        setReceiptUrl(null);
        setReceiptName("");
      }
    }
  }, [open, editing, defaultCategory, defaultAccountId, defaultBranchId]);

  // Handle File Upload (Compress Image if large)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الملف يجب ألا يتجاوز 5 ميجابايت");
      return;
    }

    setReceiptName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (file.type.startsWith("image/")) {
        // Compress image using canvas
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL("image/jpeg", 0.75);
            setReceiptUrl(compressed);
            toast.success("تم إرفاق صورة الإيصال بنجاح");
          } else {
            setReceiptUrl(result);
          }
        };
        img.src = result;
      } else {
        setReceiptUrl(result);
        toast.success("تم إرفاق المستند بنجاح");
      }
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setReceiptUrl(null);
    setReceiptName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح أكبر من الصفر");
      return;
    }

    const selectedAcc = treasuryAccounts.find((a) => a.id === accountId);
    if (!selectedAcc) {
      toast.error("يرجى اختيار خزينة / قناة دفع صالحة للخصم");
      return;
    }
    if (insufficient) {
      const proceed = confirm(
        `رصيد "${selectedAcc.name}" الحالي ${fmt(accountBalance || 0)} ج.م وهو أقل من المبلغ المطلوب (${fmt(numericAmount)} ج.م).\nهل تريد المتابعة وتسجيل الخزينة بالسالب؟`
      );
      if (!proceed) return;
    }
    const selectedBranch = branches.find((b) => b.id === branchId);

    // رقم سند متسلسل رسمي (يُصدر مرة واحدة فقط عند الإنشاء)
    const voucherNumber = editing
      ? getExpenseMeta(editing).voucherNumber
      : issueVoucherNumber({ amount: numAmount, recipientName: recipientName.trim() || undefined, accountId }).number;

    const meta: ExpenseMeta = {
      accountId,
      accountName: selectedAcc.name,
      branchId: branchId === "all" ? undefined : branchId,
      branchName: branchId === "all" ? "كل الفروع" : selectedBranch?.name,
      costCenter: costCenter === "none" ? undefined : costCenter,
      recipientName: recipientName.trim() || undefined,
      receiptUrl: receiptUrl || undefined,
      receiptName: receiptName || undefined,
      voucherNumber,
    };

    const finalNotes = encodeExpenseNotes(notes, meta);

    setBusy(true);
    try {
      if (editing) {
        await db.updateExpense(editing.id, {
          amount: numAmount,
          category: category as any,
          expenseDate,
          notes: finalNotes,
        });
        saveExpenseMetaLocal(editing.id, meta);
        toast.success("تم تعديل المصروف وتحديث الخزينة");
      } else {
        const newExpenseId = await db.addExpense({
          amount: numAmount,
          category: category as any,
          expenseDate,
          notes: finalNotes,
        });
        if (newExpenseId) {
          saveExpenseMetaLocal(newExpenseId, meta);
          if (voucherNumber) linkVoucherToExpense(voucherNumber, newExpenseId);
        }
        toast.success("تم تسجيل المصروف وخصمه من الخزينة المحددة");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ المصروف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            {editing ? "تعديل المصروف" : "تسجيل مصروف جديد"}
          </DialogTitle>
          <DialogDescription className="text-right text-xs">
            يتم خصم المصروف تلقائياً من الخزينة أو المحفظة المحددة وحسابه في تقارير الأرباح.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* المبلغ والتصنيف */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold text-foreground">
                المبلغ المنصرف (ج.م) <span className="text-danger">*</span>
              </Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="font-bold text-lg text-danger pr-3"
                  autoFocus={!editing}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                  ج.م
                </span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground">
                بند وتصنيف المصروف <span className="text-danger">*</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="اختر التصنيف" />
                </SelectTrigger>
                <SelectContent dir="rtl" className="max-h-60">
                  {categories.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      <div className="flex items-center gap-2">
                        <span>{c.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* الخزينة المسحوب منها والفرع */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-primary" />
                الخزينة / قناة الدفع (للخصم الفوري)
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="اختر الخزينة" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {treasuryAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{acc.name}</span>
                        {acc.isDefault && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">الافتراضي</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accountBalance !== null && (
                <p
                  className={cn(
                    "mt-1 text-[11px] font-semibold flex items-center gap-1",
                    insufficient ? "text-danger" : "text-muted-foreground"
                  )}
                >
                  {insufficient && <AlertTriangle className="w-3 h-3" />}
                  الرصيد المتاح: <span className="tabular-nums">{fmt(accountBalance)}</span> ج.م
                  {insufficient && " — لا يكفي لهذا المبلغ"}
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                الفرع / مركز التكلفة
              </Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">الفرع الرئيسي / عام</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* مركز التكلفة */}
          <div>
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-muted-foreground" />
              مركز التكلفة (اختياري)
            </Label>
            <Select value={costCenter} onValueChange={setCostCenter}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="اختر مركز التكلفة" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="none">بدون مركز تكلفة</SelectItem>
                {COST_CENTERS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* المستفيد والتاريخ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                يُصرف إلى (اسم المستلم / المستفيد)
              </Label>
              <Input
                placeholder="مثال: شركة الكهرباء، العامل أحمد..."
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value.slice(0, 100))}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                تاريخ الصرف
              </Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* ملاحظات وبيان الصرف */}
          <div>
            <Label className="text-xs font-bold text-foreground">بيان الصرف / ملاحظات تفصيلية</Label>
            <Textarea
              placeholder="اكتب سبب الصرف، تفاصيل الفاتورة، أو أي ملاحظات هامة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              rows={2}
              className="mt-1"
            />
          </div>

          {/* إرفاق صورة الفاتورة أو الإيصال */}
          <div className="p-3.5 rounded-xl border border-dashed border-border bg-card/50">
            <Label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-primary" />
                إرفاق صورة الفاتورة / إيصال الدفع (اختياري)
              </span>
              {receiptUrl && (
                <button
                  type="button"
                  onClick={removeAttachment}
                  className="text-xs text-danger hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> حذف المرفق
                </button>
              )}
            </Label>

            {receiptUrl ? (
              <div className="mt-2.5 flex items-center gap-3 p-2 bg-muted/40 rounded-lg border">
                <img
                  src={receiptUrl}
                  alt="معاينة"
                  className="w-12 h-12 object-cover rounded-md border"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {receiptName || "مرفق الفاتورة"}
                  </p>
                  <p className="text-[11px] text-emerald-600 font-medium">تم إرفاق المستند بنجاح ✓</p>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="expense-receipt-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 w-full text-xs"
                >
                  <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                  اختر صورة من الجهاز أو قم بالتصوير
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-3 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? "حفظ التعديلات" : "تسجيل وصرف المصروف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
