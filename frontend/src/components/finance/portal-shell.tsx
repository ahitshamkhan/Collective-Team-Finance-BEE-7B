"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  CheckCheck,
  ChevronRight,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  Wallet,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Audience, SelfView } from "@/lib/contracts";

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-sidebar-foreground text-sidebar">
        <Layers3 aria-hidden className="size-6" />
      </span>
      <span>
        <span className="block text-xl font-semibold tracking-tight">
          Collective<span className="text-sidebar-foreground/60">.</span>
        </span>
        <span className="block text-[10px] font-medium tracking-[0.2em] opacity-75">
          TEAM FINANCE
        </span>
      </span>
    </div>
  );
}
const shared = [
  { href: "/overview", title: "Overview", icon: LayoutDashboard },
  { href: "/members", title: "Members", icon: Users },
  { href: "/groups", title: "Groups", icon: Layers3 },
  { href: "/deposits", title: "Deposits", icon: ArrowDownLeft },
  { href: "/expenses", title: "Expenses", icon: ArrowUpRight },
  { href: "/ledger", title: "Transaction ledger", icon: BookOpen },
];
const admin = [
  { href: "/admin", title: "Admin overview", icon: ChartNoAxesCombined },
  { href: "/admin/approvals", title: "Approvals", icon: CheckCheck },
  { href: "/admin/deposits", title: "Record deposit", icon: Wallet },
  { href: "/admin/expenses", title: "Record expense", icon: ArrowUpRight },
  { href: "/admin/members", title: "Manage members", icon: Users },
  { href: "/admin/groups", title: "Manage groups", icon: Layers3 },
  { href: "/admin/audit", title: "Audit history", icon: ShieldCheck },
];
export function PortalShell({
  children,
  path,
  title,
  profile,
  preview = false,
  audience,
  onAudience,
  href,
  onLogout,
}: {
  children: ReactNode;
  path: string;
  title: string;
  profile: SelfView;
  preview?: boolean;
  audience: Audience;
  onAudience?: (value: Audience) => void;
  href: (path: string) => string;
  onLogout: () => void;
}) {
  const [mobile, setMobile] = useState(false);
  const nav = (
    <>
      <p className="mb-3 px-3 text-[10px] font-semibold tracking-widest text-sidebar-foreground/65">
        WORKSPACE
      </p>
      <nav aria-label="Workspace" className="grid gap-1">
        {shared.map(renderNavItem)}
      </nav>
      {audience === "admin" && (
        <>
          <p className="mt-7 mb-3 px-3 text-[10px] font-semibold tracking-widest text-sidebar-foreground/65">
            ADMINISTRATION
          </p>
          <nav aria-label="Administration" className="grid gap-1">
            {admin.map(renderNavItem)}
          </nav>
        </>
      )}
    </>
  );
  function renderNavItem({
    href: route,
    title: label,
    icon: Icon,
  }: (typeof shared)[number]) {
    const active =
      path === route || (route !== "/admin" && path.startsWith(route + "/"));
    return (
      <Link
        key={route}
        href={href(route)}
        onClick={() => setMobile(false)}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}
      >
        <Icon aria-hidden className="size-[18px]" />
        {label}
        {active && <ChevronRight aria-hidden className="ml-auto size-4" />}
      </Link>
    );
  }
  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-lg bg-card p-4 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-7 py-8">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nav}
        </div>
        <div className="border-t border-sidebar-border p-5">
          <div className="rounded-xl border border-sidebar-border p-4">
            <ShieldCheck aria-hidden className="mb-2 size-5" />
            <p className="text-sm font-medium">One fund. Clear records.</p>
            <p className="mt-1 text-xs leading-5 text-sidebar-foreground/75">
              Shared visibility for every approved team member.
            </p>
          </div>
        </div>
      </aside>
      <div className="min-w-0 lg:pl-64">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b bg-card px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </Button>
            <p className="text-sm text-muted-foreground">
              Workspace <span className="mx-2">/</span>
              <span className="font-medium text-foreground">{title}</span>
            </p>
          </div>
          <Link
            href={href("/account")}
            className="flex min-h-11 items-center gap-3 rounded-lg p-1.5 hover:bg-muted"
          >
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-semibold">
                {profile.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {audience === "admin" ? "FIP Lead" : "Member"}
                {preview ? " · preview" : ""}
              </span>
            </span>
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound aria-hidden className="size-5" />
              <span className="sr-only">My account</span>
            </span>
          </Link>
        </header>
        {preview && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warning/25 bg-warning/10 px-4 py-3 text-sm sm:px-8">
            <p>
              <strong>Development preview.</strong> All people and amounts are
              synthetic. Nothing is saved.
            </p>
            <label className="flex items-center gap-2 text-xs font-medium">
              Preview audience
              <select
                aria-label="Preview audience"
                className="min-h-11 rounded-lg border border-input bg-card px-3"
                value={audience}
                onChange={(e) => onAudience?.(e.target.value as Audience)}
              >
                <option value="admin">Administrator UI</option>
                <option value="member">Member UI</option>
              </select>
            </label>
          </div>
        )}
        <main
          id="main-content"
          className="mx-auto max-w-screen-2xl p-4 py-7 sm:p-8"
        >
          {children}
        </main>
        <footer className="mx-4 flex flex-wrap items-center justify-between gap-3 border-t py-5 text-xs text-muted-foreground sm:mx-8">
          <span>Collective · Team finance workspace</span>
          <Button variant="ghost" onClick={onLogout}>
            <LogOut aria-hidden className="size-4" />
            {preview ? "Exit preview" : "Sign out"}
          </Button>
        </footer>
      </div>
      <Dialog
        open={mobile}
        onOpenChange={setMobile}
        title="Workspace navigation"
      >
        <div className="rounded-xl bg-sidebar p-4 text-sidebar-foreground">
          {nav}
        </div>
      </Dialog>
    </div>
  );
}
