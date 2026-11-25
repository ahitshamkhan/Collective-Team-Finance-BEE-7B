import { Suspense } from "react";
import { LoadingState } from "@/components/finance/primitives";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PreviewWorkspace } from "@/components/finance/preview-workspace";
import type { Screen } from "@/lib/contracts";
async function PreviewContent({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ audience?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  await connection();
  const { path: segments = [] } = await params;
  const { audience } = await searchParams;
  const path = "/" + (segments.join("/") || "overview");
  const screens: Record<string, Screen> = {
    "/overview": "overview",
    "/members": "members",
    "/groups": "groups",
    "/ledger": "ledger",
    "/deposits": "deposits",
    "/expenses": "expenses",
    "/account": "account",
    "/admin": "admin",
    "/admin/approvals": "approvals",
    "/admin/members": "manage-members",
    "/admin/groups": "manage-groups",
    "/admin/deposits": "record-deposit",
    "/admin/expenses": "record-expense",
    "/admin/audit": "audit",
  };
  const detail =
    segments.length === 2 &&
    (segments[0] === "members" || segments[0] === "groups");
  const screen = detail
    ? segments[0] === "members"
      ? "member-detail"
      : "group-detail"
    : screens[path];
  if (!screen) notFound();
  const { fixtureData, fixtureProfile } = await import("@/dev/fixtures");
  return (
    <PreviewWorkspace
      key={path}
      screen={screen}
      id={detail ? segments[1] : undefined}
      path={path}
      data={fixtureData}
      profile={fixtureProfile}
      initialAudience={audience === "member" ? "member" : "admin"}
    />
  );
}

export default function PreviewPage(
  props: Parameters<typeof PreviewContent>[0],
) {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <Suspense fallback={<LoadingState />}>
      <PreviewContent {...props} />
    </Suspense>
  );
}
