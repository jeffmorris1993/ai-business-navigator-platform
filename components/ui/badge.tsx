import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tagVariants = cva("inline-flex items-center gap-1 rounded-[5px] px-1.5 py-[2px] text-[11.5px] font-medium leading-4", {
  variants: {
    variant: {
      default: "bg-ink/[0.05] text-ink-2",
      outline: "border border-line text-ink-2",
      brand: "bg-cobalt-50 text-cobalt-700",
      green: "bg-teal-50 text-teal-700",
      amber: "bg-amber-50 text-amber-700",
      red: "bg-red-50 text-red-700",
      purple: "bg-cobalt-50 text-cobalt-700",
      dark: "bg-midnight text-night",
      lime: "bg-lime text-midnight",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof tagVariants>) {
  return <span className={cn(tagVariants({ variant }), className)} {...p} />;
}
export const Tag = Badge;
