"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, wide, ...p }: D.DialogContentProps & { wide?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-midnight/35 animate-fade-in" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-line bg-surface p-6 shadow-pop animate-pop",
          wide ? "max-w-4xl" : "max-w-lg",
          className,
        )}
        {...p}
      >
        {children}
        <D.Close className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
export function DialogTitle({ className, ...p }: D.DialogTitleProps) {
  return <D.Title className={cn("text-lg font-semibold tracking-tight", className)} {...p} />;
}
export function DialogDescription({ className, ...p }: D.DialogDescriptionProps) {
  return <D.Description className={cn("mt-1 text-sm text-slate-500", className)} {...p} />;
}
