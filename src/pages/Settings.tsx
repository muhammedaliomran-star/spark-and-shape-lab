import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  useProfile, useShopSettings, saveShopSettings, fmt,
  type ShopSettings, type ThemeMode, type PrintPaper,
} from "@/lib/store";
import { applyTheme } from "@/lib/theme";
import { downloadExcelBackup, downloadJsonBackup, dataCounts, restoreJsonBackup, wipeAllData } from "@/lib/backup";
import { cn } from "@/lib/utils";
import {
  Settings as SettingsIcon, Store, KeyRound, Save, LogOut, Receipt, Bell,
  Palette, Database, Upload, Trash2, FileJson, FileSpreadsheet, RotateCcw, ShieldAlert, Mail,
  UserRound, ShieldCheck, Users,
} from "lucide-react";
import { UserAvatar } from "@/components/UserChip";
import { useMyRole, useTeam, ROLE_LABEL, ROLE_HINT, ABILITIES, relativeTime, type AppRole } from "@/lib/roles";
import { inviteTeamMember } from "@/lib/team.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useNavigate } from "@/lib/router-compat";
import { z } from "zod";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <SettingsPage />
      </PageTransition>
    </AppShell>
  );
}

const shopSchema = z.object({
  shopName: z.string().trim().max(80, "اسم المحل طويل جداً"),
  phone: z.string().trim().max(30, "رقم التليفون طويل جداً"),
  whatsapp: z.string().trim().max(30, "رقم الواتساب طويل جداً"),
  address: z.string().trim().max(200, "العنوان طويل جداً"),
  taxNumber: z.string().trim().max(40, "الرقم الضريبي طويل جداً"),
  logoUrl: z.string().trim().max(400000).nullable(),
  footerNote: z.string().trim().max(300, "الملاحظة طويلة جداً"),
  currency: z.string().trim().min(1, "اكتب رمز العملة").max(10, "رمز العملة طويل"),
  invoicePrefix: z.string().trim().max(10, "البادئة 10 حروف كحد أقصى"),
  lowStockThreshold: z.number().int().min(0).max(999),
  defaultInstallmentMonths: z.number().int().min(1, "شهر واحد على الأقل").max(60, "60 شهر كحد أقصى"),
  defaultDueDay: z.number().int().min(1).max(28),
  reminderDaysBefore: z.number().int().min(0).max(30),
  printPaper: z.enum(["a4", "thermal"]),
  theme: z.enum(["dark", "light", "system"]),
  alertsEnabled: z.boolean(),
});

const TABLE_LABELS: Record<string, string> = {
  customers: "العملاء",
  suppliers: "الموردين",
  invoices: "فواتير البيع",
  invoice_items: "أصناف الفواتير",
  payments: "الدفعات",
  purchases: "فواتير الشراء",
  purchase_items: "أصناف الشراء",
  supplier_payments: "مدفوعات الموردين",
  stock_items: "أصناف المخزن",
  stock_adjustments: "تسويات المخزن",
  expenses: "المصروفات",
};

