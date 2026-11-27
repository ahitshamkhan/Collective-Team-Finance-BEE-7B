"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  RefreshCw,
  Users,
  Layers3,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import type {
  Audience,
  Screen,
  SelfView,
  TransactionView,
  WorkspaceData,
} from "@/lib/contracts";
import { screenTitles } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PortalShell } from "./portal-shell";
import {
  Panel,
  PageHeading,
  SummaryCard,
  Field,
  Pagination,
  EmptyState,
  MoneyText,
} from "./primitives";
import { TransactionTable } from "./transaction-table";
import { TransactionFilters, type Filters } from "./transaction-filters";
import { MemberTable, GroupTable } from "./roster-tables";
import { ApprovalTable, AuditTable } from "./admin-tables";
import { AdminActionDialog, type AdminAction } from "./admin-dialogs";
import {
  CorrectionDialog,
  FinancialFormPanel,
  type WriteAttempt,
} from "./financial-forms";
import { AccountPanel } from "./account-panel";

export type ViewQuery = {
  filters: Filters;
  page: number;
  search: string;
  group: string;
  registrationStatus: string;
  operation: string;
  entityType: string;
  actorId: string;
  entityId: string;
  auditFrom: string;
  auditTo: string;
};
export function WorkspaceView({
  screen,
  id,
  path,
  data,
  profile,
  preview = false,
  audience,
  href,
  onAudience,
  onLogout,
  onRefresh,
  query,
  onQuery,
}: {
  screen: Screen;
  id?: string;
  path: string;
  data: WorkspaceData;
  profile: SelfView;
  preview?: boolean;
  audience: Audience;
  href: (s: string) => string;
  onAudience?: (a: Audience) => void;
  onLogout: () => void;
  onRefresh: () => void;
  query: ViewQuery;
  onQuery: (q: ViewQuery) => void;
}) {
  const correctionAttempts = useRef(new Map<string, WriteAttempt>());
  function getCorrectionAttempt(id: string, operation: string) {
    const key = `${id}:${operation}`;
    let attempt = correctionAttempts.current.get(key);
    if (!attempt) {
      attempt = { key: null, body: "", uncertain: false };
      correctionAttempts.current.set(key, attempt);
    }
    return attempt;
  }
  const [correction, setCorrection] = useState<TransactionView | null>(null);
  const [action, setAction] = useState<AdminAction | null>(null);
  const [notice, setNotice] = useState("");
  const saved = () => {
    setNotice("Changes saved.");
    onRefresh();
  };
  const admin = audience === "admin";
  const update = (changes: Partial<ViewQuery>) =>
    onQuery({ ...query, ...changes, page: changes.page ?? 1 });
  const member = data.members.find((m) => m.id === id);
  const group = data.groups.find((g) => g.id === id);
  const members = data.members.filter(
    (m) =>
      m.name.toLowerCase().includes(query.search.toLowerCase()) &&
      (!query.group || m.current_group.id === query.group),
  );
  const groups = data.groups.filter((g) =>
    (g.name + " " + g.code).toLowerCase().includes(query.search.toLowerCase()),
  );
  const financial = [
    "ledger",
    "deposits",
    "expenses",
    "record-deposit",
    "record-expense",
    "member-detail",
    "group-detail",
  ].includes(screen);
  const kind = screen.includes("deposit")
    ? "deposit"
    : screen.includes("expense")
      ? "expense"
      : undefined;
  const overview = screen === "overview" || screen === "admin";
  const description = overview
    ? "One shared fund. A clear view of contributions, expenditure and the balance available to the team."
    : screen === "members" || screen === "manage-members"
      ? "Current roster assignments and active contributions. Expenses never reduce individual contributions."
      : screen === "groups" || screen === "manage-groups"
        ? "Ten technical groups, one collective fund. Historical attribution stays with each transaction."
        : screen === "approvals"
          ? "Review verified applicants and link each approved account to one authorized roster member."
          : screen === "audit"
            ? "Trace account, roster and financial changes. Audit records cannot be edited here."
            : screen === "account"
              ? "Manage your password and sessions securely."
              : "Shared financial records, with original attribution and a traceable correction history.";
  const metrics = (
    <div className="mb-7 grid gap-4 md:grid-cols-3">
      <SummaryCard
        label="Total deposits"
        value={data.summary.total_deposits}
        note="Active verified contributions"
        icon={ArrowDownLeft}
      />
      <SummaryCard
        label="Total expenses"
        value={data.summary.total_expenses}
        note="Active collective and group expenses"
        icon={ArrowUpRight}
      />
      <SummaryCard
        label="Remaining collective balance"
        value={data.summary.collective_balance}
        note="Active deposits minus active expenses"
        icon={Wallet}
        featured
      />
    </div>
  );
  return (
    <PortalShell
      path={path}
      title={screenTitles[screen]}
      profile={profile}
      audience={audience}
      preview={preview}
      href={href}
      onAudience={onAudience}
      onLogout={onLogout}
    >
      <PageHeading
        title={
          screen === "member-detail"
            ? member?.name || "Member record"
            : screen === "group-detail"
              ? group?.name || "Group record"
              : screenTitles[screen]
        }
        description={description}
        action={
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw aria-hidden className="size-4" />
            Refresh
          </Button>
        }
      />
      {overview && (
        <>
          {metrics}
          <div className="mb-7 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Authorized members",
                value: data.summary.member_count,
                icon: Users,
                route: "/members",
              },
              {
                label: "Technical groups",
                value: data.summary.group_count,
                icon: Layers3,
                route: "/groups",
              },
              {
                label: "Collective expense category",
                value: (
                  <MoneyText
                    value={data.summary.collective_category_expenses}
                  />
                ),
                icon: ShieldCheck,
                route: "/expenses",
              },
            ].map((item) => (
              <Link
                key={item.label}
                href={href(item.route)}
                className="flex items-center gap-4 rounded-xl border bg-card p-5 hover:border-primary/40"
              >
                <item.icon aria-hidden className="size-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold">{item.value}</p>
                </div>
                <ArrowRight
                  aria-hidden
                  className="ml-auto size-4 text-muted-foreground"
                />
              </Link>
            ))}
          </div>
          {screen === "admin" && (
            <Panel
              title="Administration"
              description="Verify evidence externally before recording financial changes."
              className="mb-7"
            >
              <div className="grid gap-3 p-5 sm:grid-cols-3">
                {[
                  ["/admin/approvals", "Review registrations"],
                  ["/admin/deposits", "Record deposit"],
                  ["/admin/expenses", "Record expense"],
                  ["/admin/members", "Manage roster"],
                  ["/admin/groups", "Manage groups"],
                  ["/admin/audit", "Inspect audit history"],
                ].map(([route, label]) => (
                  <Link
                    key={route}
                    href={href(route)}
                    className="flex min-h-12 items-center justify-between rounded-lg border px-4 text-sm font-medium hover:bg-muted"
                  >
                    {label}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                ))}
              </div>
            </Panel>
          )}
          <Panel
            title="Recent activity"
            description="Latest records, including corrections. Summary cards include active records only."
            action={
              <Link
                href={href("/ledger")}
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
              >
                View full ledger →
              </Link>
            }
            className="mb-7"
          >
            <TransactionTable rows={data.transactions.items.slice(0, 5)} />
          </Panel>
          <Panel
            title="Group finance"
            description="Historical contributions and expenditure, with no group budgets or expense shares."
          >
            <GroupTable groups={data.groups} href={href} />
          </Panel>
        </>
      )}
      {notice && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm"
        >
          {notice}
        </p>
      )}
      {["members", "manage-members", "groups", "manage-groups"].includes(
        screen,
      ) && (
        <Panel title={screenTitles[screen]}>
          <div className="grid gap-4 border-b p-5 sm:grid-cols-2">
            <Field
              label={
                screen.includes("members") ? "Search members" : "Search groups"
              }
              id="roster-search"
            >
              <Input
                id="roster-search"
                placeholder="Search by name"
                value={query.search}
                onChange={(e) => update({ search: e.target.value })}
              />
            </Field>
            {screen.includes("members") && (
              <Field label="Current group" id="roster-group">
                <Select
                  id="roster-group"
                  value={query.group}
                  onChange={(e) => update({ group: e.target.value })}
                >
                  <option value="">All groups</option>
                  {data.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} · {g.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          {screen.includes("members") ? (
            <MemberTable
              members={members}
              href={href}
              onEdit={
                admin && screen === "manage-members"
                  ? (m) => setAction({ kind: "member", record: m })
                  : undefined
              }
            />
          ) : (
            <GroupTable
              groups={groups}
              href={href}
              onEdit={
                admin && screen === "manage-groups"
                  ? (g) => setAction({ kind: "group", record: g })
                  : undefined
              }
            />
          )}{" "}
          {screen === "manage-members" && (
            <div className="border-t p-5 text-sm text-muted-foreground">
              Account suspension and restoration are available in{" "}
              <Link
                className="font-medium text-primary underline"
                href={href("/admin/approvals")}
              >
                registration and account administration
              </Link>
              . No roster additions, deletions or administrator promotions are
              available.
            </div>
          )}
        </Panel>
      )}
      {screen === "member-detail" &&
        (member ? (
          <Panel title="Member contribution" className="mb-6">
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  Active contributions
                </p>
                <p className="text-2xl">
                  <MoneyText value={member.contribution} />
                </p>
              </div>
              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  Current group
                </p>
                <Link
                  className="font-medium text-primary hover:underline"
                  href={href(`/groups/${member.current_group.id}`)}
                >
                  {member.current_group.name}
                </Link>
              </div>
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Expenses shown below are associated context only. They are never
                deducted from this contribution.
              </p>
            </div>
          </Panel>
        ) : (
          <EmptyState title="Member not found" />
        ))}
      {screen === "group-detail" &&
        (group ? (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <SummaryCard
                label="Historical group contributions"
                value={group.contribution}
                note="Active deposits attributed at recording"
                icon={ArrowDownLeft}
              />
              <SummaryCard
                label="Historical group expenditure"
                value={group.expenditure}
                note="Active expenses assigned to this group"
                icon={ArrowUpRight}
              />
            </div>
            <Panel title="Current group members" className="mb-6">
              <MemberTable
                members={data.members.filter(
                  (m) => m.current_group.id === group.id,
                )}
                href={href}
              />
            </Panel>
          </>
        ) : (
          <EmptyState title="Group not found" />
        ))}
      {admin &&
        (screen === "record-deposit" || screen === "record-expense") && (
          <div className="mb-7 max-w-3xl">
            <FinancialFormPanel
              kind={screen === "record-deposit" ? "deposit" : "expense"}
              members={data.members}
              groups={data.groups}
              preview={preview}
              onSaved={onRefresh}
            />
          </div>
        )}
      {financial && (
        <Panel
          title={
            kind === "deposit"
              ? "Deposit history"
              : kind === "expense"
                ? "Expense history"
                : "Transaction history"
          }
          description="Dates use Asia/Karachi. Totals are not recalculated from filtered or paginated rows."
        >
          <TransactionFilters
            filters={query.filters}
            onChange={(filters) => update({ filters })}
            members={data.members}
            groups={data.groups}
            fixedKind={kind}
            fixedMember={screen === "member-detail" ? id : undefined}
            fixedGroup={screen === "group-detail" ? id : undefined}
          />
          <TransactionTable
            rows={data.transactions.items}
            canCorrect={admin}
            onCorrect={setCorrection}
          />
          <Pagination
            page={query.page}
            total={data.transactions.total}
            onChange={(page) => update({ page })}
          />
        </Panel>
      )}
      {screen === "approvals" && admin && (
        <Panel title="Registrations and account access">
          <div className="grid gap-4 border-b p-5 sm:grid-cols-2">
            <Field label="Search applicants" id="applicant-search">
              <Input
                id="applicant-search"
                value={query.search}
                onChange={(e) => update({ search: e.target.value })}
                placeholder="Name or email"
              />
            </Field>
            <Field label="Account status" id="registration-status">
              <Select
                id="registration-status"
                value={query.registrationStatus}
                onChange={(e) => update({ registrationStatus: e.target.value })}
              >
                {[
                  "pending",
                  "unverified",
                  "approved",
                  "rejected",
                  "suspended",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <ApprovalTable rows={data.registrations.items} onAction={setAction} />
          <Pagination
            page={query.page}
            total={data.registrations.total}
            onChange={(page) => update({ page })}
          />
        </Panel>
      )}
      {screen === "audit" && admin && (
        <Panel title="Audit events">
          <div className="grid gap-4 border-b p-5 sm:grid-cols-2 xl:grid-cols-3">
            {(
              [
                {
                  key: "operation",
                  label: "Operation",
                  placeholder: "Exact operation",
                },
                {
                  key: "entityType",
                  label: "Entity type",
                  placeholder: "Exact entity type",
                },
                {
                  key: "actorId",
                  label: "Actor ID",
                  placeholder: "Exact actor UUID",
                },
                {
                  key: "entityId",
                  label: "Entity ID",
                  placeholder: "Exact entity UUID",
                },
                { key: "auditFrom", label: "From (UTC)", placeholder: "" },
                { key: "auditTo", label: "To (UTC)", placeholder: "" },
              ] as const
            ).map((f) => (
              <Field key={f.key} id={f.key} label={f.label}>
                <Input
                  id={f.key}
                  value={query[f.key]}
                  placeholder={f.placeholder}
                  type={f.key.startsWith("audit") ? "datetime-local" : "text"}
                  onChange={(e) => update({ [f.key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <AuditTable rows={data.audits.items} />
          <Pagination
            page={query.page}
            total={data.audits.total}
            onChange={(page) => update({ page })}
          />
        </Panel>
      )}
      {screen === "account" && (
        <AccountPanel profile={profile} preview={preview} />
      )}
      {admin && correction && (
        <CorrectionDialog
          getAttempt={(operation) =>
            getCorrectionAttempt(correction.id, operation)
          }
          transaction={correction}
          onClose={() => setCorrection(null)}
          members={data.members}
          groups={data.groups}
          preview={preview}
          onSaved={saved}
        />
      )}
      {admin && action && (
        <AdminActionDialog
          action={action}
          data={data}
          preview={preview}
          onClose={() => setAction(null)}
          onSaved={saved}
        />
      )}
    </PortalShell>
  );
}
