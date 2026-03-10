"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("../generated/prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = __importDefault(require("pg"));
const node_dns_1 = __importDefault(require("node:dns"));
// Force IPv4 DNS resolution (Render free tier doesn't support IPv6)
node_dns_1.default.setDefaultResultOrder('ipv4first');
const globalForPrisma = globalThis;
function createClient() {
    const isProduction = process.env.NODE_ENV === 'production';
    const pool = new pg_1.default.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 3,
        min: 0,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: isProduction ? 30000 : 10000,
        allowExitOnIdle: true,
        ...(isProduction && { ssl: { rejectUnauthorized: false } }),
    });
    // Evict dead connections so they don't poison the pool after hibernation
    pool.on('error', () => { });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    return new client_1.PrismaClient({ adapter });
}
exports.prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
const shutdown = async () => {
    await exports.prisma.$disconnect();
    process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