function SettingsPage() {
  const { settings, loading } = useShopSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState<ShopSettings>(settings);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);
  useEffect(() => { applyTheme(form.theme); }, [form.theme]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(settings),
    [form, settings],
  );

  const set = useCallback(<K extends keyof ShopSettings>(k: K, v: ShopSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v })), []);

  const save = async () => {
    const parsed = shopSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      await saveShopSettings({ ...form, ...parsed.data });
      toast.success("تم حفظ الإعدادات");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally { setBusy(false); }
  };

  return (
    <div dir="rtl" className="text-right">
      <PageHeader
        title="الإعدادات"
        subtitle="بيانات المحل، الفواتير والطباعة، التنبيهات، المظهر، الحساب، والنسخ الاحتياطي."
        icon={<SettingsIcon className="w-7 h-7" />}
      />

      <Tabs defaultValue="shop" dir="rtl" className="w-full text-right">
        {/* شريط البحث الملتصق بتأثير بلوري */}
        <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-background/60 backdrop-blur-xl border-b border-foreground/5 mb-8">
          <TabsList dir="rtl" className="h-auto w-full bg-transparent justify-start gap-2 border-none p-0 rounded-none overflow-x-auto custom-scrollbar no-scrollbar">
            {[
              { value: "shop", label: "المحل", icon: Store },
              { value: "billing", label: "الفواتير والطباعة", icon: Receipt },
              { value: "alerts", label: "التنبيهات", icon: Bell },
              { value: "appearance", label: "المظهر", icon: Palette },
              { value: "team", label: "الفريق والصلاحيات", icon: Users },
              { value: "account", label: "الحساب", icon: KeyRound },
              { value: "data", label: "البيانات", icon: Database },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative h-11 px-6 gap-2 rounded-none border-b-2 border-transparent bg-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground transition-[color,border-color] duration-300 font-bold opacity-70 data-[state=active]:opacity-100 hover:opacity-100"
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="shop"><ShopTab form={form} set={set} /></TabsContent>
        <TabsContent value="billing"><BillingTab form={form} set={set} /></TabsContent>
        <TabsContent value="alerts"><AlertsTab form={form} set={set} /></TabsContent>
        <TabsContent value="appearance"><AppearanceTab form={form} set={set} /></TabsContent>
        <TabsContent value="account">
          <AccountTab onSignOut={async () => { await supabase.auth.signOut(); navigate("/landing"); }} />
        </TabsContent>
        <TabsContent value="team"><TeamTab /></TabsContent>
        <TabsContent value="data"><DataTab /></TabsContent>
      </Tabs>


      <div className="sticky bottom-4 mt-12 z-20 mx-auto max-w-2xl px-4">
        <div className="flex items-center justify-between gap-6 rounded-2xl border border-foreground/10 bg-card/80 p-3 shadow-sm">
          <div className="flex items-center gap-3 px-3">
            <div className={cn("h-2 w-2 rounded-full animate-pulse", dirty ? "bg-warning" : "bg-success")} />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em]">
              {dirty ? "تغييرات غير محفوظة" : "الإعدادات محفوظة"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 gap-2 rounded-2xl px-5 font-bold hover:bg-foreground/5"
              disabled={!dirty}
              onClick={() => setForm(settings)}
            >
              <RotateCcw className="w-4 h-4 opacity-60" /> تراجع
            </Button>
            <Button
              onClick={save}
              disabled={busy || loading || !dirty}
              className="h-10 gap-2 rounded-2xl bg-primary px-6 font-black text-black transition-[transform,box-shadow] hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              <Save className="w-4 h-4" /> {busy ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

type TabProps = {
  form: ShopSettings;
  set: <K extends keyof ShopSettings>(k: K, v: ShopSettings[K]) => void;
};

function Section({ icon, title, hint, children, className = "", iconClassName = "bg-foreground/[0.06] text-foreground" }: {
  icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode; className?: string; iconClassName?: string;
}) {
  return (
    <section dir="rtl" className={`rounded-[2rem] border border-foreground/10 bg-card/70 text-right ${className}`}>
      <div className="flex items-center gap-3 border-b border-foreground/10 p-6 bg-foreground/[0.02]">
        <div className={`grid h-10 w-10 place-items-center rounded-2xl ${iconClassName}`}>
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-black tracking-tight">{title}</h2>
          {hint && <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.12em]">{hint}</p>}
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </section>
  );
}

/* ------------------------------- المحل ------------------------------- */
function ShopTab({ form, set }: TabProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("اختار صورة من فضلك"); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error("حجم الصورة أكبر من 3 ميجا"); return; }
    try {
      const dataUrl = await shrinkImage(file, 256);
      set("logoUrl", dataUrl);
      toast.success("تم تحميل اللوجو — اضغط حفظ");
    } catch {
      toast.error("تعذر قراءة الصورة");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <Section icon={<Store className="w-5 h-5" />} title="هوية المحل" hint="بيانات النشاط التجاري للمطبوعات" iconClassName="text-foreground bg-foreground/[0.06]">
        <div className="grid gap-3">
          <Field label="اسم النشاط التجاري">
            <Input value={form.shopName} onChange={(e) => set("shopName", e.target.value)} placeholder="مثال: شركة النور للتجارة" maxLength={80} className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="رقم التليفون">
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01xxxxxxxxx" dir="ltr" maxLength={30} className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]" />
            </Field>
            <Field label="رقم الواتساب" hint="بيستخدم في أزرار إرسال التذكيرات">
              <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="201xxxxxxxxx" dir="ltr" maxLength={30} className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]" />
            </Field>
          </div>
          <Field label="العنوان">
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="مثال: القاهرة، حي المعادي" maxLength={200} className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]" />
          </Field>
          <Field label="الرقم الضريبي (اختياري)">
            <Input value={form.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} placeholder="000-000-000" dir="ltr" maxLength={40} className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]" />
          </Field>
          <Field label="ملاحظة أسفل الفاتورة (اختياري)">
            <Textarea
              value={form.footerNote}
              onChange={(e) => set("footerNote", e.target.value)}
              placeholder="مثال: البضاعة المباعة لا ترد ولا تستبدل بعد 14 يوم."
              maxLength={300}
              rows={3}
              className="rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity] resize-none p-4"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] font-black tracking-[0.12em] text-muted-foreground/60">{form.footerNote.length}/300</span>
            </div>
          </Field>
        </div>
      </Section>

      <div className="grid gap-6 h-fit order-first lg:order-none">
        <Section icon={<Upload className="w-5 h-5" />} title="شعار المحل" hint="أبعاد مربعة أفضل للطباعة">
          <div className="flex items-start gap-4">
            <div className="h-24 w-24 rounded-[2rem] border-2 border-dashed border-foreground/10 bg-foreground/[0.02] grid place-items-center overflow-hidden shrink-0 transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:border-foreground/30 hover:bg-foreground/[0.04]">
              {form.logoUrl
                ? <img src={form.logoUrl} alt="لوجو المحل" className="h-full w-full object-contain p-2" />
                : <Store className="w-8 h-8 text-muted-foreground/40" />}
            </div>
            <div className="grid gap-2 flex-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              <div className="flex gap-2 mb-2">
                <Button type="button" variant="secondary" size="sm" className="h-10 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-[background-color,border-color,color,box-shadow,transform,opacity] px-4" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4" /> رفع صورة
                </Button>
                {form.logoUrl ? (
                  <Button type="button" variant="ghost" size="sm" className="h-10 gap-2 rounded-2xl text-danger hover:bg-danger/10 transition-[background-color,border-color,color,box-shadow,transform,opacity] px-4" onClick={() => set("logoUrl", null)}>
                    <Trash2 className="w-4 h-4" /> حذف
                  </Button>
                ) : null}
              </div>
              <Input
                value={form.logoUrl?.startsWith("data:") ? "" : (form.logoUrl ?? "")}
                onChange={(e) => set("logoUrl", e.target.value || null)}
                placeholder="أو رابط مباشر للشعار https://..."
                dir="ltr"
                className="h-10 rounded-xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]"
              />
            </div>
          </div>
        </Section>

        <Section icon={<Receipt className="w-5 h-5" />} title="معاينة رأس الفاتورة" hint="شكل الهيدر في الورق">
          <div className="rounded-2xl border border-foreground/10 bg-card/70 p-6">
              <div className="flex items-start justify-between gap-3 border-b-2 border-primary/20 pb-4">
                <div className="flex items-center gap-4">
                  {form.logoUrl ? <img src={form.logoUrl} alt="" className="h-12 w-12 object-contain rounded-xl bg-white p-1" /> : null}
                  <div className="text-right">
                    <div className="text-xl font-black tracking-tight">{form.shopName || "اسم المحل"}</div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em]">{form.address || "عنوان المحل"}</div>
                  </div>
                </div>
                <div className="text-[9px] font-black text-muted-foreground text-left leading-5 uppercase tracking-[0.12em]">
                  <div dir="ltr">{form.phone || "01xxxxxxxxx"}</div>
                  {form.taxNumber ? <div dir="ltr">T.R: {form.taxNumber}</div> : null}
                  <Badge variant="secondary" className="mt-2 rounded-lg bg-primary/10 text-primary border-none text-[9px] font-black">{form.invoicePrefix || "INV"}-0001</Badge>
                </div>
              </div>
              <div className="pt-4 text-xs font-bold text-muted-foreground/60 leading-relaxed italic">
                {form.footerNote || "ملاحظة أسفل الفاتورة"}
              </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ------------------------- الفواتير والطباعة ------------------------- */
