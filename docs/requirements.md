# QA Bot Requirements

## Overview

An LLM-based QA bot that answers user questions grounded in a curated markdown knowledge base.

## Scope

Personal internal tool for a single user, running on localhost. **Simplicity over completeness** — prefer a small number of obvious pieces over flexible abstractions. No authentication, no multi-user support, no deployment complexity.

## Stack

- Backend: **Node.js**.
- Frontend: a web UI served by the same Node process.
- Storage: plain files on disk. No database.

## Model

- Default provider: DeepSeek API.
- Model-agnostic: switching providers requires only configuration changes (environment variables), not code changes. Any OpenAI-compatible endpoint is supported out of the box (DeepSeek, OpenAI, Ollama, LM Studio, vLLM, …). Non-compatible providers can be added as adapters when actually needed.

## Knowledge Base

- Format: a collection of markdown files.
- Size bound: each file is at most 10,000 Chinese characters (~15k tokens), which comfortably fits in a single LLM context window.
- Storage: plain files under a KB directory on disk.

## Retrieval

No RAG, no vector embeddings. Use an agentic **grep-then-read** pattern, similar to how coding agents navigate a repo:

1. Present the LLM with a lightweight index (filename + first-line title/heading of each file).
2. The LLM selects relevant files by listing/grepping that index, or by keyword-grepping file contents.
3. The LLM reads the chosen files in full and answers from that context.

Rationale:
- Whole-file reads preserve context better than RAG chunks.
- The 10k-character file bound keeps per-read cost predictable.
- No embedding pipeline, no vector store, no chunking strategy to maintain.

Revisit only if recall demonstrably breaks on paraphrased or semantic questions where user wording doesn't overlap with filenames or file contents.

## Frontend

A web UI that covers:
- **Browse** — list and view all knowledge base files.
- **Manage** — create, edit, and delete markdown files.
- **Chat** — ask questions and receive answers, with citations back to the source file(s) used.
