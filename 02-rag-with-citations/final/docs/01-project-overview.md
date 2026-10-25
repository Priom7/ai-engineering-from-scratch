# Project Overview

This project is the next step after a simple local chat app.

It adds:

- document upload
- chunking
- embeddings
- semantic retrieval
- grounded answers with citations

This is the simplest useful version of a RAG system.

## Beginner scope

This version is intentionally small:

- only `.txt` and `.md` uploads
- local JSON storage instead of a database
- local Ollama for both embeddings and chat
- no auth
- no background queue yet

That keeps the architecture understandable.

