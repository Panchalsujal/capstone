import "dotenv/config";
import { ChatMistralAI } from "@langchain/mistralai";
import { createAgent } from "langchain";
import { listfiles, updateFiles, readfile } from "./tools.js";

const model = new ChatMistralAI({
  model: "mistral-medium-latest",
  temperature: 0.7,
  apiKey: process.env.MISTRALAI_API_KEY,
});

const agent = createAgent({
  model,
  tools: [listfiles, readfile, updateFiles],
});

agent.invoke({
  messages: [
    {
      role: "user",
      content: "create a snake game",
    },
  ],
});
