# Misu provider reliability

Misu planning runs in the deployed Nuxt server and calls Groq directly. AWS stores the owned lesson and session data through Vercel workload identity. Signing into a personal AWS session does not refresh Groq authentication or limits.

The function-planning path uses the complete `propose_session_plan` schema as its output contract. Once all declared Misu read tools have confirmed results, the runner requests that proposal directly. A model that returns another read instead is rejected before that read executes again. Approval, source references and proposal validation remain required.

## Diagnose a production failure

Use Vercel's project Runtime Logs and find the static event `Airs agent provider rejected a request`. The event and failed API response contain only the safe provider status, category and retry metadata. Never copy provider response messages, generated content, API keys or learner transcripts into support records.

| Code | Meaning | Owner action |
| --- | --- | --- |
| `AGENT_PROVIDER_RATE_LIMITED` | HTTP 429, request or token limit | Respect the validated `retryAfterSeconds` when present and inspect the Groq organization/model limits. Repeated clicks can worsen the limit. |
| `AGENT_PROVIDER_CONFIGURATION` | HTTP 401 or 403 | Check the production provider key and model permissions in the provider/Vercel consoles. Repair credentials through the normal secret configuration; do not paste them into logs or support messages. |
| `AGENT_PROVIDER_RESULT_INVALID` | HTTP 400 with the fixed `tool_use_failed` code | Retry manually after checking the function schema/output contract. No raw generation is logged. |
| `AGENT_PROVIDER_REQUEST_INVALID` | HTTP 400, 404, 413 or 422 without that tool-failure classification | Inspect model/request compatibility and size. An identical automatic retry is not performed. |
| `AGENT_PROVIDER_UNAVAILABLE` | Other provider errors | Check provider status and retry manually when available. |

Network failures remain `AGENT_CONNECTION_FAILED`; they are separate from an HTTP rejection. Unknown provider error prose is discarded. Only an allowlisted tool-failure code is inspected, from at most 8 KiB of error body. Retry delays are bounded to one day.

These changes resolve contradictory planning instructions and redundant read rounds. They do not establish the cause of a historical production failure whose provider status was not retrieved. They also do not increase an account's quota or silently switch providers. Mocked tests do not prove live model availability. Paid model and voice checks remain owner-run.

## Kai review recovery

Kai receives the exact permitted evidence IDs and approved criterion IDs. A generated review that cites an unavailable reference is rejected with `502 / KAI_EVIDENCE_INVALID` and a message explaining that practice is saved and the review can be retried. The invalid review is not published, the review lock is released, and an explicit retry can use the same saved practice. Provider and persistence failures retain their own handling.

[Recovery regressions](../../tests/airs-kai-recovery.test.ts) verify rejected references, preserved records, released locks, valid retry and cached replay. These fixture results establish a reproducible generic-500 path was repaired; they do not attribute a historical live failure or prove paid model availability.

## Verbal skills and session completion

Kai assessment v0.3 describes understanding, clarity, vocabulary and reasoning shown in the saved practice. Each assessed skill cites permitted evidence and exact learner quotations. Partial meaning, help used and material transcription uncertainty stay visible; skills not elicited are marked not assessed. This is session feedback, not a standardized intelligence score, acoustic assessment or longitudinal trend. See [assessment contract and regressions](../../tests/kai-assessment.test.ts).

Existing reviews remain readable. Opening them does not generate another paid review: the learner can explicitly refresh for verbal skills feedback. Rich reviews use a new cache version and preserve older artifacts. Invalid citations or quotes retain saved practice and offer review retry.

After the final Kai page is read, Misu invites the learner to practise again or choose a new session. A covered session with learning evidence gets brief confetti that honors reduced motion; ended sessions with gaps and zero-evidence closures use factual wording. Dismissal is remembered for the current browser session and Next session reopens the invitation explicitly.

Practise again creates an independent source copy and fresh pending plan with the original source snapshot and preferences. It preserves the previous ledger, attempts and review, requires new plan approval, and does not bypass microphone consent. The same request ID reuses the fresh session; an interrupted source copy can resume only while owned, pristine and source-preparing. [Repeat regressions](../../tests/study-repeat.test.ts), [invitation regressions](../../tests/study-completion-invitation.test.ts) and [desktop/mobile browser journeys](../../tests/source-e2e/session-completion.spec.ts) verify these controls without paid voice/model calls.

## Verification

Focused tests cover distinct output contracts, confirmed reads, forced-choice enforcement, schema validation, safe error categories, bounded body inspection and retry metadata. The public export manifest and parity check include the new classifier and regression tests.

References: [provider classifier](../../server/services/airsProviderFailure.ts), [runner regressions](../../tests/airs-orchestration.test.ts), [output-contract regressions](../../tests/study-misu-output-contract.test.ts), [Groq error codes](https://console.groq.com/docs/errors), [Groq limits](https://console.groq.com/docs/rate-limits), [Vercel AWS identity](https://vercel.com/docs/oidc/aws).
