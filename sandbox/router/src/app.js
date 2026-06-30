import express from "express";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

app.use(morgan("dev"));

/**
 * Cache of proxy instances keyed by sandboxId.
 * createProxyMiddleware must be initialized once per target,
 * not called as a factory on every request (causes 504 timeouts).
 */
const proxyCache = new Map();

function getProxy(sandboxId) {
  if (proxyCache.has(sandboxId)) {
    return proxyCache.get(sandboxId);
  }

  const target = `http://sandbox-svc-${sandboxId}`;

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,

    on: {
      error(err, req, res) {
        console.error(`Proxy Error [${sandboxId}]:`, err.message);

        // Remove from cache so the next request gets a fresh proxy
        // instead of reusing this broken connection pool forever
        proxyCache.delete(sandboxId);

        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            message: "Sandbox service unavailable",
          });
        }
      },
    },
  });

  proxyCache.set(sandboxId, proxy);
  return proxy;
}

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

  console.log(`Proxying ${host} -> http://sandbox-svc-${sandboxId}`);

  return getProxy(sandboxId)(req, res, next);
});

export default app;