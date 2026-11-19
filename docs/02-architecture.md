# Architecture

Status: Implemented prototype baseline, November 20, 2026.

## Why this storage model

The central consistency boundary is an accepted change: the page, historical revision, and review decision must agree. SQLite provides a local transaction for these records without a separate service. Git is not needed for that transaction. The schema stores structured claims and citations as JSON within typed lifecycle tables; there is no second authoritative Markdown page.

Original source files use a separate immutable archive so model suggestions cannot replace their evidence. Each artifact contains exact original bytes, filename, timestamp, SHA-256, and stable identity. Identical filename/content imports reuse an artifact; changed content creates a new artifact. A filename is not proof of shared external identity.

## Components

```text
React: Knowledge / Inbox / Review
                |
Node.js local HTTP boundary
  |             |                  |
SourceStore   Maintenance       KnowledgeStore (SQLite)
                |
        Chat Completions adapter
```

The frontend receives model configuration status and destination, never credentials. Source text is rendered as escaped text. No provider tool execution is available.

## Data model

| Record | Responsibility |
| --- | --- |
| Source artifact | Immutable evidence and original bytes |
| Processing run | running / completed / failed; safe error and retry context |
| Proposal | Candidate title, claims, evidence, conflicts, before snapshot, base revision, and model |
| Page | Current accepted knowledge and revision number |
| Revision | Accepted snapshot, proposal identity, review note, and timestamp |

## Processing

The backend sends one selected source plus up to 20 current pages and their evidence, capped at 60,000 context characters. A single request proposes one page. No vector retrieval is implied. The adapter supports OpenAI and DeepSeek Chat Completions with JSON output, a 6,000-token completion budget, a 60-second timeout, and no retries. OpenAI uses `max_completion_tokens`; DeepSeek uses `max_tokens` and disables thinking. The example selects OpenAI `gpt-4.1`; legacy provider inference is documented in the root README. Truncated, malformed, or oversized output fails visibly.

Server validation checks field/list limits, target membership, citation source scope, and verbatim quote occurrence in preserved source text. A conflict needs evidence from at least two sources. At least one quote must come from the new source. Reused evidence is limited to the selected source and target page's prior evidence.

These checks do not prove semantic entailment, completeness, or correct contradiction classification. Review remains essential. An exact quote appearing several times is not position-disambiguated.

## Review transaction

Acceptance revalidates evidence, opens an immediate database transaction, checks pending status and current page revision, writes the accepted page and revision, then marks the proposal accepted. Any failure rolls the transaction back. Rejecting only changes the proposal's review state.

Two proposals based on the same revision cannot both overwrite the page: the second becomes stale and must be rejected/reprocessed. A conflict-bearing proposal requires a review note and retains the conflict after acceptance.

## Failure and recovery

Original-source publication uses complete temporary files and exclusive hard links. Reopening SQLite preserves review state; previously running requests become failed without being resent. An interrupted run may already have produced a proposal, so pending suggestions block duplicate processing. A failed model call never modifies an accepted page.

An exclusive transaction in a separate rollback-journal SQLite file holds an OS-backed library lock for the server lifetime. Canonical directory paths prevent aliases from bypassing it. Port binding and lock acquisition both precede knowledge-database recovery: a rejected second process cannot mark active runs interrupted, even on another port. Graceful shutdown drains requests before releasing ownership; abrupt process exit releases the OS lock. Never unlink the lock file while a process is alive. Older versions without this lock must be stopped before upgrading.

## Local security and configuration

The server binds to loopback and validates Host, Origin, and cross-site request headers. Model endpoints must be HTTPS or loopback HTTP without URL credentials/query parameters. Redirects are rejected. The local `.env` is backend-only, Git-ignored, and should be mode 0600. No request bodies, raw provider errors, or keys are logged.

This is not a defense against a malicious process running as the same OS user. Do not expose the service publicly. Stop the process before backing up both the database state directory and source directory.

## API contract reference

DeepSeek configuration was checked against [Chat Completions documentation](https://api-docs.deepseek.com/api/create-chat-completion/) and [Models documentation](https://api-docs.deepseek.com/quick_start/pricing/) on November 20, 2026. Live-model evaluation results are recorded separately.

OpenAI JSON mode is documented in [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). JSON mode does not establish schema validity or factual accuracy; application validation and human review remain required. OpenAI live calls have not been validated.
