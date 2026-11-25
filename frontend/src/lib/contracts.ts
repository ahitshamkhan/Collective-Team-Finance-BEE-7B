export type Audience = "admin" | "member";
export interface SelfView {
  user_id: string;
  name: string;
  email: string;
  role: Audience;
  status: string;
  member_id: string | null;
  session_kind: "full" | "status";
  session_expires_at: string;
}
export interface GroupView {
  id: string;
  code: string;
  name: string;
  contribution: string;
  expenditure: string;
  member_count: number;
  version: number;
}
export interface MemberView {
  id: string;
  name: string;
  current_group: Pick<GroupView, "id" | "code" | "name">;
  contribution: string;
  version: number;
}
export interface TransactionView {
  id: string;
  kind: "deposit" | "expense";
  amount: string;
  currency: "PKR";
  business_date: string;
  description: string;
  title: string | null;
  member_id: string | null;
  member_name_snapshot: string | null;
  group_id: string | null;
  group_code_snapshot: string | null;
  group_name_snapshot: string | null;
  expense_category: "group" | "collective" | null;
  recorded_by: string;
  recorded_by_name_snapshot: string;
  created_at: string;
  status: "active" | "voided";
  void_reason: string | null;
  voided_by: string | null;
  voided_at: string | null;
  replaces_id: string | null;
  replacement_id: string | null;
}
export interface SummaryView {
  currency: "PKR";
  total_deposits: string;
  total_expenses: string;
  collective_balance: string;
  collective_category_expenses: string;
  member_count: number;
  group_count: number;
}
export interface RegistrationView {
  id: string;
  name: string;
  email: string;
  status: string;
  email_verified_at: string | null;
  member_id: string | null;
  version: number;
  created_at: string;
}
export interface AuditView {
  id: string;
  actor_label: string;
  operation: string;
  entity_type: string;
  entity_id: string | null;
  occurred_at: string;
  reason: string | null;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown> | null;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
export interface WorkspaceData {
  summary: SummaryView;
  members: MemberView[];
  groups: GroupView[];
  transactions: PageResult<TransactionView>;
  registrations: PageResult<RegistrationView>;
  audits: PageResult<AuditView>;
  available: { id: string; name: string; group_id: string }[];
}
export type Screen =
  | "overview"
  | "members"
  | "member-detail"
  | "groups"
  | "group-detail"
  | "ledger"
  | "deposits"
  | "expenses"
  | "account"
  | "admin"
  | "approvals"
  | "manage-members"
  | "manage-groups"
  | "record-deposit"
  | "record-expense"
  | "audit";
export const screenTitles: Record<Screen, string> = {
  overview: "Finance overview",
  members: "Members",
  "member-detail": "Member record",
  groups: "Groups",
  "group-detail": "Group record",
  ledger: "Transaction ledger",
  deposits: "Deposit history",
  expenses: "Expense history",
  account: "My account",
  admin: "Admin overview",
  approvals: "Registration approvals",
  "manage-members": "Member management",
  "manage-groups": "Group management",
  "record-deposit": "Deposit management",
  "record-expense": "Expense management",
  audit: "Audit history",
};
