import express from "express";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

app.use(morgan("dev"));

/**
 * -------------------------
 * Health Check
 * -------------------------
 */
app.get("/api/status/healthz", (req, res) => {
  res.json({
    status: "ok",
  });
});

/**
 * -------------------------
 * Readiness Check
 * -------------------------
 */
app.get("/api/status/readyz", (req, res) => {
  res.json({
    status: "ready",
  });
});

/**
 * -----------------------------------
 * Proxy Cache
 * -----------------------------------
 *
 * Key Example:
 * abc-default
 * abc-3000
 */
const proxyCache = new Map();

/**
 * Returns cached proxy instance.
 */
function getProxy(sandboxId, port = null) {
  const cacheKey = `${sandboxId}-${port || "default"}`;

  if (proxyCache.has(cacheKey)) {
    return proxyCache.get(cacheKey);
  }

  const target = port
    ? `http://sandbox-svc-${sandboxId}:${port}`
    : `http://sandbox-svc-${sandboxId}`;

  console.log(`Creating Proxy -> ${target}`);

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,

    on: {
      proxyReq(proxyReq, req) {
        console.log(
          `[${req.method}] ${req.headers.host}${req.originalUrl} -> ${target}`
        );
      },

      error(err, req, res) {
        console.error(`Proxy Error (${cacheKey})`, err.message);

        proxyCache.delete(cacheKey);

        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            message: "Sandbox unavailable",
          });
        }
      },
    },
  });

  proxyCache.set(cacheKey, proxy);

  return proxy;
}

/**
 * -----------------------------------
 * Dynamic Sandbox Router
 * -----------------------------------
 *
 * abc.preview.localhost
 *        │
 *        ▼
 * sandbox-svc-abc
 *
 *
 * abc.agent.localhost
 *        │
 *        ▼
 * sandbox-svc-abc:3000
 *
 */

app.use((req, res, next) => {
  const host = req.headers.host;

  if (!host) {
    return res.status(400).json({
      success: false,
      message: "Host header missing",
    });
  }

  // Remove :80 / :3000 if present
  const hostname = host.split(":")[0];

  const parts = hostname.split(".");

  if (parts.length < 3) {
    return res.status(404).json({
      success: false,
      message: "Invalid hostname",
    });
  }

  const sandboxId = parts[0];
  const service = parts[1];

  switch (service) {
    case "preview":
      console.log(
        `Preview Request : ${hostname} -> sandbox-svc-${sandboxId}`
      );

      return getProxy(sandboxId)(req, res, next);

    case "agent":
      console.log(
        `Agent Request : ${hostname} -> sandbox-svc-${sandboxId}:3000`
      );

      return getProxy(sandboxId, 3000)(req, res, next);

    default:
      return res.status(404).json({
        success: false,
        message: "Unknown service",
      });
  }
});

export default app;