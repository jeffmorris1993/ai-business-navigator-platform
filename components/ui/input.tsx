import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn("h-8 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[13px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cobalt/25 focus:border-cobalt disabled:opacity-50", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn("w-full rounded-md border border-line-strong bg-surface px-2.5 py-2 text-[13px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cobalt/25 focus:border-cobalt", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn("h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-cobalt/25 focus:border-cobalt", className)} {...p} />
));
Select.displayName = "Select";

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-slate-700", className)} {...p} />;
}