function BillingTab({ form, set }: TabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <Section icon={<Receipt className="w-5 h-5" />} title="الفواتير والأقساط" hint="القيم دي بتتحط تلقائياً وانت بتعمل فاتورة جديدة.">
        <div className="grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="رمز العملة">
              <Input value={form.currency} onChange={(e) => set("currency", e.target.value)} placeholder="ج.م" maxLength={10} className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]" />
            </Field>
            <Field label="بادئة رقم الفاتورة" hint="مثال: INV → INV-0001">
              <Input value={form.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value.toUpperCase())} placeholder="INV" dir="ltr" maxLength={10} className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]" />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="عدد الأقساط الافتراضي (شهور)">
              <Input
                type="number" min={1} max={60} inputMode="numeric"
                value={form.defaultInstallmentMonths}
                onChange={(e) => set("defaultInstallmentMonths", Number(e.target.value) || 1)}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]"
              />
            </Field>
            <Field label="يوم الاستحقاق الافتراضي" hint="من 1 لـ 28 من كل شهر">
              <Input
                type="number" min={1} max={28} inputMode="numeric"
                value={form.defaultDueDay}
                onChange={(e) => set("defaultDueDay", Number(e.target.value) || 1)}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]"
              />
            </Field>
          </div>
          <div className="rounded-[1.75rem] bg-foreground/[0.04] p-5 text-[11px] text-muted-foreground leading-loose border border-foreground/10">
            <span className="block mb-2 font-black uppercase tracking-[0.12em] text-muted-foreground">معاينة الحسابات:</span>
            فاتورة بقيمة <strong className="text-foreground">{fmt(12000)} {form.currency}</strong> على{" "}
            <strong className="text-foreground">{form.defaultInstallmentMonths}</strong> شهر →
            القسط ≈ <strong className="text-foreground">{fmt(12000 / Math.max(1, form.defaultInstallmentMonths))} {form.currency}</strong>{" "}
            يوم <strong className="text-foreground">{form.defaultDueDay}</strong> من كل شهر.
          </div>
        </div>
      </Section>

      <Section icon={<FileSpreadsheet className="w-5 h-5" />} title="الطباعة" hint="مقاس الورق المستخدم في طباعة الفواتير والتقارير.">
        <div className="grid gap-3">
          <Field label="مقاس الورق">
            <Select value={form.printPaper} onValueChange={(v) => set("printPaper", v as PrintPaper)}>
              <SelectTrigger className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4 — طابعة عادية</SelectItem>
                <SelectItem value="thermal">حراري 80mm — طابعة كاشير</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <p className="text-xs text-muted-foreground leading-6">
            {form.printPaper === "a4"
              ? "الفاتورة هتتطبع بعرض كامل مع جدول أصناف مفصّل."
              : "الفاتورة هتتطبع في عمود ضيق مناسب لرول الكاشير 80 مم."}
          </p>
        </div>
      </Section>
    </div>
  );
}

/* ----------------------------- التنبيهات ----------------------------- */
function AlertsTab({ form, set }: TabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <Section icon={<Bell className="w-5 h-5" />} title="تنبيهات المديونية" hint="إعدادات إشعارات مواعيد الأقساط">
        <div className="grid gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-black">تفعيل نظام التنبيهات</div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.12em] font-bold opacity-60">تفعيل الإشعارات في شريط التنقل</p>
            </div>
            <Switch checked={form.alertsEnabled} onCheckedChange={(v) => set("alertsEnabled", v)} />
          </div>
          <Separator />
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">تذكير قبل الاستحقاق بـ</Label>
              <Badge variant="secondary" className="rounded-xl px-3 py-1 bg-foreground/[0.06] text-foreground border-none font-black">{form.reminderDaysBefore} يوم</Badge>
            </div>
            <Slider
              value={[form.reminderDaysBefore]} min={0} max={30} step={1}
              onValueChange={([v]) => set("reminderDaysBefore", v)}
              disabled={!form.alertsEnabled}
              className="py-4"
            />
            <p className="text-xs text-muted-foreground">صفر = التنبيه يوم الاستحقاق نفسه.</p>
          </div>
        </div>
      </Section>

      <Section icon={<ShieldAlert className="w-5 h-5" />} title="تنبيهات المخزون" hint="إشعارات قرب نفاد المنتجات">
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold">حد المخزون المنخفض</Label>
            <Badge variant="secondary" className="rounded-xl px-3 py-1 bg-foreground/[0.06] text-foreground border-none font-black">{form.lowStockThreshold} قطعة</Badge>
          </div>
          <Slider
            value={[form.lowStockThreshold]} min={0} max={50} step={1}
            onValueChange={([v]) => set("lowStockThreshold", v)}
            className="py-4"
          />
          <p className="text-xs text-muted-foreground">القيمة الافتراضية 5 وحدات.</p>
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------ المظهر ------------------------------ */
const THEMES: Array<{ value: ThemeMode; label: string; desc: string }> = [
  { value: "dark", label: "غامق", desc: "الفحمي الافتراضي — مريح بالليل" },
  { value: "light", label: "فاتح", desc: "خلفية بيضاء — أوضح في النهار" },
  { value: "system", label: "تلقائي", desc: "حسب إعدادات جهازك" },
];

