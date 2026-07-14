import express from "express";
import http from "http";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const server = http.createServer(app);

app.use(morgan("dev"));

app.get("/api/status/healthz", (_, res) => {
  res.json({ status: "ok" });
});

app.get("/api/status/readyz", (_, res) => {
  res.json({ status: "ready" });
});

const proxyCache = new Map();

function getProxy(sandboxId, port) {
  const key = `${sandboxId}-${port}`;

  if (proxyCache.has(key)) {
    return proxyCache.get(key);
  }

  const target = `http://sandbox-svc-${sandboxId}:${port}`;

  console.log(`Creating proxy -> ${target}`);

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    // Note: do NOT set ws: true here — it conflicts with the manual
    // server.on("upgrade") handler below and causes double-handling

    on: {
      proxyReq(proxyReq, req) {
        console.log(
          `[HTTP] ${req.method} ${req.headers.host}${req.url} -> ${target}`
        );
      },

      proxyReqWs(proxyReq, req) {
        console.log(`[WS] ${req.headers.host}${req.url} -> ${target}`);
      },

      error(err, req, res) {
        console.error(err);

        proxyCache.delete(key);

        if (res && !res.headersSent) {
          res.status(502).json({
            success: false,
            message: err.message,
          });
        }
      },
    },
  });

  proxyCache.set(key, proxy);

  return proxy;
}

app.use((req, res, next) => {
  const host = req.headers.host;

  if (!host) {
    return res.status(400).send("Host header missing");
  }

  const hostname = host.split(":")[0];

  const parts = hostname.split(".");

  if (parts.length < 3) {
    return res.status(404).send("Invalid Host");
  }

  const sandboxId = parts[0];
  const service = parts[1];

  if (service === "preview") {
    return getProxy(sandboxId, 5173)(req, res, next);
  }

  if (service === "agent") {
    return getProxy(sandboxId, 3000)(req, res, next);
  }

  return res.status(404).send("Unknown service");
});

server.on("upgrade", (req, socket, head) => {
  const host = req.headers.host;

  if (!host) {
    socket.destroy();
    return;
  }

  const hostname = host.split(":")[0];

  const parts = hostname.split(".");

  if (parts.length < 3) {
    socket.destroy();
    return;
  }

  const sandboxId = parts[0];
  const service = parts[1];

  const port = service === "preview" ? 5173 : 3000;

  const proxy = getProxy(sandboxId, port);

  // HPM v4: proxy.upgrade is a valid method for manual WebSocket upgrade handling
  if (typeof proxy.upgrade === "function") {
    proxy.upgrade(req, socket, head);
  } else {
    console.error("[WS] proxy.upgrade is not a function — WebSocket upgrade failed");
    socket.destroy();
  }
});

export default server;