# UI Generator AI Agent API

A FastAPI backend that acts as an AI Agent to generate frontend UI code based on user requirements.

## Features

- Analyzes UI requirements
- Plans implementation steps
- Generates HTML, CSS, and JavaScript code
- Provides feedback on vague or infeasible requirements

## Setup & Installation

### Using PDM (Recommended)

1. Install PDM if you haven't already:

   ```bash
   pip install pdm
   ```

2. Set up the project:

   ```bash
   pdm install
   ```

3. Run the server:
   ```bash
   pdm run start
   ```

### Alternative: Using pip

If you prefer not to use PDM:

1. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies from the pyproject.toml file:

   ```bash
   pip install .
   ```

3. Run the server:
   ```bash
   uvicorn main:app --reload
   ```

## API Usage

### Generate UI Code

**Endpoint:** `POST /generate`

**Request Body:**

```json
{
  "requirement": "Create a todo list with the ability to add, complete, and delete items"
}
```

**Response:**

```json
{
  "html": "...",
  "css": "...",
  "javascript": "...",
  "analysis": "...",
  "plan": "...",
  "feedback": null
}
```

### Testing with cURL

You can test the API using cURL commands:

```bash
# Basic UI generation request
curl -X POST http://127.0.0.1:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"requirement": "Create a simple counter with increment and decrement buttons"}'

# Testing with a more complex requirement
curl -X POST http://127.0.0.1:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"requirement": "Create a todo list app with the ability to add new tasks, mark tasks as complete, delete tasks, and filter by completed/active status"}'

# Testing with a vague requirement (should return feedback)
curl -X POST http://127.0.0.1:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"requirement": "Make something cool"}'
```

You can also access the auto-generated API documentation at:

- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

## Development

- Format code: `pdm run format`
- Lint code: `pdm run lint`
- Run tests: `pdm run test`

## Requirements

- Python 3.8+
- Local LLM running on http://localhost:11434/api/generate
