# Quick Start

## Step 1: Install Ollama

Go to [https://ollama.com/](https://ollama.com/) and install Ollama for your operating system.

Official references:

- [Ollama API introduction](https://docs.ollama.com/api/introduction)
- [Ollama chat endpoint](https://docs.ollama.com/api/chat)

## Step 2: Pull a model

In your terminal:

```bash
ollama pull llama3.2:3b
```

## Step 3: Install dependencies

In the project root:

```bash
npm install
```

## Step 4: Create backend environment file

```bash
cp backend/.env.example backend/.env
```

## Step 5: Start the app

```bash
npm run dev
```

## Step 6: Open the frontend

Visit:

```text
http://localhost:5173
```

## What to do if it does not work

### If the backend says it cannot reach Ollama

- make sure Ollama is installed
- make sure Ollama is running
- make sure `OLLAMA_BASE_URL` is correct in `backend/.env`

### If there are no models

Run:

```bash
ollama list
```

If the list is empty:

```bash
ollama pull llama3.2:3b
```

### If ports are busy

Change:

- `PORT` in `backend/.env`
- `VITE_API_BASE_URL` in the frontend if needed

## Build for production

```bash
npm run build
```

