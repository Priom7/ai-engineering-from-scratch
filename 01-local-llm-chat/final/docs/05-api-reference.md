# API Reference

## Backend API

### `GET /api/config`

Response example:

```json
{
  "appName": "Ollama Chat 001",
  "defaultModel": "llama3.2:3b"
}
```

### `GET /api/health`

Success example:

```json
{
  "ok": true,
  "ollamaReachable": true,
  "modelCount": 1,
  "defaultModel": "llama3.2:3b"
}
```

Failure example:

```json
{
  "ok": false,
  "ollamaReachable": false,
  "message": "Could not reach Ollama..."
}
```

### `GET /api/models`

Response example:

```json
{
  "models": [
    {
      "name": "llama3.2:3b"
    }
  ]
}
```

### `POST /api/chat`

Request example:

```json
{
  "model": "llama3.2:3b",
  "systemPrompt": "You are a helpful local assistant.",
  "messages": [
    {
      "role": "user",
      "content": "Explain TypeScript in one paragraph."
    }
  ]
}
```

Response example:

```json
{
  "model": "llama3.2:3b",
  "reply": "TypeScript is ...",
  "stats": {
    "promptTokens": 32,
    "responseTokens": 84,
    "totalDurationMs": 1750,
    "doneReason": "stop"
  }
}
```

## Ollama API used by this project

Based on the current official Ollama docs:

- base URL: `http://localhost:11434/api`
- model list: `GET /tags`
- chat: `POST /chat`

References:

- [Ollama API introduction](https://docs.ollama.com/api/introduction)
- [Ollama chat endpoint](https://docs.ollama.com/api/chat)
- [Ollama models endpoint](https://docs.ollama.com/api/tags)

