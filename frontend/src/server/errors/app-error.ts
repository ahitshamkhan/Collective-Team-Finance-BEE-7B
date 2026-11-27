import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export interface ErrorView {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
  request_id: string;
}

export interface AppErrorOptions {
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string[]>;
  retryAfterSeconds?: number;
}

/**
 * Controlled application error mapped to the public ErrorView envelope.
 * Never pass raw SQL, SMTP, or internal exception messages to `message`.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string[]>;
  readonly retryAfterSeconds?: number;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.status = options.status;
    this.code = options.code;
    this.fields = options.fields;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  static badRequest(code: string, message: string): AppError {
    return new AppError({ status: 400, code, message });
  }

  static unauthorized(
    message = "Authentication is required.",
    code = "UNAUTHORIZED",
  ): AppError {
    return new AppError({ status: 401, code, message });
  }

  static forbidden(
    message = "You do not have permission to perform this action.",
    code = "FORBIDDEN",
  ): AppError {
    return new AppError({ status: 403, code, message });
  }

  static notFound(
    message = "The requested resource was not found.",
    code = "NOT_FOUND",
  ): AppError {
    return new AppError({ status: 404, code, message });
  }

  static conflict(code: string, message: string): AppError {
    return new AppError({ status: 409, code, message });
  }

  static validation(
    fields?: Record<string, string[]>,
    message = "Validation failed.",
    code = "VALIDATION_ERROR",
  ): AppError {
    return new AppError({ status: 422, code, message, fields });
  }

  static rateLimited(
    retryAfterSeconds: number,
    message = "Too many requests. Please try again later.",
    code = "RATE_LIMITED",
  ): AppError {
    return new AppError({
      status: 429,
      code,
      message,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterSeconds)),
    });
  }

  static serviceUnavailable(
    message = "The service is temporarily unavailable. Please try again later.",
    code = "SERVICE_UNAVAILABLE",
  ): AppError {
    return new AppError({ status: 503, code, message });
  }
}

function formatZodFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    fields[key] ??= [];
    fields[key].push(issue.message);
  }
  return fields;
}

function isDependencyFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as {
    name?: unknown;
    code?: unknown;
    cause?: unknown;
    meta?: {
      driverAdapterError?: {
        name?: unknown;
        message?: unknown;
        cause?: { kind?: unknown };
      };
    };
  };

  const name = typeof record.name === "string" ? record.name : "";
  if (
    name === "PrismaClientInitializationError" ||
    name === "PrismaClientRustPanicError" ||
    name === "DriverAdapterError"
  ) {
    return true;
  }

  const adapterErr = record.meta?.driverAdapterError;
  if (adapterErr) {
    const kind =
      typeof adapterErr.cause?.kind === "string" ? adapterErr.cause.kind : "";
    const msg = typeof adapterErr.message === "string" ? adapterErr.message : "";
    if (
      kind === "DatabaseNotReachable" ||
      kind === "ConnectionClosed" ||
      kind === "SocketTimeout" ||
      kind === "TlsConnectionError" ||
      msg === "DatabaseNotReachable"
    ) {
      return true;
    }
  }

  const code = typeof record.code === "string" ? record.code : "";
  if (
    code === "P1001" ||
    code === "P1002" ||
    code === "P1003" ||
    code === "P1008" ||
    code === "P1017" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "ECONNRESET" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code === "08001" ||
    code === "08006"
  ) {
    return true;
  }

  if (record.cause && record.cause !== error) {
    return isDependencyFailure(record.cause);
  }

  return false;
}

export interface MappedErrorResult {
  status: number;
  body: ErrorView;
  headers: Record<string, string>;
}

/**
 * Converts any thrown value into a safe ErrorView payload without leaking
 * internal stack traces, SQL errors, or credentials.
 */
export function toErrorView(
  error: unknown,
  requestId: string = randomUUID(),
): MappedErrorResult {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
  };

  if (error instanceof AppError) {
    if (error.retryAfterSeconds !== undefined) {
      headers["Retry-After"] = String(error.retryAfterSeconds);
    }

    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
        request_id: requestId,
      },
      headers,
    };
  }

  if (error instanceof ZodError) {
    const fields = formatZodFields(error);
    return {
      status: 422,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed.",
          ...(Object.keys(fields).length > 0 ? { fields } : {}),
        },
        request_id: requestId,
      },
      headers,
    };
  }

  if (isDependencyFailure(error)) {
    return {
      status: 503,
      body: {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message:
            "The service is temporarily unavailable. Please try again later.",
        },
        request_id: requestId,
      },
      headers,
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
      request_id: requestId,
    },
    headers,
  };
}

export function errorResponse(
  error: unknown,
  requestId?: string,
): NextResponse<ErrorView> {
  const mapped = toErrorView(error, requestId);
  return NextResponse.json(mapped.body, {
    status: mapped.status,
    headers: mapped.headers,
  });
}
