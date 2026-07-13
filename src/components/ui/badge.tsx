import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        ink: "mono-eyebrow rounded-sm border-transparent bg-ink text-parch px-1.5 py-0.5",
        ochre: "mono-eyebrow rounded-sm border-transparent bg-ochre text-ink px-1.5 py-0.5",
        clay: "mono-eyebrow rounded-sm border-transparent bg-clay text-parch px-1.5 py-0.5",
        sky: "mono-eyebrow rounded-sm border-transparent bg-sky text-parch px-1.5 py-0.5",
        line: "mono-eyebrow rounded-sm border-line bg-transparent text-mute px-1.5 py-0.5",
        "ochre-soft": "mono-eyebrow rounded-sm border-transparent bg-ochre/15 text-parch px-1.5 py-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
