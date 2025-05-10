> Create a Python FastAPI backend that acts as an AI Agent:
>
> 1. Expose a POST `/generate` endpoint.
> 2. Accept a JSON body with a field `requirement` (string) describing the frontend UI user wants.
> 3. Implement an AI agent behavior:
>    - First, **analyze the requirement** carefully.
>    - **Plan the steps** needed to build the UI (internally, chain of thought).
>    - **Then generate** the HTML, CSS, and JavaScript accordingly.
>    - If the requirement is **not feasible or too vague**, politely **suggest an alternative** or **ask for clarification**.
> 4. Use local LLM for reasoning and code generation.

    example:

    const response = await fetch("http://localhost:11434/api/generate", {

// method: "POST",
// headers: {
// "Content-Type": "application/json",
// },
// body: JSON.stringify({
// model: "llama3.2:1b",
// prompt: prompt,
// stream: false,
// }),
// });

> 5. Parse and return 3 parts: `html`, `css`, `javascript` inside JSON.
> 6. Use `fastapi` and `httpx` (async call).
> 7. Add error handling for bad input or LLM API errors.
>
> Constraints:
>
> - Treat the LLM like a **reasoning agent**, not just a direct code generator.
> - Add clear modular code for agent planning and final generation separately.
