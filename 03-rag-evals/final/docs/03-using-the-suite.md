# Using the eval suite

All commands run from this folder (`final/`). They need Ollama with `llama3.2:3b`, `qwen2.5:7b-instruct` and `nomic-embed-text`.

## Run an eval

```bash
npm run eval -- baseline
```

`baseline` is a configuration from [`evals/configs.json`](../evals/configs.json): chunk size, overlap, how many paragraphs to fetch (`topK`), the chat model and the system prompt. Other configurations override the baseline, for example `model-7b` only changes the chat model.

Options:

- `--repeats 3`: attempts per question (default 3)
- `--retrieval-only`: measure retrieval without generating answers. It's fast, and needs only the embedding model.
- `--only id1,id2`: run only these questions.
- `--name results-name`: save under another name, so a partial run doesn't overwrite `results/<config>.json`.

A configuration can also limit the knowledge base. `docs-episode-2` uses only Episode 2's two documents:

```bash
npm run eval -- docs-episode-2 --only student-discount --repeats 10 --name hook-2-docs
```

The run prints a report and saves everything, including every answer and the judge's reasons, to `evals/results/<config>.json`.

A run goes in four steps, an order that keeps memory low on an 8 GB machine:

1. retrieve every question once
2. generate every answer (after one warm-up call)
3. unload the answering model
4. grade, then unload the judge

## See it in the app

`npm run dev`, then open the **Evals** tab. Pick a run to see its scores, one dot per attempt for every question, and the questions that failed. Pick a second run under **Compare with** to see the change in each score and which questions improved or regressed. Click any question to read each answer with the grader's reason.

## Compare two runs

```bash
npm run eval:compare -- baseline prompt-b
```

Lists the questions that improved or regressed, then the overall change.

## Check before shipping

Save a run you trust as the baseline, then check every change against it:

```bash
cp evals/results/baseline.json evals/baseline.json
npm run eval:check -- prompt-b
```

The check fails (exit code 1) when:

- any one rate (overall, answers, honesty or retrieval) drops by more than 5 points. Each is checked on its own, because an average can hide a drop in one kind of question. Or:
- a question that passed every attempt in the baseline now fails every attempt.

Run it in CI and a worse change can't be merged without someone noticing.

Mind the sample size. With 6 unanswerable questions × 3 attempts, one attempt is 5.6 points of honesty, so a single flip trips a 5-point margin. Before you gate CI on it, add questions or raise the margin, and look at what changed with `eval:compare`.

## Check the judge

```bash
npm run eval:judge-check
```

Runs the hand-labelled answers in `evals/dataset/judge-labels.json` through the judge and prints how often it agrees.

## Add your own questions

Each entry in `evals/dataset/questions.json` looks like this:

```json
{
  "id": "refund-speed",
  "question": "How long does a refund take to reach my card?",
  "source": "fernhill-refund-policy.md",
  "evidence": ["within 5 to 10 business days"],
  "grade": { "type": "facts", "mustSay": ["5 to 10 business days|5-10 business days"] }
}
```

- `evidence`: a short phrase copied from the source document. Retrieval passes when a fetched chunk contains it.
- `grade`:
  - `facts` with `mustSay` phrases (`|` separates alternatives)
  - `judge` with a `reference` answer and a `rubric`
  - `refuse` for questions the documents don't answer, with `"source": null` and empty `evidence`

Write questions the way customers ask them, and include some the documents can't answer.

## Tests

```bash
npm test
```

Unit tests for the RAG pipeline and every part of the eval suite. They use fake models, so they don't need Ollama.
