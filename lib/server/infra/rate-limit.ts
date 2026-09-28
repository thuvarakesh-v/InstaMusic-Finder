import { ProviderError } from "./provider-error";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export interface RateLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

type Bucket = { count: number; resetsAt: number };

export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = Date.now) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    assertLimit(limit, windowSeconds);
    const currentTime = this.now();
    const existing = this.buckets.get(key);
    const bucket = !existing || existing.resetsAt <= currentTime
      ? { count: 0, resetsAt: currentTime + windowSeconds * 1_000 }
      : existing;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      retryAfterSeconds: Math.max(0, Math.ceil((bucket.resetsAt - currentTime) / 1_000)),
    };
  }
}

export interface RedisRateLimitClient {
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly client: RedisRateLimitClient,
    private readonly namespace = "instamusic:v1:limit",
  ) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    assertLimit(limit, windowSeconds);
    const result = await this.client.eval(CONSUME_SCRIPT, {
      keys: [`${this.namespace}:${key}`],
      arguments: [String(windowSeconds * 1_000)],
    });
    if (!Array.isArray(result) || result.length !== 2) {
      throw new ProviderError({
        code: "INFRASTRUCTURE_UNAVAILABLE",
        message: "The shared rate limiter returned an invalid response.",
        status: 503,
        retryable: true,
      });
    }
    const count = Number(result[0]);
    const ttlMs = Number(result[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
      throw new ProviderError({
        code: "INFRASTRUCTURE_UNAVAILABLE",
        message: "The shared rate limiter returned invalid values.",
        status: 503,
        retryable: true,
      });
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(0, Math.ceil(ttlMs / 1_000)),
    };
  }
}

function assertLimit(limit: number, windowSeconds: number): void {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new ProviderError({ code: "INVALID_INPUT", message: "Invalid rate-limit configuration.", status: 500 });
  }
}
