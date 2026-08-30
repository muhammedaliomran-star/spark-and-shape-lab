import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type BezelExtras = {
  innerClassName?: string;
  variant?: "bezel" | "flat";
  /** وضع الكارت الإحصائي: يعرض تخطيط (أيقونة + عنوان + قيمة + وصف) */
  label?: string;
  icon?: LucideIcon;
  value?: React.ReactNode;
  sub?: React.ReactNode;
};

/**
 * Double-Bezel container: غلاف خارجي (tray) + قلب داخلي (plate)
 * بأنصاف أقطار متحدة المركز و inset highlight — إحساس عتاد مصنّع.
 * تمت إضافة دعم لـ Backdrop Filter لتحسين مظهر Glassmorphism.
 */
export const BezelCard = React.forwardRef<
  HTMLDivElement,
  Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & BezelExtras & { children?: React.ReactNode }
>(({ className, innerClassName, children, variant = "bezel", label, icon: Icon, value, sub, ...props }, ref) => {
  const content = label
    ? (
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            {Icon && (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-muted-foreground ring-1 ring-border">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0 pt-1 text-left text-[11px] font-bold uppercase leading-tight tracking-[0.12em] text-muted-foreground">
              {label}
            </span>
          </div>
          <div className="mt-auto text-right text-[clamp(1.2rem,3vw,1.7rem)] font-extrabold leading-none">
            {value}
          </div>
          {sub && <div className="text-right text-[11px] leading-relaxed text-muted-foreground">{sub}</div>}
        </div>
      )
    : children;

  if (variant === "flat") {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[1.75rem] bg-card/70 ring-1 ring-inset ring-[var(--hairline)] shadow-[0_4px_16px_-12px_hsl(165_40%_1%/0.35)]",
          className,
        )}
        {...props}
      >
        <div className={cn(innerClassName)}>{content}</div>
      </div>
    );
  }
  return (
    <div ref={ref} className={cn("bezel-shell", className)} {...props}>
      <div className={cn("bezel-core", innerClassName)}>{content}</div>
    </div>
  );
});
BezelCard.displayName = "BezelCard";