function AppearanceTab({ form, set }: TabProps) {
  return (
    <div className="grid gap-6 animate-[fade-in_0.3s_ease-out]">
      <Section icon={<Palette className="w-5 h-5" />} title="وضع العرض" hint="اختر وضع النهار أو الليل، ثم اختر لوحة الألوان التي تناسبك.">
        <div className="grid sm:grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set("theme", t.value)}
              className={`text-right rounded-[1.75rem] border-2 p-5 transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-500 hover:scale-[1.02] active:scale-[0.98] ${
                form.theme === t.value ? "border-primary bg-primary/10 shadow-lg shadow-primary/10" : "border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.05]"
              }`}
            >
              <div className="text-sm font-black mb-1">{t.label}</div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em] opacity-60">{t.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={<Palette className="w-5 h-5" />} title="ألوان الثيم" hint="١٠ لوحات ألوان، وكل لوحة مهيأة لتظل واضحة في الوضعين الليلي والنهاري.">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "زمردي", sub: "الأصل الهادئ", color: "#10b981" },
            { label: "عنبري", sub: "إضاءة دافئة", color: "#f59e0b" },
            { label: "ياقوتي", sub: "أزرق عميق", color: "#3b82f6" },
            { label: "بنفسجي", sub: "تباين ناعم", color: "#8b5cf6" },
            { label: "وردي", sub: "دفء عصري", color: "#ec4899" },
            { label: "أوركيد", sub: "بنفسجي وردي", color: "#d946ef" },
            { label: "محيطي", sub: "أزرق منعش", color: "#06b6d4" },
            { label: "نحاسي", sub: "طابع راق", color: "#b45309" },
            { label: "ليموني", sub: "حيوية متزنة", color: "#84cc16" },
            { label: "فحمي", sub: "محايد ودقيق", color: "#4b5563" },
          ].map((c) => (
            <div key={c.label} className={cn("rounded-[1.5rem] p-4 cursor-pointer border-2 transition-[border-color,background-color]", c.label === "زمردي" ? "border-primary bg-primary/5" : "border-transparent hover:border-foreground/20")}>
              <div className="flex justify-between items-start mb-4">
                 <div className="flex gap-1">
                   <div className="w-2 h-2 rounded-full bg-foreground/20" />
                   <div className="w-2 h-2 rounded-full bg-foreground/10" />
                   <div className="w-2 h-2 rounded-full bg-background" />
                 </div>
                 {c.label === "زمردي" && <div className="w-2 h-2 rounded-full bg-white ring-2 ring-primary ring-offset-2 ring-offset-background" />}
              </div>
              <div className="text-xs font-black">{c.label}</div>
              <div className="text-[9px] text-muted-foreground font-bold">{c.sub}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-muted-foreground font-bold text-center opacity-60">تُحفظ اختياراتك فوراً وتظل ثابتة بعد تسجيل الدخول والريلود.</p>
      </Section>
    </div>
  );
}

/* ------------------------------ الحساب ------------------------------ */
const dateFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "غير معروف");

function AccountTab({ onSignOut }: { onSignOut: () => void }) {
  const { user, authReady, hasPassword } = useAccount();
  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <IdentityCard onSignOut={onSignOut} />
      <div className="grid gap-6">
        <Section
          icon={<KeyRound className="w-5 h-5" />}
          title={hasPassword ? "كلمة المرور" : "إضافة كلمة مرور"}
          hint="حماية الخصوصية والأمان"
        >
          {authReady ? <ChangePassword mode={hasPassword ? "change" : "add"} /> : <LineSkeleton rows={3} />}
        </Section>

        {user?.provider === "google" ? null : (
          <Section icon={<Mail className="w-5 h-5" />} title="البريد الإلكتروني" hint="تحديث وسيلة التواصل الأساسية">
            <ChangeEmail />
          </Section>
        )}
      </div>
    </div>
  );
}

function useAccount() {
  const p = useProfile();
  return { ...p, hasPassword: p.user?.hasPassword ?? false };
}

function LineSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="grid gap-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} className="block h-9 animate-pulse rounded-2xl bg-foreground/[0.06]" />
      ))}
    </div>
  );
}

function providerLabel(p: string) {
  if (p === "google") return "جوجل";
  if (p === "email") return "بريد وكلمة سر";
  return p;
}

/** يقلّل الصورة لمربع 256px ويرجّعها كـ data URL خفيف. */
async function shrinkImage(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر معالجة الصورة");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side, side, 0, 0, size, size,
  );
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

