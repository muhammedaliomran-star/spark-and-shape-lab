import { PageTransition } from "@/components/PageTransition";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useDB, db, daysLate, fmt, customerBalance, useShopSettings, isDueSoonOrOverdue, daysUntilDue, type Customer } from "@/lib/store";
import { Bell, MessageCircle, Phone, Calendar, AlertCircle, Eye, EyeOff, Wallet, Clock, Copy, Send, Package, AlertTriangle } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { toArabicDigits } from "@/lib/arabic-digits";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePrivacy } from "@/lib/privacy";
import { motion, AnimatePresence } from "framer-motion";

export default function Page() { return (<AppShell><PageTransition><AlertsPage /></PageTransition></AppShell>); }

// --- Snooze (24h, per-invoice, localStorage) ---
const SNOOZE_KEY = "segilly:alerts:snooze";
type SnoozeMap = Record<string, number>; // invoiceId -> expiresAt(ms)
function readSnooze(): SnoozeMap {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}"); } catch { return {}; }
}
function writeSnooze(m: SnoozeMap) {
  try { localStorage.setItem(SNOOZE_KEY, JSON.stringify(m)); } catch { /* noop */ }
}

// --- Script variants (Friendly / Formal / Final Warning) ---
type ScriptTone = "friendly" | "formal" | "final";
function scriptFor(tone: ScriptTone, c: Customer, balance: number, lateDays: number, dueAmount: number): string {
  if (tone === "friendly") {
    return `يا أستاذ ${c.name}، تحية طيبة 🌿\nتذكير ودي بقسط بقيمة ${fmt(dueAmount)} ج.م${lateDays > 0 ? ` (متأخر ${lateDays} يوم)` : ` المستحق اليوم`}.\nلو فيه أي استفسار أو ظرف، إحنا تحت أمرك. شكراً لتعاونك معانا.`;
  }
  if (tone === "formal") {
    return `السيد/ ${c.name} المحترم،\nنود إحاطتكم علماً بأن قسطكم بقيمة ${fmt(dueAmount)} ج.م ${lateDays > 0 ? `متأخر السداد منذ ${lateDays} يوم` : `مستحق السداد اليوم`}، وإجمالي الرصيد المستحق عليكم ${fmt(balance)} ج.م.\nنرجو التكرم بسرعة سداد المبلغ المستحق في أقرب وقت.\nمع وافر الاحترام.`;
  }
  // final warning
  const months = Math.max(1, Math.floor(Math.max(lateDays, 30) / 30));
  return `السيد/ ${c.name}،\nإنذار نهائي: حسابكم متأخر السداد منذ ${months} شهر، والرصيد المستحق ${fmt(balance)} ج.م.\nنمنحكم مهلة (7) أيام من تاريخه للسداد، وفي حال عدم الاستجابة سنضطر لاتخاذ كافة الإجراءات القانونية اللازمة لاسترداد حقوقنا، وتحميلكم المصاريف القضائية.\nنأمل المبادرة تجنباً للإجراءات.`;
}

const TONES: { id: ScriptTone; label: string; sub: string; cls: string }[] = [
  { id: "friendly", label: "للتذكير الودي", sub: "Friendly", cls: "border-success/40 bg-success/5 hover:bg-success/10 text-success" },
  { id: "formal",   label: "مطالبة رسمية",  sub: "Formal",   cls: "border-warning/40 bg-warning/5 hover:bg-warning/10 text-warning" },
  { id: "final",    label: "تحذير نهائي",   sub: "Final Warning", cls: "border-danger/40 bg-danger/5 hover:bg-danger/10 text-danger" },
];

