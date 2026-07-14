import express from "express";
import morgan from "morgan";
import { k8sCoreV1Api } from "./../kubernetes/config.js";
import { v7 as uuid } from "uuid";
import { initPool, claimPod, poolStats } from "./pool.js";

const app = express();
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Start pre-warming the sandbox pod pool on server boot.
// Runs entirely in the background — does not block startup.
initPool();

// Fatal container waiting reasons that mean the pod will never recover
const FATAL_REASONS = new Set([
  "CrashLoopBackOff",
  "OOMKilled",
  "ImagePullBackOff",
  "ErrImagePull",
  "CreateContainerConfigError",
  "InvalidImageName",
]);

/**
 * Single-shot readiness check — NO polling loop.
 * Returns one of: "ready" | "provisioning" | "failed"
 * Meant to be called repeatedly by the client, not blocked on server-side.
 */
async function checkPodStatus(sandboxId) {
  const podName = `sandbox-pod-${sandboxId}`;

  const pod = await k8sCoreV1Api.readNamespacedPod({
    name: podName,
    namespace: "default",
  });

  const phase = pod?.status?.phase;

  // Hard failures
  if (phase === "Failed" || phase === "Unknown") {
    return { status: "failed", phase, reason: `Pod entered phase: ${phase}` };
  }

  const initStatuses = pod?.status?.initContainerStatuses || [];
  const containerStatuses = pod?.status?.containerStatuses || [];
  const allStatuses = [...initStatuses, ...containerStatuses];

  // Detect any container stuck in a fatal waiting state
  for (const c of allStatuses) {
    const reason = c?.state?.waiting?.reason;
    if (FATAL_REASONS.has(reason)) {
      return {
        status: "failed",
        phase,
        reason: `Container "${c.name}" is in an unrecoverable state: ${reason}`,
      };
    }
    const lastReason = c?.lastState?.terminated?.reason;
    if (lastReason === "OOMKilled") {
      return {
        status: "failed",
        phase,
        reason: `Container "${c.name}" was OOMKilled — increase memory limits`,
      };
    }
  }

  // All main containers ready → pod is fully up
  if (phase === "Running") {
    const allReady =
      containerStatuses.length > 0 && containerStatuses.every((c) => c.ready);
    if (allReady) {
      return { status: "ready", phase };
    }
  }

  // Still initializing or containers not yet ready
  return { status: "provisioning", phase };
}

app.get("/api/sandbox/health", (req, res) => {
  res.status(200).json({ message: "Sandbox Api is healthy", status: "ok" });
});

/**
 * GET /api/sandbox/pool-stats
 * Debug endpoint — shows how many pods are warm and ready.
 */
app.get("/api/sandbox/pool-stats", (req, res) => {
  res.status(200).json(poolStats());
});

/**
 * POST /api/sandbox/start
 *
 * Tries to claim a pre-warmed pod from the pool (< 200ms).
 * If the pool has a ready pod:
 *   → returns immediately with status "ready" + previewUrl usable right now
 * If the pool is empty (all pods still provisioning):
 *   → falls back to on-demand creation and returns status "provisioning"
 *   → client should poll GET /api/sandbox/status/:sandboxId
 *
 * In both cases the response is fast — the slow work happens in the background.
 */
app.post("/api/sandbox/start", async (req, res) => {
  try {
    const { sandboxId, previewUrl, fromPool } = await claimPod();

    return res.status(202).json({
      message: fromPool
        ? "Sandbox ready (served from warm pool)"
        : "Sandbox provisioning started",
      sandboxId,
      // If served from pool the pod is already ready; client can use previewUrl now.
      // If on-demand, client should poll the status endpoint.
      status: fromPool ? "ready" : "provisioning",
      statusUrl: `/api/sandbox/status/${sandboxId}`,
      previewUrl,
      success: true,
    });
  } catch (err) {
    console.error("Failed to start sandbox:", err?.body || err?.message || err);
    return res.status(500).json({
      message: "Failed to create sandbox environment",
      error: err?.body?.message || err?.message || "Unknown error",
      success: false,
    });
  }
});

/**
 * GET /api/sandbox/status/:sandboxId
 *
 * Lightweight single-shot readiness check.
 * Reads the live pod state from Kubernetes once and returns the result.
 * No polling loop — the client calls this endpoint on a timer.
 *
 * Response status field:
 *   "provisioning" — pod/containers still initializing
 *   "ready"        — all containers running and healthy
 *   "failed"       — pod entered an unrecoverable state
 */
app.get("/api/sandbox/status/:sandboxId", async (req, res) => {
  const { sandboxId } = req.params;

  try {
    const { status, phase, reason } = await checkPodStatus(sandboxId);

    const body = {
      sandboxId,
      status,
      phase,
      previewUrl: `http://${sandboxId}.preview.localhost`,
      success: true,
    };

    if (reason) body.reason = reason;

    return res.status(200).json(body);
  } catch (err) {
    // Pod not found yet (still being scheduled) → still provisioning
    const code = err?.body?.code || err?.statusCode;
    if (code === 404) {
      return res.status(200).json({
        sandboxId,
        status: "provisioning",
        phase: "Pending",
        previewUrl: `http://${sandboxId}.preview.localhost`,
        success: true,
      });
    }

    console.error(
      "Failed to read sandbox status:",
      err?.body || err?.message || err
    );
    return res.status(500).json({
      message: "Failed to read sandbox status",
      error: err?.body?.message || err?.message || "Unknown error",
      success: false,
    });
  }
});

export default app;
