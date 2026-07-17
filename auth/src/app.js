import "dotenv/config";
import express from "express";
import morgam from "morgan";

const app = express();
app.use(express.json());

export default app;