function AlertsPage() {
  const data = useDB();
  const { settings } = useShopSettings();
  const lowStockLimit = settings.lowStockThreshold;
  const daysBefore = settings.reminderDaysBefore;
  const [scriptInvId, setScriptInvId] = useState<string | null>(null);
  const [tone, setTone] = useState<ScriptTone>("friendly");
  const [payInvId, setPayInvId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [paying, setPaying] = useState(false);
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  // Snooze state — re-read on mount; tick every minute to expire snoozes
  const [snoozes, setSnoozes] = useState<SnoozeMap>(() => readSnooze());
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  const now = Date.now();
  const items = data.invoices
    .filter((inv) => isDueSoonOrOverdue(inv, daysBefore))
    .filter((inv) => !(snoozes[inv.id] && snoozes[inv.id] > now))
    .map((inv) => ({
      inv,
      late: daysLate(inv),
      until: daysUntilDue(inv),
      customer: data.customers.find((c) => c.id === inv.customerId),
    }))
    .filter((x) => x.customer)
    .sort((a, b) => b.late - a.late);

  const selected = scriptInvId ? items.find((x) => x.inv.id === scriptInvId) : null;
  const payTarget = payInvId ? items.find((x) => x.inv.id === payInvId) : null;

  const lowStock = data.stockItems
    .filter((it) => it.quantity < lowStockLimit)
    .sort((a, b) => a.quantity - b.quantity);

  const openPay = (invId: string, suggested: number) => {
    setPayInvId(invId);
    setPayAmount(String(Math.round(suggested)));
  };

  const submitPayment = async () => {
    if (!payTarget) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { toast.error("أدخل مبلغ صحيح"); return; }
    setPaying(true);
    try {
      await db.recordPayment(payTarget.inv.id, amount);
      toast.success("تم تسجيل الدفعة");
      setPayInvId(null);
      setPayAmount("");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل تسجيل الدفعة");
    } finally {
      setPaying(false);
    }
  };

  const sendWhatsApp = (customerName: string, phone: string, amount: number) => {
    const msg = `عزيزي ${customerName}، نذكركم بموعد قسطكم اليوم بقيمة ${fmt(amount)} ج.م. شكراً لتعاونكم مع سجلّي.`;
    const num = phone.replace(/\D/g, "").replace(/^0/, "20");
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(toArabicDigits(msg))}`, "_blank");
  };

  const snooze = (invId: string) => {
    const next = { ...snoozes, [invId]: Date.now() + 24 * 60 * 60 * 1000 };
    setSnoozes(next);
    writeSnooze(next);
    toast.success("تم تأجيل التنبيه 24 ساعة");
  };

  const openScript = (invId: string) => {
    setScriptInvId(invId);
    setTone("friendly");
  };

  return (
    <>
      <PageHeader
        title="المنبه والمتأخرات"
        subtitle={
          daysBefore > 0
            ? `العملاء المتأخرين، والمستحق عليهم اليوم أو خلال ${daysBefore} يوم — مرتبين حسب خطورة التأخر.`
            : "قائمة العملاء المستحقة أقساطهم اليوم أو المتأخرين، مرتبة حسب خطورة التأخر."
        }
          icon={<Bell className="w-7 h-7" />}
        action={
          <Button
            variant={privacy ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={toggle}
            title="إخفاء الأرقام"
          >
            {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">إخفاء الأرقام</span>
          </Button>
        }
      />

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {items.map(({ inv, late, until, customer }, idx) => {
            // Severity: neutral = upcoming, green = due today, amber = 1–30 days late, red = >30
            const upcoming = until > 0;
            const severity = upcoming ? "soon" : late === 0 ? "due" : late > 30 ? "danger" : "warning";
            const remaining = inv.total - inv.paid;
            const dueAmount = Math.min(inv.monthlyInstallment || remaining, remaining);
            const cls =
              severity === "soon"    ? "border-foreground/15 bg-foreground/[0.03]" :
              severity === "due"     ? "border-success/40 bg-success/5"   :
              severity === "danger"  ? "border-danger/40 bg-danger/5"     :
                                       "border-warning/40 bg-warning/5";
            const accent =
              severity === "soon"    ? "text-muted-foreground" :
              severity === "due"     ? "text-success" :
              severity === "danger"  ? "text-danger"  :
                                       "text-warning";
            return (
              <motion.div
                key={inv.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.35, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] } }}
                exit={{ opacity: 0, x: 400, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}
                className={cn("rounded-xl border-2 p-5 hover:scale-[1.005] transition-transform", cls)}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-center bg-card/60 rounded-2xl p-3 min-w-[90px] border border-foreground/10">
                      <div className={cn("text-2xl font-extrabold", accent)}>
                        {upcoming ? until : late > 0 ? late : "اليوم"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {upcoming ? "يوم للاستحقاق" : late > 0 ? "يوم تأخر" : "مستحق"}
                      </div>
                    </div>
                    <div className="bg-card/60 rounded-2xl p-3 border border-foreground/10">
                      <div className="text-xs text-muted-foreground">{upcoming ? "المبلغ المستحق قريباً" : "المبلغ المتأخر"}</div>
                      <div className={cn("text-lg font-bold", blurCls)}>{fmt(remaining)} ج.م</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-lg font-bold flex items-center gap-2 justify-end", accent)}>
                      {customer!.name}
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 justify-end">
                      <span dir="ltr">{customer!.phone}</span>
                      <Phone className="w-3 h-3" />
                      <span>
                        {upcoming ? "يستحق في: " : "مستحق منذ: "}
                        {new Date(inv.firstDueDate).toLocaleDateString("en-US", { day: "2-digit", month: "long" })}
                      </span>
                      <Calendar className="w-3 h-3" />
                    </div>
                  </div>
                </div>

                {/* Action row */}
                <div className="mt-4 pt-4 border-t border-[var(--hairline)] flex items-center gap-2 flex-wrap">
                  <Button size="sm" className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground" onClick={() => openPay(inv.id, dueAmount)}>
                    <Wallet className="w-3.5 h-3.5" /> دفع الآن
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-success/40 text-success hover:bg-success/10"
                    onClick={() => sendWhatsApp(customer!.name, customer!.phone, dueAmount)}
                    title="تذكير عبر واتساب"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> تذكير واتساب
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => openScript(inv.id)}>
                    <MessageCircle className="w-3.5 h-3.5" /> هقوله إيه؟
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => snooze(inv.id)}
                    title="تأجيل 24 ساعة"
                  >
                    <Clock className="w-3.5 h-3.5" /> تأجيل
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {items.length === 0 && lowStock.length === 0 && (
          <div className="text-center py-20 rounded-2xl border border-foreground/10 bg-card/70">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <div className="text-lg font-medium">لا يوجد تنبيهات 🎉</div>
            <div className="text-sm text-muted-foreground mt-1">كل العملاء ملتزمين والمخزن بحالة جيدة.</div>
          </div>
        )}
      </div>

      {lowStock.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2 text-warning">
              <Package className="w-5 h-5" /> تنبيهات المخزن
              <span className="text-xs font-normal text-muted-foreground">(أقل من {lowStockLimit} وحدات)</span>
            </h2>
            <Link to="/inventory" className="text-xs text-foreground hover:underline">عرض المخزن ←</Link>
          </div>
          <div className="grid gap-2">
            {lowStock.map((it) => {
              const out = it.quantity <= 0;
              return (
                <Link
                  key={it.id}
                  to="/inventory"
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border-2 p-4 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    out ? "border-danger/40 bg-danger/5 hover:bg-danger/10" : "border-warning/40 bg-warning/5 hover:bg-warning/10",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={cn("w-5 h-5", out ? "text-danger" : "text-warning")} />
                    <div>
                      <div className="font-bold">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{out ? "نفذ من المخزن" : "كمية منخفضة — يحتاج إعادة طلب"}</div>
                    </div>
                  </div>
                  <div className={cn("text-2xl font-extrabold tabular-nums", out ? "text-danger" : "text-warning", blurCls)}>
                    {fmt(it.quantity)}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Script Picker Dialog (Friendly / Formal / Final Warning) */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setScriptInvId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-right">اختر نوع الرسالة</DialogTitle>
            <DialogDescription className="text-right">3 صيغ مقترحة حسب الموقف.</DialogDescription>
          </DialogHeader>
          {selected && (() => {
            const balance = customerBalance(data.invoices, selected.customer!.id, selected.customer!.openingBalance);
            const remaining = selected.inv.total - selected.inv.paid;
            const dueAmount = Math.min(selected.inv.monthlyInstallment || remaining, remaining);
            const msg = scriptFor(tone, selected.customer!, balance, selected.late, dueAmount);
            return (
              <div className="space-y-4">
                {/* Tone tabs */}
                <div className="grid grid-cols-3 gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTone(t.id)}
                      className={cn(
                        "rounded-2xl border-2 p-2.5 text-center transition-[border-color,background-color,opacity,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] text-xs",
                        t.cls,
                        tone === t.id ? "ring-1 ring-foreground/20 scale-[1.02]" : "opacity-70"
                      )}
                    >
                      <div className="font-bold">{t.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{t.sub}</div>
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-foreground/15 bg-foreground/[0.04] p-4 text-right leading-loose whitespace-pre-line">{msg}</div>

                <div className="flex gap-2">
                  <Button className="flex-1 gap-1.5" onClick={() => { navigator.clipboard.writeText(toArabicDigits(msg)); toast.success("تم النسخ"); }}>
                    <Copy className="w-4 h-4" /> نسخ
                  </Button>
                  <Button variant="outline" className="flex-1 gap-1.5" onClick={() => {
                    const phone = selected.customer!.phone.replace(/\D/g, "").replace(/^0/, "20");
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(toArabicDigits(msg))}`, "_blank");
                  }}>
                    <Send className="w-4 h-4" /> إرسال واتساب
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Quick Pay Dialog */}
      <Dialog open={!!payTarget} onOpenChange={(o) => { if (!o) { setPayInvId(null); setPayAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-right">تسجيل دفعة</DialogTitle>
            <DialogDescription className="text-right">
              {payTarget ? `العميل: ${payTarget.customer!.name} • متبقي: ${fmt(payTarget.inv.total - payTarget.inv.paid)} ج.م` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-right">
            <Label htmlFor="quick-pay-amount">المبلغ (ج.م)</Label>
            <Input
              id="quick-pay-amount"
              type="number"
              inputMode="decimal"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0"
              dir="ltr"
              className="text-right"
            />
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={submitPayment} disabled={paying} className="gap-1.5">
              <Wallet className="w-4 h-4" /> تأكيد الدفع
            </Button>
            <Button variant="outline" onClick={() => { setPayInvId(null); setPayAmount(""); }}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
