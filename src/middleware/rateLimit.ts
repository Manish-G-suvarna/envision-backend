import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';

/**
 * Build a rate-limit store.
 * - If Redis is configured: uses RedisStore (shared across all PM2 instances)
 * - If Redis is NOT configured: falls back to in-memory store (default)
 */
function buildStore(prefix: string) {
    const client = getRedisClient();

    if (client) {
        console.log(`📊 Rate limiter [${prefix}]: using Redis store`);
        return new RedisStore({
            // rate-limit-redis uses sendCommand to stay client-agnostic
            sendCommand: (command: string, ...args: string[]) =>
                client.call(command, ...args) as any,
            prefix: `rl:${prefix}:`,
        });
    }

    console.log(`📊 Rate limiter [${prefix}]: using in-memory store (no Redis configured)`);
    return undefined; // express-rate-limit defaults to memory store
}

// ─── Global limiter: 100 requests per 15 minutes ────────────────────────────
export const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: buildStore('global'),
    message: {
        error: 'Too many requests, please try again later.',
    },
});

// ─── Auth limiter: 10 login attempts per 15 minutes ─────────────────────────
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: buildStore('auth'),
    message: {
        error: 'Too many login attempts, please try again later.',
    },
});

// ─── Registration limiter: 5 registrations per hour ─────────────────────────
export const registrationRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: buildStore('registration'),
    message: {
        error: 'Too many registration attempts, please try again later.',
    },
});
