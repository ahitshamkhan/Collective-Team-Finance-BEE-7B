import "server-only";
import { z } from "zod";
import {
  type Context,
  body,
  json,
  noContent,
  authorized,
  clearAuth,
  csrfResponse,
  sessionResponse,
  emailSchema,
  passwordSchema,
  nameSchema,
  reasonSchema,
  versionSchema,
  uuid,
  emptySchema,
} from "./http";
import * as identity from "./services/identity";
import { challengeResult, resendChallenge } from "./services/otp";
import { flowCookie } from "./auth/cookies";
import { mutate } from "./db/mutation";

function challenge(flow: string) {
  const response = json(challengeResult, 202);
  response.cookies.set(flowCookie(flow));
  return response;
}
export async function authApi(c: Context, path: string) {
  const method = c.request.method;
  if (method === "GET" && path === "auth/csrf") return csrfResponse(c);
  if (method === "GET" && path === "auth/me")
    return json(identity.selfView(await authorized(c, "self")));
  if (method === "POST") {
    switch (path) {
      case "auth/register":
        return challenge(
          await identity.register(
            await body(
              c,
              z
                .object({
                  name: nameSchema,
                  email: emailSchema,
                  password: passwordSchema,
                })
                .strict(),
            ),
            c.ip,
          ),
        );
      case "auth/login": {
        const result = await identity.login(
          await body(
            c,
            z.object({ email: emailSchema, password: passwordSchema }).strict(),
          ),
          c.ip,
          c.sessionId,
        );
        if ("flow" in result) return challenge(result.flow);
        if (result.session) return sessionResponse(result.session);
        break;
      }
      case "auth/otp/verify": {
        const input = await body(
          c,
          z.object({ code: z.string().regex(/^\d{6}$/) }).strict(),
        );
        return sessionResponse(
          await identity.verifyOtp(
            c.flow,
            input.code,
            c.ip,
            c.requestId,
            c.sessionId,
          ),
        );
      }
      case "auth/otp/resend":
        await body(c, emptySchema);
        return challenge(await resendChallenge(c.flow, c.ip));
      case "auth/password/recovery":
        return challenge(
          await identity.recover(
            (await body(c, z.object({ email: emailSchema }).strict())).email,
            c.ip,
          ),
        );
      case "auth/password/reset": {
        const input = await body(
          c,
          z
            .object({
              code: z.string().regex(/^\d{6}$/),
              new_password: passwordSchema,
            })
            .strict(),
        );
        await identity.resetPassword(
          c.flow,
          input.code,
          input.new_password,
          c.ip,
          c.requestId,
        );
        return clearAuth(noContent());
      }
      case "auth/password/change": {
        const a = await authorized(c, "member");
        const input = await body(
          c,
          z
            .object({
              current_password: passwordSchema,
              new_password: passwordSchema,
            })
            .strict(),
        );
        await identity.changePassword(
          a.session.id,
          input.current_password,
          input.new_password,
          c.ip,
          c.requestId,
        );
        return clearAuth(noContent());
      }
      case "auth/logout":
      case "auth/logout-all": {
        await body(c, emptySchema);
        const a = await authorized(
          c,
          path === "auth/logout" ? "self" : "member",
        );
        await mutate(async (tx) => {
          await identity.authority(
            tx,
            a.session.id,
            path === "auth/logout" ? "self" : "member",
          );
          await tx.session.updateMany({
            where:
              path === "auth/logout"
                ? { id: a.session.id }
                : { userId: a.user.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        });
        return clearAuth(noContent());
      }
    }
    const match =
      /^admin\/(registrations|users)\/([^/]+)\/(approve|reject|suspend|restore)$/.exec(
        path,
      );
    if (
      match &&
      ((match[1] === "registrations" &&
        ["approve", "reject"].includes(match[3])) ||
        (match[1] === "users" && ["suspend", "restore"].includes(match[3])))
    ) {
      const a = await authorized(c, "admin");
      const id = uuid.parse(match[2]);
      const action = z
        .enum(["approve", "reject", "suspend", "restore"])
        .parse(match[3]);
      const input =
        action === "approve"
          ? await body(
              c,
              z
                .object({ member_id: uuid, expected_version: versionSchema })
                .strict(),
            )
          : await body(
              c,
              z
                .object({
                  reason: reasonSchema,
                  expected_version: versionSchema,
                })
                .strict(),
            );
      return json(
        await identity.reviewUser(a.session.id, id, action, input, c.requestId),
      );
    }
  }
  return null;
}
