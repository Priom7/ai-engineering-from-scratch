# Running and measuring

All commands run from `final/`. They need Ollama with `llama3.2:3b`, `qwen2.5:7b-instruct` and `nomic-embed-text`.

## The app

```bash
npm run dev       # backend on :4400, app on http://localhost:5174
```

- **Workflow:** pick an email and press **Run**. Steps light up as they run, the edges taken are animated, and the email ends at an outcome. Click any step to see what it did. **Single prompt** runs the same email the Episode 2 way, for comparison.
- **Inbox:** every email with its latest outcome. Paste your own email with **Paste an email**. Open one to see how it was understood, the draft, and what the check flagged.
- **Results:** the saved experiments, compared.

The first run builds the document index (a few seconds), and the first call to each model loads it into memory. The timeline shows that load time in amber.

## Your own documents

Set `DOCS_DIR` in `backend/.env` to a folder of `.md` or `.txt` files, then restart. The index is rebuilt when the documents change. Then update the prompts in `workflows/support-desk.json` so they name your product, and adjust the `intent` list in the Understand schema.

## The experiments

```bash
npm run experiment -- single --mode single                           # the Episode 2 way: one prompt, always sent
npm run experiment -- workflow                                       # the workflow
npm run experiment -- workflow-3b-check --check-model llama3.2:3b    # a smaller model as the check
npm run experiment -- workflow-no-format --no-format                 # no JSON schema passed to Ollama
```

Each one runs all 20 emails in `data/emails.json`, grades every reply, and saves `data/experiments/<name>.json`. `--only id1,id2` runs some of the emails.

Replies are graded the Episode 3 way:
- **Facts:** an email with `mustSay` passes when the reply contains every listed phrase.
- **Rubric:** an email with `rubric` is graded by `qwen2.5:7b-instruct`, which explains its reason before its verdict.
- **Outages:** they should be escalated, and need no reply.

The number that matters most is **wrong replies sent**: a reply that went out as `ready` and failed its grade. A wrong draft that went to review was **caught**. A right draft that went to review is the price of checking.

The grader is a model too, so read the replies it fails before you trust a number. If a rubric was unclear, fix it in `data/emails.json` and re-grade the saved replies without running the workflow again:

```bash
npm run experiment -- workflow --regrade
```

## Add a step

1. Add a node to `workflows/support-desk.json`, with a position for the diagram.
2. Connect it: change the edge that should lead to it, and add its own `next` (and `failure`) edges.
3. If it needs a new step type, add it to `backend/src/workflow/types.ts` and handle it in `executeStep()` in `engine.ts`, with a test in `engine.test.ts`.

For example, a `condition` after Understand that sends every `refund` email to review, or an `llm-text` step that translates the reply.
