import express from "express";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

app.use(morgan("dev"));

/**
 * Health Check
 */
app.get("/api/status/healthz", (req, res) => {
  return res.status(200).json({
    status: "ok",
  });
});

/**
 * Readiness Check
 */
app.get("/api/status/readyz", (req, res) => {
  return res.status(200).json({
    status: "ready",
  });
});

/**
 * Dynamic Sandbox Router
 * Example:
 *   abc123.preview.localhost
 *   -> sandbox-svc-abc123
 */
app.use((req, res, next) => {
  const host = req.headers.host;

  if (!host) {
    return res.status(400).json({
      success: false,
      message: "Host header missing",
    });
  }

  const sandboxId = host.split(".")[0];

  // Ignore requests that are not sandbox subdomains
  if (
    sandboxId === "localhost" ||
    sandboxId === "preview" ||
    sandboxId === "www"
  ) {
    return res.status(404).json({
      success: false,
      message: "Invalid sandbox host",
    });
  }

  const target = `http://sandbox-svc-${sandboxId}`;

  console.log(`Proxying ${host} -> ${target}`);

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    logLevel: "debug",

    onError(err, req, res) {
      console.error("Proxy Error:", err.message);

      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          message: "Sandbox service unavailable",
        });
      }
    },
  })(req, res, next);
});

export default app;