function IdentityCard({ onSignOut }: { onSignOut: () => void }) {
  const { user, label, avatar, profile, save, loading } = useProfile();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setName(profile.displayName || user?.metaName || ""); }, [profile.displayName, user?.metaName]);

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("اختار صورة صح"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("الصورة كبيرة جداً (أقصى 8 ميجا)"); return; }
    setUploading(true);
    try {
      const dataUrl = await shrinkImage(file);
      await save({ avatarUrl: dataUrl });
      toast.success("تم تحديث صورتك");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر رفع الصورة");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setUploading(true);
    try {
      await save({ avatarUrl: null });
      toast.success("تم حذف الصورة");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر الحذف");
    } finally { setUploading(false); }
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length > 60) { toast.error("الاسم طويل جداً"); return; }
    setBusy(true);
    try {
      await save({ displayName: trimmed });
      toast.success("تم تحديث اسم العرض");
      setEditing(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally { setBusy(false); }
  };


  return (
    <Section icon={<UserRound className="w-5 h-5" />} title="هويتك" hint="الحساب المسجل دخوله حالياً على الجهاز.">
      {loading ? (
        <LineSkeleton rows={4} />
      ) : !user ? (
        <p className="text-sm text-muted-foreground">مفيش حساب مسجل دخوله.</p>
      ) : (
        <div className="grid gap-5">
          {/* Identity plate - flat */}
          <div className="flex items-center gap-5 rounded-2xl border border-foreground/10 bg-card/70 p-6">
              <UserAvatar size={58} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold leading-tight">{label || "بدون اسم"}</div>
                <div dir="ltr" className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {user.email ?? "—"}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(user.providers.length ? user.providers : ["unknown"]).map((p: string) => (
                    <Badge key={p} variant="secondary" className="rounded-xl px-3 py-1 text-xs font-black uppercase tracking-[0.12em] bg-foreground/10 border-none">
                      {providerLabel(p)}
                    </Badge>
                  ))}
                  <Badge
                    variant="outline"
                    className={cn("rounded-xl px-3 py-1 text-xs font-black uppercase tracking-[0.12em] border-none", user.emailConfirmed ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}
                  >
                    {user.emailConfirmed ? (
                      <><ShieldCheck className="mr-1 h-3 w-3" /> مؤكد</>
                    ) : (
                      <><ShieldAlert className="mr-1 h-3 w-3" /> غير مؤكد</>
                    )}
                  </Badge>
                </div>
              </div>
          </div>

          {/* Display name */}
          <div className="grid gap-2">
            <Label>اسم العرض</Label>
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); setEditing(true); }}
                placeholder={user.metaName ?? "اكتب اسمك"}
                maxLength={60}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]"
              />
              <Button onClick={submit} disabled={busy || !editing} variant="secondary" className="h-11 shrink-0 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-[background-color,border-color,color,box-shadow,transform,opacity] px-6 font-bold">
                <Save className="h-4 w-4 opacity-60" /> حفظ
              </Button>
            </div>
          </div>


          {/* Avatar upload */}
          <div className="grid gap-2">
            <Label>صورتك</Label>
            <div className="flex items-center gap-3">
              <UserAvatar size={48} />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickAvatar(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-[background-color,border-color,color,box-shadow,transform,opacity] px-6 font-bold"
              >
                <UserRound className="h-4 w-4 opacity-60" /> {uploading ? "جاري الرفع..." : avatar ? "تغيير الصورة" : "رفع صورة"}
              </Button>
              {profile.avatarUrl ? (
                <Button type="button" variant="ghost" disabled={uploading} onClick={removeAvatar} className="text-destructive">
                  حذف
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              اختار صورة من جهازك — بنصغّرها تلقائياً. لو مفيش صورة بنستخدم صورة حساب جوجل.
            </p>
          </div>


          <Separator />

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-foreground/[0.04] p-3">
              <dt className="mb-1 block text-[11px] text-muted-foreground">تاريخ إنشاء الحساب</dt>
              <dd className="font-medium">{fmtDate(user.createdAt)}</dd>
            </div>
            <div className="rounded-2xl bg-foreground/[0.04] p-3">
              <dt className="mb-1 block text-[11px] text-muted-foreground">آخر تسجيل دخول</dt>
              <dd className="font-medium">{fmtDate(user.lastSignInAt)}</dd>
            </div>
          </dl>

          <Button
            variant="outline"
            className="w-full gap-1.5 text-destructive transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-destructive/10 hover:text-destructive active:scale-[0.98]"
            onClick={onSignOut}
          >
            <LogOut className="w-4 h-4" /> تسجيل الخروج
          </Button>
        </div>
      )}
    </Section>
  );
}

function ChangeEmail() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast.error("بريد غير صحيح"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success("بعتنا رسالة تأكيد على البريد الجديد");
      setEmail("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "تعذر التغيير");
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="grid gap-2">
      <Label>البريد الجديد</Label>
      <Input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="new@email.com" type="email" className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]" />
      <p className="rounded-2xl bg-warning/10 p-3 text-[11px] leading-relaxed text-muted-foreground">
        البريد <span className="font-semibold text-foreground">مش بيتغير فوراً</span>: هنبعت رسالة تأكيد على البريد الجديد،
        ولازم تفتح اللينك اللي جواها. لحد ما تأكّد، تسجيل الدخول يفضل بالبريد القديم.
      </p>
      <Button type="submit" variant="secondary" disabled={busy} className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-[background-color,border-color,color,box-shadow,transform,opacity] px-6 font-bold">
        <Mail className="w-4 h-4 opacity-60" /> {busy ? "جاري الإرسال..." : "تأكيد تغيير البريد"}
      </Button>
    </form>
  );
}


