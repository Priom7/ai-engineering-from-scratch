# Project Overview

## Project name

**Ollama Chat 001**

## Purpose

This project teaches the smallest useful shape of a local AI app:

- a browser UI
- a backend API
- a local model running through Ollama

## Why this project is good for beginners

- the frontend has only one main screen
- the backend has only a few endpoints
- the code uses plain `fetch` and Express
- there is no database
- there is no authentication
- there is no streaming yet

That keeps the main learning path clear.

## Main features

- backend health check
- local model list
- editable model name
- system prompt field
- simple chat history
- response stats

## Technology choices

### Backend

- Node.js
- TypeScript
- Express
- `fetch` for talking to Ollama

### Frontend

- React
- TypeScript
- Vite

### Local model layer

- Ollama
- local REST API

## Beginner architecture summary

The project has three layers:

1. **Frontend**: shows the UI and sends requests
2. **Backend**: validates input and calls Ollama
3. **Ollama**: runs the local model and returns answers

The browser does not call Ollama directly. It calls the backend first.

## Recommended first model

Use `llama3.2:3b` for a first local setup. It is small enough to be practical for many laptops while still being useful for chat.

## Next document

Continue with [02-quick-start.md](./02-quick-start.md).

