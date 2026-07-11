import "dotenv/config"; // loads .env from the project root
import { ChatMistralAI } from "@langchain/mistralai";
import { createReactAgent } from "@langchain/langgraph/prebuilt"; // Fix: correct function & package
import { createTools } from "./tools.js";
import {SYSTEM_PROMPT} from "./systemPrompt.js";

// Shared model instance (stateless — safe to reuse across requests)
const model = new ChatMistralAI({
  model: "mistral-medium-latest",
  temperature: 0.2,
  apiKey: process.env.MISTRALAI_API_KEY,
   
});
/**
 * Returns a LangGraph ReAct agent bound to a specific sandbox.
 * Tools are created per-request so they target the right sandbox URL.
 *
 * @param {string} sandboxId - UUID of the sandbox (from /api/sandbox/start)
 */
  export function createAgentForSandbox(sandboxId) {
    const tools = createTools(sandboxId);
    return createReactAgent({ llm: model, tools,prompt:SYSTEM_PROMPT });
  }