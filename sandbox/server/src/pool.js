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
import { createSandboxKey } from "./config/redis.js";
import http from "http";

// How long a pod is allowed to stay Pending without being assigned to a node
// before we treat it as an unschedulable failure (ms).
// Keeping this SHORT prevents the 180s timeout from firing and triggering retries
// when the cluster simply doesn't have capacity.
const PENDING_TIMEOUT_MS = 30_000;

// How many warm pods to keep ready at all times.
const POOL_SIZE = parseInt(process.env.POOL_SIZE || "1", 10);

// How often to poll a provisioning pod for readiness (ms).
const POLL_INTERVAL_MS = 1000;

// How long to wait for a pod to become ready before giving up (ms).
const POD_TIMEOUT_MS = 180_000;

// Maximum number of times addSlotAndWait() will retry on failure before giving up.
const MAX_SLOT_RETRIES = 3;

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

// ─── Sync-agent activation ──────────────────────────────────────────────────

/**
 * After a warm pod is claimed, activate its sync-agent by POSTing the
 * projectId to the sidecar's HTTP server. The sync-agent starts in idle
 * mode (no PROJECT_ID) and waits for this call before syncing files.
 *
 * @param {string} sandboxId
 * @param {string} projectId
 */
async function activateSyncAgent(sandboxId, projectId) {
  // The sync-agent listens on port 4000 inside the pod. We reach it via the
  // pod's DNS name (pod IP is not stable, but the pod name is).
  // In-cluster: <pod-name>.<namespace>.pod.cluster.local doesn't work reliably;
  // use the service name which routes to the correct pod via label selector.
  // The service exposes agent on 3000, but sync-agent port 4000 is NOT in the
  // service — so we must use the pod IP directly.
  try {
    const pod = await k8sCoreV1Api.readNamespacedPod({
      name: `sandbox-pod-${sandboxId}`,
      namespace: "default",
    });
    const podIP = pod?.status?.podIP;
    if (!podIP) {
      console.warn(`[pool] Could not get pod IP for ${sandboxId} — sync-agent not activated`);
      return;
    }

    const body = JSON.stringify({ projectId });
    await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: podIP,
          port: 4000,
          path: "/activate",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        },
        (res) => {
          res.resume();
          res.on("end", resolve);
        },
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
    console.log(`[pool] Activated sync-agent for pod ${sandboxId} with projectId ${projectId}`);
  } catch (err) {
    console.error(`[pool] Failed to activate sync-agent for ${sandboxId}:`, err?.message || err);
  }
}

// ─── Kubernetes cleanup helpers ──────────────────────────────────────────────

/**
 * Best-effort delete of a pod and its associated service from Kubernetes.
 * Errors are logged but NOT re-thrown so a cleanup failure never crashes
 * the pool management loop.
 *
 * @param {string} sandboxId
 */
