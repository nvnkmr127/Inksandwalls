import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
export const connection = process.env.NODE_ENV === "test"
  ? (null as unknown as Redis)
  : new Redis(redisUrl, { maxRetriesPerRequest: null });
