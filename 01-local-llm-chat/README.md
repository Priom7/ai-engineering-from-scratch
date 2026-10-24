# 01: Local LLM chat

A private ChatGPT-style app that runs entirely on your machine. A React front end talks to a small Node server, and the server talks to Ollama, which runs Llama 3.2 locally. No API keys, and nothing leaves your computer.

## Videos

- **Concept:** How LLMs work: tokens, temperature and context windows (link coming soon)
- **Build:** Building this app file by file (link coming soon)
- **Ship:** The finished app on an 8 GB Mac (link coming soon)

## What's in this folder

| Folder | What it is |
| --- | --- |
| `starter/` | The full project with the core logic replaced by `TODO` comments. Code along with the Build video here. |
| `final/` | The finished, working version, plus a beginner-friendly docs pack in `final/docs/`. |

## Run the finished app

You need Node.js 22 or newer and [Ollama](https://ollama.com).

```bash
ollama pull llama3.2:3b
cd final
npm install
npm run dev
```

Then open http://localhost:5173. The backend runs on port 4000 and talks to Ollama on port 11434.

To use a different model, copy `backend/.env.example` to `backend/.env` and change `OLLAMA_MODEL`.

## What you write in the starter

| File | TODO |
| --- | --- |
| `backend/src/ollama.ts` | `listModels()`: list installed models from Ollama |
| `backend/src/ollama.ts` | `chatWithModel()`: clean the messages, add the system prompt, call Ollama, return a simple result |
| `backend/src/index.ts` | `/api/health`, `/api/models` and `/api/chat` route handlers |
| `frontend/src/App.tsx` | Load config, health and models when the page opens |
| `frontend/src/App.tsx` | Send the whole conversation and show the reply and stats |

The types, the API client (`frontend/src/api.ts`), `/api/config` and the whole interface are already done, so you can focus on the request flow. The routes return `501` until you implement them.

## Homework challenge

Add a temperature slider:

1. The front end sends a `temperature` with each chat request.
2. The server passes it to Ollama as `options: { temperature }`.
3. Ask the same question at 0 and at 1, and compare the answers.

Stretch goal: stream the reply, so words appear as they're generated.

Open a pull request with your solution. The best ones get featured at the start of the next Build video.
