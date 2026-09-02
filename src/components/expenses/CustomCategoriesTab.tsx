import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  CustomExpenseCategory,
  getAllExpenseCategories,
  addExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  CATEGORY_ICON_OPTIONS,
} from "@/lib/expenses-system";
import { CategoryIcon, CATEGORY_COLOR_CLASSES } from "@/components/expenses/CategoryIcon";
import { fmt, useDB } from "@/lib/store";
import { toast } from "sonner";
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Zap,
  Users,
  Truck,
  Wrench,
  Megaphone,
  Package,
  Coffee,
  FileCheck,
  Receipt,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_OPTIONS = [
  { name: "emerald", label: "أخضر زمردي", bg: "bg-emerald-500" },
  { name: "blue", label: "أزرق", bg: "bg-blue-500" },
  { name: "amber", label: "كهرماني / أصفر", bg: "bg-amber-500" },
  { name: "purple", label: "بنفسجي", bg: "bg-purple-500" },
  { name: "pink", label: "وردي", bg: "bg-pink-500" },
  { name: "cyan", label: "سماوي", bg: "bg-cyan-500" },
  { name: "orange", label: "برتقالي", bg: "bg-orange-500" },
  { name: "teal", label: "تركواز", bg: "bg-teal-500" },
  { name: "indigo", label: "نيلي", bg: "bg-indigo-500" },
  { name: "slate", label: "رمادي داكن", bg: "bg-slate-500" },
];

export function CustomCategoriesTab() {
  const { expenses } = useDB();
  const [categories, setCategories] = useState<CustomExpenseCategory[]>(() => getAllExpenseCategories());
  const [openModal, setOpenModal] = useState(false);
  const [editingCat, setEditingCat] = useState<CustomExpenseCategory | null>(null);

  const [label, setLabel] = useState("");
  const [color, setColor] = useState("emerald");
  const [iconName, setIconName] = useState("Receipt");
  const [description, setDescription] = useState("");

  const refresh = () => setCategories(getAllExpenseCategories());

  // Tally expenses by category
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    expenses.forEach((e) => {
      if (!stats[e.category]) stats[e.category] = { count: 0, total: 0 };
      stats[e.category].count += 1;
      stats[e.category].total += e.amount;
    });
    return stats;
  }, [expenses]);

  const onOpenAdd = () => {
    setEditingCat(null);
    setLabel("");
    setColor("emerald");
    setIconName("Receipt");
    setDescription("");
    setOpenModal(true);
  };

  const onOpenEdit = (cat: CustomExpenseCategory) => {
    setEditingCat(cat);
    setLabel(cat.label);
    setColor(cat.color || "emerald");
    setIconName(cat.iconName || "Receipt");
    setDescription(cat.description || "");
    setOpenModal(true);
  };

  const handleSave = () => {
    if (!label.trim()) {
      toast.error("يرجى إدخال اسم التصنيف");
      return;
    }

    if (editingCat) {
      updateExpenseCategory(editingCat.id, {
        label: label.trim(),
        color,
        iconName,
        description: description.trim() || undefined,
      });
      toast.success("تم تحديث التصنيف");
    } else {
      const internalName = `custom_${Date.now()}`;
      addExpenseCategory({
        name: internalName,
        label: label.trim(),
        color,
        iconName,
        description: description.trim() || undefined,
      });
      toast.success("تمت إضافة التصنيف الجديد بنجاح");
    }

    setOpenModal(false);
    refresh();
  };

  const handleDelete = (cat: CustomExpenseCategory) => {
    if (cat.isSystem) {
      toast.error("لا يمكن حذف التصنيفات الأساسية للنظام");
      return;
    }
    const hasExpenses = (categoryStats[cat.name]?.count || 0) > 0;
    if (hasExpenses) {
      if (!confirm(`هذا التصنيف مرتبط بـ ${categoryStats[cat.name].count} قيد مصروف مسجل. هل تريد حذفه؟`)) {
        return;
      }
    }
    deleteExpenseCategory(cat.id);
    toast.success("تم حذف التصنيف");
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Tags className="w-5 h-5 text-primary" />
            إدارة وتخصيص تصنيفات المصروفات
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            إضافة مراكز تكلفة وتصنيفات مخصصة تلائم طبيعة نشاطك التجاري.
          </p>
        </div>
        <Button size="sm" onClick={onOpenAdd} className="gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" /> إضافة تصنيف جديد
        </Button>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const stats = categoryStats[cat.name] || categoryStats[cat.id] || { count: 0, total: 0 };
          return (
            <div
              key={cat.id || cat.name}
              className="p-4 rounded-2xl border bg-card/80 flex flex-col justify-between gap-3 hover:border-border transition-all shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0",
                        CATEGORY_COLOR_CLASSES[cat.color]?.soft || "bg-primary/10 text-primary"
                      )}
                    >
                      <CategoryIcon name={cat.iconName} className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-sm">{cat.label}</h4>
                      {cat.isSystem && (
                        <span className="text-[10px] text-muted-foreground">أساسي</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => onOpenEdit(cat)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {!cat.isSystem && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-danger hover:bg-danger/10"
                        onClick={() => handleDelete(cat)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {cat.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{cat.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{stats.count} قيد مسجل</span>
                <span className="font-bold text-danger tabular-nums">{fmt(stats.total)} ج.م</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog for Add / Edit Category */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Tags className="w-5 h-5 text-primary" />
              {editingCat ? "تعديل التصنيف" : "إضافة تصنيف مصروفات جديد"}
            </DialogTitle>
            <DialogDescription className="text-right text-xs">
              تحديد التسمية العربية واللون المناسب للتصنيف.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-bold">اسم التصنيف بالعربية</Label>
              <Input
                placeholder="مثال: رسوم حكومية، أدوات تغليف، شاي وبوفيه..."
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs font-bold">لون التمييز</Label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setColor(c.name)}
                    className={cn(
                      "h-8 rounded-lg flex items-center justify-center border transition-all",
                      color === c.name ? "ring-2 ring-primary ring-offset-2 border-transparent scale-105" : "border-border/60 hover:opacity-80"
                    )}
                    title={c.label}
                  >
                    <div className={cn("w-4 h-4 rounded-full", c.bg)} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">أيقونة التصنيف</Label>
              <div className="grid grid-cols-10 gap-1.5 mt-2">
                {CATEGORY_ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIconName(ic)}
                    className={cn(
                      "h-8 rounded-lg flex items-center justify-center border transition-all",
                      iconName === ic
                        ? cn("ring-2 ring-primary ring-offset-1 border-transparent", CATEGORY_COLOR_CLASSES[color]?.soft)
                        : "border-border/60 text-muted-foreground hover:bg-muted"
                    )}
                    title={ic}
                  >
                    <CategoryIcon name={ic} className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">وصف التصنيف (اختياري)</Label>
              <Input
                placeholder="أي ملاحظات توضيحية حول هذا البند..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3 pt-3 border-t">
            <Button variant="outline" onClick={() => setOpenModal(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave}>حفظ التصنيف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
