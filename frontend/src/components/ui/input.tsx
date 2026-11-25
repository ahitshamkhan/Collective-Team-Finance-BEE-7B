"use client";
import * as React from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  const hydrated = useHydrated();
  return (
    <input
      className={cn(
        "flex min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive",
        className,
      )}
      {...props}
      disabled={!hydrated || props.disabled}
    />
  );
}
export function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  const hydrated = useHydrated();
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
      disabled={!hydrated || props.disabled}
    />
  );
}
export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  const hydrated = useHydrated();
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
      disabled={!hydrated || props.disabled}
    />
  );
}
