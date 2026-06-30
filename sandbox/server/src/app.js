import express from "express";
import morgan from "morgan";
import { createService } from "./../kubernetes/service.js";
import { createPode } from "./../kubernetes/pode.js";
import { v7 as uuid } from "uuid";
const app = express();
app.use(morgan("dev"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/api/sandbox/health", (req, res) => {
  res.status(200).json({
    messsage: "Sandbox Api is healthy",
    status: "ok",
  });
});
app.post("/api/sandbox/start", async(req, res) => {
  try {
    const sandboxId = uuid()

    await Promise.all([
      createPode(sandboxId),
      createService(sandboxId)
    ])

    return res.status(201).json({
      messsage: "Sandbox environment created successfully",
      sandboxId,
      previwUrl: `http://${sandboxId}.preview.localhost`,
      success: true,
    })
  } catch (err) {
    console.error("Failed to start sandbox:", err?.body || err?.message || err);
    return res.status(500).json({
      message: "Failed to create sandbox environment",
      error: err?.body?.message || err?.message || "Unknown error",
      success: false,
    });
  }
});
export default app;
