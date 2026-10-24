# Backend Guide

## Backend job

The backend sits between the frontend and Ollama.

It does four main things:

1. exposes simple HTTP endpoints for the frontend
2. reads environment configuration
3. asks Ollama for models and chat responses
4. returns friendly JSON back to the frontend

## Important files

- `backend/src/index.ts`
- `backend/src/ollama.ts`
- `backend/src/types.ts`
- `backend/.env.example`

## Endpoints

### `GET /api/config`

Returns app name and default model.

### `GET /api/health`

Checks whether the backend can reach Ollama.

### `GET /api/models`

Returns models from Ollama's model list endpoint.

### `POST /api/chat`

Accepts chat history and sends it to Ollama's chat endpoint.

## Why use a backend here?

For a beginner project, you could try to call Ollama directly from the browser. But using a backend is better because:

- it keeps environment details in one place
- it makes error handling easier
- it gives you a place to add validation later
- it matches how many real projects are built

## Ollama calls used by the backend

### List models

The backend calls:

```text
GET /api/tags
```

### Chat

The backend calls:

```text
POST /api/chat
```

with `stream: false` to keep the first version simple.

## Suggested beginner exercises

- log the selected model before sending the request
- add a maximum message length check
- return a clearer error when the model name is empty
- add a `/api/version` endpoint

