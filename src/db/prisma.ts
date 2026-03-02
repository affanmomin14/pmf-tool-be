import { PrismaClient } from '../generated/prisma/client';

type PrismaInstance = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma: PrismaInstance | undefined };

// Prisma v7 reads datasource URL from prisma.config.ts at runtime
export const prisma: PrismaInstance =
  globalForPrisma.prisma ?? (new (PrismaClient as unknown as new () => PrismaInstance)());

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
