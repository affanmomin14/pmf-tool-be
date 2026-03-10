"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const v4_1 = require("zod/v4");
const envSchema = v4_1.z.object({
    DATABASE_URL: v4_1.z.url(),
    OPENAI_API_KEY: v4_1.z.string().min(1),
    PORT: v4_1.z.coerce.number().default(3001),
    NODE_ENV: v4_1.z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGINS: v4_1.z.string().default('http://localhost:3000'),
    REPORT_EXPIRY_DAYS: v4_1.z.coerce.number().default(90),
    OPENAI_MODEL: v4_1.z.string().default('gpt-4o'),
    OPENAI_REPORT_MODEL: v4_1.z.string().default('gpt-5'),
    OPENAI_RESEARCH_MODEL: v4_1.z.string().default('gpt-5'),
    OPENAI_MAX_TOKENS: v4_1.z.coerce.number().default(6000),
    DAILY_SPEND_LIMIT_CENTS: v4_1.z.coerce.number().default(5000),
    LOG_LEVEL: v4_1.z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    RESEND_API_KEY: v4_1.z.string().min(1),
    RESEND_FROM_EMAIL: v4_1.z.string().email().default('onboarding@resend.dev'),
    FRONTEND_URL: v4_1.z.url().default('http://localhost:3000'),
});
const result = envSchema.safeParse(process.env);
if (!result.success) {
    console.error('Environment validation failed:');
    console.error(result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
    process.exit(1);
}
exports.env = result.data;
