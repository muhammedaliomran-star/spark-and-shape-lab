import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { GitBranch, MapPin, Phone, User, Star, Plus, Pencil, Trash2 } from "lucide-react";
import { useDB, Branch } from "@/lib/store";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


export default function BranchesPage() {
  const { branches, addBranch, updateBranch, removeBranch, loading } = useDB();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const mainBranch = branches.find(b => b.isMain);
  const otherBranches = branches.filter(b => !b.isMain);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      location: formData.get("location") as string,
      phone: formData.get("phone") as string,
      managerName: formData.get("managerName") as string,
      isMain: formData.get("isMain") === "on",
    };

    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, data);
        toast.success("تم تحديث بيانات الفرع");
      } else {
        await addBranch(data);
        toast.success("تم إضافة الفرع بنجاح");
      }
      setIsDialogOpen(false);
      setEditingBranch(null);
    } catch (error) {
      toast.error("حدث خطأ أثناء الحفظ");
    }
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="flex flex-col gap-8">
          <PageHeader 
            title="الفروع" 
            icon={<GitBranch className="h-7 w-7" />} 
            subtitle="إدارة فروع المحل وتوزيع المهام" 
            action={
            <Button 
              onClick={() => {
                setEditingBranch(null);
                setIsDialogOpen(true);
              }}
              className="rounded-full px-6 shadow-sm"
            >
              <Plus className="ml-2 h-4 w-4" />
              إضافة فرع جديد
            </Button>
          } />

          {/* Quick Stats */}
          <Reveal className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-6 flex flex-col gap-1">
              <span className="text-muted-foreground text-sm font-medium">إجمالي الفروع</span>
              <span className="text-3xl font-bold tabular-nums">{branches.length}</span>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-6 flex flex-col gap-1">
              <span className="text-muted-foreground text-sm font-medium">الفروع النشطة</span>
              <span className="text-3xl font-bold tabular-nums text-foreground">{branches.length}</span>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-6 flex flex-col gap-1">
              <span className="text-muted-foreground text-sm font-medium">المديرين</span>
              <span className="text-3xl font-bold tabular-nums text-foreground">
                {new Set(branches.map(b => b.managerName).filter(Boolean)).size}
              </span>
            </div>
          </Reveal>

          {/* Branches List */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold px-1">قائمة الفروع</h2>
            <div className="flex flex-col gap-3">
              {branches.map((branch, idx) => (
                <Reveal key={branch.id} delay={idx * 0.05}>
                  <BranchCard 
                    branch={branch} 
                    onEdit={(b) => {
                      setEditingBranch(b);
                      setIsDialogOpen(true);
                    }}
                    onDelete={removeBranch}
                  />
                </Reveal>
              ))}
              {branches.length === 0 && !loading && (
                <div className="py-20 text-center text-muted-foreground rounded-2xl border border-dashed border-foreground/10 bg-card/50 italic">
                  لا توجد فروع مسجلة حالياً
                </div>
              )}
            </div>
          </div>

        </div>
      </PageTransition>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg">
          <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-8 py-6">
            <DialogTitle className="text-2xl font-bold">
              {editingBranch ? "تعديل بيانات الفرع" : "إضافة فرع جديد"}
            </DialogTitle>
          </div>
          <form onSubmit={handleSave} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم الفرع</Label>
                <Input id="name" name="name" defaultValue={editingBranch?.name} required placeholder="مثلاً: فرع وسط البلد" className="h-12 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">الموقع / العنوان</Label>
                <div className="relative">
                  <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="location" name="location" defaultValue={editingBranch?.location || ""} placeholder="القاهرة، التجمع الخامس..." className="h-12 pr-11 rounded-2xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <div className="relative">
                    <Phone className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="phone" name="phone" defaultValue={editingBranch?.phone || ""} placeholder="010..." className="h-12 pr-11 rounded-2xl" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="managerName">اسم المدير</Label>
                  <div className="relative">
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="managerName" name="managerName" defaultValue={editingBranch?.managerName || ""} placeholder="أحمد محمد..." className="h-12 pr-11 rounded-2xl" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl border border-foreground/10 bg-card/50">
                <div className="space-y-0.5">
                  <Label>فرع رئيسي</Label>
                  <p className="text-xs text-muted-foreground">تعيين هذا الفرع كفرع أساسي للنظام</p>
                </div>
                <Switch name="isMain" defaultChecked={editingBranch?.isMain} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 h-12 rounded-2xl font-bold text-lg shadow-sm">
                حفظ البيانات
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="h-12 px-6 rounded-2xl border-[var(--hairline)]">
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function BranchCard({ branch, onEdit, onDelete }: { 
  branch: Branch; 
  onEdit: (b: Branch) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group relative overflow-hidden flex flex-col rounded-2xl border border-foreground/10 bg-card/70 hover:border-foreground/20 transition-[border-color,background-color]">
      {/* Status Stripe */}
      <div className={cn(
        "absolute right-0 top-0 bottom-0 w-1.5 rounded-r-full",
        branch.isMain ? "bg-warning" : "bg-foreground/20"
      )} />

      <div className="flex items-center gap-6 p-5">
        {/* Identity Column */}
        <div className="flex flex-1 items-center gap-4 min-w-0">
          <div className={cn(
            "h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center ring-1",
            branch.isMain ? "bg-warning/10 ring-warning/20 text-warning" : "bg-foreground/[0.06] ring-foreground/10 text-foreground"
          )}>
            <GitBranch className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-lg truncate">{branch.name}</span>
              {branch.isMain && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 font-bold text-warning uppercase tracking-[0.12em]">
                  الفرع الرئيسي
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {branch.location || "بدون عنوان"}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                المدير: {branch.managerName || "غير محدد"}
              </span>
            </div>
          </div>
        </div>

        {/* Info Column */}
        <div className="flex flex-col items-end gap-1 px-6 border-x border-[var(--hairline)]">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em]">رقم الهاتف</span>
          <span className="text-xl font-black tabular-nums" dir="ltr">
            {branch.phone || "---"}
          </span>
          <span className="text-xs text-muted-foreground font-medium">نشط</span>
        </div>

        {/* Actions Column */}
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => onEdit(branch)} className="h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-[opacity,background-color,color]">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (confirm("هل أنت متأكد من حذف هذا الفرع؟")) onDelete(branch.id);
            }} 
            className="h-10 w-10 rounded-full text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-[opacity,background-color,color]"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

