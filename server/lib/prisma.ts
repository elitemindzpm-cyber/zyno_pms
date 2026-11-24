// server/lib/prisma.ts
// Singleton Prisma client instance with connection pooling

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Interactive transaction with a 20-second limit. The database is remote, so the default 5-second
 * limit is too short for multi-step postings. Use this instead of prisma.$transaction(...).
 */
export function txn<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  return (prisma.$transaction as any)(fn, { timeout: 20000, maxWait: 10000 });
}

export default prisma;
