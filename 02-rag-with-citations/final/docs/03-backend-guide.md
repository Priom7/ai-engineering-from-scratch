# Backend Guide

The backend is responsible for:

- receiving uploads
- reading and cleaning text
- chunking documents
- calling Ollama embeddings
- storing chunks in a local JSON index
- retrieving top matches
- calling the chat model with retrieved context

Important files:

- `backend/src/index.ts`
- `backend/src/ollama.ts`
- `backend/src/store.ts`
- `backend/src/text.ts`

