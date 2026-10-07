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

## Verification

Focused tests cover distinct output contracts, confirmed reads, forced-choice enforcement, schema validation, safe error categories, bounded body inspection and retry metadata. The public export manifest and parity check include the new classifier and regression tests.

References: [provider classifier](../../server/services/airsProviderFailure.ts), [runner regressions](../../tests/airs-orchestration.test.ts), [output-contract regressions](../../tests/study-misu-output-contract.test.ts), [Groq error codes](https://console.groq.com/docs/errors), [Groq limits](https://console.groq.com/docs/rate-limits), [Vercel AWS identity](https://vercel.com/docs/oidc/aws).
