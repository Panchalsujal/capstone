import axios from "axios";
import { tool } from "langchain";
import * as z from "zod";

export function createTools(sandboxId) {
  const base = `http://sandbox-svc-${sandboxId}:3000`;

  /**
   * List Files
   */
  const listfiles = tool(
    async () => {
      console.log("\n==============================");
      console.log("[Agent] -> list_files");
      console.log("GET", `${base}/list-files`);

      const response = await axios.get(`${base}/list-files`);

      console.log("[Sandbox] <- list_files response");
      console.log(response.data);
      console.log("==============================\n");

      return JSON.stringify(response.data.files);
    },
    {
      name: "list_files",
      description: "List all project files.",
    }
  );

  /**
   * Read Files
   */
  const readfile = tool(
    async ({ files }) => {
      console.log("\n==============================");
      console.log("[Agent] -> read_file");
      console.log("Files:", files);

      const query = encodeURIComponent(files.join(","));

      console.log("GET", `${base}/read-files?files=${query}`);

      const response = await axios.get(`${base}/read-files?files=${query}`);

      console.log("[Sandbox] <- read_file response");
      console.log(response.data);
      console.log("==============================\n");

      return JSON.stringify(response.data.files);
    },
    {
      name: "read_file",
      description: "Read one or more files.",
      schema: z.object({
        files: z.array(z.string()),
      }),
    }
  );

  /**
   * Create Files
   */
  const createFiles = tool(
    async ({ files }) => {
      console.log("\n==============================");
      console.log("[Agent] -> create_files");
      console.log("Files to create:");
      console.dir(files, { depth: null });

      console.log("POST", `${base}/create-files`);

      const response = await axios.post(`${base}/create-files`, {
        files,
      });

      console.log("[Sandbox] <- create_files response");
      console.log(response.data);
      console.log("==============================\n");

      return JSON.stringify(response.data);
    },
    {
      name: "create_files",
      description:
        "Create new files only. Do not use this to modify existing files.",
      schema: z.object({
        files: z.array(
          z.object({
            file: z.string().describe("Relative file path."),
            content: z.string().describe("Initial file content."),
          })
        ),
      }),
    }
  );

  /**
   * Update Files
   */
  const updateFiles = tool(
    async ({ files }) => {
      console.log("\n==============================");
      console.log("[Agent] -> update_files");
      console.log("Files to update:");
      console.dir(files, { depth: null });

      console.log("PATCH", `${base}/update-files`);

      const response = await axios.patch(`${base}/update-files`, {
        updates: files,
      });

      console.log("[Sandbox] <- update_files response");
      console.log(response.data);
      console.log("==============================\n");

      return JSON.stringify(response.data.results);
    },
    {
      name: "update_files",
      description:
        "Update existing files only. Do not create new files.",
      schema: z.object({
        files: z.array(
          z.object({
            file: z.string().describe("Relative file path."),
            content: z.string().describe("Updated file content."),
          })
        ),
      }),
    }
  );

  return [listfiles, readfile, createFiles, updateFiles];
} 