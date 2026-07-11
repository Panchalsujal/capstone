import express from "express";
import { createAgentForSandbox } from "../agents/code.agents.js";

const agentRouter = express.Router();

/**
 * POST /api/ai/invoke
 * Body: { message: string, sandboxId: string }
 *
 * Creates an agent bound to the given sandboxId, runs it,
 * and returns only the final AI response text.
 */
agentRouter.post("/invoke", async (req, res) => {
  const { message, sandboxId } = req.body;

  if (!message || !sandboxId) {
    return res
      .status(400)
      .json({ error: "message and sandboxId are required" });
  }

  console.log(`[invoke] sandboxId=${sandboxId}`);

  try {
    // Create agent targeting the specific sandbox
    const agent = createAgentForSandbox(sandboxId);

    const result = await agent.invoke(
      {
        messages: [{ role: "user", content: message }],
      },
      {
        recursionLimit: 100,
      },
    );

    // Fix: extract the final AI message text instead of returning raw state
    const messages = result.messages;
    const lastMsg = messages[messages.length - 1];

    res.status(200).json({ result: lastMsg.content });
  } catch (error) {
    console.error("Error invoking agent:", error);
    res.status(500).json({ error: "Failed to invoke agent" });
  }
});

/** Health check */
agentRouter.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default agentRouter;
