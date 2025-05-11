import re
from typing import Dict, Any, Optional
from services.llm_service import LLMService, LLMServiceError
import json
import asyncio  # Add this import

class AgentService:
    """Service that implements AI agent behavior for UI generation."""
    
    def __init__(self):
        self.llm_service = LLMService()
        
    async def process_requirement(self, requirement: str) -> Dict[str, Any]:
        try:
            is_modification = self._is_modification_request(requirement)
            
            analysis = await self._analyze_requirement(requirement, is_modification)
            plan = await self._plan_implementation(requirement, analysis, is_modification)
            
            # Generate React project files instead of basic UI code
            generated_files = await self._generate_react_project_files(requirement, analysis, plan)
            
            return {
                "files": generated_files,
                "analysis": analysis,
                "plan": plan,
                "feedback": None
            }
            
        except Exception as e:
            raise LLMServiceError(f"Failed to process requirement: {str(e)}")
    
    def _is_modification_request(self, requirement: str) -> bool:
        """Check if the requirement is requesting a modification to an existing UI."""
        modification_keywords = [
            "add", "change", "modify", "update", "remove", "delete", 
            "reset button", "alter", "adjust", "extend", "enhance"
        ]
        
        requirement_lower = requirement.lower()
        return any(keyword in requirement_lower for keyword in modification_keywords)
    
    async def _analyze_requirement(self, requirement: str, is_modification: bool) -> str:
        """Analyze the requirement with React + shadcn/ui context."""
        prompt = f"""
        You are a React development expert. Analyze this UI requirement:
        
        '{requirement}'
        
        Consider:
        1. What React components are needed
        2. Which shadcn/ui components can be used
        3. What state management is required
        4. Component hierarchy and data flow
        5. Any technical constraints or challenges
        
        Return only your analysis, formatted clearly.
        """
        
        return await self.llm_service.generate_text(prompt)
    
    async def _plan_implementation(self, requirement: str, analysis: str, is_modification: bool) -> str:
        """Create an implementation plan for React + shadcn/ui."""
        prompt = f"""
        Based on:
        Requirement: '{requirement}'
        Analysis: '{analysis}'
        
        Create a step-by-step plan to implement this React + Vite + shadcn/ui project:
        1. Project structure and file organization
        2. Component breakdown and responsibilities
        3. State management approach
        4. Implementation order and dependencies
        5. Integration points between components
        
        Return only the concrete implementation plan, formatted as a clear list.
        """
        
        return await self.llm_service.generate_text(prompt)
    
    async def _generate_react_project_files(self, requirement: str, analysis: str, plan: str) -> Dict[str, str]:
        """Generate React project files in chunks to avoid timeout."""
        try:
            # Split the prompts into chunks
            core_prompt = f"""
            Given this TODO app requirement, return ONLY a valid JSON object containing these React component files: 
            '{requirement}'

            Files needed:
            - "src/App.tsx"
            - "src/main.tsx"
            - "src/components/TodoList.tsx"
            - "src/components/TodoItem.tsx"

            Format:
            {{
                "src/App.tsx": "// Full TSX code here",
                "src/main.tsx": "// Full TSX code here",
                ...
            }}

            Include complete, working code for a React + Vite + shadcn/ui TODO app.
            No explanations, only the JSON with the code.
            """

            config_prompt = f"""
            Return ONLY a valid JSON object containing these config files for a React + Vite + shadcn/ui TODO app:
            
            Files needed:
            - "vite.config.ts"
            - "tailwind.config.js"
            - "package.json"
            - "tsconfig.json"
            - "components.json"

            Format:
            {{
                "vite.config.ts": "// Full config code here",
                "tailwind.config.js": "// Full config code here",
                ...
            }}

            Include all necessary dependencies and configurations.
            No explanations, only the JSON with the code.
            """

            # Generate files in parallel
            core_response, config_response = await asyncio.gather(
                self.llm_service.generate_text(core_prompt),
                self.llm_service.generate_text(config_prompt)
            )

            # Parse responses
            try:
                core_files = json.loads(core_response)
                config_files = json.loads(config_response)
            except json.JSONDecodeError as e:
                raise LLMServiceError(f"Failed to parse generated code: {str(e)}")

            # Combine and validate
            files = {**core_files, **config_files}
            required_files = {
                "src/App.tsx",
                "src/main.tsx",
                "vite.config.ts",
                "package.json"
            }
            
            missing_files = required_files - set(files.keys())
            if missing_files:
                raise LLMServiceError(f"Missing required files: {', '.join(missing_files)}")

            return files

        except Exception as e:
            raise LLMServiceError(f"React project generation failed: {str(e)}")
    
    async def _generate_feedback(self, requirement: str, analysis: str) -> str:
        """Generate feedback when the requirement is too vague or not feasible."""
        prompt = f"""
        The following UI requirement appears to be unclear or not feasible:
        
        '{requirement}'
        
        Based on this analysis: '{analysis}'
        
        Please provide:
        1. A clear explanation of what makes this requirement challenging
        2. Specific questions that would help clarify the requirement
        3. Alternative suggestions that might meet the user's needs
        
        Format this as helpful feedback to the user.
        """
        
        return await self.llm_service.generate_text(prompt)
    
    def _extract_code_blocks(self, text: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """Extract HTML, CSS, and JavaScript code blocks from the generated text."""
        if not isinstance(text, str):
            raise ValueError("Generated code must be a string")

        def extract_block(pattern: str) -> Optional[str]:
            matches = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            return matches.group(1).strip() if matches else None
            
        html = extract_block(r"```html\s*(.*?)\s*```")
        css = extract_block(r"```css\s*(.*?)\s*```")
        javascript = extract_block(r"```javascript\s*(.*?)\s*```")
        
        if not any([html, css, javascript]):
            raise ValueError("No code blocks found in generated text")
            
        return html or "", css or "", javascript or ""
