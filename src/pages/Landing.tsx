import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowLeft,
  BarChart3,
  Check,
  FileText,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { SiteFooter } from "@/components/SiteFooter";

import heroImg from "@/assets/landing-hero.jpg";
import useCaseImg from "@/assets/landing-usecase.jpg";
import ctaImg from "@/assets/landing-cta.jpg";

export default Landing;

const NAV = [
  { label: "المميزات", href: "#features" },
  { label: "النظام", href: "#showcase" },
  { label: "لمين", href: "#usecases" },
  { label: "الأسعار", href: "#pricing" },
];

const FEATURES = [
  {
    icon: FileText,
    title: "إدارة الأقساط",
    body: "أنشئ جداول أقساط مرنة، وتابع كل دفعة حتى السداد الكامل.",
  },
  {
    icon: Users,
    title: "ملف عميل كامل",
    body: "كل فواتيره ومدفوعاته وتقييمه في شاشة واحدة.",
  },
  {
    icon: ScanLine,
    title: "باركود ومخزون",
    body: "امسح الصنف، والمخزن يتحدّث لوحده مع كل بيعة.",
  },
  {
    icon: BarChart3,
    title: "تقارير ومصروفات",
    body: "اعرف ربحك الحقيقي بعد المصروفات، شهرًا بشهر.",
  },
];

const USE_CASES = [
  {
    title: "محلات الأجهزة بالتقسيط",
    body: "دفتر الأقساط الورقي بيتحوّل جدول محسوب بالمليم، وتنبيه قبل كل استحقاق.",
  },
  {
    title: "معارض الأثاث والموبايلات",
    body: "فاتورة مفصّلة بالأصناف، خصم مقدّم، وباقي محسوب تلقائيًا.",
  },
  {
    title: "التجار اللي بيشتروا بالجملة",
    body: "فواتير شراء من الموردين تعبّي المخزن من غير إدخال يدوي.",
  },
];

const PLANS = [
  {
    name: "أساسي",
    price: "٤٩٩",
    features: ["حتى ١٠٠ عميل", "فواتير وأقساط", "مخزون أساسي", "دعم بالبريد"],
    featured: false,
  },
  {
    name: "احترافي",
    price: "٩٩٩",
    features: [
      "عملاء بلا حدود",
      "باركود ومسح ضوئي",
      "تقارير ومصروفات",
      "دعم أولوية",
    ],
    featured: true,
  },
  {
    name: "متعدد الفروع",
    price: "١٩٩٩",
    features: ["أكثر من فرع", "صلاحيات مستخدمين", "تصدير ونسخ احتياطي", "مدير حساب"],
    featured: false,
  },
];

const QUOTES = [
  {
    text: "كنت بنسى مين دفع ومين لأ. بقيت أفتح الموبايل وأعرف في ثانية.",
    name: "أحمد السعيد",
    role: "معرض أجهزة — المنصورة",
  },
  {
    text: "المخزن بيتظبط لوحده مع كل فاتورة. وفّر عليّ يوم شغل في الشهر.",
    name: "بسمة علي",
    role: "محل موبايلات — طنطا",
  },
];

