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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  useProfile,
  useShopSettings,
  saveShopSettings,
  fmt,
  type ShopSettings,
  type ThemeMode,
  type PrintPaper,
  type ColorPalette,
  type NumeralsFormat,
  type AutoBackupFrequency,
  DEFAULT_EXPENSE_CATEGORIES_LIST,
} from "@/lib/store";
import {
  applyTheme,
  PALETTES_CONFIG,
  storePalette,
  type ColorPalette as LibColorPalette,
} from "@/lib/theme";
import {
  downloadExcelBackup,
  downloadJsonBackup,
  downloadAccountingAuditLog,
  resetInventoryStock,
  resetCustomerOpeningBalances,
  dataCounts,
  restoreJsonBackup,
  wipeAllData,
} from "@/lib/backup";
import { cn } from "@/lib/utils";
import {
  Settings as SettingsIcon,
  Store,
  KeyRound,
  Save,
  LogOut,
  Receipt,
  Bell,
  Palette,
  Database,
  Upload,
  Trash2,
  FileJson,
  FileSpreadsheet,
  RotateCcw,
  ShieldAlert,
  Mail,
  UserRound,
  ShieldCheck,
  Users,
  Globe,
  Building2,
  Phone,
  MessageCircle,
  Volume2,
  Sparkles,
  Percent,
  Printer,
  ShoppingBag,
  Truck,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Binary,
  Clock,
  HeartHandshake,
  Tag,
  Plus,
  X,
} from "lucide-react";
import { UserAvatar } from "@/components/UserChip";
import {
  useMyRole,
  useTeam,
  ROLE_LABEL,
  ROLE_HINT,
  ABILITIES,
  relativeTime,
  type AppRole,
} from "@/lib/roles";
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
  defaultInstallmentMonths: z
    .number()
    .int()
    .min(1, "شهر واحد على الأقل")
    .max(60, "60 شهر كحد أقصى"),
  defaultDueDay: z.number().int().min(1).max(28),
  reminderDaysBefore: z.number().int().min(0).max(30),
  printPaper: z.enum(["a4", "thermal"]),
  theme: z.enum(["dark", "light", "system"]),
    alertsEnabled: z.boolean(),
  colorPalette: z.string(),
  numeralsFormat: z.enum(["latn", "arab"]),
  autoBackupFrequency: z.enum(["weekly", "monthly", "off"]),
  commercialRegister: z.string().max(50),
  email: z.string().max(100),
  website: z.string().max(200),
  enableVat: z.boolean(),
  defaultVatRate: z.number(),
  warrantyPolicy: z.string().max(500),
  autoPrintOnSave: z.boolean(),
  thermalShowBarcode: z.boolean(),
  thermalShowHeader: z.boolean(),
  customExpenseCategories: z.array(z.string()),
  whatsappReminderTemplate: z.string(),
  whatsappPaymentThankYouTemplate: z.string(),
  criticalOverdueDays: z.number().int().min(1).max(60),
  audioAlertsEnabled: z.boolean(),
  // Extended fields
  commercialRegister: z.string().trim().max(50, "السجل التجاري طويل جداً").optional(),
  email: z.string().trim().max(100).optional(),
  website: z.string().trim().max(200).optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  enableVat: z.boolean().optional(),
  warrantyPolicy: z.string().trim().max(500, "شروط الضمان طويلة جداً").optional(),
  autoPrintOnSave: z.boolean().optional(),
  thermalShowBarcode: z.boolean().optional(),
  thermalShowHeader: z.boolean().optional(),
  whatsappReminderTemplate: z.string().trim().max(600).optional(),
  whatsappPaymentThankYouTemplate: z.string().trim().max(600).optional(),
  criticalOverdueDays: z.number().int().min(1).max(180).optional(),
  audioAlertsEnabled: z.boolean().optional(),
  colorPalette: z.string().optional(),
  numeralsFormat: z.enum(["latn", "arab"]).optional(),
  autoBackupFrequency: z.enum(["off", "weekly", "monthly"]).optional(),
  customExpenseCategories: z.array(z.string().trim()).optional(),
});

const TABLE_LABELS: Record<string, string> = {
  customers: "العملاء",
  suppliers: "الموردين",
  invoices: "فواتير البيع",
  invoice_items: "أصناف الفواتير",
  payments: "الدفعات والتحصيلات",
  purchases: "فواتير الشراء",
  purchase_items: "أصناف الشراء",
  supplier_payments: "مدفوعات الموردين",
  stock_items: "أصناف المخزن",
  stock_adjustments: "تسويات المخزن",
  expenses: "المصروفات",
};

/** Plays a gentle synthesized test beep */
function playTestAlert() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch {
    /* ignore audio context restrictions */
  }
}

