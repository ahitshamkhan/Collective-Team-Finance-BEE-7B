import "server-only";
import { getPrisma } from "./prisma";
import type { Prisma } from "../../generated/prisma/client";

export type Tx = Prisma.TransactionClient;
export function mutate<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(260010)`;
    return work(tx);
  });
}
