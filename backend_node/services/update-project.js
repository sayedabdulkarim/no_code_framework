const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const router = express.Router();

// POST /update-project
router.post("/update-project", async (req, res) => {
  const { projectName, requirements } = req.body;

  if (!projectName || !requirements) {
    return res
      .status(400)
      .json({ error: "projectName and requirements are required" });
  }

  const baseDir = path.join(__dirname, "../../client/user-projects");
  const projectPath = path.join(baseDir, projectName);
  const prdPath = path.join(projectPath, "PRD.md");

  try {
    const prd = await fs.readFile(prdPath, "utf-8");

    // Add this block:
    const isInitial = prd.trim() === requirements.trim();

    const prompt = isInitial
      ? `
You are an expert Next.js developer. Generate the FULL codebase for the following PRD using Next.js (with app directory) and Tailwind CSS.
Respond ONLY with a JSON object as described below. Do NOT include any explanation, markdown, or extra text.

Format:
{
  "files": [
    {
      "path": "relative/path/to/file",
      "content": "full code here",
      "action": "create"
    }
  ],
  "explanation": "brief explanation of the generated code"
}

PRD:
${prd}
`
      : `
You are an expert Next.js developer. Your task is to analyze the project requirements and generate code updates.

You will be provided with:
1. The original PRD
2. Current project structure
3. New requirements

Generate code updates that:
- Maintain consistency with the existing codebase
- Follow Next.js best practices
- Implement the new requirements
- Use Tailwind CSS for styling

Format your response as a JSON object with the following structure:
{
  "files": [
    {
      "path": "relative/path/to/file",
      "content": "full code here",
      "action": "create|update|delete"
    }
  ],
  "explanation": "brief explanation of changes"
}

Original PRD:
${prd}

New Requirements:
${requirements}
`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    const completion = response.data.choices?.[0]?.message?.content;
    if (!completion) {
      return res.status(500).json({ error: "Empty response from LLM" });
    }

    // const parsed = JSON.parse(
    //   completion.replace(/```(json)?/g, "").trim() // remove markdown
    // );

    let parsed;
    try {
      parsed = JSON.parse(completion.replace(/```(json)?/g, "").trim());
    } catch (err) {
      console.error("LLM did not return valid JSON:", completion);
      return res.status(500).json({
        error:
          "LLM did not return valid JSON. Please try again or adjust your prompt.",
        details: completion,
      });
    }

    const changes = [];

    for (const file of parsed.files) {
      const filePath = path.join(projectPath, file.path);

      switch (file.action) {
        case "create":
        case "update":
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, file.content, "utf-8");
          changes.push(`Updated ${file.path}`);
          break;
        case "delete":
          await fs.unlink(filePath);
          changes.push(`Deleted ${file.path}`);
          break;
      }
    }

    return res.json({
      message: "Project updated successfully",
      changes,
      explanation: parsed.explanation || "",
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Failed to update project", details: err.message });
  }
});

router.get("/project-history/:projectName", (req, res) => {
  const { projectName } = req.params;

  if (!projectName) {
    return res.status(400).json({ error: "Project name is required" });
  }

  const history = projectHistory[projectName] || { updates: [] };
  return res.json(history);
});

// DELETE /clear-project-history/:projectName - Clear history for a specific project
router.delete("/clear-project-history/:projectName", async (req, res) => {
  const { projectName } = req.params;

  if (!projectName) {
    return res.status(400).json({ error: "Project name is required" });
  }

  if (projectHistory[projectName]) {
    // Keep the original PRD but clear updates
    projectHistory[projectName].updates = [];

    // Save the updated history
    await saveProjectHistory();

    return res.json({ message: `History cleared for project ${projectName}` });
  }

  return res.status(404).json({ error: "Project history not found" });
});

module.exports = router;
