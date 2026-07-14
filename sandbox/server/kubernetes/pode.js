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

      // Init-container: seeds the shared emptyDir volume with the template project files.
      // Uses cp -a to recursively copy all files (source + node_modules) from the image
      // into the shared volume that both sandbox-container and agent-container mount.
      initContainers: [
        {
          name: "init-container",
          image: "template",
          imagePullPolicy: "IfNotPresent",
          command: [
            "sh",
            "-c",
            // Copy all workspace files (including node_modules) into the shared emptyDir volume.
            // NOTE: cp -al (hard-links) does NOT work here — emptyDir is a separate filesystem
            // mount from the image layer, so hard-links always fail with "Invalid cross-device link".
            // cp -a does a proper recursive copy and correctly handles the cross-device boundary.
            "cp -a /workspace/. /seed/",
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
          image: "template",
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
          // startupProbe gives Vite up to 120 s (60 × 2 s) to boot on first start.
          // Vite cold-starts (no pre-built cache) can take 60-90 s on a fresh emptyDir
          // workspace — 30×2s was not enough. 60×2s=120s covers even slow nodes.
          // Once it succeeds once, Kubernetes switches to the faster readinessProbe.
          startupProbe: {
            httpGet: {
              path: "/",
              port: 5173,
            },
            failureThreshold: 60,
            periodSeconds: 2,
          },
          // Once startupProbe passes, readinessProbe takes over with a tight poll.
          // failureThreshold: 15 × 2s = 30s grace before marking unready.
          readinessProbe: {
            httpGet: {
              path: "/",
              port: 5173,
            },
            initialDelaySeconds: 2,
            periodSeconds: 2,
            failureThreshold: 15,
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
            initialDelaySeconds: 5,
            periodSeconds: 2,
            failureThreshold: 15,
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
