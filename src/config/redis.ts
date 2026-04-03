import Redis from 'ioredis';
import { env } from './env';

let redisClient: Redis | null = null;

/**
 * Returns a connected Redis client if REDIS_URL is configured,
 * otherwise returns null (falls back to in-memory rate limiting).
 */
export function getRedisClient(): Redis | null {
    if (!env.REDIS_URL) {
        return null;
    }

    if (redisClient) {
        return redisClient;
    }

    redisClient = new Redis(env.REDIS_URL, {
        // Reconnect on failure: wait 2s between retries, max 10 retries
        retryStrategy(times) {
            if (times > 10) {
                console.error('❌ Redis: Max reconnection attempts reached. Giving up.');
                return null; // stop retrying
            }
            const delay = Math.min(times * 200, 2000);
            return delay;
        },
        enableReadyCheck: true,
        lazyConnect: false,
    });

    redisClient.on('connect', () => {
        console.log('🔴 Redis: Connected successfully');
    });

    redisClient.on('ready', () => {
        console.log('✅ Redis: Client is ready');
    });

    redisClient.on('error', (err) => {
        console.error('❌ Redis error:', err.message);
    });

    redisClient.on('close', () => {
        console.warn('⚠️  Redis: Connection closed');
    });

    redisClient.on('reconnecting', () => {
        console.log('🔄 Redis: Reconnecting...');
    });

    return redisClient;
}

/**
 * Gracefully close the Redis connection.
 * Call this on application shutdown.
 */
export async function closeRedisClient(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        console.log('🔴 Redis: Connection closed gracefully');
    }
}
