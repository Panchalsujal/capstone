import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";

const app = express();
app.use(express.json());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));

app.get("/api/ai/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
