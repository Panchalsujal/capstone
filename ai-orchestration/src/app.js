import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import agentRouter from "./routes/agent.routes.js";

const app = express();
app.use(express.json());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use("/api/ai", agentRouter);


app.get("/api/status/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});
app.get("/api/ai/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
