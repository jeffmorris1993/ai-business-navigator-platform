"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Right-side drawer for focused review work (e.g. draft approval). */
export function Sheet({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-midnight/35 animate-fade-in" />
        <D.Content className={cn("fixed inset-y-0 right-0 z-50 flex w-full max-w-[860px] flex-col bg-canvas shadow-pop animate-slide-left focus:outline-none", className)}>
          <div className="flex items-start justify-between gap-4 border-b border-line bg-surface px-6 py-4">
            <div>
              <D.Title className="text-heading font-semibold tracking-[-0.01em]">{title}</D.Title>
              {description && <D.Description className="mt-0.5 text-body-sm text-ink-3">{description}</D.Description>}
            </div>
            <D.Close className="rounded-md p-1.5 text-ink-3 hover:bg-ink/5 hover:text-ink" aria-label="Close"><X className="size-4" /></D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
