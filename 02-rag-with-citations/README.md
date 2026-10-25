# 02: RAG with citations

Upload your own documents and ask questions about them. The app splits each file into chunks, turns every chunk into an embedding with Ollama, finds the chunks closest to your question, and asks Llama 3.2 to answer only from them. Every answer shows the sources it came from, with their similarity scores. There's no database: the index is a JSON file.

## Videos

- **Concept:** RAG explained: chunks, embeddings, vector search and citations (link coming soon)
- **Build:** Building this app file by file (link coming soon)
- **Ship:** The finished app on an 8 GB Mac (link coming soon)

## What's in this folder

| Folder | What it is |
| --- | --- |
| `starter/` | The full project with the RAG core replaced by `TODO` comments. Code along with the Build video here. |
| `final/` | The finished, working version, plus a docs pack in `final/docs/`. |
| `final/sample-docs/` | Two short documents about Fernhill Cloud, a fictional company, to test with. |

## Run the finished app

You need Node.js 22 or newer and [Ollama](https://ollama.com).

```bash
ollama pull nomic-embed-text
ollama pull llama3.2:3b
cd final
npm install
npm run dev
```

Open the address Vite prints (http://localhost:5174), upload the two files from `sample-docs/`, and ask *"Can I get a refund on an annual plan after two months?"* The backend runs on port 4100.

Settings live in `backend/.env.example`. Copy it to `backend/.env` to change the models, the chunk size (500 characters) or the overlap (80).

## What you write in the starter

| File | TODO |
| --- | --- |
| `backend/src/text.ts` | `chunkText()`: split text into overlapping windows |
| `backend/src/text.ts` | `cosineSimilarity()`: how closely two embeddings point the same way |
| `backend/src/ollama.ts` | `embedText()`: turn text into an embedding with Ollama |
| `backend/src/ollama.ts` | `answerQuestion()`: answer only from the retrieved context |
| `backend/src/index.ts` | `rankMatches()`, ingestion in the upload route, and the `/api/query` route |

Text cleaning, the JSON store, the other routes and the whole front end are already done. The unfinished routes return `501` until you implement them.

## Homework challenge

Add a relevance threshold:

1. Look at the scores in the citations. Good matches for the sample questions score around 0.78. A question the documents can't answer scores 0.48 at best.
2. Drop chunks below your threshold.
3. If nothing is left, don't call the model at all. Answer "I couldn't find that in your documents."

Open a pull request with your solution. The best ones get featured at the start of the next Build video.
