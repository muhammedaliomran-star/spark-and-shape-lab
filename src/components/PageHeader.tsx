import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
  icon,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="relative mb-12 grid grid-cols-[minmax(0,1fr)] gap-6 md:mb-16 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:justify-between">
      {/* هالة زمردية خفيفة تحت العنوان — عمق بدون ثقل */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 right-0 -z-10 h-48 w-[26rem] max-w-full rounded-full bg-primary/12 blur-[80px]"
      />
      <div className="order-1 min-w-0 text-right">
        {eyebrow && <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 py-1 text-xs font-medium tracking-[0.03em] text-muted-foreground ring-1 ring-border">{eyebrow}</span>}
        <h1 className="text-title flex w-full items-center justify-start gap-3 text-right text-foreground">
          <span className="truncate">{title}</span>
          {icon && <span className="shrink-0 opacity-90">{icon}</span>}
        </h1>
        {subtitle && (
          <p className="text-lede mt-3 max-w-prose text-right">{subtitle}</p>
        )}
      </div>
      <div className="order-2 flex flex-wrap items-center gap-2 md:justify-end">{action}</div>
    </header>
  );
}
