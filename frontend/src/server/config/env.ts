import "server-only";
import { z } from "zod";

const pgUrl = z
  .string()
  .min(1)
  .refine(
    (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
    "Must be a valid PostgreSQL connection string",
  );

const envSchema = z.object({
  DATABASE_URL: pgUrl,

  APP_ENV: z.enum(["development", "test", "production"]).default("development"),

  PUBLIC_ORIGIN: z.string().url().default("http://localhost:3000"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters (256 bits)"),
  JWT_ISSUER: z.string().min(1).default("collective-finance-portal"),
  JWT_AUDIENCE: z.string().min(1).default("collective-finance-portal"),

  CSRF_HMAC_KEY: z
    .string()
    .min(32, "CSRF_HMAC_KEY must be at least 32 characters"),
  RATE_LIMIT_HMAC_KEY: z
    .string()
    .min(32, "RATE_LIMIT_HMAC_KEY must be at least 32 characters"),

  ADMIN_SESSION_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(7200)
    .default(7200),
  MEMBER_SESSION_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(28800)
    .default(28800),
  STATUS_SESSION_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(1800)
    .default(1800),

  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  BUSINESS_TIMEZONE: z.literal("Asia/Karachi").default("Asia/Karachi"),
  CURRENCY: z.literal("PKR").default("PKR"),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cachedEnv: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Invalid server environment configuration. Check: ${missing}`,
    );
  }

  const env = result.data;
  const origin = new URL(env.PUBLIC_ORIGIN);
  if (
    env.PUBLIC_ORIGIN !== origin.origin ||
    (env.APP_ENV === "production" &&
      (!env.COOKIE_SECURE || origin.protocol !== "https:")) ||
    (!env.COOKIE_SECURE &&
      !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
  ) {
    throw new Error("Invalid secure origin/cookie configuration");
  }
  const keys = [
    env.JWT_SECRET,
    env.CSRF_HMAC_KEY,
    env.RATE_LIMIT_HMAC_KEY,
    process.env.OTP_HMAC_KEY,
  ].filter((v): v is string => !!v);
  if (new Set(keys).size !== keys.length)
    throw new Error("Security keys must be distinct");
  cachedEnv = env;
  return cachedEnv;
}

/** Reset cache — only for tests */
export function _resetEnvCache(): void {
  cachedEnv = undefined;
}
