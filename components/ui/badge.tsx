import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", {
  variants: {
    variant: {
      default: "bg-slate-100 text-slate-700 ring-slate-200",
      brand: "bg-brand-50 text-brand-700 ring-brand-200",
      green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      amber: "bg-amber-50 text-amber-800 ring-amber-200",
      red: "bg-rose-50 text-rose-700 ring-rose-200",
      purple: "bg-violet-50 text-violet-700 ring-violet-200",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}
