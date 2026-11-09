# Why a workflow

Episode 2's app answers with **one prompt**: find the paragraphs that match the question, then ask the model to answer from them. That works most of the time. Episode 3 measured the rest: sometimes the model answers a question the documents don't cover, and invents the answer.

For a chat window, that's a wrong answer on screen. For a support desk, it's a wrong promise in a customer's inbox.

## Three ways to use a model

| | What it is | Good for |
| --- | --- | --- |
| **Single prompt** | One model call with everything it needs | Simple tasks where a wrong answer is cheap |
| **Workflow** | A fixed chain of steps you design. Each step has one job, and the edges between them decide what runs next. | Tasks you can describe in advance, where each step can be checked |
| **Agent** | The model decides which tools to call and when to stop | Open-ended tasks where you can't list the steps beforehand |

A support reply is a task you can describe in advance: understand the email, find the facts, draft a reply, check it, decide where it goes. So a workflow fits. It's also easier to test, trace and trust than an agent, because you know every path it can take.

## What the workflow adds

- **Structured output.** The first step turns the email into fields (`intent`, `plan`, `urgency`, `question`) and checks them against a JSON schema. If the model's JSON is wrong, it gets the error back and tries again.
- **Branches.** An urgent outage skips the draft and goes straight to the on-call team.
- **A check before sending.** A second model reads the draft next to the sources and lists every claim the sources don't back up.
- **A person in the loop.** A draft with unsupported claims goes to **Needs review**, with those claims listed, instead of to the customer.
- **A trace.** Every step's input, output, attempts and time are saved, so you can see exactly why an email ended up where it did.

The price is time: several model calls instead of one. The Results view shows how much.
