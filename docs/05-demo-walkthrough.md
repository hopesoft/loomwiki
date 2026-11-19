# Demo Walkthrough

Date: November 20, 2026. Use only the supplied synthetic examples when demonstrating the repository.

## Setup

Run `make install`, configure `.env` from `.env.example`, and run `make dev`. Open `http://127.0.0.1:4310`. Real processing uses your configured provider and may incur charges. Model output varies; do not present this script as a guaranteed model result.

## Five-minute workflow

1. Open **Inbox**, choose **Import Markdown**, and select `fixtures/retention-policy.md`. Expect the preserved original and source details; import alone does not contact the model provider.
2. Read the processing disclosure and choose **Send to AI & prepare review**. Expect a proposed new page in **Review**. Knowledge should remain unchanged.
3. Expand **1 source reference**, choose **Inspect original**, and check the original directly below the quotation. Close it with **Close original**.
4. Choose **Accept update**. Open **Knowledge**, select the page, and verify revision 1.
5. Import `fixtures/revised/retention-policy.md` and process it. Expect a proposal targeting the same page, with the differing 30-day and 90-day retention claims visible for review. If the model does something else, treat that as evaluation evidence rather than silently adjusting the demo.
6. Review **Before** and **Proposed**, inspect both sources, and add a note such as “Retain both perspectives until the policy owner clarifies the discrepancy.” Accept, then confirm revision 2 and the preserved first revision under **View revision history**.
7. To demonstrate rejection, process another synthetic source and choose **Reject suggestion**. Confirm Knowledge is unchanged.
8. Refresh the browser. Accepted knowledge and history should remain available. Stop and restart the server to verify persistence beyond the browser session.

## Deterministic browser acceptance

`make browser` uses an isolated test server with an explicitly labeled fixture provider. It covers import, citation inspection, close/focus behavior, acceptance, conflicting update, history, refresh, paste, a simulated failure/retry, rejection, and a 390px viewport check. It sends no model requests.

To regenerate the documentation screenshots intentionally:

```sh
LOOMWIKI_CAPTURE_DEMO=1 make browser
```

The generated screenshots contain synthetic content only. Their visible fixture label must not be removed or described as live-model evidence.

## What to say when sharing

“LoomWiki is an early local Web demo of AI-maintained, human-reviewed knowledge. It preserves original sources and accepted revisions. Browser workflow tests use a deterministic test provider; a separate two-request DeepSeek evaluation exercised a synthetic create/update/conflict flow. Broader model accuracy, multi-user hosting, and production operations are not established.”
