import { Link } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** حالة فارغة مصمّمة داخل الشارت: خطوط شبح + دعوة لإجراء. */
export function ChartEmpty({
  title,
  hint,
  ctaLabel,
  ctaTo,
  variant = "line",
  className,
}: {
  title: string;
  hint?: string;
  ctaLabel?: string;
  ctaTo?: string;
  variant?: "line" | "ring";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative grid h-full min-h-[11rem] place-items-center overflow-hidden py-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.22]" aria-hidden="true">
        {variant === "line" ? (
          <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="h-full w-full">
            {[12, 24, 36, 48].map((y) => (
              <line
                key={y}
                x1="0"
                x2="100"
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeWidth="0.4"
                strokeDasharray="2 3"
                className="text-border"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path
              d="M0,46 L16,38 L33,42 L50,28 L66,33 L83,20 L100,25"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 5"
              strokeLinecap="round"
              className="text-muted-foreground/45"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 100 100" className="mx-auto h-full">
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeDasharray="6 8"
              strokeLinecap="round"
              className="text-border"
            />
          </svg>
        )}
      </div>

      <div className="relative max-w-[17rem] px-5 text-center">
        <p className="text-sm font-bold tracking-[-0.01em] text-foreground/85">{title}</p>
        {hint && <p className="mt-2 text-xs leading-6 text-muted-foreground">{hint}</p>}
        {ctaLabel && ctaTo && (
          <Link
            to={ctaTo as never}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-4 py-2 text-xs font-bold text-foreground ring-1 ring-border transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.10] active:scale-[0.98]"
          >
            {ctaLabel}
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
