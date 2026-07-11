import express from "express";
import { randomUUID } from "crypto";
import { createAgentForSandbox } from "../agents/code.agents.js";

const agentRouter = express.Router();

const AGENT_TIMEOUT = 60000;

agentRouter.post("/invoke", async (req, res) => {
  const { message, sandboxId } = req.body;

  // Validate BEFORE opening SSE connection
  if (!message || !sandboxId) {
    return res.status(400).json({
      success: false,
      error: "message and sandboxId are required",
    });
  }

  const requestId = randomUUID();
  const startTime = Date.now();

  console.log("\n======================================");
  console.log(`[${requestId}] AI REQUEST`);
  console.log("Sandbox:", sandboxId);
  console.log("Message:", message);
  console.log("======================================");

  // Open SSE connection
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Flush headers immediately
  res.flushHeaders?.();

  const writer = (text) => {
    res.write(
      `event: token\ndata: ${JSON.stringify({
        text,
      })}\n\n`
    );
  };

  let timeout;

  try {
    console.log(`[${requestId}] Creating agent`);

    const agent = createAgentForSandbox(sandboxId);

    console.log(`[${requestId}] Agent created`);

    timeout = setTimeout(() => {
      console.error(`[${requestId}] Agent timeout`);

      res.write(
        `event: error\ndata: ${JSON.stringify({
          success: false,
          error: "Agent execution timeout",
        })}\n\n`
      );

      res.end();
    }, AGENT_TIMEOUT);

    const stream = await agent.stream(
      {
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
      },
      {
        context: {
          writer,
        },
        streamMode: "values",
        recursionLimit:
          Number(process.env.RECURSION_LIMIT) || 100,
        configurable: {
          thread_id: requestId,
        },
      }
    );

    let finalChunk = null;

    console.log(`[${requestId}] Streaming started`);

    for await (const chunk of stream) {
      finalChunk = chunk;

      console.log("Chunk:", chunk);

      res.write(
        `event: chunk\ndata: ${JSON.stringify(chunk)}\n\n`
      );
    }

    clearTimeout(timeout);

    const duration = Date.now() - startTime;

    console.log(`[${requestId}] Completed ${duration}ms`);

    res.write(
      `event: done\ndata: ${JSON.stringify({
        success: true,
        duration,
        requestId,
        result: finalChunk,
      })}\n\n`
    );

    res.end();
  } catch (error) {
    clearTimeout(timeout);

    const duration = Date.now() - startTime;

    console.error("\n======================================");
    console.error(`[${requestId}] FAILED`);
    console.error("Duration:", duration, "ms");
    console.error(error);
    console.error("======================================\n");

    if (!res.writableEnded) {
      res.write(
        `event: error\ndata: ${JSON.stringify({
          success: false,
          duration,
          error: error.message,
        })}\n\n`
      );

      res.end();
    }
  }
});

agentRouter.get("/healthz", (_, res) => {
  res.status(200).json({
    status: "ok",
    service: "ai-orchestration",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default agentRouter;