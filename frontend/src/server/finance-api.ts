import "server-only";
import { z } from "zod";
import {
  type Context,
  authorized,
  body,
  json,
  nameSchema,
  pageSchema,
  uuid,
  versionSchema,
} from "./http";
import { getPrisma } from "./db/prisma";
import { mutate } from "./db/mutation";
import { AppError } from "./errors/app-error";
import { audit, authority, registrationView } from "./services/identity";
import {
  dateSchema,
  financialWrite,
  groupView,
  memberView,
  summary,
  transactionView,
} from "./services/finance";
import type { Prisma } from "../generated/prisma/client";

const q = z.string().trim().max(160).optional();
const querySchema = pageSchema
  .extend({
    q,
    kind: z.enum(["deposit", "expense"]).optional(),
    member_id: uuid.optional(),
    group_id: uuid.optional(),
    category: z.enum(["group", "collective"]).optional(),
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
    status: z.enum(["active", "voided"]).optional(),
  })
  .strict()
  .refine(
    (v) => !v.date_from || !v.date_to || v.date_from <= v.date_to,
    "Invalid date range",
  );
const query = (c: Context) =>
  Object.fromEntries(c.request.nextUrl.searchParams);
export async function financeApi(c: Context, path: string) {
  const method = c.request.method;
  if (
    method === "POST" &&
    (path === "deposits" ||
      path === "expenses" ||
      /^transactions\/[^/]+\/(void|replace)$/.test(path))
  ) {
    const a = await authorized(c, "admin");
    const parts = path.split("/");
    const operation =
      path === "deposits"
        ? "deposit"
        : path === "expenses"
          ? "expense"
          : z.enum(["void", "replace"]).parse(parts[2]);
    const result = await financialWrite(
      a.session.id,
      operation,
      uuid.parse(c.request.headers.get("idempotency-key")),
      await body(c, z.unknown()),
      c.requestId,
      parts.length === 3 ? uuid.parse(parts[1]) : undefined,
    );
    return json(result.body, result.status);
  }
  if (method === "PATCH" && /^admin\/(members|groups)\/[^/]+$/.test(path)) {
    const a = await authorized(c, "admin");
    const [, kind, rawId] = path.split("/");
    const id = uuid.parse(rawId);
    const input =
      kind === "members"
        ? await body(
            c,
            z
              .object({
                name: nameSchema.optional(),
                group_id: uuid.optional(),
                expected_version: versionSchema,
              })
              .strict()
              .refine(
                (v) => v.name !== undefined || v.group_id !== undefined,
                "A change is required",
              ),
          )
        : await body(
            c,
            z
              .object({
                name: z.string().trim().min(1).max(180),
                expected_version: versionSchema,
              })
              .strict(),
          );
    return json(
      await mutate(async (tx) => {
        await authority(tx, a.session.id, "admin");
        if (kind === "members") {
          const old = await tx.member.findUnique({ where: { id } });
          if (!old) throw AppError.notFound();
          if (old.version !== input.expected_version)
            throw AppError.conflict(
              "STALE_VERSION",
              "Member changed. Please reload.",
            );
          const groupId = "group_id" in input ? input.group_id : undefined;
          if (
            groupId &&
            !(await tx.group.findUnique({ where: { id: groupId } }))
          )
            throw AppError.notFound();
          const updated = await tx.member.update({
            where: { id },
            data: {
              name: input.name,
              groupId,
              version: { increment: 1 },
              updatedAt: new Date(),
            },
          });
          const view = {
            id,
            name: updated.name,
            group_id: updated.groupId,
            version: updated.version,
          };
          await audit(
            tx,
            a.user,
            "member.update",
            "member",
            id,
            c.requestId,
            { name: old.name, group_id: old.groupId },
            view,
          );
          return view;
        }
        const old = await tx.group.findUnique({ where: { id } });
        if (!old) throw AppError.notFound();
        if (old.version !== input.expected_version)
          throw AppError.conflict(
            "STALE_VERSION",
            "Group changed. Please reload.",
          );
        const updated = await tx.group.update({
          where: { id },
          data: { name: input.name, version: { increment: 1 } },
        });
        const view = {
          id,
          code: updated.code,
          name: updated.name,
          version: updated.version,
        };
        await audit(
          tx,
          a.user,
          "group.update",
          "group",
          id,
          c.requestId,
          { name: old.name },
          view,
        );
        return view;
      }),
    );
  }
  if (
    method !== "GET" ||
    !/^(finance\/summary|members(?:\/[^/]+)?|groups(?:\/[^/]+)?|transactions(?:\/[^/]+)?|admin\/(registrations|members\/available|audit-events))$/.test(
      path,
    )
  )
    return null;
  const a = await authorized(c, path.startsWith("admin/") ? "admin" : "member");
  // All queries contributing to one response share a consistent database snapshot.
  const result = await getPrisma().$transaction(
    async (tx) => {
      await authority(
        tx,
        a.session.id,
        path.startsWith("admin/") ? "admin" : "member",
      );
      if (path === "finance/summary") return summary(tx);
      if (path === "admin/members/available")
        return tx.member
          .findMany({
            where: { user: null, authorizedAdmin: null },
            select: { id: true, name: true, groupId: true },
            orderBy: { name: "asc" },
          })
          .then((rows) =>
            rows.map((r) => ({ id: r.id, name: r.name, group_id: r.groupId })),
          );
      if (path === "admin/registrations") {
        const p = pageSchema
          .extend({
            q,
            status: z
              .enum([
                "pending",
                "rejected",
                "approved",
                "suspended",
                "unverified",
              ])
              .default("pending"),
          })
          .strict()
          .parse(query(c));
        const where: Prisma.UserWhereInput = {
          status: p.status,
          ...(p.q
            ? {
                OR: [
                  { name: { contains: p.q, mode: "insensitive" } },
                  { emailNormalized: { contains: p.q, mode: "insensitive" } },
                ],
              }
            : {}),
        };
        const rows = await tx.user.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (p.page - 1) * p.page_size,
          take: p.page_size,
        });
        return {
          items: rows.map(registrationView),
          total: await tx.user.count({ where }),
          page: p.page,
          page_size: p.page_size,
        };
      }
      if (path === "admin/audit-events") {
        const p = pageSchema
          .extend({
            actor_id: uuid.optional(),
            entity_type: z.string().max(32).optional(),
            entity_id: uuid.optional(),
            operation: z.string().max(64).optional(),
            from: z.iso.datetime().optional(),
            to: z.iso.datetime().optional(),
          })
          .strict()
          .parse(query(c));
        const where: Prisma.AuditEventWhereInput = {
          actorUserId: p.actor_id,
          entityType: p.entity_type,
          entityId: p.entity_id,
          operation: p.operation,
          occurredAt: {
            gte: p.from ? new Date(p.from) : undefined,
            lte: p.to ? new Date(p.to) : undefined,
          },
        };
        const rows = await tx.auditEvent.findMany({
          where,
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          skip: (p.page - 1) * p.page_size,
          take: p.page_size,
        });
        return {
          items: rows.map((r) => ({
            id: r.id,
            actor_user_id: r.actorUserId,
            actor_kind: r.actorKind,
            actor_label: r.actorLabel,
            operation: r.operation,
            entity_type: r.entityType,
            entity_id: r.entityId,
            occurred_at: r.occurredAt.toISOString(),
            request_id: r.requestId,
            before_values: r.beforeValues,
            after_values: r.afterValues,
            reason: r.reason,
          })),
          total: await tx.auditEvent.count({ where }),
          page: p.page,
          page_size: p.page_size,
        };
      }
      const [kind, rawId] = path.split("/");
      if (rawId) {
        const id = uuid.parse(rawId);
        if (kind === "members") return memberView(tx, id);
        if (kind === "groups")
          return {
            ...(await groupView(tx, id)),
            members: await tx.member.findMany({
              where: { groupId: id },
              select: { id: true, name: true },
              orderBy: [{ name: "asc" }, { id: "asc" }],
            }),
          };
        const row = await tx.transaction.findUnique({
          where: { id },
          include: { replacedBy: { select: { id: true } } },
        });
        if (!row) throw AppError.notFound();
        return transactionView(row);
      }
      if (kind === "groups") {
        const p = z.object({ q }).strict().parse(query(c));
        const rows = await tx.group.findMany({
          where: { name: { contains: p.q, mode: "insensitive" } },
          orderBy: { code: "asc" },
        });
        return Promise.all(rows.map((r) => groupView(tx, r.id)));
      }
      if (kind === "members") {
        const p = pageSchema
          .extend({ q, group_id: uuid.optional() })
          .strict()
          .parse(query(c));
        const where: Prisma.MemberWhereInput = {
          groupId: p.group_id,
          name: { contains: p.q, mode: "insensitive" },
        };
        const rows = await tx.member.findMany({
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: (p.page - 1) * p.page_size,
          take: p.page_size,
        });
        return {
          items: await Promise.all(rows.map((r) => memberView(tx, r.id))),
          total: await tx.member.count({ where }),
          page: p.page,
          page_size: p.page_size,
        };
      }
      const p = querySchema.parse(query(c));
      const where: Prisma.TransactionWhereInput = {
        kind: p.kind,
        memberId: p.member_id,
        groupId: p.group_id,
        expenseCategory: p.category,
        status: p.status,
        businessDate: {
          gte: p.date_from ? new Date(p.date_from) : undefined,
          lte: p.date_to ? new Date(p.date_to) : undefined,
        },
        ...(p.q
          ? {
              OR: [
                { title: { contains: p.q, mode: "insensitive" } },
                { description: { contains: p.q, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const rows = await tx.transaction.findMany({
        where,
        include: { replacedBy: { select: { id: true } } },
        orderBy: [
          { businessDate: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        skip: (p.page - 1) * p.page_size,
        take: p.page_size,
      });
      return {
        items: rows.map(transactionView),
        total: await tx.transaction.count({ where }),
        page: p.page,
        page_size: p.page_size,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
  return json(result);
}
