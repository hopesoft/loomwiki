# First Milestone: Maintain Knowledge Through Review

Status: Implemented; automated and limited live-model checks passed. Browser acceptance pending. November 20, 2026.

## Acceptance

1. Import or paste a source without sending it to a provider.
2. Start processing explicitly with the destination and context scope visible.
3. Generate a cited new-page proposal; accepted knowledge remains empty until approval.
4. Inspect evidence and accept the proposal; create the page and its first revision atomically.
5. Add a second related source and propose an update to the same page.
6. Compare prior/proposed content and inspect both sides of any disagreement.
7. Accept with a note where conflicts exist; preserve prior revisions and original evidence.
8. Reject a suggestion without modifying knowledge.
9. Refuse a stale suggestion, unknown citation, or fabricated quote rather than silently accepting it.
10. Preserve data across restart; show failed/interrupted runs and allow an explicit retry.

## Evidence layers

Deterministic regressions validate state transitions and guardrails. Real DeepSeek requests validate the adapter and a limited synthetic task. Browser inspection validates interaction and rendering. None of these alone establishes general content accuracy.

## Not required for this milestone

Automatic processing, automatic acceptance, vector search, multi-page changes, hosted deployment, arbitrary editing, or export.
