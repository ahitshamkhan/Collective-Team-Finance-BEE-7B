import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "./db/prisma";
import { AppError, errorResponse } from "./errors/app-error";
import { verifyToken } from "./auth/jwt";
import * as cookie from "./auth/cookies";
import {
  generateBrowserId,
  generateCsrfToken,
  verifyCsrfToken,
} from "./auth/csrf";
import { validateOrigin, validateContentType } from "./auth/origin";
import { authority } from "./services/identity";

export const emailSchema = z
  .string()
  .trim()
  .pipe(z.email().max(254))
  .transform((s) => s.toLowerCase());
export const passwordSchema = z.string().min(12).max(128);
export const nameSchema = z.string().trim().min(1).max(140);
export const reasonSchema = z.string().trim().min(5).max(500);
export const versionSchema = z.number().int().positive();
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});
export const uuid = z.uuid();
export const emptySchema = z.object({}).strict();
export type Context = {
  request: NextRequest;
  requestId: string;
  sessionId?: string;
  ip: string;
  flow?: string;
};
export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const noContent = () =>
  new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
export async function body<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = await c.request.json();
  } catch {
    throw AppError.validation(undefined, "Invalid JSON body.");
  }
  return schema.parse(value);
}
export async function authorized(
  c: Context,
  permission: "self" | "member" | "admin",
) {
  if (!c.sessionId) throw AppError.unauthorized();
  return authority(getPrisma(), c.sessionId, permission);
}
export function clearAuth(response: NextResponse) {
  for (const name of [
    cookie.sessionCookieName(),
    cookie.flowCookieName(),
    cookie.csrfCookieName(),
  ])
    response.cookies.set(cookie.clearCookie(name));
  return response;
}
export function sessionResponse(result: {
  token: string;
  seconds: number;
  sessionId: string;
  view: unknown;
}) {
  const response = json(result.view);
  response.cookies.set(cookie.sessionCookie(result.token, result.seconds));
  response.cookies.set(
    cookie.csrfReadableCookie(
      generateCsrfToken(result.sessionId, result.seconds),
      Math.min(1800, result.seconds),
    ),
  );
  response.cookies.set(cookie.clearCookie(cookie.flowCookieName()));
  return response;
}
export async function endpoint(
  request: NextRequest,
  work: (c: Context) => Promise<NextResponse>,
) {
  const requestId = randomUUID();
  try {
    let sessionId: string | undefined;
    const raw = request.cookies.get(cookie.sessionCookieName())?.value;
    if (raw) {
      const token = await verifyToken(raw);
      if (!token) throw AppError.unauthorized();
      const a = await authority(getPrisma(), token.sid, "self");
      if (a.user.id !== token.sub) throw AppError.unauthorized();
      sessionId = token.sid;
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      if (!validateOrigin(request) || !validateContentType(request))
        throw AppError.forbidden("Invalid request origin or content type.");
      const header = request.headers.get("x-csrf-token") ?? "";
      const saved = request.cookies.get(cookie.csrfCookieName())?.value ?? "";
      const binding =
        sessionId ?? request.cookies.get(cookie.browserCookieName())?.value;
      if (
        !binding ||
        !header ||
        Buffer.byteLength(header) !== Buffer.byteLength(saved) ||
        !timingSafeEqual(Buffer.from(header), Buffer.from(saved)) ||
        !verifyCsrfToken(header, binding)
      )
        throw AppError.forbidden("Invalid CSRF token.");
    }
    // NextRequest does not expose a trusted peer address. Never trust caller supplied
    // forwarding headers. A shared bucket fails conservatively until edge trust is configured.
    return await work({
      request,
      requestId,
      sessionId,
      ip: "unverified-peer",
      flow: request.cookies.get(cookie.flowCookieName())?.value,
    });
  } catch (error) {
    const response = errorResponse(error, requestId);
    if (response.status === 401) clearAuth(response);
    return response;
  }
}
export async function csrfResponse(c: Context) {
  const browser =
    c.request.cookies.get(cookie.browserCookieName())?.value ??
    generateBrowserId();
  const seconds = c.sessionId
    ? Math.min(
        1800,
        Math.max(
          1,
          Math.floor(
            ((await authorized(c, "self")).session.expiresAt.getTime() -
              Date.now()) /
              1000,
          ),
        ),
      )
    : 1800;
  const token = generateCsrfToken(c.sessionId ?? browser, seconds);
  const response = json({ csrf_token: token });
  if (!c.sessionId) response.cookies.set(cookie.browserCookie(browser, 1800));
  response.cookies.set(cookie.csrfReadableCookie(token, seconds));
  return response;
}
