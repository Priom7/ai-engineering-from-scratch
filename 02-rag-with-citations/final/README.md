# RAG Workspace Assistant 002

A local-first retrieval-augmented generation project for learning the next step after a basic chat app.

This project lets you:

- upload `.txt` and `.md` files
- chunk and embed them locally with Ollama
- store a small local vector index in JSON
- ask questions grounded in your uploaded documents
- view citations and retrieval matches

## Stack

- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Node.js + TypeScript + Express
- Local models:
  - embeddings: `nomic-embed-text:latest`
  - chat: `llama3.2:3b`

## Quick start

1. Make sure Ollama is installed and running.
2. Make sure these models are available:

```bash
ollama pull nomic-embed-text:latest
ollama pull llama3.2:3b
```

3. Install dependencies:

```bash
npm install
```

4. Copy backend env:

```bash
cp backend/.env.example backend/.env
```

If Vite starts on `5175` or another localhost port because `5174` is busy, that is fine. The backend now accepts local dev origins automatically.

5. Run the app:

```bash
npm run dev
```

6. Open:

- frontend: [http://localhost:5174](http://localhost:5174)
- backend: [http://localhost:4100](http://localhost:4100)

If `5174` is already in use, Vite may move to `5175` or higher. Open the URL shown in the terminal.

## Documentation

Start with:

- [docs/README.md](./docs/README.md)
- [docs/02-how-rag-works.md](./docs/02-how-rag-works.md)
- [docs/05-beginner-study-guide.md](./docs/05-beginner-study-guide.md)
