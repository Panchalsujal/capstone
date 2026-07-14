import express from "express";
import morgan from "morgan";
import { createService } from "./../kubernetes/service.js";
import { createPode } from "./../kubernetes/pode.js";
import { k8sCoreV1Api } from "./../kubernetes/config.js";
import { v7 as uuid } from "uuid";

const app = express();
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Poll until all containers in the pod report ready=true (or timeout after 2 min).
 * Checks both pod.phase and containerStatuses.ready to avoid returning a URL
 * while containers are still initializing (which would cause 502 errors).
 * Also detects CrashLoopBackOff / OOMKilled early so we fail fast instead of
 * waiting for the full timeout.
 */
async function waitForPodReady(sandboxId, timeoutMs = 120_000) {
  const podName = `sandbox-pod-${sandboxId}`;
  const start = Date.now();

  // Container waiting reasons that mean the pod will never become ready
  const FATAL_REASONS = new Set([
    "CrashLoopBackOff",
    "OOMKilled",
    "ImagePullBackOff",
    "ErrImagePull",
    "CreateContainerConfigError",
    "InvalidImageName",
  ]);

  while (Date.now() - start < timeoutMs) {
    const pod = await k8sCoreV1Api.readNamespacedPod({
      name: podName,
      namespace: "default",
    });

    const phase = pod?.status?.phase;

    if (phase === "Failed" || phase === "Unknown") {
      throw new Error(`Pod entered phase: ${phase}`);
    }

    const initStatuses = pod?.status?.initContainerStatuses || [];
    const containerStatuses = pod?.status?.containerStatuses || [];
    const allStatuses = [...initStatuses, ...containerStatuses];

    // Detect any container stuck in a fatal waiting state — fail immediately
    for (const c of allStatuses) {
      const reason = c?.state?.waiting?.reason;
      if (FATAL_REASONS.has(reason)) {
        throw new Error(
          `Container "${c.name}" is in an unrecoverable state: ${reason}`
        );
      }
      // Also check lastState for OOMKilled (container briefly Running then killed)
      const lastReason = c?.lastState?.terminated?.reason;
      if (lastReason === "OOMKilled") {
        throw new Error(`Container "${c.name}" was OOMKilled — increase memory limits`);
      }
    }

    // All containers ready → pod is fully up
    if (phase === "Running") {
      const allReady =
        containerStatuses.length > 0 && containerStatuses.every((c) => c.ready);
      if (allReady) return;
    }

    // Poll every 2 seconds
    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error("Timed out waiting for pod to become ready");
}

app.get("/api/sandbox/health", (req, res) => {
  res.status(200).json({ message: "Sandbox Api is healthy", status: "ok" });
});

app.post("/api/sandbox/start", async (req, res) => {
  try {
    const sandboxId = uuid();

    // Create pod and service concurrently
    await Promise.all([createPode(sandboxId), createService(sandboxId)]);

    // Wait until all containers are truly ready before returning the URL
    await waitForPodReady(sandboxId);

    return res.status(201).json({
      message: "Sandbox environment created successfully",
      sandboxId,
      previewUrl: `http://${sandboxId}.preview.localhost`,
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

export default app;
