import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-2xl bg-foreground/[0.035] px-4 py-2 text-base shadow-[inset_0_1px_1px_hsl(0_0%_100%/0.04)] ring-1 ring-inset ring-[var(--hairline)] transition-[background-color,box-shadow,ring-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/70 hover:bg-foreground/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
