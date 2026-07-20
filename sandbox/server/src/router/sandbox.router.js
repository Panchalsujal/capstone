import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
const router = Router();
import {
  checkHealth,
  poolStartCheck,
  sandboxStartasync,
  checkSandboxStatusasync,
  projectController,
  projectsController
} from "../controller/sandbox.controller.js";


/**
 *  create a project  
 */


router.post("/project",authMiddleware,projectController)

/**
 *  
 */

router.get("/projects",authMiddleware,projectsController)



/**
 * Single-shot readiness check — NO polling loop.
 * Returns one of: "ready" | "provisioning" | "failed"
 * Meant to be called repeatedly by the client, not blocked on server-side.
 */

router.get("/health", checkHealth);

/**
 * GET /api/sandbox/pool-stats
 * Debug endpoint — shows how many pods are warm and ready.
 */
router.get("/pool-stats", poolStartCheck);

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
router.post("/start", authMiddleware, sandboxStartasync);

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
router.get("/status/:sandboxId", authMiddleware, checkSandboxStatusasync);

export default router;
