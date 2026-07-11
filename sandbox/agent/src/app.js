import express from "express";
import morgan from "morgan";
import fs from "fs";
import path from "path";
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const WORKING_DIR = "/workspace";
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Hello",
    status: "Success",
  });
});

/**
 * @route GET /list-file
 * @desc list all files in the working directory and its subdirectories. Returns a JSON object with the list of files path relative to the working directory.exclude node_modules and .git
 * dist directories.
 * example {
 * "files": [
 * "file1.txt",
 * "file2.txt",
 * "subdir/file3.txt"
 * ]
 * }
 */
app.get("/list-files", async (req, res) => {
  const listFiles = async (dir, baseDir) => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // Exclude certain directories
      if (
        entry.isDirectory() &&
        ["node_modules", ".git", "dist"].includes(entry.name)
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        files.push(...(await listFiles(fullPath, baseDir)));
      } else {
        files.push(relativePath);
      }
    }

    return files;
  };

  try {
    const files = await listFiles(WORKING_DIR, WORKING_DIR);
    res.status(200).json({
      message: "Files listed successfully",
      files,
    });
  } catch (err) {
    res.status(500).json({
      message: `Error listing files: ${err.message}`,
      status: "error",
    });
  }
});

app.get("/read-files", async (req, res) => {
  const files = req.query.files;

  if (!files) {
    return res.status(400).json({
      message: "Please provide files to read",
      status: "Error",
    });
  }

  const filesList = files.split(",");

  const results = await Promise.all(
    filesList.map(async (file) => {
      // Fix: use path.join (consistent with update-files, avoids double-slash issues)
      const filePath = path.join(WORKING_DIR, file);
      try {
        const data = await fs.promises.readFile(filePath, "utf-8");
        return { [filePath]: data };
      } catch (err) {
        return { [filePath]: `Error reading file: ${err.message}` };
      }
    }),
  );

  res.status(200).json({
    message: "Files read successfully",
    files: results,
  });
});

/**
 * @route GET /update-Files
 * @description Update files the content of the files specified in the request body. The request body should be a JSON object with the file names as keys and the new content as values.
 */

app.patch("/update-files", async (req, res) => {
  const updates = req.body.updates;
  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({
      message:
        "Invalid request body.Expected an array of objects with 'file' and 'content' properties.",
      status: "Error",
    });
  }

  const results = await Promise.all(
    updates.map(async (update) => {
      const { file, content } = update;

      const filePath = path.join(WORKING_DIR, file);
      try {
        await fs.promises.writeFile(filePath, content, "utf-8");
        return {
          [filePath]: "File updated successfully",
        };
      } catch (err) {
        return {
          [filePath]: `Error updating file: ${err.message}`,
        };
      }
    }),
  );
  res.status(200).json({
    message: "Files updated successfully",
    results,
  });
});

/**
 * @route POST /create-file
 * @description Create a new file with the specified name and content. The request body should be a JSON object with 'file' and 'content' properties.
 */

app.post("/create-files", async (req, res) => {
    const files = req.body.files;

    if (!files || !Array.isArray(files)) {
        return res.status(400).json({
            message: 'Invalid request body. Expected a JSON object with a "files" property containing an array of file objects.',
            status: 'error',
        });
    }

    const results = await Promise.all(files.map(async (fileObj) => {
        const { file, content } = fileObj;
        const filePath = path.join(WORKING_DIR, file);
        try {

            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
            await fs.promises.writeFile(filePath, content, 'utf-8');
            return {
                [ filePath ]: 'File created successfully',
            }
        } catch (err) {
            return {
                [ filePath ]: `Error creating file: ${err.message}`,
            }
        }
    }));

    res.status(200).json({
        message: 'File creation results',
        results,
    });
})

export default app;
