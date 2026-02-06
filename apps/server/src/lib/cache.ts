import Redis from "ioredis";

type MemoryEntry = {
  value: string;
  expiresAtMs: number;
};

type CacheOptions = {
  now?: () => number;
  useRedis?: boolean;
};

export class AppCache {
  private memory = new Map<string, MemoryEntry>();
  private now: () => number;
  private redis: Redis | null = null;

  constructor(options: CacheOptions = {}) {
    this.now = options.now || (() => Date.now());
    const useRedis = options.useRedis ?? process.env.CACHE_USE_REDIS !== "0";
    const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
    if (useRedis) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false
      });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const redisValue = await this.getFromRedis<T>(key);
    if (redisValue !== undefined) return redisValue;

    this.purgeExpiredMemory();
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAtMs <= this.now()) {
      this.memory.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
    const serialized = JSON.stringify(value);

    await this.setInRedis(key, serialized, ttlSec);

    this.memory.set(key, {
      value: serialized,
      expiresAtMs: this.now() + ttlSec * 1000
    });
  }

  async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await factory();
    await this.set(key, fresh, ttlMs);
    return fresh;
  }

  async del(key: string): Promise<void> {
    this.memory.delete(key);
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch {
      // Keep memory cache behavior even if redis is unavailable.
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
      }
    }

    if (!this.redis) return;
    try {
      await this.redis.connect().catch(() => undefined);
      const keys = await this.redis.keys(`${prefix}*`);
      if (keys.length) {
        await this.redis.del(keys);
      }
    } catch {
      // Ignore redis failure and continue with memory invalidation only.
    }
  }

  async disconnect(): Promise<void> {
    if (!this.redis) return;
    this.redis.disconnect();
  }

  private purgeExpiredMemory() {
    const now = this.now();
    for (const [key, entry] of this.memory.entries()) {
      if (entry.expiresAtMs <= now) {
        this.memory.delete(key);
      }
    }
  }

  private async getFromRedis<T>(key: string): Promise<T | null | undefined> {
    if (!this.redis) return undefined;
    try {
      await this.redis.connect().catch(() => undefined);
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  private async setInRedis(key: string, value: string, ttlSec: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.connect().catch(() => undefined);
      await this.redis.set(key, value, "EX", ttlSec);
    } catch {
      // Ignore redis failure and continue with memory cache only.
    }
  }
}
