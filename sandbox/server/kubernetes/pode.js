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

      // Init-container: seeds the shared volume with the template project files
      initContainers: [
        {
          name: "init-container",
          image: "template",
          imagePullPolicy: "IfNotPresent", // Fix: use local image without always pulling
          command: ["sh", "-c", "cp -r /workspace/. /seed/"],
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
          imagePullPolicy: "IfNotPresent", // Fix: don't force-pull local images
          ports: [
            {
              containerPort: 5173,
              name: "http", // port 80 of sandbox-svc → 5173 here
            },
          ],
          resources: {
            requests: { cpu: "250m", memory: "500Mi" },
            limits: { cpu: "500m", memory: "1Gi" },
          },
          volumeMounts: [
            {
              name: "workspace-volume",
              mountPath: "/workspace",
            },
          ],
        },

        {
          // Agent sidecar: exposes file-read/write API on port 3000
          name: "agent-container",
          image: "agent",
          imagePullPolicy: "IfNotPresent",
          ports: [
            {
              containerPort: 3000,
              name: "http-agent", // Fix: was "http" — duplicate name caused K8s rejection
            },
          ],
          resources: {
            requests: { cpu: "250m", memory: "500Mi" },
            limits: { cpu: "500m", memory: "1Gi" },
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
