import axios from "axios";
import { tool } from "langchain";
import * as z from "zod";

/**
 * List Files Tool
 */
export const listfiles = tool(
  async () => {
    const response = await axios.get(
      "http://019f4654-48b9-75dc-9896-c218809e7552.agent.localhost/list-files",
    );
    console.log("==================================");
    console.log("Using list files tool", response.data.files);
    console.log("==================================");
    return JSON.stringify(response.data.files);
  },
  {
    name: "list_files",
    description:
      "List all files in the project directory. Useful for understanding what files are available to work with.",
  },
);

/**
 * Read Files Tool
 */
export const readfile = tool(
  async ({ files }) => {
    console.log("==================================");
    console.log("Using read file tool");
    console.log("Files:", files);
    console.log("==================================");

    const response = await axios.get(
      `http://019f4654-48b9-75dc-9896-c218809e7552.agent.localhost/read-files?files=${encodeURIComponent(
        files.join(","),
      )}`,
    );

    return JSON.stringify(response.data.files);
  },
  {
    name: "read_file",
    description:
      "Read the contents of one or more files. The files should exist in the project directory.",
    schema: z.object({
      files: z
        .array(z.string())
        .describe(
          "List of absolute file paths to read. These should be returned by the list_files tool or created later.",
        ),
    }),
  },
);

/**
 * Update/Create Files Tool
 */
export const updateFiles = tool(
  async ({ files }) => {
    console.log("==================================");
    console.log("Using update files tool");
    console.log(files);
    console.log("==================================");

    const response = await axios.patch(
      "http://019f4654-48b9-75dc-9896-c218809e7552.agent.localhost/update-files",
      {
        updates: files,
      },
    );

    console.log("==================================");
    console.log("Update response:");
    console.log(response.data);
    console.log("==================================");

    return JSON.stringify(response.data.results);
  },
  {
    name: "update_files",
    description:
      "Update existing files or create new files by providing the file path and content.",
    schema: z.object({
      files: z
        .array(
          z.object({
            file: z
              .string()
              .describe("Absolute path of the file to update or create."),
            content: z.string().describe("New content for the file."),
          }),
        )
        .describe("List of files and their contents."),
    }),
  },
);
