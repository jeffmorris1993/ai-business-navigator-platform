import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium leading-4", {
  variants: {
    variant: {
      default: "bg-subtle text-ink-2",
      outline: "border border-line text-ink-2",
      brand: "bg-cobalt-50 text-cobalt-700",
      green: "bg-teal-50 text-teal-700",
      amber: "bg-amber-50 text-amber-700",
      red: "bg-red-50 text-red-700",
      purple: "bg-cobalt-50 text-cobalt-700",
      dark: "bg-ink text-white",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}
