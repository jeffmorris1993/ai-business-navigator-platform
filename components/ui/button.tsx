import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[7px] text-[13.5px] font-medium tracking-[-0.005em] transition-[background,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px [&_svg]:size-[15px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-midnight-3",
        primary: "bg-cobalt text-white hover:bg-cobalt-700",
        signal: "bg-lime text-midnight shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_6px_18px_-8px_rgba(200,240,75,0.7)] hover:bg-[#d4f56a]",
        dark: "bg-midnight text-night hover:bg-midnight-3",
        secondary: "border border-line-strong bg-surface text-ink shadow-card hover:border-ink-4 hover:bg-white",
        ghost: "text-ink-2 hover:bg-ink/[0.05] hover:text-ink",
        quiet: "text-ink-3 hover:text-ink",
        night: "border border-midnight-line bg-midnight-2 text-night hover:bg-midnight-3",
        success: "bg-teal text-white hover:bg-teal-700",
        danger: "border border-red/30 bg-surface text-red-700 hover:bg-red-50",
        link: "h-auto px-0 text-cobalt underline-offset-4 hover:underline",
      },
      size: { default: "h-9 px-3.5", sm: "h-8 px-3 text-[13px]", xs: "h-7 px-2.5 text-[12.5px]", lg: "h-11 px-5 text-[14.5px]", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";
export { buttonVariants };
