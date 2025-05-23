const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

let io;
const router = express.Router();

// Export a function that accepts io as a parameter
module.exports = (socketIo) => {
  io = socketIo;

  router.post("/initialize-project", async (req, res) => {
    const { prd, socketId } = req.body;

    if (!prd || typeof prd !== "string") {
      return res.status(400).json({ error: "PRD is required as a string" });
    }

    // Check if socketId was provided
    const socket = socketId ? io.sockets.sockets.get(socketId) : null;

    try {
      console.log("Received PRD:", prd);

      // Generate a unique project name
      const projectName = `project-${randomUUID().slice(0, 8)}`;
      console.log("Generated project name:", projectName);

      const baseDir = path.join(__dirname, "../../client/user-projects");
      console.log("Base directory:", baseDir);

      const projectPath = path.join(baseDir, projectName);
      console.log("Project path:", projectPath);

      // Ensure user-projects folder exists
      await fs.mkdir(baseDir, { recursive: true });
      console.log("Ensured user-projects directory exists");

      // Run create-next-app command
      const commandString = `npx create-next-app@latest ${projectName} --tailwind --eslint --app --src-dir --ts --yes`;
      console.log("Running command:", commandString);

      // Emit initial message to the terminal
      if (socket) {
        socket.emit(
          "output",
          `\n> Starting project initialization...\n> ${commandString}\n\n`
        );
      }

      // Use spawn to capture real-time output
      const childProcess = spawn(
        "npx",
        [
          "create-next-app@latest",
          projectName,
          "--tailwind",
          "--eslint",
          "--app",
          "--src-dir",
          "--ts",
          "--yes",
        ],
        {
          cwd: baseDir,
          shell: true,
        }
      );

      // Stream stdout to the client terminal
      childProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log("Command output:", output);
        if (socket) {
          socket.emit("output", output);
        }
      });

      // Stream stderr to the client terminal
      childProcess.stderr.on("data", (data) => {
        const output = data.toString();
        console.error("Command error:", output);
        if (socket) {
          socket.emit("output", output);
        }
      });

      // Wait for the command to complete
      const exitCode = await new Promise((resolve) => {
        childProcess.on("close", (code) => {
          if (socket) {
            socket.emit("output", `\n> Process exited with code ${code}\n`);
          }
          resolve(code);
        });
      });

      if (exitCode !== 0) {
        throw new Error(`Command failed with exit code ${exitCode}`);
      }

      // Save the PRD as markdown file in the project directory
      const prdPath = path.join(projectPath, "PRD.md");
      await fs.writeFile(prdPath, prd, "utf-8");
      console.log("Saved PRD to:", prdPath);

      if (socket) {
        socket.emit(
          "output",
          `\n> Saved PRD to: ${prdPath}\n> Project initialization completed successfully!\n`
        );
      }

      return res.json({
        projectName,
        projectPath,
        message: "Project initialized successfully",
      });
    } catch (err) {
      console.error("Error initializing project:", err);

      // Send error to terminal
      if (socket) {
        socket.emit("output", `\n> ERROR: ${err.message}\n`);
      }

      return res.status(500).json({
        error: "Failed to initialize project",
        details: err.message,
      });
    }
  });

  return router;
};
