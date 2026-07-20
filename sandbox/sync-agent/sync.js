import "dotenv/config";
import chokidar from "chokidar";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import http from "http";
import { config } from "./config/config.js";

// ─── S3 client (credentials always available from env/secret) ────────────────

const s3Client = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

const bucketName = config.BUCKET_NAME;
const localDirectory = "/workspace";

// ─── S3 helpers ──────────────────────────────────────────────────────────────

async function checkS3ForFiles(projectId) {
  console.log(`Checking S3 for existing files in project: ${projectId}`);
  const listCommand = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: `${projectId}/`,
  });
  const listResponse = await s3Client.send(listCommand);
  return listResponse.Contents || [];
}

async function downloadFilesFromS3(s3Objects, projectId) {
  console.log("Found existing files in S3. Syncing to local directory...");
  for (const file of s3Objects) {
    // Skip if it is a directory placeholder
    if (file.Key.endsWith("/")) continue;

    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: file.Key,
    });
    const getResponse = await s3Client.send(getCommand);

    const relativePath = file.Key.replace(`${projectId}/`, "");
    const localFilePath = path.join(localDirectory, relativePath);

    // Ensure the local directory structure exists
    fs.mkdirSync(path.dirname(localFilePath), { recursive: true });

    const writeStream = fs.createWriteStream(localFilePath);
    getResponse.Body.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    console.log(`Downloaded ${file.Key} to ${localFilePath}`);
  }
}

async function uploadFileToS3(filePath, projectId) {
  try {
    const fileContent = fs.readFileSync(filePath);
    const relativePath = path.relative(localDirectory, filePath);

    if (filePath.includes("node_modules") || filePath.includes(".env")) {
      return; // Skip syncing node_modules and .env files
    }

    console.log(filePath);
    // Files will have the prefix of projectId
    const s3Key = `${projectId}/${relativePath}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
    });

    await s3Client.send(command);
    console.log(
      `Successfully synced ${filePath} to s3://${bucketName}/${s3Key}`,
    );
  } catch (err) {
    console.error(`Error syncing ${filePath} to S3:`, err);
  }
}

function startWatcher(hasFiles, projectId) {
  console.log("Starting chokidar watch...");
  chokidar
    .watch(localDirectory, {
      ignored: [
        /(^|[\/\\])\./, // ignore dotfiles
        /node_modules/, // ignore node_modules completely
        /\.env/, // ignore .env files
      ],
      persistent: true,
      ignoreInitial: hasFiles, // if S3 is empty (hasFiles is false), upload all existing local files
    })
    .on("all", async (event, filePath) => {
      if (event === "add" || event === "change") {
        if (filePath.includes("node_modules") || filePath.includes(".env")) {
          return; // Skip syncing node_modules and .env files
        }
        await uploadFileToS3(filePath, projectId);
      }
    });
}

// ─── Core sync logic ─────────────────────────────────────────────────────────

let activated = false;

async function activate(projectId) {
  if (activated) {
    console.warn(`[sync-agent] Already activated — ignoring duplicate activate call`);
    return;
  }
  activated = true;
  console.log(`[sync-agent] Activating with projectId: ${projectId}`);

  try {
    const s3Objects = await checkS3ForFiles(projectId);
    const hasFiles = s3Objects.length > 0;

    if (hasFiles) {
      await downloadFilesFromS3(s3Objects, projectId);
    } else {
      console.log(
        "No files found in S3. Local files will be synced to S3 automatically.",
      );
    }

    startWatcher(hasFiles, projectId);
  } catch (error) {
    console.error("Error during activation:", error);
    process.exit(1);
  }
}

// ─── HTTP server (always starts — for /activate and /health) ─────────────────

const PORT = 4000;

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", activated }));
    return;
  }

  if (req.method === "POST" && req.url === "/activate") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { projectId } = JSON.parse(body);
        if (!projectId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "projectId is required" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        // Activate asynchronously after responding so caller doesn't wait
        await activate(projectId);
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[sync-agent] HTTP server listening on port ${PORT}`);
});

// ─── Auto-activate if PROJECT_ID is already set (on-demand pod path) ─────────

const envProjectId = process.env.PROJECT_ID;
if (envProjectId) {
  console.log(`[sync-agent] PROJECT_ID found in env — auto-activating`);
  activate(envProjectId);
} else {
  console.log(`[sync-agent] No PROJECT_ID in env — waiting for POST /activate`);
}
