import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
  console.log("Connected to Redis successfully");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export async function refreshTTL(sandboxId) {
  try {
    const key = `sandbox:${sandboxId}`;

    const updated = await redis.expire(key, 120);

    if (!updated) {
      console.warn(`Redis key not found: ${key}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to refresh TTL:", err);
    return false;
  }
}

export default redis;