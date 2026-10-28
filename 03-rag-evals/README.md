# 03: RAG evals

The RAG app from Episode 2 works. This project answers the next two questions: how good is it really, and when you change something, did it get better or quietly worse?

It adds an eval suite and an **Evals view** to the same app. The suite asks the app 24 questions about Fernhill Cloud, three times each, and measures four things:
- **retrieval:** did it fetch the right paragraph?
- **answers:** is the answer correct?
- **honesty:** does it say so when the documents don't cover a question?
- **speed:** how long does each answer take?

Then you can compare runs question by question in the app, and block a change that makes the app worse.

## Videos

- **Concept:** what evals are, what to measure in a RAG app, and what they're for (link coming soon)
- **Build:** adding the eval suite to the Episode 2 app (link coming soon)
- **Ship:** is a bigger model worth it? The real results (link coming soon)

## What's in this folder

| Folder | What it is |
| --- | --- |
| `starter/` | The working RAG app, with the eval suite's core functions as `TODO`s. All tests included. |
| `final/` | The finished version, the results from the videos in `evals/results/`, and a docs pack in `final/docs/`. |
| `final/sample-docs/` | Six short documents about Fernhill Cloud, a fictional company. Two of them are from Episode 2. |

## Run it

You need Node.js 22 or newer and [Ollama](https://ollama.com):

```bash
ollama pull llama3.2:3b            # answers the questions
ollama pull qwen2.5:7b-instruct    # the judge
ollama pull nomic-embed-text       # embeddings for retrieval
cd final
npm install
npm test                           # 53 unit tests, no Ollama needed
npm run eval -- baseline           # about 8 minutes on an 8 GB M1
npm run dev                        # the app: Ask, and the new Evals view
```

Then try the experiments from the videos:

```bash
npm run eval -- topk-1 --retrieval-only     # retrieval only, seconds
npm run eval -- prompt-b
npm run eval:compare -- baseline prompt-b
cp evals/results/baseline.json evals/baseline.json
npm run eval:check -- prompt-b              # the check before shipping
npm run eval -- model-7b
npm run eval:judge-check                    # how often the judge agrees with labelled answers

# The opening experiment: one question, 10 attempts, Episode 2's 2 documents vs all 6
npm run eval -- docs-episode-2 --only student-discount --repeats 10 --name hook-2-docs
npm run eval -- baseline --only student-discount --repeats 10 --name hook-6-docs
```

Every run is saved in `evals/results/`. Open the **Evals** tab in the app to see a run's scores, every attempt as a dot, a comparison with any other run, and each answer with the grader's reason.

## What you write in the starter

| File | TODO |
| --- | --- |
| `evals/src/graders.ts` | `containsPhrase()`, `retrievalHit()` and `parseJudge()` |
| `evals/src/runner.ts` | `runEval()`: retrieve, generate every answer, unload, grade |
| `evals/src/summary.ts` | `summarize()`: the four rates and the median time |
| `evals/src/compare.ts` | `compareRuns()`: improved, regressed or unchanged |
| `evals/src/gate.ts` | `checkGate()`: block a run that's worse than the baseline |

Run `npm test` in `starter/` as you go: 11 eval tests pass at the start and 32 fail. The Evals view and its API routes are already done.

## The results from the videos

Measured on an 8 GB M1 with Ollama 0.40.9. Each run is 24 questions × 3 attempts. The judge is `qwen2.5:7b-instruct`, and it agreed with 19 of 20 labelled answers.

| Run | Retrieval | Answers | Honesty | Overall | Seconds per answer |
| --- | --- | --- | --- | --- | --- |
| Baseline: the Episode 2 app, `llama3.2:3b` | 100% | 91% | 89% | 90% | 2.0 |
| Prompt B: "say exactly: I couldn't find that" | 100% | 96% | 67% | 89% | 2.0 |
| `qwen2.5:7b-instruct` answering | 100% | 94% | 89% | 93% | 3.7 |

- **More documents changed an answer nobody tested.** Asked "Do you offer a student discount?" 10 times, the app was honest 8/10 times with Episode 2's 2 documents and 2/10 with all 6. The other 8 said yes, borrowing the new charity discount.
- **Retrieval isn't where this app fails.** It found the right paragraph every time with 2 or more paragraphs fetched, and at every chunk size tried. With only 1 paragraph fetched, it found 15 of 18.
- **Prompt B looks the same overall but isn't.** Correct answers went up and honesty went down. The check before shipping blocks it.
- **The 7B model is no real improvement, at almost twice the time.**
  - Only one question changed: camera upload.
  - On it, the 3B model's three answers say the same thing, and the judge passed one and failed two.
  - Graded consistently, both models score 93%.
  - Both still invent a student discount.
  - Look at what changed, not just the total.

**Know the limits.** 24 questions × 3 attempts is a small sample: one attempt moves the overall score by about 1.4 points, and the honesty score by 5.6. Treat differences of a few points as noise until you've looked at the questions that changed. The 5-point gate is deliberately strict on honesty; raise the margin or add questions before relying on it in CI.

Your numbers can differ with other model versions or hardware.

## Homework challenge

Point the eval suite at your own documents:

1. Write 5 questions your users would ask, including 2 your documents can't answer.
2. Run the baseline, then find the setting or prompt that scores best without a regression.
3. Share your before and after numbers in a pull request.

The best ones get featured at the start of the next Build video.
