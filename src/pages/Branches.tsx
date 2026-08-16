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
          >
            <Button 
              onClick={() => {
                setEditingBranch(null);
                setIsDialogOpen(true);
              }}
              className="rounded-full px-6 shadow-lg shadow-primary/20"
            >
              <Plus className="ml-2 h-4 w-4" />
              إضافة فرع جديد
            </Button>
          </PageHeader>

          {/* Quick Stats */}
          <Reveal className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="plate p-6 flex flex-col gap-1">
              <span className="text-muted-foreground text-sm font-medium">إجمالي الفروع</span>
              <span className="text-3xl font-bold">{branches.length}</span>
            </div>
            <div className="plate p-6 flex flex-col gap-1">
              <span className="text-muted-foreground text-sm font-medium">الفروع النشطة</span>
              <span className="text-3xl font-bold text-success">{branches.length}</span>
            </div>
            <div className="plate p-6 flex flex-col gap-1">
              <span className="text-muted-foreground text-sm font-medium">المديرين</span>
              <span className="text-3xl font-bold text-primary">
                {new Set(branches.map(b => b.managerName).filter(Boolean)).size}
              </span>
            </div>
          </Reveal>

          {/* Main Branch */}
          {mainBranch && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2 px-1">
                <Star className="h-5 w-5 text-warning fill-warning" />
                الفرع الرئيسي
              </h2>
              <Reveal>
                <BranchCard 
                  branch={mainBranch} 
                  onEdit={(b) => {
                    setEditingBranch(b);
                    setIsDialogOpen(true);
                  }}
                  onDelete={removeBranch}
                />
              </Reveal>
            </div>
          )}

          {/* Other Branches */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold px-1">باقي الفروع</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherBranches.map((branch, idx) => (
                <Reveal key={branch.id} delay={idx * 0.1}>
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
              {otherBranches.length === 0 && !mainBranch && !loading && (
                <div className="col-span-full py-20 text-center text-muted-foreground plate italic">
                  لا توجد فروع مسجلة حالياً
                </div>
              )}
            </div>
          </div>
        </div>
      </PageTransition>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
          <div className="glass-header sticky top-0 z-10 border-b border-[var(--hairline)] px-8 py-6">
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
              <div className="flex items-center justify-between p-4 plate rounded-2xl">
                <div className="space-y-0.5">
                  <Label>فرع رئيسي</Label>
                  <p className="text-xs text-muted-foreground">تعيين هذا الفرع كفرع أساسي للنظام</p>
                </div>
                <Switch name="isMain" defaultChecked={editingBranch?.isMain} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 h-12 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20">
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
    <div className="plate-glow bezel-lift group relative overflow-hidden p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
            <GitBranch className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{branch.name}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {branch.location || "بدون عنوان"}
            </p>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={() => onEdit(branch)} className="h-8 w-8 rounded-full">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (confirm("هل أنت متأكد من حذف هذا الفرع؟")) onDelete(branch.id);
            }} 
            className="h-8 w-8 rounded-full text-danger hover:bg-danger/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--hairline)]">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">المدير المسئول</span>
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-primary" />
            {branch.managerName || "غير محدد"}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">رقم الهاتف</span>
          <span className="text-sm font-semibold flex items-center gap-1.5" dir="ltr">
            <Phone className="h-3.5 w-3.5 text-primary" />
            {branch.phone || "---"}
          </span>
        </div>
      </div>
    </div>
  );
}
