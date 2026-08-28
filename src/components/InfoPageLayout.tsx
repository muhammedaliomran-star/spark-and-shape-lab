import { Link } from "@tanstack/react-router";
import { ArrowUpLeft } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";

export type InfoSection = {
  heading: string;
  body?: string;
  bullets?: string[];
};

export function InfoPageLayout({
  eyebrow,
  title,
  intro,
  sections,
  updatedAt = "أغسطس 2026",
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: InfoSection[];
  updatedAt?: string;
}) {
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <main className="relative px-4 pt-16 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-24 top-0 h-[480px] w-[480px] rounded-full opacity-30 blur-[80px]"
          style={{ background: "hsl(var(--foreground) / 0.06)" }}
        />

        <div className="relative mx-auto w-full max-w-4xl">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0 space-y-4">
              <span className="inline-flex items-center rounded-full hairline/70 px-2.5 py-0.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {eyebrow}
              </span>
              <h1 className="text-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
            </div>
            <Link
              to="/landing"
              className="group inline-flex shrink-0 items-center gap-2 rounded-full hairline/70 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-foreground/20 hover:text-foreground"
            >
              <span className="hidden sm:inline">الرئيسية</span>
              <ArrowUpLeft className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-45" />
            </Link>
          </div>

          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{intro}</p>

          <div className="mt-12 space-y-5">
            {sections.map((s) => (
              <section
                key={s.heading}
                className="rounded-2xl border border-foreground/10 bg-card/70 p-6 sm:p-8"
              >
                  <h2 className="border-s-2 border-foreground/20 ps-3 text-base font-bold tracking-tight text-foreground sm:text-lg">
                    {s.heading}
                  </h2>
                  {s.body ? (
                    <p className="mt-4 leading-relaxed text-muted-foreground">{s.body}</p>
                  ) : null}
                  {s.bullets ? (
                    <ul className="mt-4 space-y-3">
                      {s.bullets.map((b) => (
                        <li key={b} className="flex gap-3 leading-relaxed text-muted-foreground">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/30" />
                          <span className="min-w-0">{b}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
              </section>
            ))}
          </div>

          <p className="mt-10 text-center text-xs text-muted-foreground">
            آخر تحديث: {updatedAt}
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export default InfoPageLayout;