function SettingsPage() {
  const { settings, loading } = useShopSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState<ShopSettings>(settings);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    applyTheme(form.theme, form.colorPalette);
  }, [form.theme, form.colorPalette]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(settings), [form, settings]);

  const set = useCallback(
    <K extends keyof ShopSettings>(k: K, v: ShopSettings[K]) => setForm((f) => ({ ...f, [k]: v })),
    [],
  );

  const save = async () => {
    const parsed = shopSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      await saveShopSettings({ ...form, ...parsed.data } as ShopSettings);
      if (form.colorPalette) {
        storePalette(form.colorPalette as LibColorPalette);
      }
      toast.success("تم حفظ جميع الإعدادات بنجاح");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="text-right">
      <PageHeader
        title="الإعدادات الشاملة"
        subtitle="بيانات المحل، الفواتير والضرائب، التنبيهات والواتساب، المظهر ولوحات الألوان، الفريق، والبيانات."
        icon={<SettingsIcon className="w-7 h-7 text-primary" />}
      />

      <Tabs defaultValue="shop" dir="rtl" className="w-full text-right">
        {/* شريط التنقل الملتصق بتأثير بلوري */}
        <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-background/70 backdrop-blur-xl border-b border-foreground/5 mb-8">
          <TabsList
            dir="rtl"
            className="h-auto w-full bg-transparent justify-start gap-2 border-none p-0 rounded-none overflow-x-auto custom-scrollbar no-scrollbar"
          >
            {[
              { value: "shop", label: "المحل والنشاط", icon: Store },
              { value: "billing", label: "الفواتير والطباعة", icon: Receipt },
              { value: "alerts", label: "التنبيهات والواتساب", icon: Bell },
              { value: "appearance", label: "المظهر والألوان", icon: Palette },
              { value: "team", label: "الفريق والصلاحيات", icon: Users },
              { value: "integrations", label: "المتجر والشحن", icon: ShoppingBag },
              { value: "account", label: "الحساب والأمان", icon: KeyRound },
              { value: "data", label: "البيانات والنسخ", icon: Database },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative h-11 px-5 gap-2 rounded-2xl border-b-2 border-transparent bg-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all duration-300 font-bold opacity-75 data-[state=active]:opacity-100 hover:opacity-100 whitespace-nowrap"
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="shop">
          <ShopTab form={form} set={set} />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab form={form} set={set} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsTab form={form} set={set} />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceTab form={form} set={set} />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="account">
          <AccountTab
            onSignOut={async () => {
              await supabase.auth.signOut();
              navigate("/landing");
            }}
          />
        </TabsContent>
        <TabsContent value="data">
          <DataTab form={form} set={set} />
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-4 mt-12 z-20 mx-auto max-w-2xl px-4">
        <div className="plate-glow flex items-center justify-between gap-6 rounded-[2rem] border border-primary/20 bg-background/85 p-3 backdrop-blur-xl shadow-2xl shadow-primary/10">
          <div className="flex items-center gap-3 px-3">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full animate-pulse",
                dirty ? "bg-amber-500" : "bg-emerald-500",
              )}
            />
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              {dirty ? "هناك تعديلات غير محفوظة" : "جميع التعديلات محفوظة"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!dirty || busy}
              onClick={() => setForm(settings)}
              className="rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              تراجع
            </Button>
            <Button
              onClick={save}
              disabled={!dirty || busy}
              className="h-11 px-8 gap-2 rounded-2xl bg-primary text-black font-black shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Save className="w-4 h-4" /> {busy ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TabProps {
  form: ShopSettings;
  set: <K extends keyof ShopSettings>(k: K, v: ShopSettings[K]) => void;
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2.5rem] bg-card/60 backdrop-blur-md border border-foreground/5 p-6 shadow-sm">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight">{title}</h3>
          {hint && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------- 1. المحل والنشاط ------------------------------- */
function ShopTab({ form, set }: TabProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختار صورة صالحة من فضلك");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("حجم الصورة أكبر من 3 ميجابايت");
      return;
    }
    try {
      const dataUrl = await shrinkImage(file, 256);
      set("logoUrl", dataUrl);
      toast.success("تم تحميل اللوجو بنجاح");
    } catch {
      toast.error("تعذر معالجة الصورة");
    }
  };

  const testWhatsAppNumber = () => {
    const raw = (form.whatsapp || form.phone || "").replace(/\D/g, "");
    if (!raw) {
      toast.error("يرجى إدخال رقم هاتف أو واتساب أولاً");
      return;
    }
    const cleanNumber = raw.startsWith("0") ? `2${raw}` : raw;
    const msg = encodeURIComponent(`مرحباً بك من متجر ${form.shopName || "سجلي"}`);
    window.open(`https://wa.me/${cleanNumber}?text=${msg}`, "_blank");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <Section
        icon={<Store className="w-5 h-5" />}
        title="هوية المحل والنشاط التجاري"
        hint="البيانات الأساسية التي تظهر في ترويسة الفواتير وسندات القبض وبوليصات الشحن."
      >
        <div className="grid gap-3">
          <Field label="اسم النشاط التجاري">
            <Input
              value={form.shopName}
              onChange={(e) => set("shopName", e.target.value)}
              placeholder="مثال: شركة النور للتجارة والتوزيع"
              maxLength={80}
              className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="رقم التليفون">
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="01xxxxxxxxx"
                dir="ltr"
                maxLength={30}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
            <Field label="رقم الواتساب" hint="يستخدم لإرسال تنبيهات الأقساط">
              <div className="relative flex items-center">
                <Input
                  value={form.whatsapp}
                  onChange={(e) => set("whatsapp", e.target.value)}
                  placeholder="201xxxxxxxxx"
                  dir="ltr"
                  maxLength={30}
                  className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all pl-10"
                />
                {form.whatsapp && (
                  <button
                    type="button"
                    onClick={testWhatsAppNumber}
                    title="اختبار فتح محادثة الواتساب"
                    className="absolute left-2.5 p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="السجل التجاري (CR)">
              <Input
                value={form.commercialRegister || ""}
                onChange={(e) => set("commercialRegister", e.target.value)}
                placeholder="مثال: 104523"
                dir="ltr"
                maxLength={50}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
            <Field label="الرقم الضريبي (TR)">
              <Input
                value={form.taxNumber}
                onChange={(e) => set("taxNumber", e.target.value)}
                placeholder="000-000-000"
                dir="ltr"
                maxLength={40}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="البريد الإلكتروني للنشاط">
              <Input
                value={form.email || ""}
                onChange={(e) => set("email", e.target.value)}
                placeholder="info@shop.com"
                dir="ltr"
                maxLength={100}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
            <Field label="الموقع / رابط المتجر">
              <Input
                value={form.website || ""}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://..."
                dir="ltr"
                maxLength={200}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
          </div>

          <Field label="العنوان الجغرافي">
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="مثال: القاهرة، حي المعادي - شارع النصر"
              maxLength={200}
              className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
            />
          </Field>

          <Field label="ملاحظة أسفل الفاتورة">
            <Textarea
              value={form.footerNote}
              onChange={(e) => set("footerNote", e.target.value)}
              placeholder="مثال: البضاعة المباعة لا ترد بعد 14 يوماً مع تقديم أصل الفاتورة."
              maxLength={300}
              rows={2}
              className="rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all resize-none p-3.5 text-xs"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] font-bold text-muted-foreground/60">
                {form.footerNote.length}/300
              </span>
            </div>
          </Field>
        </div>
      </Section>

      <div className="grid gap-6 h-fit order-first lg:order-none">
        <Section
          icon={<Upload className="w-5 h-5" />}
          title="شعار المحل (Logo)"
          hint="شعار مربع أو دائري يظهر في الفواتير والمطبوعات."
        >
          <div className="flex items-start gap-4">
            <div className="h-24 w-24 rounded-[2rem] border-2 border-dashed border-foreground/10 bg-foreground/[0.02] grid place-items-center overflow-hidden shrink-0 transition-all hover:border-primary/40 hover:bg-primary/5">
              {form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt="لوجو المحل"
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <Store className="w-8 h-8 text-muted-foreground/40" />
              )}
            </div>
            <div className="grid gap-2 flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onLogo(e.target.files?.[0])}
              />
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-10 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all px-4 font-bold"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-4 h-4" /> رفع صورة
                </Button>
                {form.logoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10 gap-2 rounded-2xl text-danger hover:bg-danger/10 transition-all px-4 font-bold"
                    onClick={() => set("logoUrl", null)}
                  >
                    <Trash2 className="w-4 h-4" /> حذف
                  </Button>
                ) : null}
              </div>
              <Input
                value={form.logoUrl?.startsWith("data:") ? "" : (form.logoUrl ?? "")}
                onChange={(e) => set("logoUrl", e.target.value || null)}
                placeholder="أو ضع رابطاً مباشراً للصورة https://..."
                dir="ltr"
                className="h-10 rounded-xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all text-xs"
              />
            </div>
          </div>
        </Section>

        <Section
          icon={<Receipt className="w-5 h-5" />}
          title="معاينة رأس الفاتورة الرسمية"
          hint="شكل الترويسة المطبوعة كما تظهر للعميل."
        >
          <div className="rounded-[2.5rem] bg-foreground/[0.02] p-2 border border-foreground/5 shadow-inner">
            <div className="rounded-[calc(2.5rem-0.5rem)] bg-card p-6 backdrop-blur-md shadow-xl border border-white/5">
              <div className="flex items-start justify-between gap-3 border-b-2 border-primary/20 pb-4">
                <div className="flex items-center gap-4">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt=""
                      className="h-12 w-12 object-contain rounded-xl bg-white p-1 shadow-sm"
                    />
                  ) : null}
                  <div className="text-right">
                    <div className="text-xl font-black tracking-tight text-foreground">
                      {form.shopName || "اسم المحل أو النشاط"}
                    </div>
                    <div className="text-[11px] font-medium text-muted-foreground mt-0.5">
                      {form.address || "عنوان المحل الرئيسي"}
                    </div>
                    {form.email && (
                      <div className="text-[10px] text-muted-foreground/80 font-mono" dir="ltr">
                        {form.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] font-black text-muted-foreground text-left leading-5 tracking-wider">
                  <div dir="ltr">{form.phone || "01xxxxxxxxx"}</div>
                  {form.taxNumber ? <div dir="ltr">T.R: {form.taxNumber}</div> : null}
                  {form.commercialRegister ? <div dir="ltr">C.R: {form.commercialRegister}</div> : null}
                  <Badge
                    variant="secondary"
                    className="mt-2 rounded-lg bg-primary/10 text-primary border-none text-[9px] font-black"
                  >
                    {form.invoicePrefix || "INV"}-0001
                  </Badge>
                </div>
              </div>
              <div className="pt-3 text-[10px] font-bold text-muted-foreground/70 leading-relaxed italic">
                {form.footerNote || "ملاحظة الفاتورة المطبوعة في الأسفل..."}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ------------------------- 2. الفواتير والطباعة والضرائب ------------------------- */
function BillingTab({ form, set }: TabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <Section
        icon={<Receipt className="w-5 h-5" />}
        title="الفواتير والأقساط الافتراضية"
        hint="القيم الافتراضية المحملة عند إنشاء فواتير البيع والأقساط."
      >
        <div className="grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="رمز العملة">
              <Input
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
                placeholder="ج.م"
                maxLength={10}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
            <Field label="بادئة رقم الفاتورة" hint="مثال: INV → INV-0001">
              <Input
                value={form.invoicePrefix}
                onChange={(e) => set("invoicePrefix", e.target.value.toUpperCase())}
                placeholder="INV"
                dir="ltr"
                maxLength={10}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="أقساط افتراضية (شهور)">
              <Input
                type="number"
                min={1}
                max={60}
                inputMode="numeric"
                value={form.defaultInstallmentMonths}
                onChange={(e) => set("defaultInstallmentMonths", Number(e.target.value) || 1)}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
            <Field label="يوم الاستحقاق الافتراضي" hint="من 1 لـ 28 شهرياً">
              <Input
                type="number"
                min={1}
                max={28}
                inputMode="numeric"
                value={form.defaultDueDay}
                onChange={(e) => set("defaultDueDay", Number(e.target.value) || 1)}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
          </div>

          <div className="rounded-[1.75rem] bg-primary/[0.04] p-4 text-xs text-muted-foreground leading-relaxed border border-primary/10">
            <span className="block mb-1.5 font-black uppercase tracking-widest text-primary">
              معاينة حاسبة الأقساط:
            </span>
            فاتورة بقيمة{" "}
            <strong className="text-foreground font-black">
              {fmt(12000)} {form.currency}
            </strong>{" "}
            على <strong className="text-foreground font-black">{form.defaultInstallmentMonths}</strong> شهر →
            القسط الشهري ≈{" "}
            <strong className="text-primary font-black">
              {fmt(12000 / Math.max(1, form.defaultInstallmentMonths))} {form.currency}
            </strong>{" "}
            يوم <strong className="text-foreground font-black">{form.defaultDueDay}</strong> من كل شهر.
          </div>

          <Separator className="my-2" />

          {/* الضريبة المضافة */}
          <div className="flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-foreground/[0.02] border border-foreground/5">
            <div>
              <div className="text-sm font-black flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" /> تفعيل ضريبة القيمة المضافة (VAT)
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                حساب الضريبة تلقائياً على فواتير المبيعات
              </p>
            </div>
            <Switch
              checked={form.enableVat ?? false}
              onCheckedChange={(v) => set("enableVat", v)}
            />
          </div>

          {form.enableVat && (
            <Field label="نسبة الضريبة الافتراضية (%)">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.defaultVatRate ?? 14}
                  onChange={(e) => set("defaultVatRate", Number(e.target.value) || 0)}
                  className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
                />
                <span className="text-sm font-bold text-muted-foreground">%</span>
              </div>
            </Field>
          )}

          <Field label="شروط الضمان وسياسة الاسترجاع">
            <Textarea
              value={form.warrantyPolicy ?? ""}
              onChange={(e) => set("warrantyPolicy", e.target.value)}
              placeholder="شروط الضمان والاسترجاع المطبوعة أسفل الفاتورة..."
              maxLength={500}
              rows={2}
              className="rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all resize-none p-3 text-xs"
            />
          </Field>
        </div>
      </Section>

      <Section
        icon={<Printer className="w-5 h-5" />}
        title="إعدادات الطباعة والورق"
        hint="تخصيص نمط وتخطيط الورق المطبوع في الفواتير وإيصالات الكاشير."
      >
        <div className="grid gap-4">
          <Field label="مقاس الورق">
            <Select
              value={form.printPaper}
              onValueChange={(v) => set("printPaper", v as PrintPaper)}
            >
              <SelectTrigger className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="a4">A4 — طابعة مكتبية عادية (تخطيط كامل)</SelectItem>
                <SelectItem value="thermal">حراري 80mm — طابعة كاشير نقاط البيع</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {form.printPaper === "a4"
              ? "الفاتورة تُطبع بعرض كامل مع جدول أصناف مفصل وترويسة كاملة وبيانات الضريبة."
              : "الفاتورة تُطبع في شريط حراري مدمج مناسب لرولات طابعات الكاشير 80 مم."}
          </p>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold">الطباعة التلقائية فور الحفظ</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                فتح نافذة الطباعة مباشرة بمجرد إصدار الفاتورة أو الإيصال
              </p>
            </div>
            <Switch
              checked={form.autoPrintOnSave ?? false}
              onCheckedChange={(v) => set("autoPrintOnSave", v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold">إظهار باركود الفاتورة في الطباعة الحرارية</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                طباعة باركود سريع في ذيل الفاتورة لسهولة المسح والاسترجاع
              </p>
            </div>
            <Switch
              checked={form.thermalShowBarcode ?? true}
              onCheckedChange={(v) => set("thermalShowBarcode", v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold">إظهار بيانات الترويسة في الإيصال الحراري</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                طباعة اسم المحل، الهاتف، والعنوان في أعلى شريط الكاشير
              </p>
            </div>
            <Switch
              checked={form.thermalShowHeader ?? true}
              onCheckedChange={(v) => set("thermalShowHeader", v)}
            />
          </div>
        </div>
      </Section>

      {/* إدارة بنود وتصنيفات المصروفات المخصصة */}
      <ExpenseCategoriesSection form={form} set={set} />
    </div>
  );
}

function ExpenseCategoriesSection({ form, set }: TabProps) {
  const [newCat, setNewCat] = useState("");
  const categories = form.customExpenseCategories || DEFAULT_EXPENSE_CATEGORIES_LIST;

  const addCategory = () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      toast.error("هذا البند موجود بالفعل");
      return;
    }
    const updated = [...categories, trimmed];
    set("customExpenseCategories", updated);
    setNewCat("");
    toast.success(`تمت إضافة بند: ${trimmed}`);
  };

  const removeCategory = (cat: string) => {
    if (categories.length <= 1) {
      toast.error("يجب الإبقاء على تصنيف واحد على الأقل");
      return;
    }
    const updated = categories.filter((c) => c !== cat);
    set("customExpenseCategories", updated);
    toast.success(`تم حذف بند: ${cat}`);
  };

  return (
    <Section
      icon={<Tag className="w-5 h-5 text-primary" />}
      title="تصنيفات وبنود المصروفات (Expense Categories)"
      hint="تخصيص بنود المصاريف والنثريات التي تظهر في شاشتي اليومية والمصروفات."
    >
      <div className="grid gap-4">
        <div className="flex gap-2">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
            placeholder="أضف بند مصروف جديد (مثال: صيانة، تسويق، بوفيه)..."
            className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all text-xs"
          />
          <Button
            type="button"
            onClick={addCategory}
            className="h-11 px-4 rounded-2xl gap-1.5 font-bold shrink-0 text-xs"
          >
            <Plus className="w-4 h-4" /> إضافة
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {categories.map((cat) => (
            <div
              key={cat}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-foreground/[0.04] border border-foreground/10 text-xs font-bold transition-all hover:bg-foreground/[0.07]"
            >
              <span>{cat}</span>
              <button
                type="button"
                onClick={() => removeCategory(cat)}
                className="text-muted-foreground hover:text-danger rounded-full p-0.5 transition-colors"
                title={`حذف ${cat}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              set("customExpenseCategories", DEFAULT_EXPENSE_CATEGORIES_LIST);
              toast.success("تمت استعادة التصنيفات الافتراضية");
            }}
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            استعادة البنود الافتراضية
          </Button>
          <span>{categories.length} بند مسجل</span>
        </div>
      </div>
    </Section>
  );
}

/* ----------------------------- 3. التنبيهات والواتساب ----------------------------- */
function AlertsTab({ form, set }: TabProps) {
  const insertTemplateVar = (varKey: string) => {
    const current = form.whatsappReminderTemplate || "";
    set("whatsappReminderTemplate", `${current} {${varKey}}`);
  };

  const sampleCustomer = "محمد أحمد";
  const sampleAmount = "1,250 ج.م";
  const sampleDate = "2026-09-01";
  const sampleShop = form.shopName || "محل النور";
  const sampleInv = "INV-1042";

  const simulatedWhatsAppText = (form.whatsappReminderTemplate || "")
    .replace(/\{اسم_العميل\}/g, sampleCustomer)
    .replace(/\{المبلغ_المستحق\}/g, sampleAmount)
    .replace(/\{تاريخ_الاستحقاق\}/g, sampleDate)
    .replace(/\{اسم_المحل\}/g, sampleShop)
    .replace(/\{رقم_الفاتورة\}/g, sampleInv);

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <Section
        icon={<Bell className="w-5 h-5" />}
        title="تنبيهات الأقساط والمديونيات"
        hint="التحكم في مواعيد وقنوات التنبيه بالأقساط المتأخرة والوشيكة."
      >
        <div className="grid gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-black">تفعيل نظام التنبيهات الذكي</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                إظهار شارات التنبيه في القائمة العلوية وشاشات الفواتير
              </p>
            </div>
            <Switch checked={form.alertsEnabled} onCheckedChange={(v) => set("alertsEnabled", v)} />
          </div>

          <Separator />

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">تذكير قبل الاستحقاق بـ</Label>
              <Badge
                variant="secondary"
                className="rounded-xl px-3 py-1 bg-primary/10 text-primary border-none font-black"
              >
                {form.reminderDaysBefore} يوم
              </Badge>
            </div>
            <Slider
              value={[form.reminderDaysBefore]}
              min={0}
              max={30}
              step={1}
              onValueChange={([v]) => set("reminderDaysBefore", v)}
              disabled={!form.alertsEnabled}
              className="py-3"
            />
            <p className="text-xs text-muted-foreground">0 = التنبيه في نفس يوم الاستحقاق.</p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">حد التأخر الحرج (Critical Overdue)</Label>
              <Badge
                variant="secondary"
                className="rounded-xl px-3 py-1 bg-danger/10 text-danger border-none font-black"
              >
                {form.criticalOverdueDays ?? 15} يوم
              </Badge>
            </div>
            <Slider
              value={[form.criticalOverdueDays ?? 15]}
              min={1}
              max={60}
              step={1}
              onValueChange={([v]) => set("criticalOverdueDays", v)}
              disabled={!form.alertsEnabled}
              className="py-3"
            />
            <p className="text-xs text-muted-foreground">
              تمييز الفواتير المتأخرة أكثر من هذه الفترة بلون تحذيري بارز.
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-primary" /> التنبيهات الصوتية
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                تشغيل نغمة خفيفة عند حدوث عمليات بيع أو وصول أقساط حرجة
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={playTestAlert}
                className="rounded-xl h-8 text-xs font-bold px-3"
              >
                تجربة الصوت
              </Button>
              <Switch
                checked={form.audioAlertsEnabled ?? true}
                onCheckedChange={(v) => set("audioAlertsEnabled", v)}
              />
            </div>
          </div>

          <Separator />

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">حد المخزون المنخفض</Label>
              <Badge
                variant="secondary"
                className="rounded-xl px-3 py-1 bg-primary/10 text-primary border-none font-black"
              >
                {form.lowStockThreshold} قطعة
              </Badge>
            </div>
            <Slider
              value={[form.lowStockThreshold]}
              min={0}
              max={50}
              step={1}
              onValueChange={([v]) => set("lowStockThreshold", v)}
              className="py-3"
            />
            <p className="text-xs text-muted-foreground">
              إشعارك تلقائياً في حالة انخفاض كمية أي منتج بالمخزن عن هذا الحد.
            </p>
          </div>
        </div>
      </Section>

      <Section
        icon={<MessageCircle className="w-5 h-5 text-emerald-500" />}
        title="محرر قالب رسائل الواتساب"
        hint="صياغة نص رسالة التذكير التي تُرسل للعملاء بضغطة زر واحدة."
      >
        <div className="grid gap-3">
          <Label className="text-xs font-black">المتغيرات الديناميكية المتاحة (اضغط للإضافة):</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              { key: "اسم_العميل", label: "اسم العميل" },
              { key: "المبلغ_المستحق", label: "المبلغ المستحق" },
              { key: "تاريخ_الاستحقاق", label: "تاريخ الاستحقاق" },
              { key: "اسم_المحل", label: "اسم المحل" },
              { key: "رقم_الفاتورة", label: "رقم الفاتورة" },
            ].map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertTemplateVar(v.key)}
                className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              >
                + {`{${v.label}}`}
              </button>
            ))}
          </div>

          <Textarea
            value={form.whatsappReminderTemplate ?? ""}
            onChange={(e) => set("whatsappReminderTemplate", e.target.value)}
            placeholder="اكتب نص رسالة التذكير هنا..."
            rows={4}
            className="rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all p-3.5 text-xs leading-relaxed"
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                set(
                  "whatsappReminderTemplate",
                  "السلام عليكم أستاذ {اسم_العميل}، نود تذكيركم بموعد استحقاق قسط بقيمة {المبلغ_المستحق} بتاريخ {تاريخ_الاستحقاق}. مع تحيات {اسم_المحل}.",
                )
              }
              className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
            >
              استعادة القالب الافتراضي
            </Button>
            <span>{(form.whatsappReminderTemplate || "").length} حرف</span>
          </div>

          {/* محاكاة فقاعة الواتساب الحية */}
          <div className="mt-2 rounded-[2rem] bg-emerald-950/20 dark:bg-emerald-950/40 p-4 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="w-4 h-4" /> محاكاة رسالة التذكير:
            </div>
            <div className="rounded-2xl bg-card p-3.5 text-xs leading-relaxed border border-emerald-500/20 shadow-sm text-foreground">
              {simulatedWhatsAppText || "اكتب نص القالب للمعاينة..."}
            </div>
          </div>
        </div>
      </Section>

      {/* قالب رسالة شكر واستلام الدفعة */}
      <PaymentThankYouTemplateSection form={form} set={set} />
    </div>
  );
}

function PaymentThankYouTemplateSection({ form, set }: TabProps) {
  const insertPaymentVar = (varKey: string) => {
    const current = form.whatsappPaymentThankYouTemplate || "";
    set("whatsappPaymentThankYouTemplate", `${current} {${varKey}}`);
  };

  const sampleCustomer = "محمد أحمد";
  const samplePaid = "500 ج.م";
  const sampleRemaining = "750 ج.م";
  const sampleShop = form.shopName || "محل النور";

  const simulatedText = (form.whatsappPaymentThankYouTemplate || "")
    .replace(/\{اسم_العميل\}/g, sampleCustomer)
    .replace(/\{المبلغ_المدفوع\}/g, samplePaid)
    .replace(/\{المبلغ_المتبقي\}/g, sampleRemaining)
    .replace(/\{اسم_المحل\}/g, sampleShop);

  return (
    <Section
      icon={<HeartHandshake className="w-5 h-5 text-emerald-500" />}
      title="قالب رسالة الشكر وتأكيد استلام الدفعة"
      hint="الرسالة التلقائية المرسلة للعميل فور استلام دفعة نقدية أو تسديد قسط."
    >
      <div className="grid gap-3">
        <Label className="text-xs font-black">المتغيرات المتاحة (اضغط للإضافة):</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[
            { key: "اسم_العميل", label: "اسم العميل" },
            { key: "المبلغ_المدفوع", label: "المبلغ المدفوع" },
            { key: "المبلغ_المتبقي", label: "المبلغ المتبقي" },
            { key: "اسم_المحل", label: "اسم المحل" },
          ].map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertPaymentVar(v.key)}
              className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
            >
              + {`{${v.label}}`}
            </button>
          ))}
        </div>

        <Textarea
          value={form.whatsappPaymentThankYouTemplate ?? ""}
          onChange={(e) => set("whatsappPaymentThankYouTemplate", e.target.value)}
          placeholder="اكتب نص رسالة الشكر واستلام الدفعة..."
          rows={3}
          className="rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all p-3.5 text-xs leading-relaxed"
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              set(
                "whatsappPaymentThankYouTemplate",
                "شكراً لتعاملكم مع {اسم_المحل}، أستاذ {اسم_العميل}. تم بنجاح استلام دفعة بقيمة {المبلغ_المدفوع}، والمتبقي على حسابكم هو {المبلغ_المتبقي}.",
              )
            }
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            استعادة القالب الافتراضي
          </Button>
          <span>{(form.whatsappPaymentThankYouTemplate || "").length} حرف</span>
        </div>

        {/* محاكاة الرسالة */}
        <div className="mt-2 rounded-[2rem] bg-emerald-950/20 dark:bg-emerald-950/40 p-4 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <MessageCircle className="w-4 h-4" /> محاكاة رسالة الشكر:
          </div>
          <div className="rounded-2xl bg-card p-3.5 text-xs leading-relaxed border border-emerald-500/20 shadow-sm text-foreground">
            {simulatedText || "اكتب نص القالب للمعاينة..."}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------ 4. المظهر ولوحات الألوان ------------------------------ */
const THEMES: Array<{ value: ThemeMode; label: string; desc: string }> = [
  { value: "dark", label: "الوضع الليلي (غامق)", desc: "الفحمي المريح للعين أثناء العمل الطويل" },
  { value: "light", label: "الوضع النهاري (فاتح)", desc: "خلفية ناصعة بتباين عالٍ ووضوح ساطع" },
  { value: "system", label: "تلقائي حسب الجهاز", desc: "يتماشى مع إعدادات نظام التشغيل" },
];

const NUMERAL_FORMATS: Array<{ value: NumeralsFormat; label: string; preview: string; desc: string }> = [
  {
    value: "latn",
    label: "الأرقام الإنجليزية / اللاتينية",
    preview: "123,456.78",
    desc: "النمط الافتراضي والمفضل لقراءة الحسابات والمبالغ بسلاسة",
  },
  {
    value: "arab",
    label: "الأرقام العربية الشرقية (الهندية)",
    preview: "١٢٣٬٤٥٦٫٧٨",
    desc: "النمط الكلاسيكي للأرقام في المطبوعات العربية التقليدية",
  },
];

function AppearanceTab({ form, set }: TabProps) {
  const currentPalette = form.colorPalette || "emerald";
  const currentNumerals = form.numeralsFormat || "latn";

  const handlePaletteSelect = (palId: LibColorPalette) => {
    set("colorPalette", palId);
    applyTheme(form.theme, palId);
    storePalette(palId);
    toast.success(`تم تفعيل لوحة ألوان: ${PALETTES_CONFIG.find(p => p.id === palId)?.label || palId}`);
  };

  return (
    <div className="grid gap-6 animate-[fade-in_0.3s_ease-out]">
      <Section
        icon={<Binary className="w-5 h-5 text-primary" />}
        title="نظام تنسيق الأرقام والأسعار (Numeral System)"
        hint="اختر طريقة عرض الأرقام والمبالغ المالية عبر كافة شاشات وجداول ومطبوعات النظام."
      >
        <div className="grid sm:grid-cols-2 gap-3">
          {NUMERAL_FORMATS.map((numOpt) => {
            const isSelected = currentNumerals === numOpt.value;
            return (
              <button
                key={numOpt.value}
                type="button"
                onClick={() => {
                  set("numeralsFormat", numOpt.value);
                  toast.success(`تم اختيار: ${numOpt.label}`);
                }}
                className={cn(
                  "text-right rounded-[1.75rem] border-2 p-5 transition-all duration-300 relative overflow-hidden group hover:scale-[1.01] active:scale-[0.99]",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                    : "border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.05]",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-black text-foreground">{numOpt.label}</div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "rounded-lg font-black text-[10px] px-2 py-0.5",
                      isSelected ? "bg-primary text-black" : "bg-foreground/5 text-muted-foreground",
                    )}
                  >
                    {isSelected ? "مفعّل" : "اختيار"}
                  </Badge>
                </div>
                <div className="text-base font-black text-primary mb-1" dir={numOpt.value === "latn" ? "ltr" : "rtl"}>
                  {numOpt.preview} {form.currency || "ج.م"}
                </div>
                <div className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                  {numOpt.desc}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        icon={<Palette className="w-5 h-5" />}
        title="وضع العرض الأساسي"
        hint="اختر بين الوضع الليلي والنهاري أو المزامنة مع إعدادات جهازك."
      >
        <div className="grid sm:grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                set("theme", t.value);
                applyTheme(t.value, form.colorPalette);
              }}
              className={`text-right rounded-[1.75rem] border-2 p-5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                form.theme === t.value
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.05]"
              }`}
            >
              <div className="text-sm font-black mb-1 text-foreground">{t.label}</div>
              <div className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                {t.desc}
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section
        icon={<Sparkles className="w-5 h-5 text-primary" />}
        title="لوحات الألوان العشرة المعتمدة (Color Palettes)"
        hint="اختر لوحة الألوان المميزة لنظامك — يتم تطبيق الألوان الحقيقية فوراً في كامل النظام وتُحفظ تلقائياً."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
          {PALETTES_CONFIG.map((p) => { const palId = p.id;
            
            const isSelected = currentPalette === palId;
            return (
              <button
                key={palId}
                type="button"
                onClick={() => handlePaletteSelect(palId)}
                className={cn(
                  "text-right rounded-[1.75rem] border-2 p-4 transition-all duration-300 relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-xl shadow-primary/10 ring-2 ring-primary/30"
                    : "border-foreground/5 bg-foreground/[0.02] hover:border-foreground/15 hover:bg-foreground/[0.04]",
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-sm"
                      style={{ backgroundColor: p.hex }}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full opacity-60"
                      style={{ backgroundColor: p.hex }}
                    />
                  </div>
                  {isSelected && (
                    <Badge
                      variant="secondary"
                      className="rounded-lg bg-primary text-black font-black text-[9px] px-1.5 py-0.5"
                    >
                      مفعّل
                    </Badge>
                  )}
                </div>

                <div className="text-xs font-black text-foreground mb-0.5">{p.label}</div>
                <div className="text-[10px] text-muted-foreground font-medium truncate">
                  {p.sub}
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          لوحات الألوان مصممة لضمان أعلى مستويات المقروءية والتباين البصري (WCAG AA).
        </p>
      </Section>
    </div>
  );
}

/* ------------------------------ 5. التكاملات والمتجر والشحن ------------------------------ */
function IntegrationsTab() {
  const navigate = useNavigate();

  return (
    <div className="grid gap-6 lg:grid-cols-3 animate-[fade-in_0.3s_ease-out]">
      <div className="rounded-[2.5rem] bg-card/60 backdrop-blur-md border border-foreground/5 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black tracking-tight mb-1">المتجر الإلكتروني (Storefront)</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            تخصيص هوية ورابط متجرك الإلكتروني للبيع أونلاين، واستقبال طلبات الزبائن مباشرة في النظام.
          </p>
        </div>
        <Button
          onClick={() => navigate("/storefront/settings")}
          className="w-full gap-2 rounded-2xl bg-primary text-black font-black h-11 shadow-md shadow-primary/10"
        >
          <ExternalLink className="w-4 h-4" /> إعدادات المتجر الإلكتروني
        </Button>
      </div>

      <div className="rounded-[2.5rem] bg-card/60 backdrop-blur-md border border-foreground/5 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-info/10 text-info grid place-items-center mb-4">
            <Truck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black tracking-tight mb-1">شركات الشحن وبوليصات التوصيل</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            إدارة شركات الشحن (بوسطة، أرامكس، مندوب خاص)، طباعة بوليصات الشحن، ومتابعة التحصيلات والتسويات.
          </p>
        </div>
        <Button
          onClick={() => navigate("/carriers")}
          variant="secondary"
          className="w-full gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 font-black h-11"
        >
          <ExternalLink className="w-4 h-4" /> إدارة الشحن والتوصيل
        </Button>
      </div>

      <div className="rounded-[2.5rem] bg-card/60 backdrop-blur-md border border-foreground/5 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 grid place-items-center mb-4">
            <Receipt className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black tracking-tight mb-1">نقطة البيع السريعة (POS)</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            كاشير نقطة البيع السريع مع دعم قارئ الباركود واللمس وإصدار الإيصالات الحرارية في ثوانٍ.
          </p>
        </div>
        <Button
          onClick={() => navigate("/pos")}
          variant="secondary"
          className="w-full gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 font-black h-11"
        >
          <ExternalLink className="w-4 h-4" /> فتح كاشير نقطة البيع
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ 6. الحساب والأمان ------------------------------ */
const dateFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
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
          hint="تأمين حسابك وحماية بيانات العمليات المالية."
        >
          {authReady ? (
            <ChangePassword mode={hasPassword ? "change" : "add"} />
          ) : (
            <LineSkeleton rows={3} />
          )}
        </Section>

        {user?.provider === "google" ? null : (
          <Section
            icon={<Mail className="w-5 h-5" />}
            title="البريد الإلكتروني"
            hint="تحديث وسيلة التواصل الأساسية مع الحساب."
          >
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
    side,
    side,
    0,
    0,
    size,
    size,
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

  useEffect(() => {
    setName(profile.displayName || user?.metaName || "");
  }, [profile.displayName, user?.metaName]);

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختار صورة صحيحة");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("الصورة كبيرة جداً (أقصى حد 8 ميجابايت)");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await shrinkImage(file);
      await save({ avatarUrl: dataUrl });
      toast.success("تم تحديث صورتك بنجاح");
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
      toast.success("تم حذف الصورة الشخصية");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر الحذف");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length > 60) {
      toast.error("الاسم طويل جداً");
      return;
    }
    setBusy(true);
    try {
      await save({ displayName: trimmed });
      toast.success("تم تحديث اسم العرض");
      setEditing(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      icon={<UserRound className="w-5 h-5" />}
      title="هويتك الشخصية"
      hint="الحساب المسجل دخوله حالياً على هذا الجهاز."
    >
      {loading ? (
        <LineSkeleton rows={4} />
      ) : !user ? (
        <p className="text-sm text-muted-foreground">لا يوجد حساب مسجل دخوله حالياً.</p>
      ) : (
        <div className="grid gap-5">
          <div className="rounded-[2.5rem] bg-foreground/[0.02] p-2 border border-foreground/5 shadow-inner">
            <div className="flex items-center gap-5 rounded-[calc(2.5rem-0.5rem)] bg-card p-6 backdrop-blur-md shadow-xl border border-white/5">
              <UserAvatar size={58} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-black leading-tight text-foreground">
                  {label || "بدون اسم"}
                </div>
                <div dir="ltr" className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {user.email ?? "—"}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(user.providers.length ? user.providers : ["unknown"]).map((p: string) => (
                    <Badge
                      key={p}
                      variant="secondary"
                      className="rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] bg-foreground/10 border-none"
                    >
                      {providerLabel(p)}
                    </Badge>
                  ))}
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] border-none",
                      user.emailConfirmed
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {user.emailConfirmed ? (
                      <>
                        <ShieldCheck className="mr-1 h-3 w-3" /> مؤكد
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="mr-1 h-3 w-3" /> غير مؤكد
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-bold">اسم العرض</Label>
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setEditing(true);
                }}
                placeholder={user.metaName ?? "اكتب اسمك"}
                maxLength={60}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
              <Button
                onClick={submit}
                disabled={busy || !editing}
                variant="secondary"
                className="h-11 shrink-0 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all px-6 font-bold"
              >
                <Save className="h-4 w-4 opacity-60" /> حفظ
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-bold">صورتك الشخصية</Label>
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
                className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all px-6 font-bold"
              >
                <UserRound className="h-4 w-4 opacity-60" />{" "}
                {uploading ? "جاري الرفع..." : avatar ? "تغيير الصورة" : "رفع صورة"}
              </Button>
              {profile.avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={uploading}
                  onClick={removeAvatar}
                  className="text-danger font-bold"
                >
                  حذف
                </Button>
              ) : null}
            </div>
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
            className="w-full gap-2 text-danger border-danger/20 hover:bg-danger/10 font-bold h-11 rounded-2xl transition-all"
            onClick={onSignOut}
          >
            <LogOut className="w-4 h-4" /> تسجيل الخروج من النظام
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
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("بريد إلكتروني غير صالح");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success("تم إرسال رابط تأكيد إلى البريد الجديد");
      setEmail("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "تعذر تغيير البريد");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-2">
      <Label className="text-xs font-bold">البريد الجديد</Label>
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        dir="ltr"
        placeholder="new@email.com"
        type="email"
        className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
      />
      <p className="rounded-2xl bg-amber-500/10 p-3 text-[11px] leading-relaxed text-muted-foreground">
        سيتم إرسال رسالة تأكيد للبريد الجديد، ويجب النقر على الرابط لتأكيد الملكية.
      </p>
      <Button
        type="submit"
        variant="secondary"
        disabled={busy}
        className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all px-6 font-bold"
      >
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
    if (pw.length < 6) {
      toast.error("كلمة السر يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (pw !== pw2) {
      toast.error("كلمتا السر غير متطابقتين");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("تم تحديث كلمة المرور بنجاح");
      setPw("");
      setPw2("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "تعذر التغيير");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field label="كلمة السر الجديدة">
        <Input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          dir="ltr"
          placeholder="••••••••"
          maxLength={72}
          className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
        />
      </Field>
      {pw ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${strength.cls}`}
              style={{ width: `${strength.pct}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">{strength.label}</span>
        </div>
      ) : null}
      <Field label="تأكيد كلمة السر">
        <Input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          dir="ltr"
          placeholder="••••••••"
          maxLength={72}
          className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
        />
      </Field>
      <Button
        type="submit"
        variant="secondary"
        disabled={busy}
        className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all px-6 font-bold"
      >
        <KeyRound className="w-4 h-4 opacity-60" />{" "}
        {busy ? "جاري الحفظ..." : mode === "add" ? "إضافة كلمة مرور" : "تحديث كلمة المرور"}
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
  return { pct: 100, cls: "bg-success", label: "قوية جداً" };
}

/* ------------------------------ 7. البيانات والنسخ الاحتياطي ------------------------------ */
function DataTab({ form, set }: TabProps) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [restoreInput, setRestoreInput] = useState<HTMLInputElement | null>(null);

  // Selective resets confirmation state
  const [selectiveResetType, setSelectiveResetType] = useState<"stock" | "balances" | null>(null);

  const load = useCallback(() => {
    dataCounts()
      .then(setCounts)
      .catch(() => setCounts({}));
  }, []);

  useEffect(load, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "حصلت مشكلة");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <div className="grid gap-6 h-fit">
        <Section
          icon={<Clock className="w-5 h-5 text-primary" />}
          title="جدولة وتذكيرات النسخ الاحتياطي الدوري"
          hint="إعداد تذكيرات منتظمة لتنزيل نسخة احتياطية للحفاظ على بيانات المحل من الضياع."
        >
          <div className="grid gap-4">
            <Field label="تكرار التذكير بالنسخ الاحتياطي">
              <Select
                value={form.autoBackupFrequency ?? "weekly"}
                onValueChange={(v) => {
                  set("autoBackupFrequency", v as AutoBackupFrequency);
                  toast.success("تم تحديث دورية التذكير بالنسخ");
                }}
              >
                <SelectTrigger className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="weekly">تذكير أسبوعي (موصى به لحماية البيانات)</SelectItem>
                  <SelectItem value="monthly">تذكير شهري (نهاية كل دورة محاسبية)</SelectItem>
                  <SelectItem value="off">إيقاف التذكير التلقائي</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="rounded-2xl bg-foreground/[0.02] border border-foreground/5 p-3.5 text-xs text-muted-foreground leading-relaxed">
              {form.autoBackupFrequency === "off" ? (
                <span>
                  ⚠️ التذكير التلقائي معطل حالياً. نوصي بتفعيل التذكير الأسبوعي أو الشهري لضمان حفظ بياناتك بانتظام.
                </span>
              ) : (
                <span>
                  💡 يُنبهك النظام بتنزيل نسخة بصيغة JSON أو Excel كل{" "}
                  <strong className="text-foreground">
                    {form.autoBackupFrequency === "weekly" ? "أسبوع" : "شهر"}
                  </strong>{" "}
                  لحفظها على فلاش ميموري أو جهازك المحلي بأمان.
                </span>
              )}
            </div>
          </div>
        </Section>

        <Section
          icon={<Database className="w-5 h-5" />}
          title="ملخص حجم السجلات"
          hint="عدد السجلات المخزنة والمسجلة في قاعدة البيانات السحابية."
        >
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(TABLE_LABELS).map(([key, label]) => (
              <div
                key={key}
                className="rounded-2xl bg-foreground/[0.03] border border-foreground/5 p-3.5 flex items-center justify-between transition-all hover:bg-foreground/[0.05]"
              >
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
                <span className="text-sm font-black tabular-nums text-primary">
                  {counts ? fmt(counts[key] ?? 0) : "…"}
                </span>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 gap-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
            onClick={load}
          >
            <RotateCcw className="w-3.5 h-3.5" /> تحديث الإحصائيات
          </Button>
        </Section>
      </div>

      <div className="grid gap-6 h-fit">
        <Section
          icon={<FileSpreadsheet className="w-5 h-5 text-emerald-500" />}
          title="النسخ الاحتياطي والمراجعة المحاسبية"
          hint="تصدير وتنزيل كافة بياناتك أو كشف الحركة المحاسبية في ملفات Excel و JSON."
        >
          <div className="grid gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all font-bold text-xs"
                disabled={busy !== null}
                onClick={() => run("json", downloadJsonBackup, "تم تنزيل النسخة الاحتياطية (JSON)")}
              >
                <FileJson className="w-4 h-4 opacity-70" /> نسخة كاملة JSON
              </Button>
              <Button
                variant="secondary"
                className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all font-bold text-xs"
                disabled={busy !== null}
                onClick={() => run("xlsx", downloadExcelBackup, "تم تنزيل ملف Excel الشامل")}
              >
                <FileSpreadsheet className="w-4 h-4 opacity-70 text-emerald-500" /> ملف Excel مجمّع
              </Button>
            </div>

            <Button
              variant="outline"
              className="h-11 gap-2 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.04] hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs"
              disabled={busy !== null}
              onClick={() =>
                run("audit", downloadAccountingAuditLog, "تم تنزيل كشف المراجعة المحاسبية باللغة العربية")
              }
            >
              <FileSpreadsheet className="w-4 h-4" /> كشف المراجعة المحاسبية الشامل (Arabic Audit Log)
            </Button>

            <input
              ref={setRestoreInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  const report = await restoreJsonBackup(JSON.parse(await file.text()));
                  toast.success(
                    `تم الاسترجاع: ${report.inserted} سجل، وتم تخطي ${report.skipped} سجل`,
                  );
                  if (report.failed.length > 0)
                    toast.error(`تعذر استرجاع ${report.failed.length} سجل`);
                  load();
                } catch (error: unknown) {
                  toast.error(error instanceof Error ? error.message : "تعذر استرجاع النسخة");
                }
              }}
            />
            <Button
              variant="outline"
              className="h-11 gap-2 rounded-2xl font-bold text-xs"
              disabled={busy !== null}
              onClick={() => restoreInput?.click()}
            >
              <Upload className="w-4 h-4" /> استرجاع بيانات من ملف JSON
            </Button>
          </div>
        </Section>

        {/* العمليات الانتقائية ومنطقة الخطر */}
        <Section
          icon={<ShieldAlert className="w-5 h-5 text-danger" />}
          title="التصفير الانتقائي ومنطقة الخطر"
          hint="إجراءات حساسة لتصفير الأرصدة أو مسح البيانات."
        >
          <div className="grid gap-2.5">
            <div className="grid sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2 rounded-xl text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/[0.02] hover:bg-amber-500/10 font-bold text-xs"
                onClick={() => setSelectiveResetType("stock")}
              >
                <RefreshCw className="w-3.5 h-3.5" /> تصفير كميات المخزون لـ 0
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2 rounded-xl text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/[0.02] hover:bg-amber-500/10 font-bold text-xs"
                onClick={() => setSelectiveResetType("balances")}
              >
                <RefreshCw className="w-3.5 h-3.5" /> تصفير أرصدة العملاء الافتتاحية
              </Button>
            </div>

            <Button
              variant="outline"
              className="h-11 w-full gap-2 rounded-2xl text-danger border-danger/20 bg-danger/[0.02] hover:bg-danger/10 font-black text-xs transition-all"
              onClick={() => {
                setConfirmText("");
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4" /> مسح كافة البيانات نهائياً (Factory Reset)
            </Button>
          </div>
        </Section>
      </div>

      {/* مودال تأكيد التصفير الانتقائي */}
      <AlertDialog open={selectiveResetType !== null} onOpenChange={(v) => !v && setSelectiveResetType(null)}>
        <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-6 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-lg font-black">
              {selectiveResetType === "stock"
                ? "تأكيد تصفير كميات المخزون؟"
                : "تأكيد تصفير الأرصدة الافتتاحية؟"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs leading-relaxed text-muted-foreground">
              {selectiveResetType === "stock"
                ? "سيتم ضبط رصيد جميع أصناف المخزن ليكون 0 دون حذف المنتجات نفسها."
                : "سيتم تصفير الأرصدة الافتتاحية لجميع العملاء المسجلين."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-amber-500 text-black font-black"
              onClick={async () => {
                if (selectiveResetType === "stock") {
                  await run("reset-stock", resetInventoryStock, "تم تصفير كميات المخزون بنجاح");
                } else if (selectiveResetType === "balances") {
                  await run("reset-balances", resetCustomerOpeningBalances, "تم تصفير الأرصدة الافتتاحية");
                }
                setSelectiveResetType(null);
                load();
              }}
            >
              تأكيد التصفير
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* مودال المسح الشامل */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          dir="rtl"
          className="rounded-[2.5rem] border-danger/10 bg-card/95 backdrop-blur-2xl p-8 max-w-lg shadow-2xl"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-2xl font-black tracking-tight text-danger">
              حذف كل البيانات بشكل نهائي؟
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-sm leading-relaxed">
              هذا الإجراء سيقوم بمسح كافة الفواتير، العملاء، الموردين، والمخزون بشكل نهائي لا رجعة فيه.
              <br />
              <br />
              لتأكيد الحذف النهائي، يرجى كتابة كلمة <strong className="text-foreground">حذف</strong> في الحقل أدناه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="اكتب حذف هنا"
            className="h-12 rounded-2xl bg-foreground/[0.03] border-danger/20 focus:border-danger transition-all text-center font-bold"
          />
          <AlertDialogFooter className="mt-6 gap-3 sm:justify-end">
            <AlertDialogCancel className="rounded-2xl border-none hover:bg-foreground/5 h-12 px-6 font-bold">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText.trim() !== "حذف" || busy !== null}
              className="rounded-2xl bg-danger h-12 px-8 font-black text-white transition-all hover:bg-danger/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-danger/20"
              onClick={async () => {
                await run("wipe", wipeAllData, "تم حذف جميع بيانات النشاط بنجاح");
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

/* --------------------------- 8. الفريق والصلاحيات --------------------------- */
const ALL_ROLES: AppRole[] = ["owner", "manager", "seller"];

function RoleBadge({ role, big = false }: { role: AppRole; big?: boolean }) {
  const tone: Record<AppRole, string> = {
    owner: "bg-primary/10 text-primary border-primary/20",
    manager: "bg-info/10 text-info border-info/20",
    seller: "bg-foreground/5 text-muted-foreground border-foreground/10",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl border font-black uppercase tracking-widest ${tone[role]} ${
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
    if (!parsed.success) {
      toast.error("اكتب بريد إلكتروني صحيح");
      return;
    }
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
      else if (res.status === "pending_no_email")
        toast.success("تم تسجيل الدعوة — لكن تعذر إرسال رسالة البريد");
      else toast.success("تم إرسال رابط الدعوة إلى البريد الإلكتروني");
      setInviteOpen(false);
      setEmail("");
      setInviteRole("seller");
      await Promise.all([reload(), reloadRole()]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذّر إرسال الدعوة");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <Section
        icon={<ShieldCheck className="w-5 h-5" />}
        title="مستوى صلاحياتك في النظام"
        hint="تحديد الصلاحيات المتاحة للمالك والمدير والبائع في النظام."
      >
        {roleLoading ? (
          <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4 p-6 rounded-[2rem] bg-primary/[0.03] border border-primary/10">
              {myRole ? (
                <RoleBadge role={myRole} big />
              ) : (
                <span className="rounded-xl bg-foreground/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground border border-foreground/10">
                  بدون صلاحية
                </span>
              )}
              <span className="text-xs font-bold text-muted-foreground leading-relaxed">
                {myRole ? ROLE_HINT[myRole] : "لم يتم العثور على صلاحيات مسجلة لحسابك حالياً."}
              </span>
            </div>

            <div className="rounded-[2.5rem] bg-foreground/[0.02] p-2 border border-foreground/5 shadow-inner">
              <div className="overflow-x-auto rounded-[calc(2.5rem-0.5rem)] bg-card border border-white/5 shadow-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-foreground/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-foreground/[0.02]">
                      <th className="py-4 px-6 text-right">وظائف وقدرات النظام</th>
                      {ALL_ROLES.map((r) => (
                        <th key={r} className="py-4 px-4 whitespace-nowrap">
                          {ROLE_LABEL[r]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ABILITIES.map((a) => (
                      <tr
                        key={a.label}
                        className="border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.01] transition-colors"
                      >
                        <td className="py-3.5 px-6 text-right font-bold text-xs">{a.label}</td>
                        {ALL_ROLES.map((r) => {
                          const ok = a.roles.includes(r);
                          return (
                            <td
                              key={r}
                              className={`py-3.5 px-4 text-center ${myRole === r ? "bg-primary/[0.03]" : ""}`}
                            >
                              <span
                                className={
                                  ok ? "text-emerald-500 font-black text-base" : "text-muted-foreground/25"
                                }
                              >
                                {ok ? "✓" : "✗"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section
        icon={<Users className="w-5 h-5" />}
        title="أعضاء الفريق المشتركين"
        hint={
          isOwner
            ? "بصفتك المالك، يمكنك دعوة مستخدمين جدد وتعديل صلاحيات الفريق."
            : "المالك فقط هو المخول بدعوة وتعديل الصلاحيات."
        }
      >
        {isOwner && (
          <div className="mb-4 flex justify-start">
            <Button
              onClick={() => setInviteOpen(true)}
              className="rounded-2xl px-6 h-11 gap-2 bg-primary text-black font-black shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Mail className="w-4 h-4" /> دعوة عضو جديد
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-[2.5rem] bg-foreground/[0.02] p-2 border border-foreground/5 shadow-inner">
            <div className="rounded-[calc(2.5rem-0.5rem)] bg-card px-6 py-12 text-center border border-white/5 shadow-xl">
              <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Users className="w-5 h-5" />
              </span>
              <p className="font-semibold">لا يوجد أعضاء مضافون في الفريق حتى الآن</p>
              <p className="mt-1 text-xs text-muted-foreground">
                أرسل دعوة بالبريد الإلكتروني وحدد صلاحيات المستخدم.
              </p>
              {isOwner && (
                <Button
                  onClick={() => setInviteOpen(true)}
                  className="mt-5 rounded-2xl px-8 h-11 bg-primary text-black font-black shadow-lg shadow-primary/20"
                >
                  دعوة عضو
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.userId}
                className="rounded-[2rem] bg-foreground/[0.02] p-2 border border-foreground/5 transition-all hover:border-primary/20"
              >
                <div className="rounded-[calc(2rem-0.5rem)] bg-card p-4 flex items-center justify-between gap-4 border border-white/5 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    {m.avatarUrl ? (
                      <img
                        src={m.avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-2xl object-cover ring-1 ring-foreground/10"
                      />
                    ) : (
                      <span className="w-10 h-10 rounded-2xl bg-primary/10 text-primary grid place-items-center font-black text-xs">
                        {m.displayName.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="font-black text-sm tracking-tight truncate text-foreground">
                        {m.displayName}
                        {m.isMe ? " (أنت)" : ""}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        آخر ظهور: {relativeTime(m.lastSeenAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOwner && !m.isMe ? (
                      <Select
                        value={m.role}
                        onValueChange={async (v) => {
                          try {
                            await setRole(m.userId, v as AppRole);
                            toast.success("تم تحديث صلاحية العضو");
                          } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : "خطأ");
                          }
                        }}
                      >
                        <SelectTrigger className="w-32 h-9 rounded-xl bg-foreground/[0.03] border-none font-bold text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {ALL_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <RoleBadge role={m.role} />
                    )}
                    {isOwner && !m.isMe && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="إزالة العضو"
                        className="h-9 w-9 rounded-xl text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                        onClick={() => setRemoving(m.userId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isOwner && pending.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
              دعوات قيد الانتظار
            </p>
            <div className="space-y-2">
              {pending.map((iv) => (
                <div
                  key={iv.id}
                  className="rounded-[1.75rem] border border-dashed border-foreground/10 p-4 flex items-center justify-between gap-4 bg-foreground/[0.01]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-black text-xs">{iv.email}</div>
                    <div className="text-[10px] text-muted-foreground">
                      تنتهي في: {new Date(iv.expiresAt).toLocaleDateString("en-US")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RoleBadge role={iv.role} />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl h-9 text-xs font-bold text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                      onClick={async () => {
                        try {
                          await revokeInvite(iv.id);
                          toast.success("تم إلغاء الدعوة بنجاح");
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : "خطأ");
                        }
                      }}
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* مودال دعوة عضو جديد */}
      <AlertDialog open={inviteOpen} onOpenChange={(v) => !v && setInviteOpen(false)}>
        <AlertDialogContent
          dir="rtl"
          className="rounded-[2.5rem] border-foreground/10 bg-card/95 backdrop-blur-2xl p-8 max-w-lg shadow-2xl"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-2xl font-black tracking-tight">
              دعوة عضو جديد لفريق العمل
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs text-muted-foreground leading-relaxed">
              سيتم إرسال دعوة رسمية عبر البريد الإلكتروني لتفعيل حساب العضو وتعيين صلاحياته.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-right">
            <div className="space-y-2">
              <Label className="text-xs font-bold">البريد الإلكتروني</Label>
              <Input
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">الدور والصلاحية</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="font-bold text-xs">
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground px-1">{ROLE_HINT[inviteRole]}</p>
            </div>
          </div>
          <AlertDialogFooter className="mt-8 gap-3 sm:justify-end">
            <AlertDialogCancel
              disabled={sending}
              className="rounded-2xl border-none hover:bg-foreground/5 h-12 px-6 font-bold"
            >
              إلغاء
            </AlertDialogCancel>
            <Button
              onClick={submitInvite}
              disabled={sending}
              className="rounded-2xl bg-primary h-12 px-8 font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              {sending ? "جاري الإرسال…" : "إرسال الدعوة"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* مودال إزالة عضو */}
      <AlertDialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent
          dir="rtl"
          className="rounded-[2.5rem] border-danger/10 bg-card/95 backdrop-blur-2xl p-8 max-w-lg shadow-2xl"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-2xl font-black tracking-tight text-danger">
              إزالة العضو من الفريق؟
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs text-muted-foreground leading-relaxed">
              سيتم سحب جميع الصلاحيات الممنوحة لهذا العضو فوراً ولن يتمكن من الدخول إلى النظام.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3 sm:justify-end">
            <AlertDialogCancel className="rounded-2xl border-none hover:bg-foreground/5 h-12 px-6 font-bold text-xs">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-danger h-12 px-8 font-black text-white transition-all hover:bg-danger/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-danger/20 text-xs"
              onClick={async () => {
                try {
                  await removeMember(removing!);
                  toast.success("تمت إزالة العضو بنجاح");
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "خطأ");
                }
                setRemoving(null);
              }}
            >
              تأكيد الإزالة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------ Helper Components ------------------------------ */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      dir="rtl"
      className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-4 text-right group"
    >
      <div className="mt-2 text-right">
        <Label className="text-xs font-black tracking-tight group-hover:text-primary transition-colors">
          {label}
        </Label>
        {hint && (
          <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed opacity-75">
            {hint}
          </p>
        )}
      </div>
      <div className="min-w-0 grid gap-1.5 text-right">{children}</div>
    </div>
  );
}
