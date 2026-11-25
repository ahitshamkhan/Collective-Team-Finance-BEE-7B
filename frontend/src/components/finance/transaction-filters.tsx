"use client";
import type { GroupView, MemberView } from "@/lib/contracts";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "./primitives";
export type Filters = {
  q: string;
  kind: string;
  status: string;
  group_id: string;
  member_id: string;
  date_from: string;
  date_to: string;
};
export const emptyFilters: Filters = {
  q: "",
  kind: "",
  status: "",
  group_id: "",
  member_id: "",
  date_from: "",
  date_to: "",
};
export function TransactionFilters({
  filters,
  onChange,
  members,
  groups,
  fixedKind,
  fixedMember,
  fixedGroup,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  members: MemberView[];
  groups: GroupView[];
  fixedKind?: string;
  fixedMember?: string;
  fixedGroup?: string;
}) {
  const update = (k: keyof Filters, v: string) =>
    onChange({ ...filters, [k]: v });
  return (
    <div className="grid gap-4 border-b p-5 sm:grid-cols-2 xl:grid-cols-4">
      <Field label="Search records" id="filter-search">
        <Input
          id="filter-search"
          placeholder="Title or description"
          value={filters.q}
          onChange={(e) => update("q", e.target.value)}
        />
      </Field>
      <Field label="Transaction type" id="filter-kind">
        <Select
          id="filter-kind"
          value={fixedKind || filters.kind}
          disabled={!!fixedKind}
          onChange={(e) => update("kind", e.target.value)}
        >
          <option value="">All types</option>
          <option value="deposit">Deposits</option>
          <option value="expense">Expenses</option>
        </Select>
      </Field>
      <Field label="Status" id="filter-status">
        <Select
          id="filter-status"
          value={filters.status}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">Recorded</option>
          <option value="voided">Voided</option>
        </Select>
      </Field>
      <Field label="Historical group" id="filter-group">
        <Select
          id="filter-group"
          value={fixedGroup || filters.group_id}
          disabled={!!fixedGroup}
          onChange={(e) => update("group_id", e.target.value)}
        >
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} · {g.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Member" id="filter-member">
        <Select
          id="filter-member"
          value={fixedMember || filters.member_id}
          disabled={!!fixedMember}
          onChange={(e) => update("member_id", e.target.value)}
        >
          <option value="">All members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="From date" id="filter-from">
        <Input
          id="filter-from"
          type="date"
          value={filters.date_from}
          onChange={(e) => update("date_from", e.target.value)}
        />
      </Field>
      <Field label="To date" id="filter-to">
        <Input
          id="filter-to"
          type="date"
          min={filters.date_from}
          value={filters.date_to}
          onChange={(e) => update("date_to", e.target.value)}
        />
      </Field>
      <div className="flex items-end">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onChange({ ...emptyFilters })}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
