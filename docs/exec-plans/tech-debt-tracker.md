# Technical debt and verification gaps

Updated 2026-10-05. Current open boundaries.

| Item | Impact | Next action |
| --- | --- | --- |
| Live transcription/voice | Platform/account speech quality and latency remain unverified | Owner-run checks with permitted sources and existing allowance |
| Hosting protection | Standalone production has required Vercel sign-in during prior checks | Verify current judge access; preserve app/signature authentication |
| Guest speech object retention | Expiring metadata does not delete private audio objects | Configure and verify object cleanup independently of DynamoDB TTL |
| Support-event coverage | Some prompt-dependence observations lack evidence | Record actual assistance, never invent counts |
| Rich versioned packets | Strict richer instruction/evaluation migrations remain incomplete | Extend validated shared contracts without changing old IDs |
| Longitudinal views and delayed retention | Immediate practice cannot establish lasting development | Add learner-controlled records and delayed retrieval/application checks |
| English-first | Broader languages unverified | Evaluate with speakers/providers |

Implemented: separate owner-scoped Kai review gated by confirmed source/turn/execution evidence, bounded viewport workspace, optional recovery, private prepared speech Replay, and fresh-history public repository at estheticallybawo/flowst-air. See [current verification](../AIRS_FOCUSED_PRACTICE_VERIFICATION.md).
