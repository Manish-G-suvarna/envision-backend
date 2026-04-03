import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('5000').transform(Number),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional().default(''),
    CLERK_PUBLISHABLE_KEY: z.string().optional().default(''),
    ADMIN_JWT_SECRET: z.string().default('envision-commander-secret-2026'),
    FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL.').default('http://localhost:3000'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error('❌ Invalid environment variables:', _env.error.format());
    throw new Error('Invalid environment variables');
}

export const env = _env.data;
