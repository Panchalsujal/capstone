import express from "express";
import { randomUUID } from "crypto";
import { createAgentForSandbox } from "../agents/code.agents.js";

const agentRouter = express.Router();

const AGENT_TIMEOUT = 60000; // 60 seconds


agentRouter.post("/invoke", async (req, res) => {
  const { message, sandboxId } = req.body;

  const requestId = randomUUID();

  if (!message || !sandboxId) {
    return res.status(400).json({
      error: "message and sandboxId are required",
    });
  }


  console.log("\n======================================");
  console.log(`[${requestId}] AI REQUEST`);
  console.log("Sandbox:", sandboxId);
  console.log("Message:", message);
  console.log("======================================");


  const startTime = Date.now();

  let timeout;

  try {

    /**
     * Create agent timeout protection
     */
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        const error = new Error(
          "Agent execution timeout"
        );

        error.name = "TimeoutError";

        reject(error);

      }, AGENT_TIMEOUT);
    });


    console.log(`[${requestId}] Creating agent`);

    const agent = createAgentForSandbox(
      sandboxId
    );


    console.log(`[${requestId}] Agent created`);


    const invokePromise = agent.invoke(
      {
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
      },
      {
        recursionLimit:
          Number(process.env.RECURSION_LIMIT) || 15,

        configurable: {
          thread_id: requestId,
        },
      }
    );


    console.log(
      `[${requestId}] Running agent`
    );


    const result = await Promise.race([
      invokePromise,
      timeoutPromise,
    ]);


    clearTimeout(timeout);


    const duration =
      Date.now() - startTime;


    console.log(
      `[${requestId}] Completed ${duration}ms`
    );


    if (!result?.messages?.length) {

      return res.status(500).json({
        error:
          "Agent returned empty response",
      });

    }


    const lastMessage =
      result.messages[
        result.messages.length - 1
      ];


    let responseText = "";


    if (
      typeof lastMessage.content === "string"
    ) {

      responseText =
        lastMessage.content;

    } else if (
      Array.isArray(lastMessage.content)
    ) {

      responseText =
        lastMessage.content
          .map(item =>
            typeof item === "string"
              ? item
              : item.text || ""
          )
          .join("");

    } else {

      responseText =
        JSON.stringify(
          lastMessage.content
        );

    }


    console.log(
      `[${requestId}] RESPONSE`
    );

    console.log(responseText);


    return res.status(200).json({
      success: true,
      requestId,
      duration,
      result: responseText,
    });


  } catch(error) {

    clearTimeout(timeout);


    const duration =
      Date.now() - startTime;


    console.error("\n======================================");
    console.error(
      `[${requestId}] FAILED`
    );

    console.error(
      "Duration:",
      duration,
      "ms"
    );

    console.error(error);

    console.error(
      "======================================\n"
    );


    if(error.name === "TimeoutError") {

      return res.status(504).json({
        success:false,
        error:
          "AI agent timeout. Try a smaller request.",
        duration,
      });

    }


    return res.status(500).json({
      success:false,
      error:
        error.message ||
        "Agent invocation failed",
      duration,
    });

  }
});



agentRouter.get(
  "/healthz",
  (_, res) => {

    res.status(200).json({
      status:"ok",
      service:"ai-orchestration",
      uptime:
        process.uptime(),
      timestamp:
        new Date().toISOString(),
    });

  }
);


export default agentRouter;