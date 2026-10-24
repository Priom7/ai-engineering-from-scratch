> **This is the starter version.** The core request logic is replaced by `TODO` comments in
> `backend/src/ollama.ts`, `backend/src/index.ts` and `frontend/src/App.tsx`. Follow the Build video,
> or see `../final` for the finished code. The quick start below works once the TODOs are done.

# Ollama Chat 001

A small beginner-friendly full-stack project with:

- a **Node.js + TypeScript backend**
- a **React + TypeScript frontend**
- a **local Ollama model** running on your machine

The goal is to keep the code easy to read while still showing the main moving parts of a local AI application.

## What this project does

- shows whether the backend can reach Ollama
- lists local models from Ollama
- lets you choose a model
- sends chat messages through the backend to Ollama
- shows the assistant response and a few generation stats

## Project structure

```text
ollama-chat-001/
├── backend/              # Express + TypeScript API
├── frontend/             # React + Vite + TypeScript app
├── docs/                 # Beginner-friendly documentation pack
├── package.json          # npm workspaces + shared scripts
└── .gitignore
```

## Quick start

### 1. Install Ollama

Download Ollama from [ollama.com](https://ollama.com/).

Official API docs used by this project:

- [Ollama API introduction](https://docs.ollama.com/api/introduction)
- [Ollama chat endpoint](https://docs.ollama.com/api/chat)
- [Ollama model list endpoint](https://docs.ollama.com/api/tags)

### 2. Pull a small model

For beginners, start with:

```bash
ollama pull llama3.2:3b
```

### 3. Install project dependencies

From this folder:

```bash
npm install
```

### 4. Set up backend environment

Copy the example file:

```bash
cp backend/.env.example backend/.env
```

Default values already work for a normal local Ollama install.

### 5. Run the app

```bash
npm run dev
```

Open:

- frontend: [http://localhost:5173](http://localhost:5173)
- backend: [http://localhost:4000](http://localhost:4000)

## Available scripts

```bash
npm run dev
npm run build
npm run start
```

## Documentation

Start here:

- [docs/README.md](./docs/README.md)
- [docs/02-quick-start.md](./docs/02-quick-start.md)
- [docs/06-beginner-study-notes.md](./docs/06-beginner-study-notes.md)

## Beginner notes

- The frontend never talks to Ollama directly.
- The backend calls Ollama for the frontend.
- This keeps the browser code simple and gives you one place to handle errors and config.
- The project uses Ollama's local API at `http://localhost:11434/api` by default.

## Default ports

- frontend: `5173`
- backend: `4000`
- Ollama: `11434`

## Next ideas

- add streaming responses
- save chat history in a database
- add model switching per conversation
- add system prompt presets
- add markdown rendering for answers

