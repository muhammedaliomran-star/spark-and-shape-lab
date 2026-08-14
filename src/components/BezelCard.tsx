import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Double-Bezel container: غلاف خارجي (tray) + قلب داخلي (plate)
 * بأنصاف أقطار متحدة المركز و inset highlight — إحساس عتاد مصنّع.
 */
export const BezelCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { innerClassName?: string }
>(({ className, innerClassName, children, ...props }, ref) => (
  <div ref={ref} className={cn("bezel-shell", className)} {...props}>
    <div className={cn("bezel-core", innerClassName)}>{children}</div>
  </div>
));
BezelCard.displayName = "BezelCard";
