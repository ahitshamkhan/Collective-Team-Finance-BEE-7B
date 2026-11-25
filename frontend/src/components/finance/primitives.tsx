import type { ReactNode } from "react";
import {
  CircleAlert,
  Inbox,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/money";
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border bg-card shadow-xs ${className}`}
    >
      {title && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function PageHeading({
  eyebrow = "COLLECTIVE FINANCE",
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-widest text-primary">
          {eyebrow}
        </p>
        <h1 className="font-heading text-3xl sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
export function MoneyText({ value }: { value: string }) {
  return (
    <span className="whitespace-nowrap font-semibold tabular-nums">
      {money(value)}
    </span>
  );
}
export function SummaryCard({
  label,
  value,
  note,
  icon: Icon,
  featured = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 shadow-xs ${featured ? "border-sidebar bg-sidebar text-sidebar-foreground" : "bg-card"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={`text-sm ${featured ? "text-sidebar-foreground/80" : "text-muted-foreground"}`}
        >
          {label}
        </p>
        <Icon
          aria-hidden
          className={`size-5 ${featured ? "text-sidebar-foreground" : "text-primary"}`}
        />
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight tabular-nums xl:text-3xl">
        {money(value)}
      </p>
      <p
        className={`mt-3 text-xs ${featured ? "text-sidebar-foreground/80" : "text-muted-foreground"}`}
      >
        {note}
      </p>
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone === "success" ? "bg-primary/10 text-primary" : tone === "warning" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}
    >
      {children}
    </span>
  );
}
export function EmptyState({
  title = "No records found",
  description = "Try adjusting your filters. Records will appear here when available.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <Inbox
        aria-hidden
        className="mx-auto mb-4 size-8 text-muted-foreground"
      />
      <h2 className="font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
export function LoadingState() {
  return (
    <div
      role="status"
      className="flex min-h-64 items-center justify-center gap-3 p-8 text-muted-foreground"
    >
      <LoaderCircle
        aria-hidden
        className="size-5 animate-spin motion-reduce:animate-none"
      />
      Loading your workspace…
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-card p-6"
    >
      <CircleAlert aria-hidden className="mb-3 size-6 text-destructive" />
      <h2 className="font-semibold">Unable to load this view</h2>
      <p className="my-3 max-w-xl text-sm text-muted-foreground">{message}</p>
      {retry && (
        <Button onClick={retry} variant="outline">
          Try again
        </Button>
      )}
    </div>
  );
}
export function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p
          id={`${id}-hint`}
          className="text-xs leading-5 text-muted-foreground"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
export function Pagination({
  page,
  total,
  pageSize = 25,
  onChange,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? "0 records"
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} records`}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={page * pageSize >= total}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
