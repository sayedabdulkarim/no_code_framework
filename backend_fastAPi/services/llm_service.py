import httpx
import json
from typing import Dict, Any, Optional
import logging
import os
from dotenv import load_dotenv
import asyncio
import re

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class LLMServiceError(Exception):
    """Exception raised for errors in the LLM service."""
    pass

class LLMService:
    """Service for interacting with the Replicate API."""
    
    def __init__(self):
        # self.base_url = "https://api.replicate.com/v1/models/meta/meta-llama-3-8b-instruct/predictions"
        self.base_url = "https://api.replicate.com/v1/models/anthropic/claude-3.5-sonnet/predictions"
        # self.base_url = "https://api.replicate.com/v1/models/anthropic/claude-3.7-sonnet/predictions"
        # self.base_url = "https://api.replicate.com/v1/models/anthropic/claude-3.7-sonnet/predictions"
        
        self.api_token = os.getenv("REPLICATE_API_TOKEN")
        if not self.api_token:
            raise LLMServiceError("REPLICATE_API_TOKEN environment variable not set")
        self.timeout = httpx.Timeout(timeout=120.0)
        self.poll_interval = 1.0
        self.max_polls = 30
        # Initialize memory to store previous generations
        self.memory: Dict[str, Dict[str, str]] = {}
        self.memory_limit = 5  # Store the last 5 generations
    
    async def _poll_for_completion(self, client: httpx.AsyncClient, get_url: str) -> Dict[str, Any]:
        """Poll the prediction URL until it's complete."""
        for _ in range(self.max_polls):
            response = await client.get(
                get_url,
                headers={"Authorization": f"Bearer {self.api_token}"}
            )
            result = response.json()
            
            if result.get("status") == "succeeded":
                return result
            elif result.get("status") == "failed":
                raise LLMServiceError(f"Prediction failed: {result.get('error')}")
            
            await asyncio.sleep(self.poll_interval)
        
        raise LLMServiceError("Prediction timed out")
    
    def _save_to_memory(self, prompt: str, response: Dict[str, str]) -> None:
        """Save the prompt and response to memory."""
        # Create a simple hash of the prompt as a key
        key = str(hash(prompt))
        self.memory[key] = response
        
        # Keep memory within the limit
        if len(self.memory) > self.memory_limit:
            # Remove the oldest entry
            oldest_key = next(iter(self.memory))
            self.memory.pop(oldest_key)
        
        logger.debug(f"Saved generation to memory. Memory size: {len(self.memory)}")
    
    def _is_modification_request(self, prompt: str) -> bool:
        """Check if the prompt is requesting a modification to an existing UI."""
        modification_keywords = [
            "add", "change", "modify", "update", "remove", "delete", 
            "reset button", "alter", "adjust", "extend", "enhance"
        ]
        
        prompt_lower = prompt.lower()
        return any(keyword in prompt_lower for keyword in modification_keywords)
    
    def _get_latest_response(self) -> Optional[Dict[str, str]]:
        """Get the most recent response from memory."""
        if not self.memory:
            return None
        
        # Return the most recently added response
        return next(reversed(list(self.memory.values())))
    
    def _build_prompt_with_memory(self, prompt: str) -> str:
        """Build a prompt that includes context from memory if this is a modification request."""
        latest_response = self._get_latest_response()
        
        if not latest_response or not self._is_modification_request(prompt):
            # If no memory or not a modification request, return the standard prompt
            return f"""You are a UI development expert. Create a complete implementation for this requirement: '{prompt}'

Return only the code in three blocks:
```html
[Your HTML code here]
```

```css
[Your CSS code here]
```

```javascript
[Your JavaScript code here]
```

Make the code clean, modern, and production-ready. Include proper styling and interactivity."""
        
        # For modification requests, include the previous implementation
        return f"""You are a UI development expert. You previously created this implementation:

HTML:
```html
{latest_response.get('html', '')}
```

CSS:
```css
{latest_response.get('css', '')}
```

JavaScript:
```javascript
{latest_response.get('javascript', '')}
```

Now, modify the existing implementation to meet this new requirement: '{prompt}'

Return the COMPLETE UPDATED code in the same three blocks:
```html
[Your updated HTML code here]
```

```css
[Your updated CSS code here]
```

```javascript
[Your updated JavaScript code here]
```

Make sure to preserve the existing functionality while adding the requested changes. Make the code clean, modern, and production-ready."""

    async def generate_text(self, prompt: str) -> str:
        """
        Generate text response (not code blocks) for agent reasoning steps.
        This is a wrapper around generate() but returns only the text, not code blocks.
        """
        # For text generation, we don't use code block extraction or memory features
        try:
            payload = {
                "input": {
                    "prompt": prompt,
                    "temperature": 0.7,
                    "max_new_tokens": 1000
                }
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.base_url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code != 201:
                    raise LLMServiceError(f"API returned status {response.status_code}: {response.text}")
                
                prediction = response.json()
                if not prediction or 'urls' not in prediction or 'get' not in prediction['urls']:
                    raise LLMServiceError("Invalid response format")

                final_result = await self._poll_for_completion(client, prediction['urls']['get'])
                
                if not final_result.get('output'):
                    raise LLMServiceError("No output in prediction")
                
                # Join the output chunks and return
                return ''.join(final_result['output'])
                
        except Exception as e:
            logger.error(f"Error generating text: {str(e)}")
            raise LLMServiceError(f"Error generating text: {str(e)}")

    async def generate(self, prompt: str) -> Dict[str, str]:
        """Generate UI code based on the requirement."""
        try:
            structured_prompt = self._build_prompt_with_memory(prompt)

            # Enhance the prompt to emphasize the need for all three code blocks
            structured_prompt += """

IMPORTANT: You must provide all three code blocks - HTML, CSS, and JavaScript.
Even if you think a section might be minimal, please provide appropriate code for each section.
Do not leave any section empty.

Example structure:
```html
<!-- Your HTML code here -->
```

```css
/* Your CSS code here, including proper styling for all HTML elements */
```

```javascript
// Your JavaScript code here, including event handlers and functionality
```
"""

            payload = {
                "input": {
                    "prompt": structured_prompt,
                    "temperature": 0.7,
                    "max_new_tokens": 1000  # Increased for complete code generation
                }
            }
            
            logger.debug(f"Sending request to Replicate API")
            logger.debug(f"Payload length: {len(structured_prompt)}")
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.base_url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                logger.debug(f"Response status: {response.status_code}")
                
                if response.status_code != 201:
                    raise LLMServiceError(f"API returned status {response.status_code}: {response.text}")
                
                prediction = response.json()
                if not prediction or 'urls' not in prediction or 'get' not in prediction['urls']:
                    raise LLMServiceError("Invalid response format")

                final_result = await self._poll_for_completion(client, prediction['urls']['get'])
                
                if not final_result.get('output'):
                    raise LLMServiceError("No output in prediction")
                
                # Join the output chunks and extract code blocks
                combined_output = ''.join(final_result['output'])
                
                # Extract code blocks using regex
                html = re.search(r'```html\s*(.*?)\s*```', combined_output, re.DOTALL)
                css = re.search(r'```css\s*(.*?)\s*```', combined_output, re.DOTALL)
                js = re.search(r'```javascript\s*(.*?)\s*```', combined_output, re.DOTALL)
                
                # Add fallback - if no CSS or JS found, extract any style or script tags from HTML
                html_content = html.group(1).strip() if html else ""
                css_content = css.group(1).strip() if css else ""
                js_content = js.group(1).strip() if js else ""
                
                # If CSS or JS is empty, try to extract from HTML
                if not css_content:
                    css_match = re.search(r'<style>(.*?)</style>', html_content, re.DOTALL)
                    if css_match:
                        css_content = css_match.group(1).strip()
                
                if not js_content:
                    js_match = re.search(r'<script>(.*?)</script>', html_content, re.DOTALL)
                    if js_match:
                        js_content = js_match.group(1).strip()
                
                # Ensure we have at least minimal content for each section
                if not css_content:
                    css_content = "/* Default styles for TODO app */\nbody {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 20px;\n}\n"
                
                if not js_content:
                    js_content = "// Basic functionality for TODO app\ndocument.addEventListener('DOMContentLoaded', function() {\n  console.log('TODO app initialized');\n});\n"
                
                result = {
                    'html': html_content,
                    'css': css_content,
                    'javascript': js_content
                }
                
                # Save the result to memory
                self._save_to_memory(prompt, result)
                
                return result
                
        except Exception as e:
            logger.error(f"Error: {str(e)}")
            raise LLMServiceError(f"Error: {str(e)}")

    async def generate_ui(self, requirement: str) -> Dict[str, str]:
        """Generate UI code files based on the requirement."""
        prompt = f"""
        Create a complete implementation for this requirement: '{requirement}'
        
        Return ONLY a JSON object with exactly this structure:
        {{
            "index.html": "<complete HTML code here>",
            "style.css": "/* complete CSS code here */",
            "script.js": "// complete JavaScript code here"
        }}
        
        The code should be production-ready and fully functional.
        Do not include any explanations or markdown formatting.
        Return only the JSON object.
        """
        
        try:
            # Generate the response
            response = await self.generate_text(prompt)
            
            # Parse the JSON response
            try:
                files = json.loads(response)
            except json.JSONDecodeError:
                raise LLMServiceError("Failed to parse LLM response as JSON")
            
            # Validate the response structure
            required_files = {"index.html", "style.css", "script.js"}
            if not all(file in files for file in required_files):
                raise LLMServiceError("Invalid response structure: missing required files")
            
            return files
            
        except Exception as e:
            raise LLMServiceError(f"UI generation failed: {str(e)}")
