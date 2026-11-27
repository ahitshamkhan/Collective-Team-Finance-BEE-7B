import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { getEnv } from "../config/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let productionPrisma: PrismaClient | undefined;

function createPrismaClient(): PrismaClient {
  const env = getEnv();

  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 3000,
  });

  return new PrismaClient({
    adapter,
  });
}

export function getPrisma(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    productionPrisma ??= createPrismaClient();

    return productionPrisma;
  }

  globalForPrisma.prisma ??= createPrismaClient();

  return globalForPrisma.prisma;
}