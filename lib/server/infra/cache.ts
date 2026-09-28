export interface CacheStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly maximumEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string): Promise<unknown | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return structuredClone(entry.value);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    if (!this.entries.has(key) && this.entries.size >= this.maximumEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey) this.entries.delete(oldestKey);
    }
    this.entries.delete(key);
    this.entries.set(key, {
      value: structuredClone(value),
      expiresAt: this.now() + ttlSeconds * 1_000,
    });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

export interface RedisCacheClient {
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export class RedisCacheStore implements CacheStore {
  constructor(
    private readonly client: RedisCacheClient,
    private readonly namespace = "instamusic:v1",
  ) {}

  async get(key: string): Promise<unknown | null> {
    const value = await this.client.get(this.key(key));
    if (value === null) return null;
    try {
      return JSON.parse(value) as unknown;
    } catch (cause) {
      throw new Error("Redis cache contained invalid JSON", { cause });
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.setEx(this.key(key), ttlSeconds, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.client.del(this.key(key));
  }

  private key(key: string): string {
    return `${this.namespace}:${key}`;
  }
}
