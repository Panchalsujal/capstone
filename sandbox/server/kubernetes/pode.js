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

      // Init-container: seeds the shared volume with the template project files.
      // node_modules is excluded — it is already baked into the image and would
      // add ~100 MB of file copies on every pod creation if included.
      initContainers: [
        {
          name: "init-container",
          image: "template",
          imagePullPolicy: "IfNotPresent",
          // Copies the full workspace including node_modules into the shared volume.
          // node_modules MUST be included because the sandbox-container mounts this
          // volume at /workspace, which shadows the image's own /workspace/node_modules.
          // Without node_modules in the volume, `vite` is not found (exit 127).
          command: [
            "sh",
            "-c",
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
          // Fix: readinessProbe ensures Kubernetes waits until Vite is actually
          // listening before marking this container ready. Without this, the pod
          // is marked ready immediately on process start, causing 502 errors.
          readinessProbe: {
            httpGet: {
              path: "/",
              port: 5173,
            },
            initialDelaySeconds: 5,
            periodSeconds: 3,
            failureThreshold: 10,
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
          // Fix: readinessProbe ensures Kubernetes waits until the agent HTTP
          // server is actually listening before marking this container ready.
          // Without this, the pod URL is returned before Socket.IO is ready.
          readinessProbe: {
            httpGet: {
              path: "/",
              port: 3000,
            },
            initialDelaySeconds: 3,
            periodSeconds: 3,
            failureThreshold: 10,
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
