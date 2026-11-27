import { z } from "zod";
const id = z.string().uuid();
const amount = z.string().regex(/^-?\d+\.\d{2}$/);
const group = z
  .object({
    id,
    code: z.string(),
    name: z.string(),
    contribution: amount,
    expenditure: amount,
    member_count: z.number().int().nonnegative(),
    version: z.number().int(),
  })
  .strict();
const member = z
  .object({
    id,
    name: z.string(),
    current_group: group.pick({ id: true, code: true, name: true }),
    contribution: amount,
    version: z.number().int(),
  })
  .strict();
const self = z
  .object({
    user_id: id,
    name: z.string(),
    email: z.string(),
    role: z.enum(["admin", "member"]),
    status: z.enum([
      "unverified",
      "pending",
      "approved",
      "rejected",
      "suspended",
    ]),
    member_id: id.nullable(),
    session_kind: z.enum(["full", "status"]),
    session_expires_at: z.string(),
  })
  .strict();
const challenge = z
  .object({
    next_step: z.string(),
    expires_in_seconds: z.number().nonnegative(),
    resend_after_seconds: z.number().nonnegative(),
  })
  .strict();
const transaction = z
  .object({
    id,
    kind: z.enum(["deposit", "expense"]),
    amount,
    currency: z.literal("PKR"),
    business_date: z.string(),
    title: z.string().nullable(),
    description: z.string(),
    member_id: id.nullable(),
    member_name_snapshot: z.string().nullable(),
    group_id: id.nullable(),
    group_code_snapshot: z.string().nullable(),
    group_name_snapshot: z.string().nullable(),
    expense_category: z.enum(["group", "collective"]).nullable(),
    recorded_by: id,
    recorded_by_name_snapshot: z.string(),
    created_at: z.string(),
    status: z.enum(["active", "voided"]),
    voided_by: id.nullable(),
    voided_at: z.string().nullable(),
    void_reason: z.string().nullable(),
    replaces_id: id.nullable(),
    replacement_id: id.nullable(),
  })
  .strict();
const registration = z
  .object({
    id,
    name: z.string(),
    email: z.string(),
    status: z.string(),
    email_verified_at: z.string().nullable(),
    member_id: id.nullable(),
    version: z.number().int(),
    created_at: z.string(),
    reviewed_by: id.nullable().optional(),
    reviewed_at: z.string().nullable().optional(),
    review_reason: z.string().nullable().optional(),
  })
  .strict();
const audit = z
  .object({
    id,
    actor_user_id: id.nullable().optional(),
    actor_kind: z.enum(["user", "operator"]).optional(),
    actor_label: z.string(),
    operation: z.string(),
    entity_type: z.string(),
    entity_id: id.nullable(),
    occurred_at: z.string(),
    request_id: id.optional(),
    before_values: z.record(z.string(), z.unknown()).nullable(),
    after_values: z.record(z.string(), z.unknown()).nullable(),
    reason: z.string().nullable(),
  })
  .strict();
const page = (schema: z.ZodType) =>
  z
    .object({
      items: z.array(schema),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      page_size: z.number().int().positive().max(100),
    })
    .strict();
export function parseResponse(
  path: string,
  method: string,
  value: unknown,
): unknown {
  const route = path.split("?")[0];
  let schema: z.ZodType | undefined;
  if (route === "/auth/csrf")
    schema = z.object({ csrf_token: z.string().min(1) }).strict();
  else if (route === "/auth/me" || route === "/auth/otp/verify") schema = self;
  else if (route === "/auth/login") schema = z.union([self, challenge]);
  else if (
    ["/auth/register", "/auth/otp/resend", "/auth/password/recovery"].includes(
      route,
    )
  )
    schema = challenge;
  else if (route === "/finance/summary")
    schema = z
      .object({
        currency: z.literal("PKR"),
        total_deposits: amount,
        total_expenses: amount,
        collective_balance: amount,
        collective_category_expenses: amount,
        member_count: z.number().int(),
        group_count: z.number().int(),
      })
      .strict();
  else if (route === "/members") schema = page(member);
  else if (route === "/groups") schema = z.array(group);
  else if (/^\/members\/[^/]+$/.test(route)) schema = member;
  else if (/^\/groups\/[^/]+$/.test(route))
    schema = group
      .extend({ members: z.array(z.object({ id, name: z.string() }).strict()) })
      .strict();
  else if (/^\/transactions\/[^/]+$/.test(route)) schema = transaction;
  else if (route === "/transactions") schema = page(transaction);
  else if (
    route === "/deposits" ||
    route === "/expenses" ||
    /^\/transactions\/[^/]+\/void$/.test(route)
  )
    schema = transaction;
  else if (/^\/transactions\/[^/]+\/replace$/.test(route))
    schema = z
      .object({ original: transaction, replacement: transaction })
      .strict();
  else if (route === "/admin/registrations") schema = page(registration);
  else if (
    /^\/admin\/(registrations|users)\/[^/]+\/(approve|reject|suspend|restore)$/.test(
      route,
    )
  )
    schema = registration;
  else if (route === "/admin/audit-events") schema = page(audit);
  else if (route === "/admin/members/available")
    schema = z.array(z.object({ id, name: z.string(), group_id: id }).strict());
  else if (method === "PATCH" && route.startsWith("/admin/members/"))
    schema = z
      .object({ id, name: z.string(), group_id: id, version: z.number().int() })
      .strict();
  else if (method === "PATCH" && route.startsWith("/admin/groups/"))
    schema = group.pick({ id: true, code: true, name: true, version: true });
  if (!schema) throw new Error("No response contract for this operation.");
  return schema.parse(value);
}
