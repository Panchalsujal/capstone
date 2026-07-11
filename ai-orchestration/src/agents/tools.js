import axios from "axios";
import { tool } from "@langchain/core/tools"; // Fix: correct package for `tool` helper
import * as z from "zod";

/**
 * Factory — returns the three tools wired to a specific sandbox instance.
 * sandboxId is the UUID created by /api/sandbox/start, e.g. "019f4af4-..."
 */
export function createTools(sandboxId) {
  // Base URL for the in-cluster agent sidecar of this sandbox
  const base = `http://sandbox-svc-${sandboxId}:3000`;

  /** List all project files (excludes node_modules, .git, dist) */
  const listfiles = tool(
    async () => {
      const response = await axios.get(`${base}/list-files`);
      console.log("list_files →", response.data.files);
      return JSON.stringify(response.data.files);
    },
    {
      name: "list_files",
      description:
        "List all files in the project directory. Use this first to understand what files exist.",
    },
  );

  /** Read the contents of one or more files */
  const readfile = tool(
    async ({ files }) => {
      console.log("read_file →", files);
      const query = encodeURIComponent(files.join(","));
      const response = await axios.get(`${base}/read-files?files=${query}`);
      return JSON.stringify(response.data.files);
    },
    {
      name: "read_file",
      description:
        "Read the contents of one or more files. Paths must be relative (as returned by list_files).",
      schema: z.object({
        files: z
          .array(z.string())
          .describe("List of relative file paths to read."),
      }),
    },
  );

  /** Update or create files with new content */
  const updateFiles = tool(
    async ({ files }) => {
      console.log("update_files →", files);
      const response = await axios.patch(`${base}/update-files`, {
        updates: files,
      });
      console.log("update_files result:", response.data);
      return JSON.stringify(response.data.results);
    },
    {
      name: "update_files",
      description:
        "Update existing files or create new files. Provide the relative path and new content.",
      schema: z.object({
        files: z.array(
          z.object({
            file: z.string().describe("Relative path of the file to update or create."),
            content: z.string().describe("New content for the file."),
          }),
        ),
      }),
    },
  );

  return [listfiles, readfile, updateFiles];
}