async function cleanupK8sResources(sandboxId) {
  const podName = `sandbox-pod-${sandboxId}`;
  const svcName = `sandbox-svc-${sandboxId}`;

  await Promise.allSettled([
    k8sCoreV1Api
      .deleteNamespacedPod({ name: podName, namespace: "default" })
      .then(() => console.log(`[pool] Deleted pod ${podName}`))
      .catch((err) => {
        if (err?.body?.code !== 404) {
          console.warn(
            `[pool] Could not delete pod ${podName}:`,
            err?.body?.message || err?.message,
          );
        }
      }),
    k8sCoreV1Api
      .deleteNamespacedService({ name: svcName, namespace: "default" })
      .then(() => console.log(`[pool] Deleted service ${svcName}`))
      .catch((err) => {
        if (err?.body?.code !== 404) {
          console.warn(
            `[pool] Could not delete service ${svcName}:`,
            err?.body?.message || err?.message,
          );
        }
      }),
  ]);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Poll a pod by name until all its containers are ready.
 *
 * This is the single source of truth for "is this pod ready" — used both
 * for background pool slots and for the on-demand slow path, so there is
 * only one place that can get the k8s polling logic wrong.
 *
 * @param {string} sandboxId
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 *   Resolves (never rejects) with a result describing why polling stopped.
 */
async function waitForPodReady(sandboxId) {
  const podName = `sandbox-pod-${sandboxId}`;
  const start = Date.now();
  let pendingSince = null; // tracks when we first saw the pod stuck in Pending

  while (Date.now() - start < POD_TIMEOUT_MS) {
    try {
      const pod = await k8sCoreV1Api.readNamespacedPod({
        name: podName,
        namespace: "default",
      });

      const phase = pod?.status?.phase;

      if (phase === "Failed" || phase === "Unknown") {
        return {
          ok: false,
          reason: `pod entered phase ${phase}`,
          retryable: false,
        };
      }

      const initStatuses = pod?.status?.initContainerStatuses || [];
      const containerStatuses = pod?.status?.containerStatuses || [];

      for (const c of [...initStatuses, ...containerStatuses]) {
        const reason = c?.state?.waiting?.reason;
        if (FATAL_REASONS.has(reason)) {
          return {
            ok: false,
            reason: `container ${c.name} fatal: ${reason}`,
            retryable: false,
          };
        }
      }

      if (phase === "Running") {
        pendingSince = null; // pod made it past Pending — reset the stuck-pending timer
        const allReady =
          containerStatuses.length > 0 &&
          containerStatuses.every((c) => c.ready);
        if (allReady) {
          return { ok: true };
        }
      } else if (phase === "Pending") {
        // Track how long we've been stuck in Pending with no node assigned.
        // A pod that stays Pending means the cluster can't schedule it —
        // retrying will just create another pod that also can't be scheduled.
        const nodeName = pod?.spec?.nodeName;
        if (!nodeName) {
          if (!pendingSince) pendingSince = Date.now();
          const pendingMs = Date.now() - pendingSince;
          if (pendingMs > PENDING_TIMEOUT_MS) {
            return {
              ok: false,
              reason: `pod stuck Pending for ${Math.round(pendingMs / 1000)}s — cluster may lack capacity`,
              retryable: false, // retrying won't help if the cluster is full
            };
          }
        } else {
          pendingSince = null; // node assigned, containers still initializing — that's fine
        }
      }
    } catch (err) {
      // Pod may not exist in k8s yet — keep polling.
      // Anything else (auth error, wrong client signature, etc.) gets logged
      // so a systemic failure doesn't silently look like "still booting".
      if (err?.body?.code !== 404) {
        console.error(
          `[pool] Error polling ${sandboxId}:`,
          err?.body?.message || err?.message || err,
        );
      }
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  return {
    ok: false,
    reason: "timed out waiting for readiness",
    retryable: false,
  };
}

/**
 * Create one new pod+service, register it as a pool slot, and watch it
 * until it's ready (or drop + replace it on failure). Awaitable — resolves
 * once the slot is ready or has been permanently given up on.
 *
 * On failure, retries up to MAX_SLOT_RETRIES times before giving up, so
 * a single bad image pull or node hiccup doesn't leave the pool short.
 * The retry counter prevents infinite pod creation (the original bug that
 * caused 11+ pods to appear on startup).
 *
 * @param {number} [retries=0] - Current retry depth. Do not pass externally.
 * @returns {Promise<void>}
 */
async function addSlotAndWait(retries = 0) {
  // Guard: never exceed POOL_SIZE pods in-flight (provisioning + ready).
  // Claimed pods are spliced out of the pool[] array immediately when claimed,
  // so pool.length is the accurate count of active (provisioning + ready) slots.
  if (pool.length >= POOL_SIZE) {
    console.log(
      `[pool] Skipping slot creation — already ${pool.length} pod(s) in pool (limit ${POOL_SIZE})`,
    );
    return;
  }

  const sandboxId = uuid();
  /** @type {PoolSlot} */
  const slot = {
    sandboxId,
    status: "provisioning",
    previewUrl: `https://${sandboxId}.preview.brohsop.in`,
  };

  pool.push(slot);
  console.log(
    `[pool] Provisioning warm pod ${sandboxId} (pool size: ${pool.length}, attempt: ${retries + 1}/${MAX_SLOT_RETRIES + 1})`,
  );

  try {
    await Promise.all([createPode(sandboxId), createService(sandboxId)]);
  } catch (err) {
    console.error(
      `[pool] Failed to create pod ${sandboxId}:`,
      err?.body?.message || err?.message,
    );
    const idx = pool.indexOf(slot);
    if (idx !== -1) pool.splice(idx, 1);
    // Clean up any k8s resources that may have been partially created
    await cleanupK8sResources(sandboxId);

    if (retries >= MAX_SLOT_RETRIES) {
      console.error(
        `[pool] Max retries (${MAX_SLOT_RETRIES}) reached — giving up on this slot`,
      );
      return;
    }
    await addSlotAndWait(retries + 1);
    return;
  }

  const start = Date.now();
  const result = await waitForPodReady(sandboxId);

  if (result.ok) {
    slot.status = "ready";
    console.log(
      `[pool] Pod ${sandboxId} is ready (${Math.round((Date.now() - start) / 1000)}s)`,
    );
  } else {
    console.warn(`[pool] Dropping pod ${sandboxId}: ${result.reason}`);
    const idx = pool.indexOf(slot);
    if (idx !== -1) pool.splice(idx, 1);

    // Always clean up the failed pod+service from Kubernetes so it doesn't
    // sit as a ghost Pending pod consuming resources.
    await cleanupK8sResources(sandboxId);

    // Don't retry on non-retryable failures (e.g. cluster out of capacity).
    // Retrying would just create another pod that also can't be scheduled.
    if (result.retryable === false) {
      console.error(
        `[pool] Not retrying — failure is not retryable: ${result.reason}`,
      );
      return;
    }

    if (retries >= MAX_SLOT_RETRIES) {
      console.error(
        `[pool] Max retries (${MAX_SLOT_RETRIES}) reached — giving up on this slot`,
      );
      return;
    }
    await addSlotAndWait(retries + 1);
  }
}

/**
 * Fire-and-forget wrapper around addSlotAndWait().
 * Starts provisioning a new slot in the background without blocking the caller.
 * Used when replenishing the pool after a pod is claimed.
 */
function addSlot() {
  addSlotAndWait().catch((err) =>
    console.error(
      "[pool] Unexpected error in background slot provisioning:",
      err?.message || err,
    ),
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize the pool. Call once at server startup, and AWAIT it —
 * this resolves only once POOL_SIZE pods are actually ready, so by the
 * time your server starts accepting traffic there is at least one warm
 * pod available.
 *
 * @returns {Promise<void>}
 */
export async function initPool() {
  const needed = POOL_SIZE - pool.length;
  console.log(`[pool] Initialising — pre-warming ${needed} pod(s)`);
  await Promise.all(Array.from({ length: needed }, () => addSlotAndWait()));
  console.log(
    `[pool] Ready — ${poolStats().ready}/${POOL_SIZE} warm pod(s) available`,
  );
}

/**
 * Claim a pod for a user.
 *
 * If a warm pod is available it is returned immediately and a new one
 * is provisioned in the background to refill the pool.
 *
 * If no warm pod is available a fresh one is created on-demand and we
 * wait for it to become ready (fallback — slower path). This pod is
 * NOT added to the pool array — it belongs to the caller, not the pool,
 * so it can never get stuck as a permanent "provisioning" ghost slot.
 *
 * @returns {Promise<{ sandboxId: string, previewUrl: string, fromPool: boolean }>}
 */
export async function claimPod(projectId) {
  console.log(projectId);
  
  const readyIdx = pool.findIndex((s) => s.status === "ready");

  if (readyIdx !== -1) {
    const slot = pool.splice(readyIdx, 1)[0];
    slot.status = "claimed";

    await createSandboxKey(slot.sandboxId);

    console.log(
      `[pool] Claimed warm pod ${slot.sandboxId} — replenishing pool`,
    );
    addSlot();

    // Activate the sync-agent sidecar now that we know the projectId.
    // Warm pods start without PROJECT_ID; this call tells the agent to begin
    // downloading from S3 and watching for file changes.
    activateSyncAgent(slot.sandboxId, projectId).catch((err) =>
      console.error(`[pool] sync-agent activation error:`, err?.message || err),
    );
    
    return {
      sandboxId: slot.sandboxId,
      previewUrl: slot.previewUrl,
      fromPool: true,
    };
  }

  console.warn("[pool] No warm pod available — creating on-demand (slow path)");

  const sandboxId = uuid();
  const previewUrl = `https://${sandboxId}.preview.brohsop.in`;

  await Promise.all([createPode(sandboxId,projectId), createService(sandboxId)]);

  const result = await waitForPodReady(sandboxId);

  if (!result.ok) {
    await cleanupK8sResources(sandboxId);
    throw new Error(
      `On-demand pod ${sandboxId} failed to become ready: ${result.reason}`,
    );
  }

  await createSandboxKey(sandboxId);

  return {
    sandboxId,
    previewUrl,
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
