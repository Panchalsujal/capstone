import express from "express";
import morgan from "morgan";
import fs from "fs";
const app = express();
const WORKING_DIR = "/workspace";
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Hello",
    status: "Success",
  });
});

app.get("/list-files", async (req, res) => {
  const elements = await fs.promises.readdir(WORKING_DIR);

  res.status(200).json({
    message: "Elements in working Directory",
    elements,
  });
});

export default app;
