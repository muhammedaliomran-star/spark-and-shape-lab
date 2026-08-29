import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  db, useDB, fmt, WAREHOUSE_SEASONS, WAREHOUSE_CATEGORIES,
  type WarehouseItem, type WarehouseSeason,
} from "@/lib/store";
import {
  Warehouse as WarehouseIcon, Boxes, Wallet, Sun, Snowflake, Search, Plus,
  ArrowLeft, Trash2, Layers, Store, Pencil, Check
} from "lucide-react";
import { usePrivacy } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/router-compat";
import { toast } from "sonner";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <WarehousePage />
      </PageTransition>
    </AppShell>
  );
}

type Filter = "any" | WarehouseSeason;

const seasonMeta: Record<WarehouseSeason, { label: string; cls: string }> = {
  summer: { label: "صيفي", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  winter: { label: "شتوي", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  all: { label: "عام", cls: "bg-foreground/[0.06] text-muted-foreground ring-border" },
};

function WarehousePage() {
  const { warehouseItems, loading } = useDB();
  const { privacy } = usePrivacy();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("any");
  const [addOpen, setAddOpen] = useState(false);

  const stats = useMemo(() => {
    const val = (it: WarehouseItem) => it.quantity * it.unitCost;
    const summer = warehouseItems.filter((i) => i.season === "summer");
    const winter = warehouseItems.filter((i) => i.season === "winter");
    return {
      skus: warehouseItems.length,
      units: warehouseItems.reduce((s, i) => s + i.quantity, 0),
      summerValue: summer.reduce((s, i) => s + val(i), 0),
      winterValue: winter.reduce((s, i) => s + val(i), 0),
      summerCount: summer.length,
      winterCount: winter.length,
      frozen: warehouseItems.reduce((s, i) => s + val(i), 0),
    };
  }, [warehouseItems]);

  const list = useMemo(() => {
    return warehouseItems
      .filter((i) => (filter === "any" ? true : i.season === filter))
      .filter((i) => (q ? i.name.includes(q) : true))
      .sort((a, b) => b.quantity * b.unitCost - a.quantity * a.unitCost);
  }, [warehouseItems, filter, q]);

  const money = (n: number) => fmt(n);

  return (
    <div className="mx-auto w-full max-w-[92rem] pb-24">
      <PageHeader
        title="المخزن"
        icon={<WarehouseIcon className="h-7 w-7" />}
        subtitle="البضاعة المركونة — صيفي وشتوي وعام."
        action={
          <>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/inventory">
                <ArrowLeft className="me-2 h-4 w-4" />
                المنتجات
              </Link>
            </Button>
            <Button size="sm" className="rounded-full" onClick={() => setAddOpen(true)}>
              <Plus className="me-2 h-4 w-4" />
              إضافة للمخزن
            </Button>
          </>
        }
      />

      {/* المؤشرات — ٤ كروت زي التصميم */}
      <Reveal>
        <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="إجمالي الأصناف"
            value={stats.skus}
            icon={Boxes}
            isMoney={false}
            format={(n) => fmt(n)}
            sub={<>{fmt(stats.units)} قطعة مخزنة</>}
          />
          <MetricCard
            label="☀️ قيمة الصيفي"
            value={stats.summerValue}
            icon={Sun}
            masked={privacy}
            format={money}
            sub={<>{fmt(stats.summerCount)} صنف صيفي</>}
          />
          <MetricCard
            label="❄️ قيمة الشتوي"
            value={stats.winterValue}
            icon={Snowflake}
            masked={privacy}
            format={money}
            sub={<>{fmt(stats.winterCount)} صنف شتوي</>}
          />
          <MetricCard
            label="رأس المال المجمد"
            value={stats.frozen}
            icon={Wallet}
            masked={privacy}
            format={money}
            sub={<>إجمالي تكلفة المخزن</>}
          />
        </div>
      </Reveal>

      {/* البحث + فلاتر الموسم */}
      <Reveal delay={80} className="sticky-search-bar mt-5">
        <div className="flex flex-col-reverse gap-3 md:flex-row-reverse md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن صنف..."
              className="h-12 rounded-full pe-11 text-right"
            />
          </div>
          <div className="glass flex w-max items-center gap-1 rounded-full p-1.5">
            {(
              [
                { value: "any", label: "الكل", icon: Layers },
                { value: "summer", label: "صيفي", icon: Sun },
                { value: "winter", label: "شتوي", icon: Snowflake },
                { value: "all", label: "عام", icon: Boxes },
              ] as { value: Filter; label: string; icon: typeof Sun }[]
            ).map((f) => {
              const active = filter === f.value;
              const Icon = f.icon;
return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "press flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
                  )}
              >
                  <Icon className="h-3.5 w-3.5" />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* الجرد */}
      <Reveal delay={140}>
        <div className="mt-6">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">جاري تحميل المخزن…</div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={WarehouseIcon}
              title={q || filter !== "any" ? "مفيش أصناف مطابقة" : "المخزن فاضي"}
              hint={
                q || filter !== "any"
                  ? "جرّب تغيّر البحث أو الموسم."
                  : "أضف بضاعتك المركونة وحدّد موسمها، وهتشوف رأس المال المجمد فورًا."
              }
              action={
                <Button className="rounded-full" onClick={() => setAddOpen(true)}>
                  <Plus className="me-2 h-4 w-4" />
                  إضافة للمخزن
                </Button>
              }
            />
          ) : (
            <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((it) => (
                <ItemCard key={it.id} item={it} masked={privacy} />
              ))}
            </div>
          )}
        </div>
      </Reveal>

      <AddWarehouseDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function ItemCard({ item, masked }: { item: WarehouseItem; masked: boolean }) {
  const meta = seasonMeta[item.season];
  const cat = WAREHOUSE_CATEGORIES.find((c) => c.value === item.category)?.label ?? "أخرى";
  const value = item.quantity * item.unitCost;
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  return (
    <BezelCard
      variant="flat"
      innerClassName="flex flex-col gap-4 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <Badge variant="outline" className={cn("rounded-full border-0 ring-1", "bg-foreground/[0.06] text-muted-foreground ring-border")}>{meta.label}</Badge>
        <div className="min-w-0 text-right">
          <div className="truncate font-semibold">{item.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{cat}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-right">
        <Cell label="الكمية" value={fmt(item.quantity)} />
        <Cell label="التكلفة" value={fmt(item.unitCost)} masked={masked} />
        <Cell label="قيمة الرصيد" value={fmt(value)} masked={masked} strong />
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--hairline)] pt-3">
        <Button size="sm" className="flex-1 rounded-full" onClick={() => setMoveOpen(true)}>
          <Store className="me-2 h-4 w-4" />
          نقل للمحل
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditOpen(true)}>
          <Pencil className="me-2 h-4 w-4" />
          تعديل
        </Button>
      </div>
      <EditDialog item={item} open={editOpen} onOpenChange={setEditOpen} />
      <MoveToShopDialog item={item} open={moveOpen} onOpenChange={setMoveOpen} />
    </BezelCard>
  );
}

