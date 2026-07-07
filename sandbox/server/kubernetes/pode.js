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
      initContainers:[
        {
          name:"init-containers",
          image:"template",
          imagePullPolicy:"Always",
          command:["sh","-c","cp -r /workspace/.  /seed/"],
          volumesMounts:[
            {
              name:"workspace-volume",
              mountPath:"/seed"
            }
          ]
        }
      ],
      containers: [
        {
          image: "template",
          imagePullPolicy: "Always",
          name: "sandbox-container",
          ports: [
            {
              containerPort: 5173,
              name: "http",
            },
          ],
          resources: {
            limits: { cpu: "500m", memory: "1Gi" },
            requests: { cpu: "250m", memory: "500Mi" },
          },
          volumesMounts: [
            {
              name: "workspace-volume",
              mountPath: "/workspace",
            },
          ],
        },
        {
          image: "agent",
          imagePullPolicy: "IfNotPresent",
          name: "agent-container",
          ports: [{ containerPort: 3000, name: "http" }],
          resources: {
            limits: { cpu: "500m", memory: "1Gi" },
            requests: { cpu: "250m", memory: "500Mi" },
          },
          volumesMounts: [
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
