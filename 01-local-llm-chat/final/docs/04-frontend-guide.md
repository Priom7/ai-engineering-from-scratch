# Frontend Guide

## Frontend job

The frontend handles the user experience:

- inputs
- buttons
- chat history
- model selection
- error messages
- response stats

## Important files

- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/types.ts`
- `frontend/src/styles.css`

## What happens on page load

When the page starts, it loads:

1. app config
2. backend health status
3. available models

That gives the user immediate feedback before they send a message.

## What happens when the user sends a message

1. the frontend adds the user message to local state
2. it sends the conversation to the backend
3. it waits for the backend response
4. it adds the assistant reply to local state
5. it shows response stats

## Why this UI is simple

This project is meant to teach structure, not visual complexity.

So the UI has:

- one page
- one chat area
- one model field
- one system prompt field
- one clear primary action

## Suggested beginner exercises

- add a keyboard shortcut for submit
- disable submit when the model field is empty
- show the timestamp of each message
- store the last system prompt in `localStorage`

