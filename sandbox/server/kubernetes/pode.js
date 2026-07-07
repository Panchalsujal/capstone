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

      initContainers: [
        {
          name: "init-container",
          image: "template",
          imagePullPolicy: "Always",
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
          name: "sandbox-container",
          image: "template",
          imagePullPolicy: "Always",

          ports: [
            {
              containerPort: 5173,
              name: "http",
            },
          ],

          resources: {
            requests: {
              cpu: "250m",
              memory: "500Mi",
            },
            limits: {
              cpu: "500m",
              memory: "1Gi",
            },
          },

          volumeMounts: [
            {
              name: "workspace-volume",
              mountPath: "/workspace",
            },
          ],
        },

        {
          name: "agent-container",
          image: "agent",
          imagePullPolicy: "IfNotPresent",

          ports: [
            {
              containerPort: 3000,
              name: "http",
            },
          ],

          resources: {
            requests: {
              cpu: "250m",
              memory: "500Mi",
            },
            limits: {
              cpu: "500m",
              memory: "1Gi",
            },
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
