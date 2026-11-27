import "server-only";
import { type NextRequest } from "next/server";
import { getEnv } from "../config/env";

/**
 * Validate the Origin header for state-changing requests.
 * Returns true if the origin matches the configured PUBLIC_ORIGIN.
 * GET/HEAD/OPTIONS requests are exempt.
 */
export function validateOrigin(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (!origin) return false;

  const env = getEnv();
  const expected = new URL(env.PUBLIC_ORIGIN).origin;
  return origin === expected;
}

/**
 * Validate that the request has the correct content type for mutations.
 */
export function validateContentType(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const contentType = request.headers.get("content-type");
  if (!contentType) return false;

  return contentType.split(";", 1)[0].trim().toLowerCase() === "application/json";
}