function ChangePassword({ mode = "change" }: { mode?: "change" | "add" }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const strength = pwStrength(pw);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) { toast.error("كلمة السر 6 أحرف على الأقل"); return; }
    if (pw !== pw2) { toast.error("كلمتا السر غير متطابقتين"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("تم تغيير كلمة السر");
      setPw(""); setPw2("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "تعذر التغيير");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field label="كلمة السر الجديدة">
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" placeholder="••••••••" maxLength={72} className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]" />
      </Field>
      {pw ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${strength.cls}`}
              style={{ width: `${strength.pct}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">{strength.label}</span>
        </div>
      ) : null}
      <Field label="تأكيد كلمة السر">
        <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} dir="ltr" placeholder="••••••••" maxLength={72} className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]" />
      </Field>
      <Button type="submit" variant="secondary" disabled={busy} className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-[background-color,border-color,color,box-shadow,transform,opacity] px-6 font-bold">
        <KeyRound className="w-4 h-4 opacity-60" /> {busy ? "جاري الحفظ..." : mode === "add" ? "إضافة كلمة مرور" : "تحديث كلمة المرور"}
      </Button>
    </form>
  );
}

function pwStrength(pw: string) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { pct: 33, cls: "bg-danger", label: "ضعيفة" };
  if (score === 3) return { pct: 66, cls: "bg-warning", label: "متوسطة" };
  return { pct: 100, cls: "bg-success", label: "قوية" };
}

/* ------------------------------ البيانات ------------------------------ */
function DataTab() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [restoreInput, setRestoreInput] = useState<HTMLInputElement | null>(null);

  const load = useCallback(() => {
    dataCounts().then(setCounts).catch(() => setCounts({}));
  }, []);
  useEffect(load, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "حصلت مشكلة"); }
    finally { setBusy(null); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <Section icon={<Database className="w-5 h-5" />} title="ملخص بياناتك" hint="عدد السجلات المخزّنة على حسابك.">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TABLE_LABELS).map(([key, label]) => (
            <div key={key} className="rounded-2xl bg-foreground/[0.03] border border-foreground/5 p-4 flex items-center justify-between transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:bg-foreground/[0.05]">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{label}</span>
              <span className="text-sm font-black tabular-nums text-foreground">{counts ? fmt(counts[key] ?? 0) : "…"}</span>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-4 gap-2 rounded-xl text-xs font-black uppercase tracking-[0.12em] opacity-60 hover:opacity-100" onClick={load}>
          <RotateCcw className="w-3.5 h-3.5" /> تحديث الإحصائيات
        </Button>
      </Section>

      <div className="grid gap-6 h-fit">
        <Section icon={<FileJson className="w-5 h-5" />} title="نسخة احتياطية" hint="نزّل كل بياناتك على جهازك في ملف واحد.">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary" className="h-12 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-[background-color,border-color,color,box-shadow,transform,opacity] px-6 font-bold flex-1" disabled={busy !== null}
              onClick={() => run("json", downloadJsonBackup, "تم تنزيل النسخة الاحتياطية (JSON)")}
            >
              <FileJson className="w-4 h-4 opacity-60" /> تنزيل JSON
            </Button>
            <Button
              variant="secondary" className="h-12 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-[background-color,border-color,color,box-shadow,transform,opacity] px-6 font-bold flex-1" disabled={busy !== null}
              onClick={() => run("xlsx", downloadExcelBackup, "تم تنزيل ملف Excel")}
            >
              <FileSpreadsheet className="w-4 h-4 opacity-60" /> تنزيل Excel
            </Button>
            <input ref={setRestoreInput} type="file" accept="application/json" className="hidden" onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                const report = await restoreJsonBackup(JSON.parse(await file.text()));
                toast.success(`تم الاسترجاع: ${report.inserted} صف، وتم تخطي ${report.skipped} صف`);
                if (report.failed.length > 0) toast.error(`تعذر استرجاع ${report.failed.length} صف`);
                load();
              } catch (error: unknown) { toast.error(error instanceof Error ? error.message : "تعذر استرجاع النسخة"); }
            }} />
            <Button variant="outline" className="h-12 gap-2 rounded-2xl px-6 font-bold" disabled={busy !== null} onClick={() => restoreInput?.click()}>
              <Upload className="w-4 h-4" /> استرجاع JSON
            </Button>
          </div>
        </Section>

        <Section icon={<ShieldAlert className="w-5 h-5" />} title="منطقة الخطر" hint="حذف كل العملاء والفواتير والمخزن والمصروفات نهائياً. بيانات المحل بتفضل زي ما هي.">
          <Button
            variant="outline"
            className="h-12 w-full gap-2 rounded-2xl text-danger border-danger/20 bg-danger/[0.02] hover:bg-danger/10 hover:border-danger/40 transition-[background-color,border-color,color,box-shadow,transform,opacity] font-black"
            onClick={() => { setConfirmText(""); setConfirmOpen(true); }}
          >
            <Trash2 className="w-4 h-4" /> مسح كافة البيانات نهائياً
          </Button>
        </Section>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl" className="rounded-2xl border-danger/10 bg-card/95 backdrop-blur-2xl p-8 max-w-lg shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-2xl font-black tracking-tight text-danger">حذف كل البيانات؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right text-sm leading-relaxed">
              هذا الإجراء سيقوم بمسح كافة الفواتير، العملاء، الموردين، والمخزون بشكل نهائي. لا يمكن التراجع عن هذه الخطوة.
              <br /><br />
              لتأكيد الحذف، يرجى كتابة كلمة <strong className="text-foreground">حذف</strong> في الحقل أدناه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="اكتب حذف هنا" className="h-12 rounded-2xl bg-foreground/[0.03] border-danger/20 focus:border-danger transition-[background-color,border-color,color,box-shadow,transform,opacity] text-center font-bold" />
          <AlertDialogFooter className="mt-6 gap-3 sm:justify-end">
            <AlertDialogCancel className="rounded-2xl border-none hover:bg-foreground/5 h-12 px-6 font-bold">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText.trim() !== "حذف" || busy !== null}
              className="rounded-2xl bg-danger h-12 px-8 font-black text-white transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:bg-danger/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-danger/20"
              onClick={async () => {
                await run("wipe", wipeAllData, "تم حذف كل البيانات");
                setConfirmOpen(false);
                load();
              }}
            >
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div dir="rtl" className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-4 text-right group">
      <div className="mt-2 text-right">
        <Label className="text-xs font-black tracking-tight group-hover:text-foreground transition-colors">{label}</Label>
        {hint && <p className="mt-1 text-xs font-bold text-muted-foreground uppercase tracking-[0.12em] leading-relaxed opacity-60">{hint}</p>}
      </div>
      <div className="min-w-0 grid gap-2 text-right">
        {children}
      </div>
    </div>
  );
}

