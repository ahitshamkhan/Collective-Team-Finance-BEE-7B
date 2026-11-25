import { parseResponse } from "./response-schemas";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const headers = new Headers(options.headers);
    if (options.method && options.method !== "GET") {
      const response = await fetch("/api/v1/auth/csrf", {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401 && typeof window !== "undefined")
          window.dispatchEvent(new Event("portal:unauthorized"));
        throw new ApiError(
          "The secure service is not available yet. Please try again later.",
          response.status,
          "SERVICE_UNAVAILABLE",
        );
      }
      const csrf = parseResponse(
        "/auth/csrf",
        "GET",
        await response.json(),
      ) as { csrf_token: string };
      if (typeof csrf.csrf_token !== "string")
        throw new ApiError(
          "Unable to prepare a secure request.",
          503,
          "CSRF_UNAVAILABLE",
        );
      headers.set("X-CSRF-Token", csrf.csrf_token);
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (response.status === 401 && typeof window !== "undefined")
        window.dispatchEvent(new Event("portal:unauthorized"));
      throw new ApiError(
        body?.error?.message ||
          (response.status === 404
            ? "This service is not connected yet. No records have been changed."
            : "The request could not be completed. Please try again."),
        response.status,
        body?.error?.code || "REQUEST_FAILED",
        Number(response.headers.get("Retry-After")) || 0,
      );
    }
    return response.status === 204
      ? (undefined as T)
      : (parseResponse(
          path,
          options.method || "GET",
          await response.json(),
        ) as T);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      "Unable to reach the service. Check your connection and try again.",
      503,
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
