import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

export interface RateLimitOptions {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
}

export async function checkRateLimit(options: RateLimitOptions): Promise<{
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
}> {
  if (redis) {
    return checkRateLimitRedis(options);
  }
  return checkRateLimitMemory(options);
}

function checkRateLimitMemory(options: RateLimitOptions): {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
} {
  const now = Date.now();
  const bucketKey = `${options.scope}:${options.key}`;
  const current = buckets.get(bucketKey);

  if (!current || now >= current.resetAt) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return {
      allowed: true,
      retryAfterSec: Math.ceil(options.windowMs / 1000),
      remaining: options.limit - 1,
    };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  current.count += 1;
  buckets.set(bucketKey, current);
  return {
    allowed: true,
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    remaining: options.limit - current.count,
  };
}

async function checkRateLimitRedis(options: RateLimitOptions): Promise<{
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
}> {
  const key = `ratelimit:${options.scope}:${options.key}`;
  const count = await redis!.incr(key);

  if (count === 1) {
    await redis!.pexpire(key, options.windowMs);
  }

  const ttlMsRaw = await redis!.pttl(key);
  const ttlMs = ttlMsRaw > 0 ? ttlMsRaw : options.windowMs;
  const retryAfterSec = Math.max(1, Math.ceil(ttlMs / 1000));

  if (count > options.limit) {
    return {
      allowed: false,
      retryAfterSec,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSec,
    remaining: Math.max(0, options.limit - count),
  };
}

export function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde alguns segundos e tente novamente." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}
