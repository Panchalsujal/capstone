import { k8sCoreV1Api } from "./config.js";

export async function createPode(sandboxId) {
  const podManifest = {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: `sandbox-pod-${sandboxId}`,
      labels: {
        app: "sandbox",
        sandboxId: sandboxId,
      },
    },
    spec: {
      volumes: [
        {
          name: "workspace-volume",
          emptyDir: {},
        },
      ],

      // Init-container: seeds the shared emptyDir volume with only the template source files.
      // node_modules are intentionally excluded — they live at /app/node_modules inside the
      // template image layer and are symlinked from /workspace/node_modules, so they are
      // accessible without any copying. Excluding them drops init time from ~60s to <1s.
      initContainers: [
        {
          name: "init-container",
          image: "template:latest",
          imagePullPolicy: "IfNotPresent",
          // Copies only source files — deliberately excludes node_modules.
          // node_modules live at /app/node_modules inside the template image and
          // are symlinked to /workspace/node_modules. Copying them would be
          // 100-300 MB of data, making sandbox start very slow.
          command: [
            "sh",
            "-c",
            "find /workspace -mindepth 1 -maxdepth 1 ! -name node_modules -exec cp -r {} /seed/ \\;",
          ],
          volumeMounts: [
            {
              name: "workspace-volume",
              mountPath: "/seed",
            },
          ],
        },
      ],

      containers: [
        {
          // Serves the Vite dev server (preview)
          name: "sandbox-container",
          image: "template:latest",
          imagePullPolicy: "IfNotPresent",
          ports: [
            {
              containerPort: 5173,
              name: "http",
            },
          ],
          resources: {
            requests: { cpu: "100m", memory: "256Mi" },
            limits: { cpu: "500m", memory: "512Mi" },
          },
          // NODE_PATH tells Node/Vite where to find node_modules when they live
          // outside the workspace volume (at /app/node_modules in the image layer).
          env: [
            {
              name: "NODE_PATH",
              value: "/app/node_modules",
            },
          ],
          // startupProbe gives Vite up to 120 s (60 × 2 s) to boot on first start.
          // Vite cold-starts (no pre-built cache) can take 60-90 s on a fresh emptyDir
          // workspace — 30×2s was not enough. 60×2s=120s covers even slow nodes.
          // Once it succeeds once, Kubernetes switches to the faster readinessProbe.
          startupProbe: {
            httpGet: {
              path: "/",
              port: 5173,
            },
            initialDelaySeconds: 5,
            failureThreshold: 120,
            periodSeconds: 1,
          },
          // Once startupProbe passes, readinessProbe takes over with a tight poll.
          // failureThreshold: 15 × 2s = 30s grace before marking unready.
          readinessProbe: {
            httpGet: {
              path: "/",
              port: 5173,
            },
            initialDelaySeconds: 1,
            periodSeconds: 1,
            failureThreshold: 30,
          },
          volumeMounts: [
            {
              name: "workspace-volume",
              mountPath: "/workspace",
            },
          ],
        },

        {
          // Agent sidecar: exposes file-read/write API + Socket.IO on port 3000
          name: "agent-container",
          image: "agent",
          imagePullPolicy: "IfNotPresent",
          ports: [
            {
              containerPort: 3000,
              name: "http-agent",
            },
          ],
          resources: {
            requests: { cpu: "100m", memory: "256Mi" },
            limits: { cpu: "500m", memory: "512Mi" },
          },
          // node-pty spawns a shell on startup; give it 5 s before first probe.
          // failureThreshold: 15 × 2s = 30s grace window.
          readinessProbe: {
            httpGet: {
              path: "/",
              port: 3000,
            },
            initialDelaySeconds: 3,
            periodSeconds: 1,
            failureThreshold: 30,
          },
          volumeMounts: [
            {
              name: "workspace-volume",
              mountPath: "/workspace",
            },
          ],
        },
      ],
    },
  };

  const response = await k8sCoreV1Api.createNamespacedPod({
    namespace: "default",
    body: podManifest,
  });

  return response;
}

export async function deletePod(sandboxId) {
  const responce = await k8sCoreV1Api.deleteNamespacedPod({
    namespace: "default",
    name: `sandbox-pod-${sandboxId}`,
  });

  responce;
}

