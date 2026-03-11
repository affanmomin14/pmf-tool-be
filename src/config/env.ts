import { z } from 'zod/v4';

const envSchema = z.object({
  DATABASE_URL: z.url(),
  OPENAI_API_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGINS: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().default('http://localhost:3000')),
  REPORT_EXPIRY_DAYS: z.coerce.number().default(90),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_REPORT_MODEL: z.string().default('gpt-4o'),
  OPENAI_RESEARCH_MODEL: z.string().default('gpt-5'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(6000),
  // No env or empty → default 5000 cents ($50)
  DAILY_SPEND_LIMIT_CENTS: z.preprocess(
    (v) => (v == null || (typeof v === 'string' && v.trim() === '') ? undefined : v),
    z.coerce.number().min(1).default(5000)
  ),
  LOG_LEVEL: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || 'info' : v),
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info')
  ),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || 'onboarding@resend.dev' : v),
    z.string().email().default('onboarding@resend.dev')
  ),
  FRONTEND_URL: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.url().default('http://localhost:3000')),
});

export type Env = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Environment validation failed:');
  console.error(result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

export const env: Env = result.data;
