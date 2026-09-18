import "server-only";

interface StorageItem {
  value: string;
  expiresAt?: number;
}

class InMemoryRedisClient {
  private store = new Map<string, StorageItem>();

  private cleanIfExpired(key: string): StorageItem | undefined {
    const item = this.store.get(key);
    if (!item) return undefined;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return item;
  }

  async get(key: string): Promise<string | null> {
    const item = this.cleanIfExpired(key);
    return item ? item.value : null;
  }

  async set(key: string, value: string, mode?: "EX", ttlSeconds?: number): Promise<void> {
    const expiresAt = mode === "EX" && ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string): Promise<number> {
    const item = this.cleanIfExpired(key);
    const current = item ? parseInt(item.value, 10) || 0 : 0;
    const next = current + 1;
    this.store.set(key, { value: String(next), expiresAt: item?.expiresAt });
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const item = this.cleanIfExpired(key);
    if (item) {
      item.expiresAt = Date.now() + ttlSeconds * 1000;
      this.store.set(key, item);
    }
  }

  async ttl(key: string): Promise<number> {
    const item = this.cleanIfExpired(key);
    if (!item || !item.expiresAt) return -1;
    const remainingSeconds = Math.ceil((item.expiresAt - Date.now()) / 1000);
    return remainingSeconds > 0 ? remainingSeconds : -2;
  }

  async reset(): Promise<void> {
    this.store.clear();
  }
}

export const redis = new InMemoryRedisClient();