function Cell({ label, value, masked, strong }: { label: string; value: string; masked?: boolean; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={cn("text-numeric mt-1", strong ? "font-extrabold" : "font-semibold", masked && "privacy-blur")}>
        {value}
      </div>
    </div>
  );
}

function EditDialog({ item, open, onOpenChange }: { item: WarehouseItem; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitCost, setUnitCost] = useState(String(item.unitCost));
  const [salePrice, setSalePrice] = useState(String(item.salePrice));
  const [season, setSeason] = useState<WarehouseSeason>(item.season);
  const [category, setCategory] = useState(item.category);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("اكتب اسم الصنف"); return; }
    setBusy(true);
    try {
      await db.updateWarehouseItem(item.id, {
        name: name.trim(),
        quantity: Math.max(0, Number(quantity) || 0),
        unitCost: Math.max(0, Number(unitCost) || 0),
        salePrice: Math.max(0, Number(salePrice) || 0),
        season, category,
      });
      toast.success("تم تحديث الصنف");
      onOpenChange(false);
    } catch {
      toast.error("تعذّر التحديث");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await db.removeWarehouseItem(item.id);
      toast.success("تم حذف الصنف من المخزن");
      onOpenChange(false);
    } catch {
      toast.error("تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="text-right sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">تعديل صنف المخزن</DialogTitle>
          <DialogDescription className="text-right">عدّل بيانات الصنف المركون.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>اسم الصنف</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-2xl text-right" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>الكمية</Label>
              <Input type="number" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="text-numeric rounded-2xl text-right" />
            </div>
            <div className="grid gap-2">
              <Label>سعر التكلفة (ج.م)</Label>
              <Input type="number" inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="text-numeric rounded-2xl text-right" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>سعر البيع (ج.م)</Label>
            <Input type="number" inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="text-numeric rounded-2xl text-right" />
          </div>
          <div className="grid gap-2">
            <Label>الموسم</Label>
            <Select value={season} onValueChange={(v) => setSeason(v as WarehouseSeason)}>
              <SelectTrigger className="rounded-2xl text-right"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WAREHOUSE_SEASONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>الفئة / القسم</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-2xl text-right"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WAREHOUSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-row-reverse justify-between gap-2 sm:justify-between">
          <div className="flex flex-row-reverse gap-2">
            <Button onClick={submit} disabled={busy} className="rounded-full">حفظ التعديل</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">إلغاء</Button>
          </div>
          <Button variant="ghost" onClick={remove} disabled={busy} className="rounded-full text-muted-foreground hover:text-destructive">
            <Trash2 className="me-2 h-4 w-4" />
            حذف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveToShopDialog({ item, open, onOpenChange }: { item: WarehouseItem; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { stockItems } = useDB();
  const [qty, setQty] = useState(String(item.quantity));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = Math.max(0, Number(qty) || 0);
    if (n <= 0) { toast.error("أدخل كمية صحيحة"); return; }
    if (n > item.quantity) { toast.error("الكمية أكبر من المتاح في المخزن"); return; }
    setBusy(true);
    try {
      const existing = stockItems.find((s) => s.name.trim() === item.name.trim());
      if (existing) {
        await db.updateStockItem(
          existing.id,
          { quantity: existing.quantity + n, lastUnitCost: item.unitCost, salePrice: item.salePrice || existing.salePrice },
          { delta: n, reason: "نقل من المخزن" },
        );
      } else {
        await db.addStockItem({
          name: item.name,
          quantity: n,
          lastUnitCost: item.unitCost,
          salePrice: item.salePrice,
          itemType: WAREHOUSE_CATEGORIES.find((c) => c.value === item.category)?.label ?? null,
        });
      }
      const remaining = item.quantity - n;
      if (remaining <= 0) await db.removeWarehouseItem(item.id);
      else await db.updateWarehouseItem(item.id, { quantity: remaining });
      toast.success("تم نقل الصنف للمحل");
      onOpenChange(false);
    } catch {
      toast.error("تعذّر النقل");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="text-right sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-right">نقل للمحل</DialogTitle>
          <DialogDescription className="text-right">
            نقل «{item.name}» من المخزن إلى المنتجات. المتاح: {fmt(item.quantity)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label>الكمية المنقولة</Label>
          <Input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className="text-numeric rounded-2xl text-right" />
        </div>
        <DialogFooter className="flex-row-reverse justify-start gap-2 sm:justify-start">
          <Button onClick={submit} disabled={busy} className="rounded-full">
            <Store className="me-2 h-4 w-4" />
            نقل للمحل
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function AddWarehouseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [unitCost, setUnitCost] = useState("0");
  const [salePrice, setSalePrice] = useState("0");
  const [season, setSeason] = useState<WarehouseSeason>("all");
  const [category, setCategory] = useState("other");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName(""); setQuantity("0"); setUnitCost("0"); setSalePrice("0");
    setSeason("all"); setCategory("other");
  };

  const submit = async () => {
    if (!name.trim()) { toast.error("اكتب اسم الصنف"); return; }
    setBusy(true);
    try {
      await db.addWarehouseItem({
        name: name.trim(),
        quantity: Number(quantity) || 0,
        unitCost: Number(unitCost) || 0,
        salePrice: Number(salePrice) || 0,
        season, category,
      });
      toast.success("تمت الإضافة للمخزن");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("تعذّرت الإضافة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-2xl border border-foreground/10 bg-card p-0 shadow-sm">
        <DialogHeader className="p-6 pb-4 border-b border-foreground/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-foreground/[0.06] flex items-center justify-center">
                <WarehouseIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <DialogTitle className="text-right text-xl font-black">إضافة صنف للمخزن</DialogTitle>
                <p className="text-xs text-muted-foreground uppercase tracking-[0.12em] font-bold mt-0.5">Add New Warehouse Item</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[80vh] p-6">
          <div className="space-y-6 text-right" dir="rtl">
            {/* Name */}
            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-foreground transition-colors">اسم الصنف</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="مثال: بنطلون صيفي قطن..." 
                className="text-right h-12 bg-background/50 border-none focus-visible:ring-2 focus-visible:ring-foreground/30 font-bold" 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Quantity */}
<div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-foreground transition-colors">الكمية</Label>
              <Input 
                type="number" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)} 
                className="text-right h-12 bg-background/50 border-none focus-visible:ring-2 focus-visible:ring-foreground/30 font-black" 
              />
              </div>

{/* Cost */}
              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-foreground transition-colors">سعر التكلفة</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={unitCost} 
                    onChange={(e) => setUnitCost(e.target.value)} 
                    className="text-right h-12 bg-background/50 border-none focus-visible:ring-2 focus-visible:ring-foreground/30 font-black" 
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground opacity-50">EGP</div>
                </div>
              </div>
              </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
{/* Sale Price */}
              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-foreground transition-colors">سعر البيع المتوقع</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={salePrice} 
                    onChange={(e) => setSalePrice(e.target.value)} 
                    className="text-right h-12 bg-background/50 border-none focus-visible:ring-2 focus-visible:ring-foreground/30 font-black" 
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground opacity-50">EGP</div>
                </div>
              </div>


              {/* Season */}
              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-foreground transition-colors">الموسم</Label>
                <Select value={season} onValueChange={(v) => setSeason(v as WarehouseSeason)}>
                  <SelectTrigger className="h-12 bg-background/50 border-none rounded-xl text-right font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WAREHOUSE_SEASONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

{/* Category */}
            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground group-focus-within/field:text-foreground transition-colors">الفئة / القسم</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 bg-background/50 border-none rounded-xl text-right font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              className="w-full gap-2 py-8 text-xl rounded-2xl shadow-2xl transition-[transform,box-shadow] duration-500 font-black relative overflow-hidden group bg-primary text-primary-foreground hover:shadow-primary/30" 
              onClick={submit}
              disabled={busy}
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              <Check className="w-6 h-6 relative z-10" /> <span className="relative z-10">إضافة للمخزن</span>
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
