import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma, type Transaction } from "../../generated/prisma/client";
import { mutate, type Tx } from "../db/mutation";
import { AppError } from "../errors/app-error";
import { audit, authority } from "./identity";

export const amountSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
  .refine((s) => new Prisma.Decimal(s).gt(0), "Amount must be positive")
  .transform((s) => new Prisma.Decimal(s).toFixed(2));
export const dateSchema = z.iso.date();
const description = z.string().trim().min(1).max(1000);
export const depositSchema = z
  .object({
    member_id: z.uuid(),
    amount: amountSchema,
    payment_date: dateSchema,
    description,
  })
  .strict();
export const expenseSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    amount: amountSchema,
    expense_date: dateSchema,
    category: z.enum(["group", "collective"]),
    group_id: z.uuid().nullable().optional(),
    associated_member_id: z.uuid().nullable().optional(),
    description,
  })
  .strict()
  .refine(
    (x) => (x.category === "group" ? !!x.group_id : !x.group_id),
    "Group category requires group_id; collective requires null group",
  );
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function policy(message: string): never {
  throw AppError.conflict("POLICY_UNRESOLVED", message);
}
export function transactionView(
  t: Transaction & { replacedBy?: { id: string } | null },
) {
  return {
    id: t.id,
    kind: t.kind,
    amount: t.amount.toFixed(2),
    currency: "PKR",
    business_date: t.businessDate.toISOString().slice(0, 10),
    title: t.title,
    description: t.description,
    member_id: t.memberId,
    member_name_snapshot: t.memberNameSnapshot,
    group_id: t.groupId,
    group_code_snapshot: t.groupCodeSnapshot,
    group_name_snapshot: t.groupNameSnapshot,
    expense_category: t.expenseCategory,
    recorded_by: t.recordedBy,
    recorded_by_name_snapshot: t.recordedByNameSnapshot,
    created_at: t.createdAt.toISOString(),
    status: t.status,
    voided_by: t.voidedBy,
    voided_at: t.voidedAt?.toISOString() ?? null,
    void_reason: t.voidReason,
    replaces_id: t.replacesId,
    replacement_id: t.replacedBy?.id ?? null,
  };
}
export async function summary(tx: Tx) {
  const rows = await tx.transaction.groupBy({
    by: ["kind", "expenseCategory"],
    where: { status: "active" },
    _sum: { amount: true },
  });
  let deposits = new Prisma.Decimal(0),
    expenses = new Prisma.Decimal(0),
    collective = new Prisma.Decimal(0);
  for (const row of rows) {
    const amount = row._sum.amount ?? new Prisma.Decimal(0);
    if (row.kind === "deposit") deposits = deposits.plus(amount);
    else {
      expenses = expenses.plus(amount);
      if (row.expenseCategory === "collective")
        collective = collective.plus(amount);
    }
  }
  return {
    currency: "PKR",
    total_deposits: deposits.toFixed(2),
    total_expenses: expenses.toFixed(2),
    collective_balance: deposits.minus(expenses).toFixed(2),
    collective_category_expenses: collective.toFixed(2),
    member_count: await tx.member.count(),
    group_count: await tx.group.count(),
  };
}
export async function memberView(tx: Tx, id: string) {
  const member = await tx.member.findUnique({
    where: { id },
    include: { group: true },
  });
  if (!member) throw AppError.notFound();
  const total = await tx.transaction.aggregate({
    where: { kind: "deposit", status: "active", memberId: id },
    _sum: { amount: true },
  });
  return {
    id: member.id,
    name: member.name,
    current_group: {
      id: member.group.id,
      code: member.group.code,
      name: member.group.name,
    },
    contribution: (total._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    version: member.version,
  };
}
export async function groupView(tx: Tx, id: string) {
  const group = await tx.group.findUnique({
    where: { id },
    include: { _count: { select: { members: true } } },
  });
  if (!group) throw AppError.notFound();
  const rows = await tx.transaction.groupBy({
    by: ["kind"],
    where: { groupId: id, status: "active" },
    _sum: { amount: true },
  });
  return {
    id: group.id,
    code: group.code,
    name: group.name,
    member_count: group._count.members,
    contribution: (
      rows.find((r) => r.kind === "deposit")?._sum.amount ??
      new Prisma.Decimal(0)
    ).toFixed(2),
    expenditure: (
      rows.find((r) => r.kind === "expense")?._sum.amount ??
      new Prisma.Decimal(0)
    ).toFixed(2),
    version: group.version,
  };
}
async function insertDeposit(
  tx: Tx,
  actor: { id: string; name: string },
  input: z.infer<typeof depositSchema>,
  original?: Transaction,
) {
  if (input.payment_date !== today())
    policy("Past and future financial date policies are unresolved.");
  const member = await tx.member.findUnique({
    where: { id: input.member_id },
    include: { group: true },
  });
  if (!member) throw AppError.notFound();
  if (original && original.memberId !== member.id)
    policy("Historical attribution changes are unresolved.");
  return tx.transaction.create({
    data: {
      id: randomUUID(),
      kind: "deposit",
      amount: new Prisma.Decimal(input.amount),
      businessDate: new Date(`${input.payment_date}T00:00:00Z`),
      description: input.description,
      memberId: member.id,
      memberNameSnapshot: original?.memberNameSnapshot ?? member.name,
      groupId: original?.groupId ?? member.groupId,
      groupCodeSnapshot: original?.groupCodeSnapshot ?? member.group.code,
      groupNameSnapshot: original?.groupNameSnapshot ?? member.group.name,
      recordedBy: actor.id,
      recordedByNameSnapshot: actor.name,
      status: "active",
      replacesId: original?.id,
    },
  });
}
export async function financialWrite(
  sessionId: string,
  operation: "deposit" | "expense" | "void" | "replace",
  key: string,
  payload: unknown,
  requestId: string,
  id?: string,
) {
  z.uuid().parse(key);
  const input =
    operation === "deposit"
      ? depositSchema.parse(payload)
      : operation === "expense"
        ? expenseSchema.parse(payload)
        : z
            .object({
              reason: z.string().trim().min(5).max(500),
              ...(operation === "replace"
                ? { replacement: z.union([depositSchema, expenseSchema]) }
                : {}),
            })
            .strict()
            .parse(payload);
  const operationKey = `${operation}${id ? `:${id}` : ""}`;
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest();
  return mutate(async (tx) => {
    const a = await authority(tx, sessionId, "admin");
    const receipt = await tx.idempotencyRequest.findUnique({
      where: {
        actorUserId_operation_key: {
          actorUserId: a.user.id,
          operation: operationKey,
          key,
        },
      },
    });
    if (receipt) {
      if (!Buffer.from(receipt.requestHash).equals(requestHash))
        throw AppError.conflict(
          "IDEMPOTENCY_CONFLICT",
          "Key was used with different content.",
        );
      return { status: receipt.responseStatus, body: receipt.responseBody };
    }
    let responseBody: Prisma.InputJsonObject;
    const status = operation === "void" ? 200 : 201;
    if (operation === "expense")
      policy("Expense overdraft and date policies are unresolved.");
    if (operation === "deposit") {
      const row = await insertDeposit(tx, a.user, depositSchema.parse(input));
      responseBody = transactionView(row);
      await audit(
        tx,
        a.user,
        "deposit.create",
        "transaction",
        row.id,
        requestId,
        undefined,
        responseBody,
      );
    } else {
      const original = await tx.transaction.findUnique({
        where: { id: z.uuid().parse(id) },
      });
      if (!original) throw AppError.notFound();
      if (original.status !== "active")
        throw AppError.conflict(
          "ALREADY_CORRECTED",
          "Transaction has already been corrected.",
        );
      const correction = z
        .object({ reason: z.string(), replacement: z.unknown().optional() })
        .parse(input);
      // Void remains available. Replacing an expense is gated with expense creation.
      if (operation === "replace" && original.kind === "expense")
        policy("Expense policies are unresolved.");
      const voided = await tx.transaction.update({
        where: { id: original.id },
        data: {
          status: "voided",
          voidedBy: a.user.id,
          voidedAt: new Date(),
          voidReason: correction.reason,
        },
      });
      responseBody = transactionView(voided);
      await audit(
        tx,
        a.user,
        "transaction.void",
        "transaction",
        original.id,
        requestId,
        transactionView(original),
        responseBody,
        correction.reason,
      );
      if (operation === "replace") {
        const replacement = await insertDeposit(
          tx,
          a.user,
          depositSchema.parse(correction.replacement),
          original,
        );
        await audit(
          tx,
          a.user,
          "deposit.replace",
          "transaction",
          replacement.id,
          requestId,
          undefined,
          transactionView(replacement),
          correction.reason,
        );
        responseBody = {
          original: transactionView({
            ...voided,
            replacedBy: { id: replacement.id },
          }),
          replacement: transactionView(replacement),
        };
      }
    }
    await tx.idempotencyRequest.create({
      data: {
        id: randomUUID(),
        actorUserId: a.user.id,
        operation: operationKey,
        key,
        requestHash,
        responseStatus: status,
        responseBody,
      },
    });
    return { status, body: responseBody };
  });
}
