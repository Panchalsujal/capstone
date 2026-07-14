/**
 * pool.js — Warm sandbox pod pool
 *
 * Pre-creates a configurable number of sandbox pods+services so they are
 * fully ready before any user requests them. When a user calls
 * POST /api/sandbox/start the server claims a warm pod instantly
 * (< 200 ms) instead of waiting ~30-60 s for a fresh pod to boot.
 *
 * After a pod is claimed the pool automatically replenishes itself in
 * the background so the next user also gets a warm pod.
 *
 * Pool states per slot:
 *   "provisioning"  – pod is created, waiting for containers to be ready
 *   "ready"         – pod is fully ready, available to be claimed
 *   "claimed"       – pod has been handed to a user session
 */

import { createService } from "./../kubernetes/service.js";
import { createPode } from "./../kubernetes/pode.js";
import { k8sCoreV1Api } from "./../kubernetes/config.js";
import { v7 as uuid } from "uuid";

// How many warm pods to keep ready at all times.
const POOL_SIZE = parseInt(process.env.POOL_SIZE || "2", 10);

// How often to poll a provisioning pod for readiness (ms).
const POLL_INTERVAL_MS = 1000;

// How long to wait for a pod to become ready before giving up (ms).
const POD_TIMEOUT_MS = 180_000;

// Fatal container waiting states — stop polling immediately.
const FATAL_REASONS = new Set([
  "CrashLoopBackOff",
  "OOMKilled",
  "ImagePullBackOff",
  "ErrImagePull",
  "CreateContainerConfigError",
  "InvalidImageName",
]);

/**
 * @typedef {{ sandboxId: string, status: "provisioning"|"ready"|"claimed", previewUrl: string }} PoolSlot
 */

/** @type {PoolSlot[]} */
const pool = [];

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Poll a pod until all containers are ready, then mark the slot "ready".
 * If it fails or times out, remove the slot and schedule a replacement.
 */
async function watchUntilReady(slot) {
  const podName = `sandbox-pod-${slot.sandboxId}`;
  const start = Date.now();

  while (Date.now() - start < POD_TIMEOUT_MS) {
    try {
      const pod = await k8sCoreV1Api.readNamespacedPod({
        name: podName,
        namespace: "default",
      });

      const phase = pod?.status?.phase;

      if (phase === "Failed" || phase === "Unknown") {
        console.warn(`[pool] Pod ${slot.sandboxId} entered phase ${phase} — dropping`);
        removeAndReplenish(slot);
        return;
      }

      const initStatuses = pod?.status?.initContainerStatuses || [];
      const containerStatuses = pod?.status?.containerStatuses || [];

      for (const c of [...initStatuses, ...containerStatuses]) {
        const reason = c?.state?.waiting?.reason;
        if (FATAL_REASONS.has(reason)) {
          console.warn(`[pool] Container ${c.name} fatal: ${reason} — dropping pod ${slot.sandboxId}`);
          removeAndReplenish(slot);
          return;
        }
      }

      if (phase === "Running") {
        const allReady =
          containerStatuses.length > 0 && containerStatuses.every((c) => c.ready);
        if (allReady) {
          slot.status = "ready";
          console.log(`[pool] Pod ${slot.sandboxId} is ready (${Math.round((Date.now() - start) / 1000)}s)`);
          return;
        }
      }
    } catch (err) {
      // Pod may not exist in k8s yet — keep polling
      if (err?.body?.code !== 404) {
        console.error(`[pool] Error polling ${slot.sandboxId}:`, err?.body?.message || err?.message);
      }
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.warn(`[pool] Pod ${slot.sandboxId} timed out — dropping`);
  removeAndReplenish(slot);
}

/** Remove a slot from the pool and add a fresh replacement. */
function removeAndReplenish(slot) {
  const idx = pool.indexOf(slot);
  if (idx !== -1) pool.splice(idx, 1);
  addSlot();
}

/** Create one new pod+service slot and start watching it. */
async function addSlot() {
  const sandboxId = uuid();
  /** @type {PoolSlot} */
  const slot = {
    sandboxId,
    status: "provisioning",
    previewUrl: `http://${sandboxId}.preview.localhost`,
  };

  pool.push(slot);
  console.log(`[pool] Provisioning warm pod ${sandboxId} (pool size: ${pool.length})`);

  try {
    await Promise.all([createPode(sandboxId), createService(sandboxId)]);
    watchUntilReady(slot); // intentionally not awaited — runs in background
  } catch (err) {
    console.error(`[pool] Failed to create pod ${sandboxId}:`, err?.body?.message || err?.message);
    removeAndReplenish(slot);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize the pool. Call once at server startup.
 * Fills the pool up to POOL_SIZE in the background — does not block.
 */
export function initPool() {
  const needed = POOL_SIZE - pool.length;
  console.log(`[pool] Initialising — pre-warming ${needed} pod(s)`);
  for (let i = 0; i < needed; i++) {
    addSlot();
  }
}

/**
 * Claim a pod for a user.
 *
 * If a warm pod is available it is returned immediately and a new one
 * is provisioned in the background to refill the pool.
 *
 * If no warm pod is available a fresh one is created on-demand and we
 * wait for it to become ready (fallback — slower path).
 *
 * @returns {Promise<{ sandboxId: string, previewUrl: string, fromPool: boolean }>}
 */
export async function claimPod() {
  // Try to grab a ready slot from the pool
  const readyIdx = pool.findIndex((s) => s.status === "ready");

  if (readyIdx !== -1) {
    const slot = pool.splice(readyIdx, 1)[0];
    slot.status = "claimed";
    console.log(`[pool] Claimed warm pod ${slot.sandboxId} — replenishing pool`);
    addSlot(); // replenish in background
    return { sandboxId: slot.sandboxId, previewUrl: slot.previewUrl, fromPool: true };
  }

  // No warm pod ready — create one on-demand and wait for it (slow path)
  console.warn("[pool] No warm pod available — creating on-demand (slow path)");
  const sandboxId = uuid();
  await Promise.all([createPode(sandboxId), createService(sandboxId)]);

  // Wait for it to be ready (inline, since the user is waiting)
  const tempSlot = { sandboxId, status: "provisioning", previewUrl: `http://${sandboxId}.preview.localhost` };
  pool.push(tempSlot);
  await watchUntilReadySync(sandboxId);

  return {
    sandboxId,
    previewUrl: `http://${sandboxId}.preview.localhost`,
    fromPool: false,
  };
}

/**
 * Returns pool stats — useful for a health/debug endpoint.
 */
export function poolStats() {
  return {
    total: pool.length,
    ready: pool.filter((s) => s.status === "ready").length,
    provisioning: pool.filter((s) => s.status === "provisioning").length,
    poolSize: POOL_SIZE,
  };
}

/**
 * Synchronous-style wait for a specific sandboxId to become ready.
 * Used only on the slow fallback path in claimPod().
 */
async function watchUntilReadySync(sandboxId) {
  const podName = `sandbox-pod-${sandboxId}`;
  const start = Date.now();

  while (Date.now() - start < POD_TIMEOUT_MS) {
    try {
      const pod = await k8sCoreV1Api.readNamespacedPod({ name: podName, namespace: "default" });
      const phase = pod?.status?.phase;
      const containerStatuses = pod?.status?.containerStatuses || [];

      if (phase === "Running" && containerStatuses.length > 0 && containerStatuses.every((c) => c.ready)) {
        return; // ready
      }
    } catch (_) { /* keep polling */ }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for on-demand pod ${sandboxId}`);
}
