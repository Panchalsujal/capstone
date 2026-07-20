import { k8sCoreV1Api } from "../../kubernetes/config.js";



// Pool is initialised (and awaited) in server.js before the HTTP server
// starts accepting traffic. See server.js for details.

// Fatal container waiting reasons that mean the pod will never recover
const FATAL_REASONS = new Set([
  "CrashLoopBackOff",
  "OOMKilled",
  "ImagePullBackOff",
  "ErrImagePull",
  "CreateContainerConfigError",
  "InvalidImageName",
]);

 export async function checkPodStatus(sandboxId) {
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
