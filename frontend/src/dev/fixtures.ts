// Synthetic development data. Loaded only behind the server development route gate.
import type { WorkspaceData, SelfView, TransactionView } from "@/lib/contracts";
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const amounts = [
  "30000.00",
  "25000.00",
  "20000.00",
  "15000.00",
  "25000.00",
  "20000.00",
];
const groups = Array.from({ length: 10 }, (_, i) => ({
  id: uuid(100 + i),
  code: `G${String(i + 1).padStart(2, "0")}`,
  name: `Technical group ${String(i + 1).padStart(2, "0")}`,
  contribution: amounts[i] || "0.00",
  expenditure: i === 0 ? "24500.00" : "0.00",
  member_count: i < 6 ? 3 : 2,
  version: 1,
}));
const members = Array.from({ length: 26 }, (_, i) => ({
  id: uuid(i + 1),
  name: `Sample Member ${String(i + 1).padStart(2, "0")}`,
  current_group: {
    id: groups[i % 10].id,
    code: groups[i % 10].code,
    name: groups[i % 10].name,
  },
  contribution: amounts[i] || "0.00",
  version: 1,
}));
const base = {
  currency: "PKR" as const,
  recorded_by: uuid(501),
  recorded_by_name_snapshot: "Sample Administrator",
  created_at: "2026-11-24T09:00:00Z",
  status: "active" as const,
  void_reason: null,
  voided_by: null,
  voided_at: null,
  replaces_id: null,
  replacement_id: null,
};
const deposits: TransactionView[] = amounts.map((amount, i) => ({
  ...base,
  id: uuid(200 + i),
  kind: "deposit",
  amount,
  business_date: `2026-11-${24 - i}`,
  description: "Externally verified sample contribution",
  title: null,
  member_id: members[i].id,
  member_name_snapshot: members[i].name,
  group_id: groups[i].id,
  group_code_snapshot: groups[i].code,
  group_name_snapshot: groups[i].name,
  expense_category: null,
}));
const expenses: TransactionView[] = [
  {
    ...base,
    id: uuid(300),
    kind: "expense",
    amount: "24500.00",
    business_date: "2026-11-24",
    title: "Sample technical supplies",
    description: "Synthetic supplies expense for interface review",
    member_id: null,
    member_name_snapshot: null,
    group_id: groups[0].id,
    group_code_snapshot: groups[0].code,
    group_name_snapshot: groups[0].name,
    expense_category: "group",
  },
  {
    ...base,
    id: uuid(301),
    kind: "expense",
    amount: "14000.00",
    business_date: "2026-11-23",
    title: "Sample shared equipment",
    description: "Synthetic collective expense for interface review",
    member_id: null,
    member_name_snapshot: null,
    group_id: null,
    group_code_snapshot: null,
    group_name_snapshot: null,
    expense_category: "collective",
  },
];
const voided: TransactionView = {
  ...deposits[0],
  id: uuid(299),
  amount: "31000.00",
  status: "voided",
  void_reason: "Sample entry corrected after verification",
  voided_by: uuid(501),
  voided_at: "2026-11-24T09:00:00Z",
  replacement_id: deposits[0].id,
};
deposits[0].replaces_id = voided.id;
const transactions = [...deposits, ...expenses, voided].sort(
  (a, b) =>
    b.business_date.localeCompare(a.business_date) || b.id.localeCompare(a.id),
);
export const fixtureProfile: SelfView = {
  user_id: uuid(501),
  name: "Sample Administrator",
  email: "administrator@example.invalid",
  role: "admin",
  status: "approved",
  member_id: members[0].id,
  session_kind: "full",
  session_expires_at: "2026-11-25T12:00:00Z",
};
export const fixtureData: WorkspaceData = {
  summary: {
    currency: "PKR",
    total_deposits: "135000.00",
    total_expenses: "38500.00",
    collective_balance: "96500.00",
    collective_category_expenses: "14000.00",
    member_count: 26,
    group_count: 10,
  },
  members,
  groups,
  transactions: {
    items: transactions,
    total: transactions.length,
    page: 1,
    page_size: 25,
  },
  registrations: {
    items: ["pending", "approved", "rejected", "suspended", "unverified"].map(
      (status, i) => ({
        id: uuid(600 + i),
        name: `Sample Applicant ${i + 1}`,
        email: `applicant${i + 1}@example.invalid`,
        status,
        email_verified_at:
          status === "unverified" ? null : "2026-11-24T08:00:00Z",
        member_id:
          status === "approved" || status === "suspended"
            ? members[i + 10].id
            : null,
        version: 1,
        created_at: "2026-11-24T08:00:00Z",
      }),
    ),
    total: 5,
    page: 1,
    page_size: 25,
  },
  available: members
    .slice(15)
    .map((m) => ({ id: m.id, name: m.name, group_id: m.current_group.id })),
  audits: {
    items: [
      {
        id: uuid(700),
        actor_label: "Sample Administrator",
        operation: "deposit.recorded",
        entity_type: "transaction",
        entity_id: deposits[0].id,
        occurred_at: "2026-11-24T09:00:00Z",
        reason: null,
        before_values: null,
        after_values: { amount: "30000.00", status: "active" },
      },
      {
        id: uuid(701),
        actor_label: "Sample Administrator",
        operation: "transaction.voided",
        entity_type: "transaction",
        entity_id: voided.id,
        occurred_at: "2026-11-24T08:00:00Z",
        reason: voided.void_reason,
        before_values: { status: "active" },
        after_values: { status: "voided" },
      },
    ],
    total: 2,
    page: 1,
    page_size: 25,
  },
};
