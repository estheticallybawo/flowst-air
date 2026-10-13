# Related practice references and saved-answer review reliability

Status: implementation complete and locally verified. Production deployment verification is tracked in the private release receipt.

The learner requests automatic related research when explanations need context, with visible references. The uploaded source remains the approved learning ground. A separate reported review failure rejected model-produced evidence after a phone recording; retrying the saved answer on a laptop succeeded. The safe production log confirms review validation, but does not distinguish which old grounding check failed.

## Decisions

- Keep learner assessment tied to owned saved answers and approved target meanings/passages. Select valid source IDs and criteria through per-request provider schema enums. Accept quotation whitespace and apostrophe/quotation-mark typography differences while storing the exact original transcript substring. Reject altered words, invented evidence and unavailable criteria; log field-specific application codes without content.
- Fetch supplemental references automatically for requested explanations and worked examples, including support after the attempt budget. Hints and normal answer assessment do not trigger a search. Reuse saved references for the same objective for up to one day.
- Use Groq GPT-OSS browser search for URL discovery independently of the selected assessment model. Only the approved objective title/outcome is supplied as the topic; no answer, conversation history or learner profile is supplied. Groq credentials and AIR_RELATED_RESEARCH_ENABLED control availability.
- The current provider contract follows [Groq browser search documentation](https://console.groq.com/docs/tool-use/built-in-tools/browser-search). URL discovery is separate from structured assessment output and does not use retired Compound systems.
- Treat discovered links and pages as untrusted. Read at most two public HTTPS HTML pages through the existing DNS/IP/redirect/size/time protections. Require topic-term overlap, save bounded readable text, final URL, retrieval time and content hash. This overlap is a relevance filter, not proof that every model claim is correct.
- Save research intent before dispatch and the result before drafting Amina’s response. A retry cannot silently repeat an ambiguous search. Unavailable research leaves approved-source practice usable and states the limitation.
- Allow only fetched related IDs in Amina’s explanation. Identify related context in the reply and display linked references separately. Never add these references to approved objectives, target criteria, assessment passages or learner evidence.

## Verification

Quotation and per-target schema regressions failed before the fix and pass after it. A stale research claim with the latest conversation revision failed its new regression before the atomic condition, then passed after correction. The final full suite passed 459 tests in 51 files; the final focused review/research suite passed 32 tests. Typecheck and the Vercel production build passed. All four desktop/mobile reference and cross-context recovery browser cases passed with an isolated fixture server. Documentation, shared parity and explicit export checks are required before pushing.

Mocked providers establish application behavior, not live search quality, source authority, citation entailment or voice recognition accuracy. Physical-phone and paid-provider checks remain distinct from fixtures. Production verification uses exact deployment commit and canonical assets.
