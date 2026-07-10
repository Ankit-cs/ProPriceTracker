import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_TOKEN;

export const redis = redisUrl && redisToken
  ? new Redis({
      url: redisUrl,
      token: redisToken,
    })
  : null;

// Ratelimiter allowing 5 requests per 60 seconds
export const ratelimit = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.fixedWindow(5, "60 s"),
      analytics: true,
    })
  : null;

/**
 * Helper to perform rate limiting check.
 * If Redis config is not present, it bypasses and returns { success: true }.
 */
export async function checkRateLimit(identifier: string) {
  if (!ratelimit) {
    return { success: true, limit: 0, remaining: 1, reset: 0 };
  }
  try {
    const result = await ratelimit.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error("Rate limit check failed, bypassing:", error);
    return { success: true, limit: 0, remaining: 1, reset: 0 };
  }
}
