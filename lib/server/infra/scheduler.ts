import { ProviderError } from "./provider-error";

export interface RequestStartScheduler {
  schedule<T>(task: () => Promise<T>): Promise<T>;
}

export class MemoryStartScheduler implements RequestStartScheduler {
  private nextStartAt = 0;
  private pending = 0;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly spacingMs = 1_100,
    private readonly maximumPending = 20,
    private readonly now: () => number = Date.now,
    private readonly sleep: (milliseconds: number) => Promise<void> = delay,
  ) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    if (this.pending >= this.maximumPending) throw queueSaturated();
    this.pending += 1;

    const start = this.tail.then(async () => {
      const waitMs = Math.max(0, this.nextStartAt - this.now());
      if (waitMs > 0) await this.sleep(waitMs);
      this.nextStartAt = this.now() + this.spacingMs;
    });
    this.tail = start.catch(() => undefined);

    try {
      await start;
      return await task();
    } finally {
      this.pending -= 1;
    }
  }
}

export interface RedisSchedulerClient {
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

const RESERVE_START_SCRIPT = `
local clock = redis.call('TIME')
local now = (tonumber(clock[1]) * 1000) + math.floor(tonumber(clock[2]) / 1000)
local earliest = tonumber(redis.call('GET', KEYS[1]) or '0')
local spacing = tonumber(ARGV[1])
if earliest <= now then
  redis.call('SET', KEYS[1], now + spacing, 'PX', spacing * 3)
  return 0
end
return earliest - now
`;

export class RedisStartScheduler implements RequestStartScheduler {
  private pending = 0;

  constructor(
    private readonly client: RedisSchedulerClient,
    private readonly key: string,
    private readonly spacingMs = 1_100,
    private readonly maximumPending = 20,
    private readonly sleep: (milliseconds: number) => Promise<void> = delay,
  ) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    if (this.pending >= this.maximumPending) throw queueSaturated();
    this.pending += 1;
    try {
      while (true) {
        const result = await this.client.eval(RESERVE_START_SCRIPT, {
          keys: [this.key],
          arguments: [String(this.spacingMs)],
        });
        const waitMs = Number(result);
        if (!Number.isFinite(waitMs)) {
          throw new ProviderError({
            code: "INFRASTRUCTURE_UNAVAILABLE",
            message: "The shared provider scheduler returned an invalid response.",
            status: 503,
            retryable: true,
          });
        }
        if (waitMs <= 0) break;
        await this.sleep(waitMs);
      }
      return await task();
    } finally {
      this.pending -= 1;
    }
  }
}

function queueSaturated(): ProviderError {
  return new ProviderError({
    code: "QUEUE_SATURATED",
    message: "The provider request queue is full.",
    status: 503,
    retryable: true,
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
