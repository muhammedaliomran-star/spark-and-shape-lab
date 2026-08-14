import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[84px] w-full rounded-2xl bg-foreground/[0.035] px-4 py-3 text-base shadow-[inset_0_1px_1px_hsl(0_0%_100%/0.04)] ring-1 ring-inset ring-[var(--hairline)] transition-[background-color,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] placeholder:text-muted-foreground/70 hover:bg-foreground/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
