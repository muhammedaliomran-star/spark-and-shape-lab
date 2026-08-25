import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Double-Bezel container: غلاف خارجي (tray) + قلب داخلي (plate)
 * بأنصاف أقطار متحدة المركز و inset highlight — إحساس عتاد مصنّع.
 * تمت إضافة دعم لـ Backdrop Filter لتحسين مظهر Glassmorphism.
 */
export const BezelCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { innerClassName?: string; variant?: "bezel" | "flat" }
>(({ className, innerClassName, children, variant = "bezel", ...props }, ref) => {
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
        <div className={cn(innerClassName)}>{children}</div>
      </div>
    );
  }
  return (
    <div ref={ref} className={cn("bezel-shell", className)} {...props}>
      <div className={cn("bezel-core", innerClassName)}>{children}</div>
    </div>
  );
});
BezelCard.displayName = "BezelCard";