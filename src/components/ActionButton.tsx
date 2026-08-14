import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * زر "جزيرة": حبة كاملة الاستدارة + أيقونة داخل دائرتها الخاصة (button-in-button)
 * مع فيزياء ضغط ومغناطيسية داخلية.
 */
export const ActionButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: React.ReactNode;
    tone?: "primary" | "surface";
  }
>(({ className, children, icon, tone = "primary", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "group island-btn",
      tone === "primary"
        ? "bg-primary text-primary-foreground"
        : "bg-secondary text-secondary-foreground ring-1 ring-border",
      className,
    )}
    {...props}
  >
    <span className="ps-1">{children}</span>
    {icon && <span className="island-btn-icon">{icon}</span>}
  </button>
));
ActionButton.displayName = "ActionButton";
