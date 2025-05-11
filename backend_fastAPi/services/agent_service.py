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
        try:
            prompt = f"""
            Create a React + TypeScript project for this TODO app requirement:
            {requirement}

            Return ONLY a valid JSON object with these file paths (do not include any others):
            {{
                "/src/App.tsx": "<React component code>",
                "/src/components/TodoList.tsx": "<component code>",
                "/src/components/TodoItem.tsx": "<component code>"
            }}

            Rules:
            1. Use absolute paths starting with /src/
            2. Include only TypeScript/React code files
            3. Do not include config files, they will be added separately
            4. Return only valid JSON with the specified files
            5. Each component should be a separate file
            6. Use proper TypeScript types
            """

            response = await self.llm_service.generate_text(prompt)
            
            try:
                files = json.loads(response)
                # Ensure all paths start with /src/
                files = {
                    k if k.startswith("/src/") else f"/src/{k.lstrip('/')}": v
                    for k, v in files.items()
                }
                return files
            except json.JSONDecodeError:
                raise LLMServiceError("Failed to parse generated code as JSON")

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