function Landing() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* ── nav ─────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-5">
        <nav className="glass flex w-full max-w-4xl items-center justify-between gap-6 rounded-full py-2 pe-2 ps-6">
          <span className="text-display text-xl font-extrabold tracking-tight">سِجلّي</span>
          <div className="hidden items-center gap-7 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="relative py-1 text-[13px] text-muted-foreground transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-foreground"
              >
                {n.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-9 w-9" />
            <Link
              to="/auth"
              className="press rounded-full bg-foreground/[0.06] px-5 py-2 text-[13px] font-semibold text-foreground ring-1 ring-inset ring-[var(--hairline)] hover:bg-foreground/10"
            >
              تسجيل الدخول
            </Link>
          </div>
        </nav>
      </header>

      {/* ── 1. hero ─────────────────────────────────────── */}
      <section className="relative flex min-h-[92vh] items-end overflow-hidden">
        <img
          src={heroImg}
          alt="محل أجهزة منزلية في مصر وقت الغروب"
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-background/70 to-background" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />


        <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-32">
          <Reveal className="max-w-2xl">
            <span className="mb-6 block text-xs font-semibold tracking-[0.14em] text-muted-foreground">نظام إدارة الفواتير والأقساط</span>
            <h1 className="text-hero">
              دفترك كله.
              <br />
              في مكان واحد.
            </h1>
            <p className="text-lede mt-7 max-w-md">
              من الفاتورة لآخر قسط — عملاء ومخزون ومصروفات، محسوبة بالمليم.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/auth" className="group island-btn bg-primary text-primary-foreground">
                <span className="ps-1">ابدأ مجانًا</span>
                <span className="island-btn-icon">
                  <ArrowLeft className="h-4 w-4" />
                </span>
              </Link>
              <a
                href="#showcase"
                className="press rounded-full bg-foreground/[0.05] px-7 py-3 text-sm font-semibold text-foreground ring-1 ring-inset ring-[var(--hairline)] hover:bg-foreground/[0.09]"
              >
                شوف النظام
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 2. trust bar ────────────────────────────────── */}
      <section className="border-y border-border/50 py-20">
        <Reveal className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-xs tracking-wide text-muted-foreground">
            بيشتغل عليه تجّار في محافظات مصر
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-12 gap-y-5 text-lg font-bold text-muted-foreground/50">
            <span>المنصورة</span>
            <span>طنطا</span>
            <span className="text-muted-foreground/75">القاهرة</span>
            <span>أسيوط</span>
            <span>الإسكندرية</span>
          </div>
          <div className="mx-auto mt-7 h-px w-24 bg-foreground/25" />
        </Reveal>
      </section>

      {/* ── 3. features ─────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 py-32">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-[1fr_2fr] lg:items-center">
          <Reveal>
            <span className="mb-4 block text-xs font-semibold tracking-[0.14em] text-muted-foreground">المميزات</span>
            <h2 className="text-title">
              مصمم لطريقة
              <br />
              شغلك اليومية.
            </h2>
            <a
              href="#showcase"
              className="mt-7 inline-flex items-center gap-2 border-b border-foreground/25 pb-1 text-sm font-semibold transition-colors duration-500 hover:border-foreground"
            >
              استكشف النظام
              <ArrowLeft className="h-4 w-4" />
            </a>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                delay={i * 70}
                className="plate group p-8 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-foreground/[0.04] text-foreground ring-1 ring-inset ring-foreground/[0.08] transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105">
                  <f.icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <h3 className="mt-6 text-[17px] font-bold tracking-[-0.01em]">{f.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. showcase ─────────────────────────────────── */}
      <section
        id="showcase"
        className="scroll-mt-20 overflow-hidden border-y border-border/50 py-32"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, hsl(var(--card)) 0%, hsl(var(--background)) 70%)",
        }}
      >
        <Reveal className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-title mx-auto max-w-xl">
            كل حركة في محلك، مسجّلة ومحسوبة.
          </h2>
        </Reveal>

        <Reveal delay={120} className="mx-auto mt-16 max-w-5xl px-6">
          <div className="rounded-[1.75rem] bg-card/60 p-6 ring-1 ring-inset ring-[var(--hairline)] sm:p-9">
            <div className="grid gap-7 text-right sm:grid-cols-3 sm:gap-0 sm:[&>*+*]:border-s sm:[&>*+*]:border-[var(--hairline)] sm:[&>*+*]:ps-8">
              {[
                { k: "إجمالي التحصيل", v: "١٢٨٬٥٤٠" },
                { k: "أقساط مستحقة", v: "٢٤" },
                { k: "عملاء نشطون", v: "٣٤٢" },
              ].map((s) => (
                <div key={s.k}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{s.k}</p>
                  <p className="text-numeric mt-2.5 text-[1.75rem] font-extrabold leading-none">{s.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-[var(--hairline)] pt-6">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">آخر الفواتير</p>
                <div>
                  {[
                    ["محمود عبد المنعم", "مكتمل", "١٬٢٥٠"],
                    ["سارة محمد", "قسط مستحق", "٨٥٠"],
                    ["خالد السبيعي", "جارٍ السداد", "٢٬٣٠٠"],
                  ].map(([n, st, amt]) => (
                    <div
                      key={n}
                      className="row-hover flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <span className="font-medium">{n}</span>
                      <span className="text-xs text-muted-foreground">{st}</span>
                      <span className="font-bold tabular-nums">{amt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        </Reveal>
      </section>

      {/* ── 5. use cases ────────────────────────────────── */}
      <section id="usecases" className="scroll-mt-20">
        <div className="grid lg:grid-cols-[45fr_55fr]">
          <div className="relative min-h-[320px] lg:min-h-[640px]">
            <img
              src={useCaseImg}
              alt="صاحب محل يمسح باركود منتج"
              loading="lazy"
              width={1008}
              height={1200}
              className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-background/60" />
          </div>

          <div className="flex items-center px-6 py-24 lg:px-16">
            <div className="w-full max-w-lg">
              <Reveal>
                <span className="mb-4 block text-xs font-semibold tracking-[0.14em] text-muted-foreground">لمين النظام</span>
                <h2 className="text-title">
                  للتاجر اللي بيبيع
                  <br />
                  بالتقسيط.
                </h2>
              </Reveal>

              <div className="mt-12">
                {USE_CASES.map((u, i) => (
                  <Reveal
                    key={u.title}
                    delay={i * 80}
                    className="border-t border-border py-7 last:border-b"
                  >
                    <h3 className="font-bold">{u.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {u.body}
                    </p>
                  </Reveal>
                ))}
              </div>

              <Reveal delay={240}>
                <Link
                  to="/auth"
                  className="press mt-10 inline-block rounded-full bg-foreground/[0.05] px-6 py-2.5 text-sm font-semibold text-foreground ring-1 ring-inset ring-[var(--hairline)] hover:bg-foreground/[0.09]"
                >
                  جرّبه على محلك
                </Link>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. testimonials ─────────────────────────────── */}
      <section className="border-y border-border/50 py-32">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 lg:grid-cols-[1fr_1.6fr] lg:items-end">
          <div className="order-2 space-y-px lg:order-1">
            {QUOTES.slice(1).map((q) => (
              <Reveal key={q.name} className="border-t border-border py-6 last:border-b">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  «{q.text}»
                </p>
                <p className="mt-3 text-xs font-bold">{q.name}</p>
                <p className="text-xs text-muted-foreground">{q.role}</p>
              </Reveal>
            ))}
          </div>

          <Reveal className="relative order-1 lg:order-2">
            <span
              aria-hidden
              className="absolute -top-8 right-0 select-none text-[9rem] font-extrabold leading-none text-foreground/[0.08]"
            >
              ”
            </span>
            <blockquote className="relative text-2xl font-medium leading-[1.6] sm:text-3xl">
              {QUOTES[0].text}
            </blockquote>
            <footer className="mt-8">
              <p className="font-bold">{QUOTES[0].name}</p>
              <p className="text-sm text-muted-foreground">{QUOTES[0].role}</p>
            </footer>
          </Reveal>
        </div>
      </section>

      {/* ── 7. pricing ──────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-20 py-32">
        <Reveal className="mx-auto max-w-6xl px-6 text-center">
          <span className="mb-4 block text-xs font-semibold tracking-[0.14em] text-muted-foreground">الأسعار</span>
          <h2 className="text-title">
            اختر الخطة اللي تناسب محلك
          </h2>
        </Reveal>

        <div className="mx-auto mt-16 grid max-w-5xl gap-4 px-6 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal
              key={p.name}
              delay={i * 80}
              className={
                p.featured
                  ? "plate plate-accent relative p-9 md:-mt-4 md:pb-12"
                  : "plate relative p-9 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1"
              }
            >
              {p.featured && (
                <span className="absolute -top-3 start-9 rounded-full bg-primary px-3 py-1 text-[10px] font-bold tracking-[0.08em] text-primary-foreground">
                  الأكثر اختيارًا
                </span>
              )}
              <h3 className="text-[17px] font-bold tracking-[-0.01em]">{p.name}</h3>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="text-numeric text-[2.5rem] font-extrabold leading-none">{p.price}</span>
                <span className="text-xs text-muted-foreground">ج.م / شهريًا</span>
              </p>
              <div className="my-7 h-px bg-[var(--hairline)]" />
              <ul className="space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-foreground/60" strokeWidth={2.25} />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className={
                  p.featured
                    ? "press mt-9 block rounded-full bg-primary py-3 text-center text-sm font-bold text-primary-foreground hover:brightness-110"
                    : "press mt-9 block rounded-full bg-foreground/[0.05] py-3 text-center text-sm font-semibold ring-1 ring-inset ring-[var(--hairline)] hover:bg-foreground/[0.09]"
                }
              >
                ابدأ الآن
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── 8. final CTA + footer ───────────────────────── */}
      <section className="relative overflow-hidden">
        <img
          src={ctaImg}
          alt="دفتر حسابات وإيصالات على منضدة محل"
          loading="lazy"
          width={1920}
          height={912}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-background/85" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 20%, hsl(var(--background)) 85%)",
          }}
        />

        <Reveal className="relative mx-auto max-w-2xl px-6 py-36 text-center">
          <h2 className="text-title">
            اقفل الدفتر الورقي النهاردة.
          </h2>
          <p className="text-lede mt-5">
            سجّل في دقيقة، وابدأ أول فاتورة على طول.
          </p>
          <Link to="/auth" className="group island-btn mt-10 bg-primary text-primary-foreground">
            <span className="ps-1">ابدأ مجانًا</span>
            <span className="island-btn-icon">
              <ArrowLeft className="h-4 w-4" />
            </span>
          </Link>
          <p className="mt-5 text-xs text-muted-foreground">
            من غير بطاقة ائتمان · إلغاء في أي وقت
          </p>
        </Reveal>

        <SiteFooter />

      </section>
    </div>
  );
}
