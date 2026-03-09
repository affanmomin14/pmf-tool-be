import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dns from 'node:dns';

// Force IPv4 DNS resolution (Render free tier doesn't support IPv6)
dns.setDefaultResultOrder('ipv4first');

type PrismaInstance = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma: PrismaInstance | undefined };

function createClient(): PrismaInstance {
  const isProduction = process.env.NODE_ENV === 'production';

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: isProduction ? 30000 : 10000,
    allowExitOnIdle: true,
    ...(isProduction && { ssl: { rejectUnauthorized: false } }),
  });

  // Evict dead connections so they don't poison the pool after hibernation
  pool.on('error', () => {});

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter }) as unknown as PrismaInstance;
}

export const prisma: PrismaInstance =
  globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
