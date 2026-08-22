import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpLeft, Facebook, Mail, MessageCircle, Phone } from "lucide-react";

const LINKS: { title: string; items: { label: string; href: string }[] }[] = [
  {
    title: "المنتج",
    items: [
      { label: "المميزات", href: "#features" },
      { label: "النظام", href: "#showcase" },
      { label: "لمين مناسب", href: "#usecases" },
      { label: "الأسعار", href: "#pricing" },
    ],
  },
  {
    title: "الشركة",
    items: [
      { label: "عن سِجلّي", href: "/about" },
      { label: "سياسة الخصوصية", href: "/privacy" },
      { label: "الشروط والأحكام", href: "/terms" },
      { label: "الدعم الفني", href: "/support" },
    ],
  },
];

function FooterLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (href.startsWith("/")) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer dir="rtl" className="relative px-3 pb-8 pt-12 sm:px-8 sm:pt-16">
      <div className="relative mx-auto w-full max-w-7xl overflow-hidden rounded-[2.5rem] border border-border/50 bg-card/70">
        <div className="relative px-5 pb-8 pt-10 sm:px-8 sm:pt-14 md:px-12 md:pt-16">
          <div className="grid grid-cols-1 items-start gap-10 sm:gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
            {/* brand */}
            <div className="space-y-7 md:col-span-2 lg:col-span-4">
              <div className="space-y-4">
                <span className="block text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
                  sejelly
                </span>
                <h2 className="text-display text-4xl font-extrabold">سِجلّي</h2>
                <p className="max-w-xs text-lg leading-relaxed text-muted-foreground">
                  دفتر محلّك بالكامل في مكان واحد — فواتير، أقساط، مخزن وتقارير،
                  محسوبة بالمليم.
                </p>
              </div>

              <Link
                to="/auth"
                className="group inline-flex items-center gap-4 rounded-full bg-foreground/[0.05] p-2 ps-6 font-bold text-foreground ring-1 ring-inset ring-[var(--hairline)] transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.02] active:scale-[0.96]"
              >
                <span className="text-lg">ابدأ مجانًا</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted-foreground transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-rotate-45">
                  <ArrowUpLeft className="h-5 w-5" strokeWidth={2} />
                </span>
              </Link>
            </div>

            {/* link columns */}
            <div className="grid grid-cols-2 gap-6 sm:gap-8 lg:col-span-4">
              {LINKS.map((col) => (
                <nav key={col.title} aria-label={col.title} className="min-w-0 space-y-5 sm:space-y-6">
                  <h3 className="border-s-2 border-foreground/25 ps-3 text-sm font-bold tracking-[0.12em] text-foreground">
                    {col.title}
                  </h3>
                  <ul className="space-y-3.5 sm:space-y-4">
                    {col.items.map((it) => (
                      <li key={it.label}>
                        <FooterLink
                          href={it.href}
                          className="inline-block text-muted-foreground transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-x-0.5 hover:text-foreground"
                        >
                          {it.label}
                        </FooterLink>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>

            {/* contact */}
            <div className="min-w-0 lg:col-span-4">
              <span className="block text-xs font-medium text-muted-foreground">
                تواصل معنا
              </span>

              <div className="mt-1">
                <a
                  href="tel:+201066830834"
                  aria-label="اتصل بنا على الرقم 01066830834"
                  className="group/item flex items-center justify-between gap-3 border-b border-border/40 py-4 sm:gap-4"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="truncate font-medium text-foreground/85" dir="ltr">
                      01066830834
                    </span>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/item:text-foreground">
                    <Phone className="h-4.5 w-4.5" strokeWidth={1.5} />
                  </span>
                </a>

                <a
                  href="mailto:muhammedaliomran@gmail.com"
                  aria-label="راسلنا على البريد الإلكتروني muhammedaliomran@gmail.com"
                  className="group/item flex items-center justify-between gap-3 border-b border-border/40 py-4 sm:gap-4"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="truncate text-sm font-medium text-foreground/85 sm:text-base" dir="ltr">
                      muhammedaliomran@gmail.com
                    </span>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/item:text-foreground">
                    <Mail className="h-4.5 w-4.5" strokeWidth={1.5} />
                  </span>
                </a>

                <a
                  href="https://wa.me/201066830834"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="تواصل معنا على واتساب على الرقم 01066830834"
                  className="group/item flex items-center justify-between gap-3 py-4 sm:gap-4"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="truncate font-medium text-foreground/85">دعم واتساب 24/7</span>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground">
                    <MessageCircle className="h-4.5 w-4.5" strokeWidth={1.5} />
                  </span>
                </a>
              </div>
            </div>
          </div>

          {/* hairline base bar */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-7 text-center sm:mt-16 sm:gap-5 sm:pt-8 md:flex-row md:text-start">
            <p className="text-sm text-muted-foreground">
              © {year} سِجلّي — كل الحقوق محفوظة.
            </p>
            <p className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-xs text-muted-foreground">
                كل البيانات متزامنة ومحفوظة لحظيًا
              </span>
            </p>
          </div>

          {/* credit line */}
          <div className="mt-6 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              تم تطويره بواسطة{" "}
              <a
                href="https://www.facebook.com/devmohamedomran"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="صفحة فيسبوك المطوّر devmohamedomran — تُفتح في تبويب جديد"
                className="inline-flex items-center gap-1.5 align-middle font-bold text-muted-foreground transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-foreground hover:underline"
              >
                <Facebook className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span dir="ltr">devmohamedomran</span>
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
