"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type {
  AuditView,
  GroupView,
  MemberView,
  PageResult,
  RegistrationView,
  Screen,
  SelfView,
  SummaryView,
  TransactionView,
  WorkspaceData,
} from "@/lib/contracts";
import { WorkspaceView, type ViewQuery } from "./workspace-view";
import { emptyFilters } from "./transaction-filters";
import { ErrorState, LoadingState } from "./primitives";
export const initialQuery: ViewQuery = {
  filters: { ...emptyFilters },
  page: 1,
  search: "",
  group: "",
  registrationStatus: "pending",
  operation: "",
  entityType: "",
  actorId: "",
  entityId: "",
  auditFrom: "",
  auditTo: "",
};
export function transactionQuery(
  screen: Screen,
  id: string | undefined,
  query: ViewQuery,
) {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: "25",
  });
  for (const [k, v] of Object.entries(query.filters)) {
    if (v) params.set(k, v);
  }
  if (screen.includes("deposit")) params.set("kind", "deposit");
  if (screen.includes("expense")) params.set("kind", "expense");
  if (screen === "member-detail" && id) params.set("member_id", id);
  if (screen === "group-detail" && id) params.set("group_id", id);
  return params;
}
const blankPage = <T,>(): PageResult<T> => ({
  items: [],
  total: 0,
  page: 1,
  page_size: 25,
});
export function Workspace({ screen, id }: { screen: Screen; id?: string }) {
  const router = useRouter();
  const path = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    profile: SelfView;
    data: WorkspaceData;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const activeRead = useRef<AbortController | null>(null);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const logout = () => {
      activeRead.current?.abort();
      setState(null);
      // A document navigation also discards hidden pages retained by Next's
      // client router, so a previous user's private DOM cannot be restored.
      window.location.replace("/login");
    };
    window.addEventListener("portal:unauthorized", logout);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("portal:unauthorized", logout);
      window.removeEventListener("focus", refresh);
    };
  }, [router, refresh]);
  useEffect(() => {
    if (!state) return;
    const timeout = setTimeout(
      () => {
        window.dispatchEvent(new Event("portal:unauthorized"));
      },
      Math.max(0, Date.parse(state.profile.session_expires_at) - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [state]);
  useEffect(() => {
    const abort = new AbortController();
    activeRead.current = abort;
    const read = <T,>(route: string) => api<T>(route, { signal: abort.signal });
    async function load() {
      try {
        const profile = await read<SelfView>("/auth/me");
        if (abort.signal.aborted) return;
        if (
          profile.status !== "approved" ||
          profile.session_kind !== "full" ||
          !profile.member_id
        ) {
          setState(null);
          router.replace("/pending");
          return;
        }
        if (
          (screen === "admin" || path.startsWith("/admin/")) &&
          profile.role !== "admin"
        )
          throw new ApiError(
            "You do not have administrator access to this page.",
            403,
            "FORBIDDEN",
          );
        const admin = profile.role === "admin";
        const registrations = new URLSearchParams({
          status: query.registrationStatus,
          q: query.search,
          page: String(query.page),
        });
        const audit = new URLSearchParams({ page: String(query.page) });
        for (const [k, v] of Object.entries({
          operation: query.operation,
          entity_type: query.entityType,
          actor_id: query.actorId,
          entity_id: query.entityId,
          from: query.auditFrom ? query.auditFrom + ":00Z" : "",
          to: query.auditTo ? query.auditTo + ":00Z" : "",
        })) {
          if (v) audit.set(k, v);
        }
        const [
          summary,
          members,
          groups,
          transactions,
          accounts,
          audits,
          available,
        ] = await Promise.all([
          read<SummaryView>("/finance/summary"),
          read<PageResult<MemberView>>("/members?page_size=100"),
          read<GroupView[]>("/groups"),
          read<PageResult<TransactionView>>(
            `/transactions?${transactionQuery(screen, id, query)}`,
          ),
          admin && screen === "approvals"
            ? read<PageResult<RegistrationView>>(
                `/admin/registrations?${registrations}`,
              )
            : Promise.resolve(blankPage<RegistrationView>()),
          admin && screen === "audit"
            ? read<PageResult<AuditView>>(`/admin/audit-events?${audit}`)
            : Promise.resolve(blankPage<AuditView>()),
          admin && screen === "approvals"
            ? read<WorkspaceData["available"]>("/admin/members/available")
            : Promise.resolve([]),
        ]);
        if (screen === "member-detail" && id) {
          const detail = await read<MemberView>(`/members/${id}`);
          members.items = members.items.map((member) =>
            member.id === id ? detail : member,
          );
        }
        if (screen === "group-detail" && id) {
          const detail = await read<GroupView>(`/groups/${id}`);
          const index = groups.findIndex((group) => group.id === id);
          if (index >= 0) groups[index] = detail;
        }
        if (!abort.signal.aborted) {
          setState({
            profile,
            data: {
              summary,
              members: members.items,
              groups,
              transactions,
              registrations: accounts,
              audits,
              available,
            },
          });
          setError("");
        }
      } catch (e) {
        if (!abort.signal.aborted) {
          setState(null);
          setError((e as Error).message);
        }
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }
    const timer = setTimeout(() => {
      setLoading(true);
      void load();
    }, 180);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [screen, id, path, query, revision, router]);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      activeRead.current?.abort();
      setState(null);
      window.location.replace("/login");
    } catch (e) {
      setState(null);
      setError((e as Error).message);
    }
  }
  if (!state)
    return (
      <main className="mx-auto w-full max-w-2xl p-6 py-20">
        {loading ? (
          <LoadingState />
        ) : (
          <>
            <ErrorState
              message={error || "Your session is not available."}
              retry={refresh}
            />
            <Link
              className="mt-5 inline-flex min-h-11 items-center text-sm text-primary underline"
              href="/login"
            >
              Return to sign in
            </Link>
          </>
        )}
      </main>
    );
  return (
    <div aria-busy={loading}>
      <WorkspaceView
        key={`${path}:${state.profile.user_id}:${state.profile.role}`}
        screen={screen}
        id={id}
        path={path}
        data={state.data}
        profile={state.profile}
        audience={state.profile.role}
        href={(p) => p}
        onLogout={logout}
        onRefresh={refresh}
        query={query}
        onQuery={setQuery}
      />
    </div>
  );
}
