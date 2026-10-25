# How RAG Works

RAG means **retrieval-augmented generation**.

Instead of asking the model to answer from general memory only, the app:

1. stores your document chunks
2. turns them into embeddings
3. embeds your question
4. finds the most similar chunks
5. sends those chunks to the model as context
6. asks the model to answer from that context

This project does exactly that in a beginner-friendly way.

## Why citations matter

Without citations, the answer looks confident but you cannot tell where it came from.

With citations, you can inspect:

- which document matched
- how strong the match was
- what text was actually retrieved

