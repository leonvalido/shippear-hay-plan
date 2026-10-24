import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap no-caps",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-white/8 bg-white/6 text-foreground",
        outline: "border-white/8 text-muted-foreground",
        success: "border-emerald-400/20 bg-emerald-400/12 text-emerald-300",
        warning: "border-amber-400/25 bg-amber-400/15 text-amber-200",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
