# Beginner Study Notes

## What you should learn from this project

This project is not only about chatting with a model.

It teaches these beginner full-stack ideas:

### 1. Separation of concerns

- React handles UI
- Express handles server logic
- Ollama handles model inference

Each layer has one clear job.

### 2. Environment-based configuration

The backend reads settings from environment variables.

That means you can change:

- port
- allowed frontend origin
- Ollama base URL
- default model

without changing code.

### 3. API boundaries

The frontend does not need to understand Ollama's raw API shape.

It only needs the backend's smaller, simpler API.

That is a common real-world design pattern.

### 4. State in React

The frontend keeps track of:

- current messages
- loading state
- error state
- selected model
- system prompt
- stats text

This is a good beginner example of practical component state.

### 5. Local AI development

Using Ollama means:

- no cloud API key is required for local use
- the model runs on your machine
- latency and quality depend on your hardware and chosen model

## Suggested learning path

1. Run the project
2. Read `frontend/src/App.tsx`
3. Read `backend/src/index.ts`
4. Read `backend/src/ollama.ts`
5. Change one small thing and test it

## Good first changes

- change the default system prompt
- change the empty state text
- add another health detail
- show the selected model more clearly
- limit message length on the backend

## Good second changes

- add markdown rendering
- add streaming responses
- save conversations to a file
- let the user pick from more models
- add a dark/light theme switch

