import type { LucideIcon } from "lucide-react";
import { BezelCard } from "@/components/BezelCard";
import { CountUp } from "@/components/CountUp";
import { Sparkline } from "@/components/Sparkline";
import { cn } from "@/lib/utils";

export type MetricTone = "positive" | "neutral" | "danger";

const toneText: Record<MetricTone, string> = {
  positive: "text-success",
  neutral: "text-foreground",
  danger: "text-danger",
};

const toneChip: Record<MetricTone, string> = {
  positive: "bg-success/10 text-success ring-success/25",
  neutral: "bg-foreground/[0.06] text-muted-foreground ring-foreground/10",
  danger: "bg-danger/10 text-danger ring-danger/25",
};

export function MetricLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block text-xs font-bold uppercase leading-none tracking-[0.12em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** كارت مؤشر بـ Double-Bezel + Sparkline بدل الأيقونة الصامتة. */
export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
  series,
  isMoney = true,
  masked = false,
  hero = false,
  format,
  className,
}: {
  label: string;
  value: number;
  sub?: React.ReactNode;
  icon: LucideIcon;
  tone?: MetricTone;
  series?: number[];
  isMoney?: boolean;
  masked?: boolean;
  hero?: boolean;
  format: (n: number) => string;
  className?: string;
}) {
  return (
    <BezelCard
      variant="flat"
      className={cn("transition-[transform,box-shadow] duration-500 hover:-translate-y-0.5", className)}
      innerClassName={cn(
        "relative flex flex-col overflow-hidden",
        hero ? "gap-6 p-7 sm:p-9" : "gap-4 p-5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full ring-1",
            toneChip[tone],
            hero ? "h-11 w-11" : "h-9 w-9",
          )}
        >
          <Icon className={hero ? "h-5 w-5" : "h-4 w-4"} />
        </span>
        <MetricLabel className="min-w-0 pt-1 text-left">{label}</MetricLabel>
      </div>

      <div className="mt-auto text-right">
        <div
          className={cn(
            "text-numeric font-extrabold leading-none",
            toneText[tone],
            masked && "privacy-blur",
            hero ? "text-[clamp(2.4rem,6vw,4rem)]" : "text-[clamp(1.4rem,3.2vw,2rem)]",
          )}
        >
          <CountUp value={value} duration={1200} format={format} />
        </div>
        {sub && (
          <div
            className={cn(
              "mt-2 text-muted-foreground",
              hero ? "text-xs sm:text-[13px]" : "text-[11px] leading-relaxed",
            )}
          >
            {sub}
          </div>
        )}
      </div>

      {series && series.length > 1 && (
        <div
          className={cn(
            "pointer-events-none -mx-5 -mb-5 opacity-90",
            // النبرة المحايدة بتبقى فاقعة أوي بالأبيض — نخفّفها
            tone === "neutral" ? "text-muted-foreground" : toneText[tone],
            hero && "-mx-7 -mb-7 sm:-mx-9 sm:-mb-9",
          )}
        >
          <Sparkline data={series} height={hero ? 88 : 44} />
        </div>
      )}
      {!isMoney && null}
    </BezelCard>
  );
}
