import "dotenv/config";
import { ChatMistralAI } from "@langchain/mistralai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { createTools } from "./tools.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";

const API_KEY = process.env.MISTRALAI_API_KEY;

if (!API_KEY) {
  throw new Error("MISTRALAI_API_KEY is missing");
}

const MODEL_NAME =
  process.env.MISTRAL_MODEL || "mistral-medium-latest";

console.log("======================================");
console.log("[AI] Loading Model");
console.log("Model:", MODEL_NAME);
console.log("======================================");

/**
 * Shared LLM instance
 */
const model = new ChatMistralAI({
  apiKey: API_KEY,
  model: MODEL_NAME,

  temperature: 0.2,

  // Retry transient failures
  maxRetries: 2,

  // Match Express timeout
  timeout: 60000,
});

/**
 * Create an agent bound to a sandbox.
 *
 * @param {string} sandboxId
 * @returns {ReturnType<typeof createReactAgent>}
 */
export function createAgentForSandbox(sandboxId) {
  if (!sandboxId) {
    throw new Error("sandboxId is required");
  }

  console.log("\n======================================");
  console.log("[Agent] Initializing");
  console.log("Sandbox:", sandboxId);

  let tools;

  try {
    tools = createTools(sandboxId);
  } catch (err) {
    console.error("[Agent] Failed to create tools");
    console.error(err);
    throw err;
  }

  console.log(
    "[Agent] Tools:",
    tools.map((tool) => tool.name).join(", ")
  );

  try {
    const agent = createReactAgent({
      llm: model,
      tools,
      prompt: SYSTEM_PROMPT,
    });

    console.log("[Agent] Ready");
    console.log("======================================\n");

    return agent;
  } catch (err) {
    console.error("[Agent] Creation failed");
    console.error(err);
    throw err;
  }
}