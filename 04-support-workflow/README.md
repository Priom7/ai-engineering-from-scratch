# 04: Support workflow

One prompt can answer a customer email. It can't check its own answer, notice an outage, or know when to ask a person. This project chains small model calls into a **workflow**: each step does one job, and the app decides what happens to the reply.

It's an AI support desk for Fernhill Cloud. Every email goes through six steps:
1. **Understand:** a model reads the email and returns JSON (intent, plan, urgency, the question), checked against a schema and retried with the error if it's wrong.
2. **Outage?** Outages go straight to the on-call team, before anything is written.
3. **Find:** retrieval from the help documents (Episode 2).
4. **Draft:** a model writes a reply from those documents.
5. **Check:** a second, larger model lists any claim the documents don't support (Episode 3's judge).
6. **Decide:** a supported reply is ready to send; anything else goes to a person.

The app shows each run live as a diagram, with every step's input, output and time.

## Videos

- **Concept:** prompts, workflows and agents, and when each is the right tool (link coming soon)
- **Build:** the workflow engine, the check step and the live diagram, step by step (link coming soon)
- **Ship:** my AI support desk checks itself before replying (link coming soon)

## What's in this folder

| Folder | What it is |
| --- | --- |
| `starter/` | The app, the API and the workflow file, with the engine's core functions as `TODO`s. All tests included. |
| `final/` | The finished version, the results from the videos in `final/data/experiments/`, and a docs pack in `final/docs/`. |
| `final/workflows/support-desk.json` | The workflow itself: steps, prompts, models and edges. Edit it and the diagram follows. |
| `final/sample-docs/` | Six short documents about Fernhill Cloud, a fictional company, from Episodes 2 and 3. |

## Run it

You need Node.js 22 or newer and [Ollama](https://ollama.com):

```bash
ollama pull llama3.2:3b            # Understand and Draft
ollama pull qwen2.5:7b-instruct    # the check, and the grader
ollama pull nomic-embed-text       # embeddings for retrieval
cd final
npm install
npm test                           # 42 unit tests, no Ollama needed
npm run dev                        # the app: Workflow, Inbox and Results
```

Open the **Workflow** tab, pick an email and press **Run**. Switch to **Single prompt** to see what one prompt sends to the same customer. The **Inbox** tab takes any email you paste.

Then run the experiments from the videos. Each one runs all 20 sample emails and grades every reply:

```bash
npm run experiment -- single --mode single                           # one prompt, always sent (about 2 minutes)
npm run experiment -- workflow                                       # the workflow (about 11 minutes on an 8 GB M1)
npm run experiment -- workflow-3b-check --check-model llama3.2:3b    # a smaller model as the check
npm run experiment -- workflow-no-format --no-format                 # no JSON schema passed to Ollama
```

Results are saved in `data/experiments/` and compared in the **Results** tab.

## Use your own documents

Set `DOCS_DIR` in `final/backend/.env` to a folder of `.md` or `.txt` files and restart. Then edit the prompts in `workflows/support-desk.json` so they name your product, and adjust the `intent` list in the Understand schema. Write a few of your own emails into `data/emails.json` to measure it. See [final/docs/03-running-and-measuring.md](final/docs/03-running-and-measuring.md).

## What you write in the starter

| File | TODO |
| --- | --- |
| `backend/src/workflow/engine.ts` | `runWorkflow()`: the loop that runs a step, records its trace and follows the right edge |
| `backend/src/workflow/engine.ts` | The `llm-json` step: ask for JSON, check it against the schema, retry with the error |
| `backend/src/workflow/engine.ts` | The `condition` step: a branch that's true when every rule matches |
| `backend/src/workflow/judge.ts` | `parseCheck()`: read the check model's verdict |
| `backend/src/experiments/grade.ts` | `gradeOutcome()`: was a wrong reply sent, caught, or was it right? |

Run `npm test` in `starter/` as you go: 23 tests pass at the start and 19 fail. The app, the diagram, the API and the experiment runner are already done.

## The results from the videos

Measured on an 8 GB M1 with Ollama 0.40.9: 20 emails, one run each. Replies are graded the Episode 3 way, by fact checks and by `qwen2.5:7b-instruct` with a rubric. I also read all 72 graded replies myself; the grader agreed with me on 64. Where we differ, my count is in brackets.

| Run | Wrong replies sent | Wrong drafts caught | Right drafts held for review | Outages escalated | Median per email |
| --- | --- | --- | --- | --- | --- |
| Single prompt | 7 (6) | 0 | 0 | 0/2 | 3.5 s |
| Workflow | **1** | 4 | 5 | 2/2 | 31.4 s |
| Workflow, 3B check | 0 | 4 (6) | 14 (12) | 2/2 | 20.4 s |
| Workflow, no JSON format | 4 (3) | 2 | 5 | 2/2 | 30.7 s |

- **The workflow sent 1 wrong reply where the single prompt sent 6.** The same small model wrote both, from the same documents. Both promised a full refund to a customer two months into an annual plan (it's the unused months minus 15%). The single prompt sent it. The workflow's check held it for review, along with 3 other wrong drafts.
- **The single prompt can't escalate.** On one outage it told the customer "I will page the on-call engineer"; nobody was paged, because a reply is only text. On the other it said there was no sign Fernhill was down. The workflow sent both outages to on-call before writing anything.
- **Checking has a price.** 9 of 20 emails waited for a person, and 5 of those drafts were fine. Each email took about 9× as long.
- **The check isn't perfect.** It let one invented answer through ("we don't have a physical office address"), and its reasons are sometimes wrong even when its verdict is right. "Ready to send" still deserves a glance.
- **A small check is no check.** With `llama3.2:3b` as the check, every one of the 18 drafts was flagged: nothing wrong was sent, and nothing was sent at all.
- **JSON was never the problem here.** Understand returned valid JSON on the first try in all 60 runs, including the 20 without Ollama's `format` setting, and all 54 of the check's replies parsed. The schema check and retry are insurance, and the unit tests show them working.
- **29% of the workflow's time is loading models.** On 8 GB the 3B and 7B models can't stay in memory together, so they swap on every email. With the 3B check, loading was 1%.

**Know the limits.** 20 emails, one run each, is a small sample, and the drafts change from run to run, so treat one or two emails as noise. The no-format run's extra wrong replies aren't from the setting: it only changes Understand, which routed every email the same way. They come from different drafts and different check verdicts. The grader is a model too: read the replies it fails, and re-grade with `--regrade` if a rubric was unclear.

Your numbers can differ with other model versions or hardware.

## Homework challenge

Add a step to the workflow:

1. Pick one: a `condition` after Understand that sends every refund email to a person, an `llm-text` step that translates the reply into the customer's language, or your own idea.
2. Add it to `workflows/support-desk.json` and watch it appear in the diagram.
3. Run `npm run experiment -- my-step` and compare it with `workflow` in the Results tab. Did wrong replies sent go down, and what did it cost?

Share your workflow file and your numbers in a pull request. The best ones get featured at the start of the next Build video.
