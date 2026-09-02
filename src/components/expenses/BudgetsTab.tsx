import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  CategoryBudget,
  getCategoryBudgets,
  setCategoryBudget,
  saveCategoryBudgets,
  calculateBudgetStatus,
  getAllExpenseCategories,
  getCategoryInfo,
  budgetKey,
  COST_CENTERS,
  summarizeByDimension,
} from "@/lib/expenses-system";
import { fmt, useDB } from "@/lib/store";
import { toast } from "sonner";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  SlidersHorizontal,
  ShieldAlert,
  Percent,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function BudgetsTab() {
  const { expenses, branches } = useDB();
  const [budgets, setBudgets] = useState<CategoryBudget[]>(() => getCategoryBudgets());
  const [openModal, setOpenModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<CategoryBudget | null>(null);

  const [category, setCategory] = useState("marketing");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [warnThreshold, setWarnThreshold] = useState("80");
  const [notes, setNotes] = useState("");
  const [scopeBranch, setScopeBranch] = useState("all");
  const [scopeCostCenter, setScopeCostCenter] = useState("all");

  const refresh = () => setBudgets(getCategoryBudgets());
  const categories = useMemo(() => getAllExpenseCategories(), []);

  // Compute status for the current month
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const statuses = useMemo(() => {
    return calculateBudgetStatus(budgets, expenses, currentMonthStr);
  }, [budgets, expenses, currentMonthStr]);

  const totalBudgetLimit = statuses.reduce((s, x) => s + x.limit, 0);
  const totalActualSpent = statuses.reduce((s, x) => s + x.spent, 0);
  const totalRemaining = Math.max(0, totalBudgetLimit - totalActualSpent);
  const totalPct = totalBudgetLimit > 0 ? Math.round((totalActualSpent / totalBudgetLimit) * 100) : 0;

  const byBranch = useMemo(() => summarizeByDimension(expenses, "branch", currentMonthStr), [expenses, currentMonthStr]);
  const byCostCenter = useMemo(() => summarizeByDimension(expenses, "costCenter", currentMonthStr), [expenses, currentMonthStr]);
  const scopeLabel = (b: { branchId?: string; costCenter?: string }) => {
    const parts: string[] = [];
    if (b.branchId) parts.push(branches.find((x) => x.id === b.branchId)?.name || "فرع");
    if (b.costCenter) parts.push(COST_CENTERS.find((c) => c.value === b.costCenter)?.label || b.costCenter);
    return parts.join(" • ");
  };

  const exceededCount = statuses.filter((s) => s.status === "exceeded").length;
  const warningCount = statuses.filter((s) => s.status === "warning").length;

  const onOpenAdd = () => {
    setEditingBudget(null);
    setCategory("marketing");
    setMonthlyLimit("");
    setWarnThreshold("80");
    setNotes("");
    setScopeBranch("all");
    setScopeCostCenter("all");
    setOpenModal(true);
  };

  const onOpenEdit = (b: CategoryBudget) => {
    setEditingBudget(b);
    setCategory(b.category);
    setMonthlyLimit(String(b.monthlyLimit));
    setWarnThreshold(String(b.warnThresholdPct || 80));
    setNotes(b.notes || "");
    setScopeBranch(b.branchId || "all");
    setScopeCostCenter(b.costCenter || "all");
    setOpenModal(true);
  };

  const handleSave = () => {
    const limit = Number(monthlyLimit);
    if (!limit || limit <= 0) {
      toast.error("يرجى إدخال سقف ميزانية صحيح");
      return;
    }

    setCategoryBudget({
      category,
      monthlyLimit: limit,
      warnThresholdPct: Number(warnThreshold) || 80,
      notes: notes.trim() || undefined,
      branchId: scopeBranch === "all" ? undefined : scopeBranch,
      costCenter: scopeCostCenter === "all" ? undefined : scopeCostCenter,
    });

    toast.success("تم ضبط وتحديث ميزانية التصنيف");
    setOpenModal(false);
    refresh();
  };

  const handleDelete = (key: string) => {
    if (confirm("هل تريد بالتأكيد حذف سقف الميزانية لهذا التصنيف؟")) {
      const filtered = budgets.filter((b) => budgetKey(b) !== key);
      saveCategoryBudgets(filtered);
      toast.success("تم حذف الميزانية");
      refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner if exceeded */}
      {exceededCount > 0 && (
        <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">
                تنبيه سقف الإنفاق: تم تجاوز ميزانية {exceededCount} تصنيف هذا الشهر!
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                يُرجى مراجعة بنود الإنفاق المرتفعة لترشيد التكاليف وحماية هامش الربح.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border bg-card/80 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground">إجمالي الميزانية التقديرية (شهرياً)</span>
          <div className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
            {fmt(totalBudgetLimit)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-card/80 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground">المصروف الفعلي (الشهر الحالي)</span>
          <div className="text-2xl font-extrabold text-danger mt-1 tabular-nums">
            {fmt(totalActualSpent)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-card/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">نسبة الاستهلاك الكلية</span>
            <Badge
              variant={totalPct >= 100 ? "destructive" : totalPct >= 80 ? "outline" : "secondary"}
              className="text-[10px]"
            >
              {totalPct}%
            </Badge>
          </div>
          <div className="mt-2 space-y-1">
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  totalPct >= 100 ? "bg-rose-600" : totalPct >= 80 ? "bg-amber-500" : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(totalPct, 100)}%` }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground text-left tabular-nums">
              المتبقي: {fmt(totalRemaining)} ج.م
            </div>
          </div>
        </div>
      </div>

      {/* Header and Add Button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            سقوف الميزانيات والتحكم في الهدر
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            تحديد سقف شهري لكل تصنيف ومتابعة معدل الاستهلاك الفعلي في الوقت الحقيقي.
          </p>
        </div>
        <Button size="sm" onClick={onOpenAdd} className="gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" /> تحديد ميزانية جديدة
        </Button>
      </div>

      {/* Budget Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {statuses.map((st) => {
          const rawBudget = budgets.find((b) => budgetKey(b) === budgetKey(st));
          return (
            <div
              key={budgetKey(st)}
              className={cn(
                "rounded-2xl border p-4.5 bg-card/80 flex flex-col justify-between gap-3 transition-all",
                st.status === "exceeded"
                  ? "border-rose-500/40 ring-1 ring-rose-500/20 bg-rose-500/[0.02]"
                  : st.status === "warning"
                  ? "border-amber-500/40 ring-1 ring-amber-500/20"
                  : "border-border/60 hover:border-border"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-foreground text-sm">{st.categoryLabel}</h4>
                    {scopeLabel(st) && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 dark:text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded mt-0.5">
                        <Building2 className="w-2.5 h-2.5" /> {scopeLabel(st)}
                      </span>
                    )}
                    {rawBudget?.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5">{rawBudget.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        st.status === "exceeded"
                          ? "destructive"
                          : st.status === "warning"
                          ? "outline"
                          : "secondary"
                      }
                      className={cn(
                        "text-[10px] px-2 py-0.5 font-bold",
                        st.status === "warning" && "bg-amber-500/10 text-amber-700 border-amber-500/30",
                        st.status === "safe" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                      )}
                    >
                      {st.status === "exceeded"
                        ? `تجاوز السقف (+${st.percentage - 100}%)`
                        : st.status === "warning"
                        ? `اقترب من السقف (${st.percentage}%)`
                        : `آمن (${st.percentage}%)`}
                    </Badge>
                    {rawBudget && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onOpenEdit(rawBudget)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                    {rawBudget && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-danger hover:bg-danger/10"
                        onClick={() => handleDelete(budgetKey(st))}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Numbers */}
                <div className="grid grid-cols-3 gap-2 my-3 p-2.5 rounded-xl bg-muted/30 text-center text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px] block">الميزانية</span>
                    <span className="font-bold text-foreground tabular-nums">{fmt(st.limit)} ج.م</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">المنصرف الفعلي</span>
                    <span className="font-bold text-danger tabular-nums">{fmt(st.spent)} ج.م</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">المتبقي</span>
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        st.remaining === 0 ? "text-rose-600" : "text-emerald-600"
                      )}
                    >
                      {fmt(st.remaining)} ج.م
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        st.status === "exceeded"
                          ? "bg-rose-600"
                          : st.status === "warning"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(st.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* تقرير الإنفاق حسب الفرع ومركز التكلفة (الشهر الحالي) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { title: "الإنفاق حسب الفرع", rows: byBranch },
          { title: "الإنفاق حسب مركز التكلفة", rows: byCostCenter },
        ].map((block) => {
          const max = Math.max(1, ...block.rows.map((r) => r.total));
          return (
            <div key={block.title} className="rounded-2xl border border-border/60 bg-card/80 p-4.5">
              <h4 className="font-bold text-foreground text-sm flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-primary" /> {block.title}
                <span className="text-[10px] text-muted-foreground font-normal">— الشهر الحالي</span>
              </h4>
              {block.rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا توجد مصروفات مسجلة هذا الشهر.</p>
              ) : (
                <div className="space-y-2.5">
                  {block.rows.map((r) => (
                    <div key={r.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-foreground">{r.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {fmt(r.total)} ج.م <span className="text-[10px]">({r.count})</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.total / max) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog for Add/Edit Budget */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              {editingBudget ? "تعديل سقف الميزانية" : "تحديد ميزانية تصنيف"}
            </DialogTitle>
            <DialogDescription className="text-right text-xs">
              سيتم تنبيهك فور اقتراب أو تجاوز إجمالي مصروفات هذا البند للسقف المحدد.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-bold">بند وتصنيف المصروف</Label>
              <Select value={category} onValueChange={setCategory} disabled={!!editingBudget}>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">نطاق الفرع</Label>
                <Select value={scopeBranch} onValueChange={setScopeBranch} disabled={!!editingBudget}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold">مركز التكلفة</Label>
                <Select value={scopeCostCenter} onValueChange={setScopeCostCenter} disabled={!!editingBudget}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="all">كل المراكز</SelectItem>
                    {COST_CENTERS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">سقف الميزانية الشهري (ج.م)</Label>
              <Input
                type="number"
                min="0"
                placeholder="5000"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                className="mt-1 font-bold text-lg"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">نسبة التنبيه والتحذير (%)</Label>
              <Select value={warnThreshold} onValueChange={setWarnThreshold}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="70">عند الوصول إلى 70% من الميزانية</SelectItem>
                  <SelectItem value="80">عند الوصول إلى 80% من الميزانية (موصى به)</SelectItem>
                  <SelectItem value="90">عند الوصول إلى 90% من الميزانية</SelectItem>
                  <SelectItem value="100">فقط عند تجاوز 100%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold">ملاحظات / أهداف الترشيد</Label>
              <Input
                placeholder="مثال: ترشيد ميزانية الإعلانات، حد أقصى للضيافة..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3 pt-3 border-t">
            <Button variant="outline" onClick={() => setOpenModal(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave}>حفظ الميزانية</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
