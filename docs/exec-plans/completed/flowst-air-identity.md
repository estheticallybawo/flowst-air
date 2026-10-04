# Flowst Airs product identity

Status: local implementation completed on 2026-10-04; deployment/publication separate.

## Result

The independent checkout and npm package are flowst-air-bring-your-source. Flowst Airs/Air owns wordmarks, public/account/session navigation, titles, metadata, PWA identity, source services, styles, access modules, configuration examples, MCP identity and the reusable source-review skill. Amina remains the verbal learning agent; Misu remains the planner. Kai is not advertised as implemented.

Canonical /air routes coexist with authenticated redirects from /amira bookmarks. The old access API delegates to the same handler. Legacy deployment keys remain explicit aliases with AIR_* precedence. Stored agent-role IDs and recovery codes remain compatible. Original Flowst checkout was untouched; no remote or commit was created.

## Verification and corrections

Type checking passed. All 108 unit/regression tests passed in one completed run. Desktop/mobile fixture journeys both passed, checking product identity, agent distinction, legacy URL/query/hash redirects, source recovery, Misu plan/approval, access compatibility, isolation and checked-screen accessibility/overflow. A mobile draft-link race was fixed by awaiting navigation before rendering source-ready content. Public asset references were checked, including the renamed microphone worklet.

Initial attempts caught a duplicate setup block, a generated-config startup race and missing bearer headers in the newly added API assertions. These were corrected; failing browser fixtures now clean up their study gate. Screenshots were inspected. Real read-only MCP calls exercised the unchanged four-tool catalog and matched the production reader's pinned README hash.

See [verification](../../references/verification.md) for final build/export results and [identity migration](../../references/identity-migration.md) for naming and deployment details. Paid source/voice checks and judge access remain separate.
