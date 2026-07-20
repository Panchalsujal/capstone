import Redis from "ioredis";
import { deletePod } from "../../kubernetes/pode.js";
import { deleteService } from "../../kubernetes/service.js";
import {config} from './config.js'

const redis = new Redis(config.REDIS_URL);
const subscriber = new Redis(config.REDIS_URL);

export async function createSandboxKey(sandboxId) {
  await redis.set(
    `sandbox:${sandboxId}`,
    JSON.stringify({
      status: "active",
    }),
    "EX",
    60*60
  );
}

async function initSubscriber() {
  try {
    await subscriber.config("SET", "notify-keyspace-events", "Ex");

    await subscriber.subscribe("__keyevent@0__:expired");

    console.log("✅ Listening for expired Redis keys...");
  } catch (err) {
    console.error("Failed to initialize Redis subscriber:", err);
  }
}

subscriber.on("message", async (channel, key) => {
  try {
    if (!key.startsWith("sandbox:")) return;

    console.log(`🗑️ Key expired: ${key}`);

    const sandboxId = key.split(":")[1];

    await deletePod(sandboxId);
    await deleteService(sandboxId);

    console.log(`✅ Sandbox ${sandboxId} deleted`);
  } catch (err) {
    console.error("Error handling expired key:", err);
  }
});

subscriber.on("error", (err) => {
  console.error("Redis Subscriber Error:", err);
});

subscriber.on("connect", () => {
  console.log("Redis subscriber connected");
});

subscriber.on("ready", () => {
  console.log("Redis subscriber ready");
});

initSubscriber();

export { redis, subscriber };