"use client";
import { Dialog as Primitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Backdrop className="fixed inset-0 z-50 bg-foreground/50" />
        <Primitive.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-6 shadow-xl outline-none">
          <div className="pr-10">
            <Primitive.Title className="text-xl font-semibold">
              {title}
            </Primitive.Title>
            {description && (
              <Primitive.Description className="mt-2 text-sm text-muted-foreground">
                {description}
              </Primitive.Description>
            )}
          </div>
          <Primitive.Close
            aria-label="Close dialog"
            className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" />
          </Primitive.Close>
          <div className="mt-6">{children}</div>
        </Primitive.Popup>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
