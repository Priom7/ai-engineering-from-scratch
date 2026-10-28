# Why evals

An app that answers questions with a language model works most of the time. The hard part is knowing how often "most of the time" is, and noticing when a change makes it worse.

An **eval** is a repeatable test for that. It has four parts:

- a **dataset**: questions, with what a good answer looks like
- a **run**: the app answers every question, with fixed settings
- **graders**: code, or a second model, that decide pass or fail
- a **score**: pass rates you can compare from one run to the next

It's like a unit test suite, with one difference: the same question can get a different answer each time. So each question runs several times, and the score is a pass rate, not a single pass or fail.

## What it's for

- **Knowing where you stand.** A baseline score, and the exact questions the app gets wrong.
- **Changing things safely.** Change the prompt, the model or a retrieval setting, run the evals again, and compare question by question.
- **Choosing between options with numbers.** A bigger model might answer better and run slower. The eval tells you how much of each.
- **Stopping regressions.** `npm run eval:check` fails when a run scores worse than the saved baseline, so a worse change can't ship quietly.
