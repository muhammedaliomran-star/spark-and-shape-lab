import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
};

/**
 * Empty state with a hand-drawn "ledger page" motif — a nod to the paper
 * notebook the app replaces. Uses only semantic tokens so it themes correctly.
 */
export function EmptyState({ icon: Icon, title, hint, action, compact, className }: Props) {
  return (
    <div
      dir="rtl"
      className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-14"} ${className ?? ""}`}
    >
      <div className="relative mb-5">
        {/* ruled ledger sheet */}
        <svg
          width={compact ? 88 : 120}
          height={compact ? 88 : 120}
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden="true"
          className="text-border"
        >
          <rect
            x="22"
            y="10"
            width="76"
            height="100"
            rx="6"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M22 30h76M22 46h76M22 62h76M22 78h76M22 94h76" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          <path d="M40 10v100" stroke="currentColor" strokeWidth="1" opacity="0.7" />
          <circle cx="60" cy="60" r="52" stroke="currentColor" strokeWidth="1" strokeDasharray="3 7" opacity="0.35" />
        </svg>
<span className="absolute inset-0 grid place-items-center">
          <span className="grid place-items-center w-11 h-11 rounded-2xl bg-foreground/[0.06] text-muted-foreground ring-1 ring-border">
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          </span>
        </span>
      </div>

      <p className="text-[15px] font-bold tracking-[-0.01em] text-foreground">{title}</p>
      {hint && <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;
