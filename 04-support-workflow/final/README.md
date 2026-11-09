# Support workflow: finished version

The Fernhill Support Desk: every customer email goes through a workflow that understands it, finds the facts, drafts a reply, checks every claim, and decides whether to send it, ask a person, or escalate. See [the project README](../README.md) for the videos, the results and the homework.

```bash
npm install
npm test                                # 42 unit tests, no Ollama needed
npm run dev                             # the app: Workflow, Inbox and Results
npm run experiment -- workflow          # needs Ollama: llama3.2:3b, qwen2.5:7b-instruct, nomic-embed-text
```

## Where things are

| Path | What it is |
| --- | --- |
| `workflows/support-desk.json` | The workflow: its steps, their prompts and models, and the edges between them |
| `backend/src/workflow/engine.ts` | Walks the workflow: runs each step, follows the edges, traces everything |
| `backend/src/workflow/schema.ts` | Checks JSON against a schema, and the retry prompt with the error |
| `backend/src/workflow/judge.ts` | The check step: a second model lists claims the sources don't back up |
| `backend/src/single.ts` | The single prompt (Episode 2's way), for comparison |
| `backend/src/knowledge.ts`, `rag.ts` | The documents, chunked and embedded, and retrieval (from Episode 2) |
| `backend/src/index.ts` | The API, including live run events (server-sent events) |
| `backend/src/experiments/` | Runs all the sample emails and grades the replies (Episode 3's graders) |
| `data/emails.json` | 20 sample customer emails, with what a good reply must say |
| `data/experiments/` | The experiment results from the videos |
| `sample-docs/` | Six short documents about Fernhill Cloud, a fictional company |
| `frontend/src/views/` | The Workflow, Inbox and Results views |

## Docs

Start with [docs/README.md](docs/README.md).
