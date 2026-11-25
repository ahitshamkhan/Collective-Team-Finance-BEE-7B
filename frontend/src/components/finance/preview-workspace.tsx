"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Audience,
  Screen,
  SelfView,
  WorkspaceData,
} from "@/lib/contracts";
import { WorkspaceView } from "./workspace-view";
import { initialQuery, transactionQuery } from "./workspace";
import { ErrorState } from "./primitives";
export function PreviewWorkspace({
  screen,
  id,
  path,
  data,
  profile,
  initialAudience,
}: {
  screen: Screen;
  id?: string;
  path: string;
  data: WorkspaceData;
  profile: SelfView;
  initialAudience: Audience;
}) {
  const [audience, setAudience] = useState(initialAudience);
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const href = (p: string) => `/dev/preview${p}?audience=${audience}`;
  const params = transactionQuery(screen, id, query);
  const rows = data.transactions.items.filter(
    (t) =>
      (!params.get("kind") || t.kind === params.get("kind")) &&
      (!params.get("status") || t.status === params.get("status")) &&
      (!params.get("member_id") || t.member_id === params.get("member_id")) &&
      (!params.get("group_id") || t.group_id === params.get("group_id")) &&
      (!query.filters.date_from ||
        t.business_date >= query.filters.date_from) &&
      (!query.filters.date_to || t.business_date <= query.filters.date_to) &&
      ((t.title || "") + " " + t.description)
        .toLowerCase()
        .includes(query.filters.q.toLowerCase()),
  );
  const registrations = data.registrations.items.filter(
    (r) =>
      r.status === query.registrationStatus &&
      (r.name + " " + r.email)
        .toLowerCase()
        .includes(query.search.toLowerCase()),
  );
  const audits = data.audits.items.filter(
    (a) =>
      (!query.operation || a.operation === query.operation) &&
      (!query.entityType || a.entity_type === query.entityType) &&
      (!query.entityId || a.entity_id === query.entityId) &&
      (!query.actorId || query.actorId === profile.user_id) &&
      (!query.auditFrom || a.occurred_at >= query.auditFrom + ":00Z") &&
      (!query.auditTo || a.occurred_at <= query.auditTo + ":00Z"),
  );
  const page = <T,>(items: T[]) => ({
    items: items.slice((query.page - 1) * 25, query.page * 25),
    total: items.length,
    page: query.page,
    page_size: 25,
  });
  if (audience === "member" && path.startsWith("/admin"))
    return (
      <main className="mx-auto max-w-xl p-6 py-20">
        <ErrorState message="Member previews cannot open administrator screens." />
        <Link
          href="/dev/preview/overview?audience=member"
          className="mt-5 inline-flex min-h-11 items-center text-primary underline"
        >
          Open member overview
        </Link>
      </main>
    );
  return (
    <WorkspaceView
      key={audience}
      screen={screen}
      id={id}
      path={path}
      data={{
        ...data,
        transactions: page(rows),
        registrations: page(registrations),
        audits: page(audits),
      }}
      profile={
        audience === "admin"
          ? profile
          : {
              ...profile,
              name: "Sample Member 01",
              email: "member@example.invalid",
              role: "member",
            }
      }
      preview
      audience={audience}
      href={href}
      onAudience={setAudience}
      onLogout={() => router.push("/login")}
      onRefresh={() => setQuery({ ...initialQuery })}
      query={query}
      onQuery={setQuery}
    />
  );
}
