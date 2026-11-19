# Verification

Date: November 20, 2026.

## Automated checks

`make check` passed: TypeScript validation, **16 tests**, and the production Web build.

Coverage includes original-byte persistence; duplicate and changed-source imports; invalid input and symlinked artifacts; HTTP origin/host boundaries; proposal creation without page mutation; acceptance and rejection; repeated-review refusal; exact citation validation; same-page updates and retained revisions; conflict-note requirements; stale-revision refusal; interrupted processing recovery; safe provider errors; concurrent-processing refusal; and transaction rollback when revision insertion fails.

The maintenance tests use an explicitly injected deterministic provider that exists only in tests. The application has no simulated AI mode.

## Live DeepSeek evaluation

`LOOMWIKI_LIVE_EVAL=1 pnpm exec tsx scripts/evaluate.ts` passed with the configured `deepseek-flash` endpoint.

Two real requests used synthetic Project Birch retention-policy documents in a temporary isolated library:

1. The first source produced a cited new-page proposal. Knowledge stayed empty until acceptance; acceptance created revision 1.
2. The second source produced an update targeting the same page and flagged the overlapping retention-policy disagreement. Knowledge stayed at revision 1 until acceptance with a review note; revision 2 retained both perspectives and the earlier revision.

No private source data was sent. The temporary evaluation library was removed afterward. There were no automatic retries. Exact billing was not checked; two successful synthetic examples do not establish general model accuracy or contradiction-detection coverage.

## HTTP and configuration

The isolated local service on port 4312 returned HTTP 200 for the workspace API, HTML, and bundle, with provider configuration reported available. `.env` is ignored by Git and has owner-only mode 0600. No key values were printed.

## Code review

One in-session review was performed without sub-agents. Fixes included binding the port before database recovery, restricting reused evidence to the target page context, and preventing navigation during asynchronous mutation/history operations. Transaction rollback and concurrent-processing regressions were added. No additional review round is claimed.

## Browser acceptance

Not completed. The browser access host was unavailable, and native Google Chrome control was not approved by the tool. HTML/JavaScript availability is not proof of successful browser interaction, visual quality, or responsive behavior.

Manual checks still needed: Inbox import and paste; selected-source processing disclosure; Review before/proposed layout and original-source inspection; accept/reject controls; Knowledge history rendering; narrow-screen layout and keyboard navigation.

## Other limits

Real power loss, storage exhaustion, malicious same-user filesystem races, independent processes sharing one state directory, large libraries, and general semantic quality are not verified. Positional citation offsets, background processing, multi-page proposals, and multi-user hosting are not implemented.

## Original-source interaction fix — November 20, 2026

The former Inspect original action rendered its result at the bottom of the entire page without moving focus or showing progress. The source now expands directly beneath the clicked quotation, with loading, local failure/retry, close, and focus restoration. In-flight reads are aborted on close or unmount; changing the citation resets its displayed source.

`make check` passed with 17 tests, type checks, and the Web build. The new React/jsdom regression exercises click, loading, inline placement, escaped source text, close/focus, failure/retry, and switching citations. This is DOM interaction evidence, not native-browser visual acceptance.

One code review checked request cancellation, citation identity, explicit button types, and text rendering. No additional changes to provider calls, knowledge state, or credentials were made. Native-browser rendering remains unverified.

## Demo delivery hardening — November 20, 2026

This section supersedes earlier browser and multi-process limitations where explicitly covered below.

- Added library ownership through an exclusive SQLite transaction, with same-directory aliases, cross-process exclusion, abrupt-exit release, separate-port refusal, unchanged active-run status after rejected startup, and graceful-restart recovery tests.
- Added actionable startup messages for occupied ports, missing build assets, invalid model configuration, and unavailable credentials. Error tests confirm that a supplied synthetic key is not printed.
- Chromium workflow passed with a deterministic, explicitly labeled fixture provider: import, original inspection and close, acceptance, conflict update, revision history, refresh persistence, paste, simulated failure/retry, rejection, and 390px layout without horizontal overflow. Browser console captured no page errors. This is actual rendered-browser interaction evidence, not a real-provider UI session.
- Inspected full-page screenshots for Review, Knowledge/history, and narrow-screen Knowledge. Content, citations, and actions are readable; long pages intentionally scroll.
- All 21 automated tests passed on the advertised minimum Node 22.19.0 runtime. jsdom was pinned to 26.1.0 because the previously installed major version required a newer runtime. Node 22 emits the expected experimental SQLite warning.
- GitHub Actions configuration adds Node 22.19.0/24 checks and a Chromium job. Remote CI has not executed; local checks do not imply a remote CI success.
- Publication checks inspect tracked and non-ignored candidate files, common secret patterns, environment-held secret matches, symlinks, and required ignore rules without printing values. This is not a comprehensive secret or history audit.
- MIT licensing was explicitly selected by the owner and added to LICENSE and package metadata. No commit, push, or publication was performed.

The previous two-request live DeepSeek evaluation remains historical evidence; this hardening pass did not send new provider requests. Real power loss, disk exhaustion, hostile same-user filesystem mutation, and general model accuracy remain unverified.

### Final delivery verification

The final `make check` passed with 21 tests, type checks, and build; `make release-check` passed. Node 22.19.0 independently passed all 21 tests, type checks, and build. Screenshots were visually inspected at desktop and narrow-screen sizes. CI remains configured-only until a remote push runs it.

One in-session code review covered lock ownership/release, startup cleanup, secret-safe diagnostics, CI isolation, publication checks, and compatibility. The existing separate meanings of `LOOMWIKI_STATE_DIR` and `LOOMWIKI_DATA_DIR` were preserved to avoid changing where old source artifacts are read. No new real-provider requests were issued.

## OpenAI and DeepSeek configuration — November 20, 2026

The example now selects OpenAI `gpt-4.1`. Provider-specific request parameters are isolated; existing DeepSeek configurations without a provider selector retain their previous behavior. The local `.env` and credentials were not changed.

`make check` passed with 25 tests, type checks, and build. Four offline adapter tests cover OpenAI request shape, legacy and explicit DeepSeek settings, endpoint inference and overrides, and sanitized failure/incomplete JSON handling. An existing startup-test race was fixed by waiting for the disabled-provider diagnostic before asserting it. `make browser` passed its synthetic Chromium workflow; `make release-check` passed for 48 candidate files.

One in-session code review checked configuration compatibility, provider-specific parameters, credential boundaries, unchanged review validation, and test isolation. No live OpenAI or DeepSeek requests were sent during this change. OpenAI account access, billing, and real-model output quality remain unverified; the earlier DeepSeek evaluation remains historical evidence.

## Verified remote CI — November 20, 2026

This supersedes the earlier pre-push statements about remote CI. [GitHub Actions run 44584079862](https://github.com/hopesoft/loomwiki/actions/runs/44584079862) completed successfully for commit `aa17535`. Both Node 22.19.0 and Node 24 check jobs passed, as did the Chromium browser job. These are remote automated results with synthetic data, not live-model evaluation or a hosted production deployment. The root README links to the run and displays the current CI badge.
