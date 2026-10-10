# Misu provider reliability

Misu planning runs in the deployed Nuxt server. Explicit text-provider selection routes Misu planning/evaluation, Amina activity selection/replies, context preparation and Kai review to either Groq or Amazon Bedrock. AWS stores owned lesson and session data through Vercel workload identity. Signing into a personal AWS session does not refresh a deployed model key or quota.

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

These changes resolve contradictory planning instructions and redundant read rounds. They do not establish the cause of a historical production failure whose provider status was not retrieved. They also do not increase an account's quota or silently switch providers. Mocked tests do not prove live model availability. Paid checks require explicit owner authorization. The owner authorized up to $20 for Bedrock model testing on 8 October 2026; voice checks remain owner-run.

## Kai review recovery

Kai receives the exact permitted evidence IDs and approved criterion IDs. A generated review that cites an unavailable reference is rejected with `502 / KAI_EVIDENCE_INVALID` and a message explaining that practice is saved and the review can be retried. The invalid review is not published, the review lock is released, and an explicit retry can use the same saved practice. Provider and persistence failures retain their own handling.

[Recovery regressions](../../tests/airs-kai-recovery.test.ts) verify rejected references, preserved records, released locks, valid retry and cached replay. These fixture results establish a reproducible generic-500 path was repaired; they do not attribute a historical live failure or prove paid model availability.

## Verbal skills and session completion

Kai assessment v0.3 describes understanding, clarity, vocabulary and reasoning shown in the saved practice. Each assessed skill cites permitted evidence and exact learner quotations. Partial meaning, help used and material transcription uncertainty stay visible; skills not elicited are marked not assessed. This is session feedback, not a standardized intelligence score, acoustic assessment or longitudinal trend. See [assessment contract and regressions](../../tests/kai-assessment.test.ts).

Existing reviews remain readable. Opening them does not generate another paid review: the learner can explicitly refresh for verbal skills feedback. Rich reviews use a new cache version and preserve older artifacts. Invalid citations or quotes retain saved practice and offer review retry.

After the final Kai page is read, Misu invites the learner to practise again or choose a new session. A covered session with learning evidence gets brief confetti that honors reduced motion; ended sessions with gaps and zero-evidence closures use factual wording. Dismissal is remembered for the current browser session and Next session reopens the invitation explicitly.

Practise again creates an independent source copy and fresh pending plan with the original source snapshot and preferences. It preserves the previous ledger, attempts and review, requires new plan approval, and does not bypass microphone consent. The same request ID reuses the fresh session; an interrupted source copy can resume only while owned, pristine and source-preparing. [Repeat regressions](../../tests/study-repeat.test.ts), [invitation regressions](../../tests/study-completion-invitation.test.ts) and [desktop/mobile browser journeys](../../tests/source-e2e/session-completion.spec.ts) verify these controls without paid voice/model calls.

## Amina’s personal welcome

New welcome notes use a concise second-person account of the confirmed Misu summary instead of quoting a truncated context block. A learner name is accepted only from an explicit self-identification in the learner’s original saved text. Unconfirmed summaries and instruction-like content do not establish personal facts. Conservative legacy wording keeps supported background and goals; missing details are omitted. The welcome uses no extra model call, keeps plan approval and microphone consent, and preserves previously saved welcome turns. See [welcome regressions](../../tests/amina-welcome.test.ts).

## Assessment scope and future progress

The current review uses up to twelve recent saved learning-evidence items plus the objective ledger and executed pedagogy trace. Skill feedback describes the cited sample. It does not establish a standardized score or improvement across sessions. A future progress feature would require a stable versioned rubric, comparable task difficulty and skill opportunities, recorded assistance and transcription uncertainty, and quoted before/after evidence. Repeating an easier or familiar question alone would not establish general improvement. This longitudinal comparison is proposed, not implemented.

## Provider limits and offline routing

Planning assembles a local extractive preview and makes no inventory-summary model calls. It includes up to eighty passages and at most 32,000 characters, with verbatim excerpts and exact original IDs. Selection spans the source; focused goals also prioritize matching passages. Long sources receive a visible coverage note in the plan rationale. Only included passage IDs can be cited in the proposed objectives. All original source text remains saved for practice; approval remains explicit. [Inventory regressions](../../tests/study-planning-inventory.test.ts) cover bounded previews, coverage, focused retrieval, one planner invocation, rejected omitted citations and source preservation.

The previous inventory step used a 550-token summary output cap. Its exact incomplete-response message identifies truncation in that preliminary call, distinct from a provider 429 or the final function proposal. Removing the call eliminates that preliminary truncation path; it does not establish that every remaining live model response will succeed.

