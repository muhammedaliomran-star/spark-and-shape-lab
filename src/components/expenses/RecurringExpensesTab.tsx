import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RecurringExpense,
  getRecurringExpenses,
  addRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  checkRecurringStatus,
  getCategoryInfo,
  getAllExpenseCategories,
  executeRecurringExpense,
} from "@/lib/expenses-system";
import { Switch } from "@/components/ui/switch";
import { getTreasuryAccounts } from "@/lib/cashbox-system";
import { db, fmt, useDB } from "@/lib/store";
import { toast } from "sonner";
import {
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Building2,
  Wallet,
  Play,
  Check,
  Calendar,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function RecurringExpensesTab() {
  const { branches } = useDB();
  const [items, setItems] = useState<RecurringExpense[]>(() => getRecurringExpenses());
  const [openModal, setOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringExpense | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Refresh items from store
  const refresh = () => {
    setItems(getRecurringExpenses());
  };

  const categories = useMemo(() => getAllExpenseCategories(), []);
  const accounts = useMemo(() => getTreasuryAccounts(), []);

  // Form states
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("rent");
  const [accountId, setAccountId] = useState("acc-cash-main");
  const [branchId, setBranchId] = useState("all");
  const [frequency, setFrequency] = useState<RecurringExpense["frequency"]>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);

  const onOpenAdd = () => {
    setEditingItem(null);
    setTitle("");
    setAmount("");
    setCategory("rent");
    setAccountId("acc-cash-main");
    setBranchId("all");
    setFrequency("monthly");
    setDayOfMonth("1");
    setRecipientName("");
    setNotes("");
    setActive(true);
    setAutoApprove(false);
    setOpenModal(true);
  };

  const onOpenEdit = (item: RecurringExpense) => {
    setEditingItem(item);
    setTitle(item.title);
    setAmount(String(item.amount));
    setCategory(item.category);
    setAccountId(item.accountId || "acc-cash-main");
    setBranchId(item.branchId || "all");
    setFrequency(item.frequency);
    setDayOfMonth(String(item.dayOfMonth || 1));
    setRecipientName(item.recipientName || "");
    setNotes(item.notes || "");
    setActive(item.active);
    setAutoApprove(!!item.autoApprove);
    setOpenModal(true);
  };

  const handleSave = () => {
    const num = Number(amount);
    if (!title.trim()) {
      toast.error("يرجى إدخال اسم البند الدوري");
      return;
    }
    if (!num || num <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }

    if (editingItem) {
      updateRecurringExpense(editingItem.id, {
        title: title.trim(),
        amount: num,
        category,
        accountId,
        branchId: branchId === "all" ? undefined : branchId,
        frequency,
        dayOfMonth: Number(dayOfMonth) || 1,
        recipientName: recipientName.trim() || undefined,
        notes: notes.trim() || undefined,
        active,
        autoApprove,
      });
      toast.success("تم تحديث المصروف الدوري");
    } else {
      addRecurringExpense({
        title: title.trim(),
        amount: num,
        category,
        accountId,
        branchId: branchId === "all" ? undefined : branchId,
        frequency,
        dayOfMonth: Number(dayOfMonth) || 1,
        startDate: new Date().toISOString().slice(0, 10),
        autoApprove,
        active,
        recipientName: recipientName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("تمت إضافة المصروف الدوري المجدول");
    }

    setOpenModal(false);
    refresh();
  };

  const handleDelete = (id: string) => {
    if (confirm("هل تريد بالتأكيد حذف هذا القالب الدوري؟")) {
      deleteRecurringExpense(id);
      toast.success("تم حذف المصروف الدوري");
      refresh();
    }
  };

  // Immediate Execution of Recurring Expense (سداد واعتماد فوري)
  const handleExecuteNow = async (item: RecurringExpense) => {
    setBusyId(item.id);
    try {
      const voucher = await executeRecurringExpense(item, {
        addExpense: (exp) => db.addExpense({ ...exp, category: exp.category as any }),
        branches,
      });
      toast.success(`تم صرف "${item.title}" بقيمة ${fmt(item.amount)} ج.م — سند رقم ${voucher.number}`);
      refresh();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء تنفيذ المصروف الدوري");
    } finally {
      setBusyId(null);
    }
  };

  // Due items count
  const dueItems = items.filter((it) => it.active && checkRecurringStatus(it).isDue);

  return (
    <div className="space-y-6">
      {/* Alert Banner if there are due recurring expenses */}
      {dueItems.length > 0 && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">
                يوجد {dueItems.length} مصروف دوري مستحق الصرف حالياً!
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                يمكنك اعتمادها بضغطة زر واحدة لتسجيلها في القيود وخصمها من الخزينة.
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            إجمالي المستحق: {fmt(dueItems.reduce((s, x) => s + x.amount, 0))} ج.م
          </div>
        </div>
      )}

      {/* Header with Add Button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            المصروفات الدورية والمجدولة تلقائياً
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            جدولة الإيجارات، الرواتب، اشتراكات الإنترنت، ومصروفات التشغيل الثابتة.
          </p>
        </div>
        <Button size="sm" onClick={onOpenAdd} className="gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" /> جدولة مصروف جديد
        </Button>
      </div>

      {/* Grid of Recurring Items */}
      {items.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed bg-card/40">
          <CalendarClock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h4 className="font-bold text-sm text-foreground">لا توجد مصروفات دورية مجدولة بعد</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            قم بإضافة التزاماتك الثابتة (إيجار، رواتب، إنترنت) لتذكيرك بها وتوليدها بضغطة زر واحدة.
          </p>
          <Button size="sm" variant="outline" onClick={onOpenAdd} className="mt-4 gap-1.5">
            <Plus className="w-3.5 h-3.5" /> إضافة أول التزام دوري
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            const status = checkRecurringStatus(item);
            const catInfo = getCategoryInfo(item.category);
            const acc = accounts.find((a) => a.id === item.accountId);
            const isBusy = busyId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-2xl border p-4.5 bg-card/80 transition-all shadow-xs flex flex-col justify-between gap-4",
                  status.isDue ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-border/60 hover:border-border"
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                        <CalendarClock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-sm leading-tight">{item.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{catInfo.label}</span>
                          <span className="text-[11px] text-muted-foreground/60">•</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Wallet className="w-3 h-3 text-primary" /> {acc?.name || "الدرج"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="text-base font-extrabold text-danger tabular-nums">
                        {fmt(item.amount)} <span className="text-xs text-muted-foreground">ج.م</span>
                      </div>
                      <Badge
                        variant={status.badgeTone === "danger" ? "destructive" : "outline"}
                        className={cn(
                          "mt-1 text-[10px] px-2 py-0.5",
                          status.badgeTone === "warning" && "bg-amber-500/10 text-amber-700 border-amber-500/30",
                          status.badgeTone === "success" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                        )}
                      >
                        {status.badgeText}
                      </Badge>
                    </div>
                  </div>

                  {item.recipientName && (
                    <div className="mt-3 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
                      <span>المستفيد: <b className="text-foreground">{item.recipientName}</b></span>
                      <span>موعد الاستحقاق: <b className="text-foreground" dir="ltr">{item.nextDueDate}</b></span>
                    </div>
                  )}

                  {item.notes && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border/40 gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => onOpenEdit(item)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-danger hover:bg-danger/10"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant={status.isDue ? "default" : "outline"}
                    className="gap-1.5 text-xs h-8"
                    disabled={isBusy}
                    onClick={() => handleExecuteNow(item)}
                  >
                    {isBusy ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    صرف وتسجيل الآن
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog for Add / Edit Recurring Item */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              {editingItem ? "تعديل المصروف الدوري" : "جدولة مصروف دوري جديد"}
            </DialogTitle>
            <DialogDescription className="text-right text-xs">
              تحديد التكرار التلقائي وقناة الخصم وموعد الاستحقاق.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-bold">اسم المصروف الدوري (مثال: إيجار المحل)</Label>
              <Input
                placeholder="إيجار الفرع، فاتورة النت، رواتب..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">المبلغ (ج.م)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 font-bold text-danger"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">التصنيف</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {categories.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">الخزينة المسحوب منها</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold">دورية التكرار</Label>
                <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="monthly">شهرياً (في يوم محدد)</SelectItem>
                    <SelectItem value="weekly">أسبوعياً</SelectItem>
                    <SelectItem value="daily">يومياً</SelectItem>
                    <SelectItem value="yearly">سنوياً</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {frequency === "monthly" && (
              <div>
                <Label className="text-xs font-bold">يوم الاستحقاق من كل شهر (1 - 31)</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label className="text-xs font-bold">اسم المستلم / المستفيد (اختياري)</Label>
              <Input
                placeholder="اسم مالك العقار، الشركة، العامل..."
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-card/60">
                <div>
                  <Label className="text-xs font-bold">القالب مفعّل</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">إيقافه يمنع التنبيهات والتوليد</p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-card/60">
                <div>
                  <Label className="text-xs font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" /> اعتماد تلقائي
                  </Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">يُسجَّل تلقائياً عند الاستحقاق دون تدخل</p>
                </div>
                <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">ملاحظات إضافية</Label>
              <Textarea
                placeholder="رقم العداد، تفاصيل العقد، شروط الدفع..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3 pt-3 border-t">
            <Button variant="outline" onClick={() => setOpenModal(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave}>
              {editingItem ? "حفظ التعديلات" : "حفظ الجدولة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
