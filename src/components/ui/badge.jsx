import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-[250ms] ease-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:opacity-80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:opacity-80",
        outline: "text-foreground",
        flat: "border-transparent bg-primary/15 text-primary",
        "flat-success": "border-transparent bg-success/15 text-success",
        "flat-warning": "border-transparent bg-warning/15 text-warning",
        "flat-destructive": "border-transparent bg-destructive/15 text-destructive",
        dot: "border-zinc-300 dark:border-zinc-600 bg-transparent text-foreground pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  dotColor,
  ...props
}) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {variant === 'dot' && (
        <span
          className={cn("w-2 h-2 rounded-full mr-1.5", dotColor || "bg-primary")}
        />
      )}
      {props.children}
    </div>
  );
}

export { Badge, badgeVariants }
