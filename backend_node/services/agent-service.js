// Agent Service for UI generation
const { LLMService, LLMServiceError } = require("./llm-service");

class AgentService {
  constructor() {
    this.llmService = new LLMService();
  }

  // Check if the requirement is requesting a modification to an existing UI
  _isModificationRequest(requirement) {
    const modificationKeywords = [
      "add",
      "change",
      "modify",
      "update",
      "remove",
      "delete",
      "reset button",
      "alter",
      "adjust",
      "extend",
      "enhance",
    ];

    const requirementLower = requirement.toLowerCase();
    return modificationKeywords.some((keyword) =>
      requirementLower.includes(keyword)
    );
  }

  // Analyze the requirement with React + shadcn/ui context
  async _analyzeRequirement(requirement, isModification) {
    const prompt = `
    You are a React development expert. Analyze this UI requirement:
    
    '${requirement}'
    
    Consider:
    1. What React components are needed
    2. Which shadcn/ui components can be used
    3. What state management is required
    4. Component hierarchy and data flow
    5. Any technical constraints or challenges
    
    Return only your analysis, formatted clearly.
    `;

    return await this.llmService.generateText(prompt);
  }

  // Create an implementation plan for React + shadcn/ui
  async _planImplementation(requirement, analysis, isModification) {
    const prompt = `
    Based on:
    Requirement: '${requirement}'
    Analysis: '${analysis}'
    
    Create a step-by-step plan to implement this React + Vite + shadcn/ui project:
    1. Project structure and file organization
    2. Component breakdown and responsibilities
    3. State management approach
    4. Implementation order and dependencies
    5. Integration points between components
    
    Return only the concrete implementation plan, formatted as a clear list.
    `;

    return await this.llmService.generateText(prompt);
  }

  // Generate React project files
  async _generateReactProjectFiles(requirement, analysis, plan) {
    try {
      const prompt = `
      Create a React + TypeScript project for this TODO app requirement:
      ${requirement}

      Return ONLY a valid JSON object with these file paths (do not include any others):
      {
          "/src/App.tsx": "<React component code>",
          "/src/components/TodoList.tsx": "<component code>",
          "/src/components/TodoItem.tsx": "<component code>"
      }

      Rules:
      1. Use absolute paths starting with /src/
      2. Include only TypeScript/React code files
      3. Do not include config files, they will be added separately
      4. Return only valid JSON with the specified files
      5. Each component should be a separate file
      6. Use proper TypeScript types
      `;

      const response = await this.llmService.generateText(prompt);

      try {
        // Extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
          throw new Error("No valid JSON found in response");
        }

        const files = JSON.parse(jsonMatch[0]);

        // Ensure all paths start with /src/
        const normalizedFiles = {};
        for (const [key, value] of Object.entries(files)) {
          const normalizedKey = key.startsWith("/src/")
            ? key
            : `/src/${key.replace(/^\//, "")}`;
          normalizedFiles[normalizedKey] = value;
        }

        return normalizedFiles;
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(
            `Failed to parse generated code as JSON: ${error.message}`
          );
        }
        throw error;
      }
    } catch (error) {
      throw new Error(`React project generation failed: ${error.message}`);
    }
  }

  // Generate feedback when the requirement is too vague or not feasible
  async _generateFeedback(requirement, analysis) {
    const prompt = `
    The following UI requirement appears to be unclear or not feasible:
    
    '${requirement}'
    
    Based on this analysis: '${analysis}'
    
    Please provide:
    1. A clear explanation of what makes this requirement challenging
    2. Specific questions that would help clarify the requirement
    3. Alternative suggestions that might meet the user's needs
    
    Format this as helpful feedback to the user.
    `;

    return await this.llmService.generateText(prompt);
  }

  // Process the requirement
  async processRequirement(requirement) {
    try {
      const isModification = this._isModificationRequest(requirement);

      const analysis = await this._analyzeRequirement(
        requirement,
        isModification
      );
      const plan = await this._planImplementation(
        requirement,
        analysis,
        isModification
      );

      // Generate React project files instead of basic UI code
      const generatedFiles = await this._generateReactProjectFiles(
        requirement,
        analysis,
        plan
      );

      return {
        files: generatedFiles,
        analysis: analysis,
        plan: plan,
        feedback: null,
      };
    } catch (error) {
      throw new Error(`Failed to process requirement: ${error.message}`);
    }
  }
}

module.exports = { AgentService };
