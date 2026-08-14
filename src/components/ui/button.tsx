import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[transform,box-shadow,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.975] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_10px_28px_-14px_hsl(var(--primary)/0.85)] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_18px_45px_-18px_hsl(var(--primary)/0.6)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_10px_28px_-16px_hsl(var(--destructive)/0.8)] hover:bg-destructive/90",
        outline:
          "bg-transparent text-foreground shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.1)] hover:bg-accent/60 hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)] hover:bg-secondary/80",
        ghost: "hover:bg-accent/70 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline rounded-md",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
