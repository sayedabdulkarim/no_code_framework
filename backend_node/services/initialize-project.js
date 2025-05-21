const express = require("express");
const { exec } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const router = express.Router();

router.post("/initialize-project", async (req, res) => {
  const { prd } = req.body;

  if (!prd || typeof prd !== "string") {
    return res.status(400).json({ error: "PRD is required as a string" });
  }

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
    // const command = `npx create-next-app@latest ${projectName} --tailwind --eslint --app --src-dir --import-alias "@/" --yes`;
    const command = `npx create-next-app@latest ${projectName} --tailwind --eslint --app --src-dir --import-alias "@/" --ts --yes`;

    console.log("Running command:", command);

    const { stdout, stderr } = await execShell(command, { cwd: baseDir });
    console.log("Command output:", stdout);
    console.error("Command errors:", stderr);

    // Save the PRD as markdown file in the project directory
    const prdPath = path.join(projectPath, "PRD.md");
    await fs.writeFile(prdPath, prd, "utf-8");
    console.log("Saved PRD to:", prdPath); // received this once the boiler plate is completed

    return res.json({
      projectName,
      projectPath,
      message: "Project initialized successfully",
      stdout,
    });
  } catch (err) {
    console.error("Error initializing project:", err);
    return res.status(500).json({
      error: "Failed to initialize project",
      details: err.message,
    });
  }
});
// helper for async exec
function execShell(cmd, opts) {
  return new Promise((resolve, reject) => {
    exec(cmd, opts, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

module.exports = router;
