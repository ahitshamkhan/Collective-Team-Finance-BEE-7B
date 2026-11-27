import "server-only";
import { type ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { getEnv } from "../config/env";

const SESSION_COOKIE = "cfp_session";
const SESSION_COOKIE_PROD = "__Host-cfp_session";
const BROWSER_COOKIE = "cfp_browser";
const BROWSER_COOKIE_PROD = "__Host-cfp_browser";
const CSRF_COOKIE = "cfp_csrf";
const CSRF_COOKIE_PROD = "__Host-cfp_csrf";
const FLOW_COOKIE = "cfp_flow";
const FLOW_COOKIE_PROD = "__Host-cfp_flow";

function isProd(): boolean {
  return getEnv().COOKIE_SECURE;
}

function name(dev: string, prod: string): string {
  return isProd() ? prod : dev;
}

export function sessionCookieName(): string {
  return name(SESSION_COOKIE, SESSION_COOKIE_PROD);
}

export function browserCookieName(): string {
  return name(BROWSER_COOKIE, BROWSER_COOKIE_PROD);
}

export function csrfCookieName(): string {
  return name(CSRF_COOKIE, CSRF_COOKIE_PROD);
}

export function flowCookieName(): string {
  return name(FLOW_COOKIE, FLOW_COOKIE_PROD);
}

function baseCookieOptions(): Partial<ResponseCookie> {
  return {
    path: "/",
    secure: isProd(),
    sameSite: "lax" as const,
  };
}

export function sessionCookie(
  jwt: string,
  maxAgeSeconds: number,
): ResponseCookie {
  return {
    name: sessionCookieName(),
    value: jwt,
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: maxAgeSeconds,
  };
}

export function browserCookie(
  value: string,
  maxAgeSeconds: number,
): ResponseCookie {
  return {
    name: browserCookieName(),
    value,
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: maxAgeSeconds,
  };
}

export function csrfReadableCookie(
  value: string,
  maxAgeSeconds: number,
): ResponseCookie {
  return {
    name: csrfCookieName(),
    value,
    ...baseCookieOptions(),
    httpOnly: false,
    maxAge: maxAgeSeconds,
  };
}

export function flowCookie(
  value: string,
  maxAgeSeconds: number = 300,
): ResponseCookie {
  return {
    name: flowCookieName(),
    value,
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: maxAgeSeconds,
  };
}

export function clearCookie(cookieName: string): ResponseCookie {
  return {
    name: cookieName,
    value: "",
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: 0,
  };
}
