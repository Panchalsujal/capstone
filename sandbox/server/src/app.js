import express from "express";
import morgan from "morgan";
import cookieParser from 'cookie-parser'
import router  from "./router/sandbox.router.js";

const app = express();
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser())
app.use("/api/sandbox",router)

export default app;
