# What to measure in a RAG app

A RAG app can fail in two places: it can fetch the wrong paragraphs, or it can answer badly from the right ones. Measure them separately, or you won't know which one to fix.

| Measure | Question it answers | How it's graded |
| --- | --- | --- |
| **Retrieval** | Did the right paragraph come back? | Code: does a retrieved chunk contain the question's evidence phrase? No model needed. |
| **Answers** | Is the answer correct? | Code for facts that must appear ("30 days"), whole words only and not negated. An LLM judge with a rubric where meaning matters ("a partial refund, minus a fee"). |
| **Honesty** | When the documents don't say, does the app say so? | The judge, with a fixed rubric: pass only if the answer says the documents don't cover it. |
| **Speed** | How long does an answer take? | The median seconds per answer, after a warm-up call so model loading isn't counted. |

## Graders: code first

Code graders are instant, free and never change their mind. Use them whenever the answer must contain a specific fact. They can't judge meaning, so "No, you cannot get a refund" and "Yes, you can get a refund" look alike to a word check. That's where the judge comes in.

## The LLM judge

The judge (`qwen2.5:7b-instruct` by default) gets the question, the context the app saw, a reference answer and a rubric, and replies with JSON: `{"pass": true or false, "reason": "..."}`. It runs at temperature 0 with a JSON schema. A reply that isn't valid JSON counts as a fail, never a pass.

A judge is a model too, so check it. `npm run eval:judge-check` runs answers that were labelled by hand through the judge and reports how often it agrees. Be extra careful when the judge grades its own model's answers.

## Repeats

Each question runs 3 times, with seeds 1, 2 and 3, at the app's real settings. A question that passes 1 time out of 3 is a real problem that a single run would miss half the time.
