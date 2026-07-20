import { k8sCoreV1Api } from "../../kubernetes/config.js";
import { claimPod, poolStats } from "../pool.js";
import { checkPodStatus } from "../middleware/sandbox.middleware.js";
import projectModel from "../model/sandox.model.js";

/**
 *  for pod health check
 */
export function checkHealth(req, res) {
  res.status(200).json({ message: "Sandbox Api is healthy", status: "ok" });
}

/**
 *  for check pool is start or not for creating a pre build pods
 */

export async function poolStartCheck(req, res) {
  res.status(200).json(poolStats());
}

/**
 *  create a sandbox in this we create pods and deployments
 */

export async function sandboxStartasync(req, res) {
  try {
    const { sandboxId, previewUrl, fromPool } = await claimPod();
    const projectId = req.user.projectId;

    const project = await projectModel.findOne({
      _id: projectId,
      user: req.user._id,
    });

    if (!project) {
      return res.status(401).json({
        message: "Authentication token is missing",
      });
    }

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
}

/**
 *  check status of pods and sandbox
 */

export async function checkSandboxStatusasync(req, res) {
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
      err?.body || err?.message || err,
    );
    return res.status(500).json({
      message: "Failed to read sandbox status",
      error: err?.body?.message || err?.message || "Unknown error",
      success: false,
    });
  }
}

/**
 *  create a project
 */

export async function projectController(req, res) {
  const { title } = req.body;

  const newProject = new projectModel({
    user: req.user.id,
    title,
  });

  await newProject.save();

  return res.status(201).json({
    message: "Project created Successfully",
    success: true,
    project: newProject,
  });
}

/**
 *
 */

export async function projectsController(req, res) {
  const projects = await projectModel.find({ user: req.user.id });

  return res.status(401).json({
    message: "Projects retrieved successfully",
    projects,
  });
}
