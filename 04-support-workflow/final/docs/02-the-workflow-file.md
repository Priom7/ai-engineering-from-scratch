# The workflow file

The whole workflow is data: [`workflows/support-desk.json`](../workflows/support-desk.json). The engine (`backend/src/workflow/engine.ts`) reads it and walks it one step at a time. The app draws the same file as a diagram.

## Steps and edges

```json
{
  "start": "understand",
  "nodes": [{ "id": "understand", "type": "llm-json", ... }, ...],
  "edges": [{ "from": "understand", "to": "is-outage", "kind": "next" }, ...]
}
```

After a step finishes, the engine follows one of its edges:

| Edge kind | Followed when |
| --- | --- |
| `next` | The step succeeded |
| `true` / `false` | A `condition` step decided |
| `failure` | The step threw an error, timed out, or ran out of retries |

A step with no matching edge ends the run as `failed`. An `end` step ends the run with its `outcome`: `ready`, `review` or `escalated`.

## Shared data

Every step reads from and writes to one **context** object. It starts as `{ email }`. A step with `"output": "understand"` saves its result as `context.understand`, and later prompts read it with `{{understand.question}}`.

## Step types

| Type | What it does | Main fields |
| --- | --- | --- |
| `llm-json` | Asks a model for JSON and checks it against a JSON schema. If it's invalid, the model gets the exact error and tries again. | `model`, `system`, `prompt`, `schema`, `maxRetries`, `useFormat` |
| `retrieve` | Finds the closest paragraphs in the documents (Episode 2's retrieval) | `query`, `topK` |
| `llm-text` | Asks a model for text: the reply | `model`, `system`, `prompt` |
| `judge` | A second model checks a reply against the sources and lists unsupported claims. Anything but a clear "supported" counts as unsupported. | `model`, `answerFrom`, `contextFrom` |
| `condition` | Picks the `true` or `false` edge. True when every rule matches. | `all: [{ key, equals }]` or `{ key, in }` |
| `end` | Ends the run | `outcome` |

Every step can also set `timeoutMs` (the default is 120 seconds).

`useFormat: true` passes the schema to Ollama, which constrains the model to valid JSON. The engine still validates the result, because a reply can be valid JSON with the wrong values, such as an intent that isn't in the list.

## The trace

For every step, the run records:
- its start time and duration
- **model time** and **load time**, kept apart, so the seconds spent loading a model into memory aren't mistaken for thinking
- every attempt, with the raw reply and the validation error
- its output or error, and which step came next

Runs are saved in `data/runs/`. The app shows them live: the backend streams `step-start`, `step-end` and `run-end` events (server-sent events) while the run happens.
