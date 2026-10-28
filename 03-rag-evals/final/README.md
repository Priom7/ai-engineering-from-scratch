# RAG evals: finished version

The RAG app from Episode 2, with an eval suite in `evals/`. See [the project README](../README.md) for the videos, the results and the homework.

```bash
npm install
npm test                       # 53 unit tests, no Ollama needed
npm run eval -- baseline       # needs Ollama: llama3.2:3b, qwen2.5:7b-instruct, nomic-embed-text
npm run dev                    # the app: Ask (Episode 2's RAG) and Evals (every saved run)
```

## Where things are

| Path | What it is |
| --- | --- |
| `backend/src/rag.ts` | The app's answer pipeline: `retrieve()` and `generate()`. The API and the evals both use it. |
| `sample-docs/` | Six short documents about Fernhill Cloud, a fictional company |
| `evals/dataset/questions.json` | 24 questions: 18 the documents answer, 6 they don't |
| `evals/dataset/judge-labels.json` | 20 answers labelled pass or fail, for checking the judge |
| `evals/configs.json` | The settings each experiment changes |
| `evals/src/graders.ts` | Fact checks, retrieval hits and the LLM judge |
| `evals/src/runner.ts` | Retrieve, generate every answer, unload, grade |
| `evals/src/summary.ts`, `compare.ts`, `gate.ts` | Scores, run-to-run comparison, and the check before shipping |
| `evals/results/` | Every run, with every answer and the judge's reasons |
| `backend/src/evalResults.ts` | Read-only access to the saved runs, for the app's API |
| `frontend/src/EvalsView.tsx` | The Evals view: scores, attempt grid, run comparison, answers |

## Docs

Start with [docs/README.md](docs/README.md).