The plain text adapter and function runner retain safe provider classifications, including bounded retry delays and incomplete-output detection. Plan and review controls retain a provider-limit cooldown across refresh: Retry-After when supplied, otherwise a sixty-second UI delay. Expiry enables an explicit retry; it never sends one automatically or guarantees the provider quota has reset. [Recovery regressions](../../tests/study-provider-recovery.test.ts) and [retry browser journey](../../tests/source-e2e/provider-retry.spec.ts) use fixtures without paid calls.

The Groq paths share GROQ_MODEL, defaulting to openai/gpt-oss-20b. Explicit AWS mode now routes both text and validated function calls through Bedrock Converse. ElevenLabs callbacks retain signed session tokens, owning leases and commit-before-delivery while accepting AWS-backed replies. Voice services remain separate. No automatic provider fallback or inference retry is performed.

### Bedrock testing configuration

Set AIR_TEXT_PROVIDER=aws for standalone or AMINA_TEXT_PROVIDER=aws for Flowst. Set FLOWST_STUDY_BEDROCK_MODEL_ID=us.amazon.nova-2-lite-v1:0 and AWS_REGION=us-east-1. AWS_BEARER_TOKEN_BEDROCK is the canonical server-only key; AWS_BEDROCK_APIKEY is supported as a compatibility alias. AWS_BEDROCK_NAME is a key label and is not used as a model ID. With no key, the SDK uses workload identity and maxAttempts=1. Local .env.local changes do not configure Vercel; production needs its own encrypted environment settings and a redeploy. Never commit a real key. On-demand Nova needs no provisioned Marketplace endpoint.

The [Bedrock adapter](../../server/services/studyBedrockTransport.ts) translates confirmed tool calls/results into Converse blocks, requests the named proposal, and returns tool inputs through the existing allowlist, Zod and citation validators. The complete encoded request is limited to 96,000 UTF-8 bytes and 4,000 output tokens before dispatch. This is a conservative request-size bound, not a claim about the account's token quota. Bedrock truncation, access, throttling, network and unusable outputs remain explicit failures. Requests and raw provider error bodies are not logged.

The [testing allowance](../../server/services/studyModelBudget.ts) atomically reserves against $15 for Flowst and $5 for standalone (server-configured air/amira surface) in their separate persistent study tables under AIRS_CONTEXT#study-bedrock-testing / MODEL_BUDGET#nova-2-lite-v1. Production configuration checks confirmed separate tables; these fixed allocations total $20 without merging learner data or expanding IAM permissions. Local Flowst testing uses the Flowst table and shares its $15 allocation. Reservations use conservative accounting rates of $1 per million input bytes plus a 4,096-byte framing allowance, and $10 per million permitted output tokens, above current Nova 2 Lite text rates. They are not actual AWS charges. The allowance supports only Nova 2 Lite, does not reset on deployment, and is retained after uncertain requests. No automatic refunds or increases occur. Missing persistent storage or an exhausted allowance blocks dispatch. The cap covers this adapter's model calls, not voice, storage, unrelated AWS services or calls outside the app. AWS promotional-credit eligibility and remaining balance must be checked in the account.

[Bedrock regressions](../../tests/study-bedrock-transport.test.ts) exercise text/function routing, confirmed reads, validation, provider errors, output truncation, no retry, concurrent reservations and refusal before dispatch when persistence or budget is unavailable. [AWS API-key documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html), [Nova tool use](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-tools.html) and [AWS pricing](https://aws.amazon.com/bedrock/pricing/) describe the service contracts. Live-check results must be reported separately from fixtures.

### Confirmed October request-size failure

The Anthropology source imported from Wikipedia contained 334 indexed sections; the card excerpt was only the opening paragraph. Its session requested broad coverage. Production logs and the failed /plan response both reported providerStatus=413. This establishes an oversized provider request, not a judgment about the definition or an AWS login failure. The prior 32,000-character preview did not bound the full Groq prompt and tool schema against the account quota. The UI now describes a 413 as a size failure. For a definition-only session, paste that passage or explicitly choose a focused goal; importing a URL captures the readable page.

Workbox navigation fallback is disabled for server-rendered authenticated pages: neither /home nor / is a precached HTML shell. Static asset caching remains enabled. A fallback may be restored only with an actual public precached offline document. See [Groq limits](https://console.groq.com/docs/rate-limits) and [Workbox configuration](https://developer.chrome.com/docs/workbox/modules/workbox-build).

## Verification

Focused tests cover distinct output contracts, confirmed reads, forced-choice enforcement, schema validation, safe error categories, bounded body inspection and retry metadata. The public export manifest and parity check include the new classifier and regression tests.

References: [provider classifier](../../server/services/airsProviderFailure.ts), [runner regressions](../../tests/airs-orchestration.test.ts), [output-contract regressions](../../tests/study-misu-output-contract.test.ts), [Groq error codes](https://console.groq.com/docs/errors), [Groq limits](https://console.groq.com/docs/rate-limits), [Vercel AWS identity](https://vercel.com/docs/oidc/aws).
