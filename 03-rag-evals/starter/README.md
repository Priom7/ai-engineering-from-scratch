# RAG evals: starter

> **This is the starter version.** The RAG app from Episode 2 works, and the eval suite is wired up,
> but its core functions are `TODO`s. Follow the Build video, or see `../final` for the finished code.

See [the project README](../README.md) for the videos and the list of TODOs.

```bash
npm install
npm test        # the eval tests fail until the TODOs are done
```

When `npm test` passes, run your first eval with `npm run eval -- baseline`. It needs Ollama with
`llama3.2:3b`, `qwen2.5:7b-instruct` and `nomic-embed-text`.