/** Reads an image file and returns a square-fit PNG data URL of at most `max` px. */
function resizeImage(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/* --------------------------- الفريق والصلاحيات --------------------------- */
const ALL_ROLES: AppRole[] = ["owner", "manager", "seller"];

function RoleBadge({ role, big = false }: { role: AppRole; big?: boolean }) {
  const tone: Record<AppRole, string> = {
    owner: "bg-primary/10 text-primary border-primary/20",
    manager: "bg-info/10 text-info border-info/20",
    seller: "bg-foreground/5 text-muted-foreground border-foreground/10",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl border font-black uppercase tracking-[0.12em] ${tone[role]} ${
        big ? "px-5 py-2 text-xs" : "px-3 py-1.5 text-[9px]"
      }`}
    >
      <ShieldCheck className={big ? "w-4 h-4" : "w-3 h-3"} />
      {ROLE_LABEL[role]}
    </span>
  );
}

function TeamTab() {
  const { role: myRole, isOwner, loading: roleLoading, reload: reloadRole } = useMyRole();
  const { members, invites, loading, setRole, removeMember, revokeInvite, reload } = useTeam();
  const [removing, setRemoving] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("seller");
  const [sending, setSending] = useState(false);
  const sendInvite = useServerFn(inviteTeamMember);
  const pending = invites.filter((i) => i.status === "pending");

  const submitInvite = async () => {
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) { toast.error("اكتب بريد إلكتروني صحيح"); return; }
    setSending(true);
    try {
      const res = await sendInvite({
        data: {
          email: parsed.data,
          role: inviteRole,
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined,
        },
      });
      if (res.status === "added") toast.success("الحساب موجود بالفعل — تمت إضافته للفريق");
      else if (res.status === "pending_no_email") toast.success("تم تسجيل الدعوة — لكن رسالة البريد مبعتتش");
      else toast.success("تم إرسال الدعوة على البريد");
      setInviteOpen(false); setEmail(""); setInviteRole("seller");
      await Promise.all([reload(), reloadRole()]);
    } catch (e: any) {
      toast.error(e?.message || "تعذّر إرسال الدعوة");
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-5">
      {/* صلاحيتك */}
      <Section
        icon={<ShieldCheck className="w-5 h-5" />}
        title="صلاحيتك"
        hint="حدد للمدير والبائع إيه اللي يقدروا يعملوه. صلاحية المالك ثابتة ومش قابلة للتعديل."
      >
        {roleLoading ? (
          <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4 p-6 rounded-[2rem] bg-foreground/[0.03] border border-foreground/10">
              {myRole ? <RoleBadge role={myRole} big /> : (
                <span className="rounded-xl bg-foreground/5 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground border border-foreground/10">
                  بدون صلاحية
                </span>
              )}
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em] leading-relaxed opacity-60">
                {myRole ? ROLE_HINT[myRole] : "لم يتم العثور على صلاحيات مسجلة لحسابك حالياً."}
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-foreground/10 bg-card/70">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-foreground/5 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground/60 bg-foreground/[0.02]">
                      <th className="py-4 px-6 text-right">صلاحيات النظام</th>
                      {ALL_ROLES.map((r) => (
                        <th key={r} className="py-4 px-4 whitespace-nowrap">{ROLE_LABEL[r]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ABILITIES.map((a) => (
                      <tr key={a.label} className="border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.01] transition-colors">
                        <td className="py-3.5 px-6 text-right font-bold text-xs">{a.label}</td>
                        {ALL_ROLES.map((r) => {
                          const ok = a.roles.includes(r);
                          return (
                            <td key={r} className={`py-3.5 px-4 text-center ${myRole === r ? "bg-primary/[0.03]" : ""}`}>
                              <span className={ok ? "text-success font-black" : "text-muted-foreground/20"}>{ok ? "✓" : "✗"}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
        )}
      </Section>

      {/* أعضاء الفريق */}
      <Section
        icon={<Users className="w-5 h-5" />}
        title="أعضاء الفريق"
        hint={isOwner ? "المالك بس اللي يقدر يدعو أعضاء ويغيّر الصلاحيات." : "المالك بس اللي يقدر يعدّل الصلاحيات."}
      >
        {isOwner && (
          <div className="mb-4 flex justify-start">
            <Button onClick={() => setInviteOpen(true)} className="group rounded-[1.75rem] ps-6 pe-2 py-2 h-12 gap-4 bg-primary text-black font-black shadow-lg shadow-primary/20 transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:scale-[1.02] active:scale-[0.98]">
              <span className="text-xs uppercase tracking-[0.12em]">دعوة عضو جديد</span>
              <span className="w-8 h-8 rounded-2xl bg-black/10 grid place-items-center transition-transform duration-500 group-hover:-translate-x-1">
                <Mail className="w-4 h-4" />
              </span>
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-2xl border border-foreground/10 bg-card/70 px-6 py-12 text-center">
              <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-foreground/[0.06] text-foreground">
                <Users className="w-5 h-5" />
              </span>
              <p className="font-semibold">لسه مفيش أعضاء في الفريق</p>
              <p className="mt-1 text-xs text-muted-foreground">ابعت دعوة بالبريد وحدّد صلاحية العضو.</p>
              {isOwner && (
                <Button onClick={() => setInviteOpen(true)} className="mt-5 rounded-2xl px-8 h-11 bg-primary text-black font-black shadow-lg shadow-primary/20">دعوة عضو</Button>
              )}
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-card/70 p-4 transition-[border-color,background-color] hover:border-foreground/20 hover:bg-card"
              >
                  <div className="flex items-center gap-3 min-w-0">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt="" className="w-10 h-10 rounded-2xl object-cover ring-1 ring-foreground/10" />
                    ) : (
                      <span className="w-10 h-10 rounded-2xl bg-foreground/[0.06] text-foreground grid place-items-center font-black text-xs">
                        {m.displayName.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="font-black text-sm tracking-tight truncate">
                        {m.displayName}{m.isMe ? " (أنت)" : ""}
                      </div>
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em] opacity-60">آخر ظهور: {relativeTime(m.lastSeenAt)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOwner && !m.isMe ? (
                      <Select
                        value={m.role}
                        onValueChange={async (v) => {
                          try { await setRole(m.userId, v as AppRole); toast.success("تم تحديث الصلاحية"); }
                          catch (e: any) { toast.error(e.message || "خطأ"); }
                        }}
                      >
                        <SelectTrigger className="w-32 h-9 rounded-xl bg-foreground/[0.03] border-none font-bold text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent dir="rtl">
                          {ALL_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <RoleBadge role={m.role} />
                    )}
                    {isOwner && !m.isMe && (
                      <Button
                        size="icon" variant="ghost" title="إزالة العضو"
                        className="h-9 w-9 rounded-xl text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                        onClick={() => setRemoving(m.userId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
              </div>
            ))}
          </div>
        )}

        {isOwner && pending.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">دعوات مُرسلة</p>
            <div className="space-y-2">
              {pending.map((iv) => (
                <div key={iv.id} className="rounded-[1.75rem] border border-dashed border-foreground/10 p-4 flex items-center justify-between gap-4 bg-foreground/[0.01]">
                  <div className="min-w-0">
                    <div className="truncate font-black text-xs">{iv.email}</div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em] opacity-60">
                      تنتهي في: {new Date(iv.expiresAt).toLocaleDateString("en-US")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RoleBadge role={iv.role} />
                    <Button
                      size="sm" variant="ghost" className="rounded-xl h-9 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                      onClick={async () => {
                        try { await revokeInvite(iv.id); toast.success("تم إلغاء الدعوة"); }
                        catch (e: any) { toast.error(e.message || "خطأ"); }
                      }}
                    >إلغاء</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* دعوة عضو */}
      <AlertDialog open={inviteOpen} onOpenChange={(v) => !v && setInviteOpen(false)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl border-foreground/10 bg-card/95 backdrop-blur-2xl p-8 max-w-lg shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-2xl font-black tracking-tight">دعوة عضو جديد</AlertDialogTitle>
            <AlertDialogDescription className="text-right text-[11px] font-bold text-muted-foreground uppercase tracking-[0.12em] leading-relaxed opacity-60">
              سيتم إرسال دعوة رسمية عبر البريد الإلكتروني لتفعيل حساب العضو الجديد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-right">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">البريد الإلكتروني</Label>
              <Input dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity]" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">الصلاحية</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-[background-color,border-color,color,box-shadow,transform,opacity] font-bold"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="font-bold text-xs">{ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em] leading-relaxed italic px-1 opacity-60">{ROLE_HINT[inviteRole]}</p>
            </div>
          </div>
          <AlertDialogFooter className="mt-8 gap-3 sm:justify-end">
            <AlertDialogCancel disabled={sending} className="rounded-2xl border-none hover:bg-foreground/5 h-12 px-6 font-bold">إلغاء</AlertDialogCancel>
            <Button onClick={submitInvite} disabled={sending} className="rounded-2xl bg-primary h-12 px-8 font-black text-black transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20">
              {sending ? "جاري الإرسال…" : "إرسال الدعوة"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl border-danger/10 bg-card/95 backdrop-blur-2xl p-8 max-w-lg shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-2xl font-black tracking-tight text-danger">إزالة العضو؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right text-[11px] font-bold text-muted-foreground uppercase tracking-[0.12em] leading-relaxed opacity-60">
              سيتم سحب جميع الصلاحيات الممنوحة لهذا العضو فوراً، ولن يتمكن من الوصول إلى النظام مجدداً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3 sm:justify-end">
            <AlertDialogCancel className="rounded-2xl border-none hover:bg-foreground/5 h-12 px-6 font-bold text-xs uppercase tracking-[0.12em]">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-danger h-12 px-8 font-black text-white transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:bg-danger/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-danger/20 text-xs uppercase tracking-[0.12em]"
              onClick={async () => {
                try { await removeMember(removing!); toast.success("تمت الإزالة"); }
                catch (e: any) { toast.error(e.message || "خطأ"); }
                setRemoving(null);
              }}
            >تأكيد الإزالة</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
