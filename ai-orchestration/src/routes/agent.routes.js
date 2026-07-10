import express from 'express'
import agent from "../agents/agent.js"
const agentRouter = express.Router()

agentRouter.post("/invoke   ", async (req, res) => {
  try {
    const { message } = req.body;
    const result = await agent.invokeAgent({ messages:[
      {
        role: "user",
        content: message,
      }
    ] });
    res.status(200).json({ result });
  } catch (error) {
    console.error("Error invoking agent:", error);
    res.status(500).json({ error: "Failed to invoke agent" });
  }
});

export default agentRouter

