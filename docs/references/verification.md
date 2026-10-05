# Implementation and validation record

This file distinguishes implemented behavior, fixture tests, and real external checks. It is updated as checks finish.

## Real read-only checks

- 2026-10-02: the supplied YouTube link `https://youtu.be/YH18H2XXa6Q` resolved to **Flowst Demo**, creator **Esther Bawo Tsotso**, duration **178 seconds**, public and completed. Metadata preflight succeeded. No transcription request was sent and no ElevenLabs credit was used.
- 2026-10-02 17:35 UTC: Codex exercised the actual stdio MCP using the official SDK client. All four tools were listed and called. Repository: `octocat/Hello-World`; commit: `7fd1a60b01f91b314f59955a4e4d4e80d8edf11d`; path: `README`; SHA-256: `03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340`. The production reader returned the same hash. No source writes or global MCP registration occurred.

## Automated checks

- Full regression report: **230 passed, 1 skipped, 0 failed**. The skipped test is not claimed as verified. Document extraction, owner/access gates and existing voice/model contracts are included.
- Final source checks after callback/quota changes: **47 passed, 0 failed** (42 source lifecycle/adapter tests, 4 actual HTTP-boundary tests with mocked transport, 1 MCP protocol contract test).
- Root Nuxt type checking passed. The independent standalone export also passed a clean locked dependency install, its own Nuxt type check, and the production Node-server build.
- Desktop/mobile browser checks: **2 passed** in the independent standalone workspace. They cover source review, draft recovery, plan approval, accessibility/overflow checks, active-study gates and cross-account isolation. These are fixture journeys; live voice and paid transcription remain separate checks.

## Live checks still required

- The owner chose to perform paid YouTube/TikTok tests herself on the deployed product. Use [the deployed checklist](deployed-video-checklist.md); Codex has not submitted a paid transcription job.
- Paid video transcription, actual signed callback delivery, and live account availability have not been verified.
- A real microphone/Groq/ElevenLabs conversation remains to be exercised in the configured environment.
- A fresh unauthenticated request on 2026-10-02 returned **302 to `https://vercel.com/sso-api`**. Judge access and an external provider callback are blocked by this deployment login wall until deployment protection is configured for public access. Application sign-in and webhook signature authentication must remain enabled.

This is now an independent standalone workspace, separate from the original Flowst checkout. Implementation changes were removed from the original checkout while preserving its existing PDF/error-handling and copy edits. This workspace remains local and unpublished, with no copied Git history. Final contents must be reviewed before public publication.

## 2026-10-04 — Misu planning presence

- Public agent name changed to Misu; existing stored identifiers and internal planner interfaces remain compatible. Added her avatar, actual preparation/approval/review states, plan-basis disclosure, bounded generated objective explanations, visible Amina handoff, and saved recommendation evidence.
- Standalone Nuxt type checking passed after correcting a nullable template reference.
- All 107 standalone regression tests have passing coverage across the full run and one targeted rerun: the full run passed 106 with one existing PDF extraction startup timeout at five seconds; the 18-test companion group then passed with a 60-second CLI timeout (PDF extraction took about nine seconds). No extraction code changed for this timeout.
- Desktop and mobile fixture journeys: 2 passed, including loaded Misu avatar, plan-basis disclosure, objective explanation, approved-plan handoff, access gates, cross-account isolation, zero Axe violations on the checked review/plan screens, and no horizontal overflow. The initial browser attempts timed out during server startup or the five-second asynchronous navigation assertion; the bounded navigation wait was corrected and the test-owned fixture was explicitly abandoned before retrying. Screenshots were reviewed. These checks use scripted fixture plans; live Groq plan explanations and voice remain deployment checks.
- Updated production Node-server build passed (exit code 0), including client, SSR, PWA and Nitro packaging. Output: 80.8 MB (29.8 MB gzip).

## 2026-10-04 — Documentation and public export preparation

- Restructured the standalone knowledge base around small root entry points, indexed design/product documents, active/completed execution plans, technical debt, generated storage references and provider/verification references. Root legacy filenames forward to canonical documents.
- Revised the product brief around the creator's verbal-development, retention, repository-understanding and career-conversation goals. Proposed Kai and longitudinal capabilities remain explicitly separated from current behavior.
- Documentation checks passed: 36 Markdown files, 142 local file links, and a deterministic storage reference extracted from 29 key objects. These checks validate file targets and generated freshness, not heading anchors or the correctness of every prose claim.
- Public export checks passed for 215 explicitly listed files: expected hashes and Git candidates matched; the narrow credential scan found no matching patterns. This is preparation, not a comprehensive security audit or asset-rights review.
- No runtime behavior changed in this documentation task; prior runtime validation is recorded above. No commit, remote creation, deployment or publication occurred. GitHub CLI is installed but requires owner sign-in.

## 2026-10-04 — Flowst Airs identity migration

- Renamed standalone folder/package to flowst-air-bring-your-source. Updated navigation, onboarding/public/account/session titles, metadata/PWA identity, product component/style/access naming, AIR_* configuration examples and source/MCP branding. Amina remains the verbal agent; stored AMIRA/MIRO IDs and recovery codes remain compatible.
- Old /amira links preserve destination/query/hash through /air redirects. The old access API delegates to the same authenticated handler. Both current and legacy surface IDs retain costly-operation gates; current environment keys take precedence over explicit legacy aliases.
- All 214 pre-migration manifest files were hash-verified after recovering a partial Windows move. Obsolete generated artifacts were removed within verified paths without following links; the old product folder is absent. Original Flowst checkout was untouched.
- Final type checking passed. Full standalone unit/regression run: 108 passed, 14 test files, 0 failed. Initial parallel startup encountered a missing generated tsconfig and the first route-alias implementation introduced a duplicate setup block; both were corrected before successful reruns.
- Desktop/mobile source journeys: 2 passed. Checks covered Flowst Airs branding, Amina agent distinction, legacy links with query/hash, draft recovery, Misu avatar/plan basis, approval, authenticated canonical/legacy access equivalence, active-study gates and cross-account isolation. Axe found zero violations on checked source-review/plan screens; no horizontal overflow. Screenshots were inspected.
- Earlier browser attempts failed from missing bearer headers in new API assertions and a draft-query navigation race on mobile. Assertions now authenticate correctly and always release their own study gate. Source readiness now waits for draft-link navigation.
- Verified 25 literal public asset references, including the renamed audio worklet. This does not replace a real microphone check.
- Real MCP stdio smoke check at 11:52 UTC: all four read-only tools called against octocat/Hello-World, pinned commit 7fd1a60b01f91b314f59955a4e4d4e80d8edf11d; README hash 03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340 matched the production reader. No global registration or repository write occurred.
- No paid provider calls, deployment, commit, remote creation or publication occurred. Live provider checks and public deployment access remain pending.
- Final production Node-server build passed after all runtime edits (exit code 0), including client, SSR, PWA and Nitro packaging: 80.8 MB, 29.8 MB gzip. Existing chunk-size/dependency deprecation warnings remain; they did not fail the build.
- Final documentation checks: 38 Markdown files, 148 local links; 29 generated storage key objects current. Public export checks: 218 explicit files, hashes/Git candidates matched, no matches for the narrow scanned credential patterns. Manual public-content and asset-rights review remains necessary.

## Context-aware practice and native integration — 2026-10-04

The owner moved the standalone to the owner-confirmed Desktop flowst-air folder. Its main branch was an earlier independent export; the implementation branch preserves that owner's snapshot and restores the required published compatibility assets. Flowst now hosts native Airs routes instead of an iframe. Its existing sign-in resolves identity. Standalone has no registration requirement and uses signed, expiring, isolated guest sessions.

Implemented: owner-scoped learner context, bounded function catalogs, contextual Misu goals and evaluation criteria, approved Amina activity selection, separate evidence-linked Kai reviews, duplicate-review reservation, next-exercise acceptance/dismissal and deleted-session memory filtering. Shared-core parity passed for 12 modules/components. Host auth/context adapters intentionally differ.

Standalone: 115 unit tests passed in 16 files. Flowst: 193 passed, one live test skipped, in 46 files. Desktop/mobile source-review → Misu-plan checks passed for native Flowst (2) and no-login standalone (2). The saved-attempt → Kai → accepted next-exercise persistence path is covered by fixture tests, not a live voice claim. Production builds and cloud availability are recorded separately as they are completed. No paid transcription, live speech or longitudinal improvement is claimed verified.

Final checks: standalone type checking passed; 118 tests passed in 17 files. Flowst type checking passed; 196 tests passed with one live test skipped in 47 files. Both production builds passed, and both existing Vercel projects deployed. Native Flowst and no-login standalone source-review/Misu-plan journeys passed on desktop and mobile. The final live adapters forward source passages separately from teaching instructions; provider smoke tests remain owner preflight.

The existing standalone production hosting login wall still prevents signed-out judge access. Automatic approval review rejected changing that exact production-domain security setting; scoped owner approval is pending. No protection bypass was attempted. The application-level guest key was configured as a server-side hosting secret and is excluded from this export.


## Misu-led setup and prepared handoff - 2026-10-04

Implemented in Flowst and extracted into this standalone slice. Flowst retains its account authentication; standalone retains signed guest ownership. The shared parity check now covers 33 modules/components (host adapters intentionally differ).

Final Flowst checks: type checking and production build passed; 206 unit tests passed, one live-provider test skipped. Desktop/mobile prepared-handoff journeys passed (2). Cloud deployment is Ready at app.useflowst.com; signed-out /airs redirects to Flowst sign-in and the context API returns 401. Authenticated production learning remains owner preflight; local fixtures are not evidence of production model/voice quality.

Standalone checks: type checking, 125 unit tests, desktop/mobile full setup journeys (2), source adapter/access checks (8), documentation checks and production build passed. Source checks exercised GitHub/web/video fixtures through draft review, planning, approval and isolation, plus supported PDF preview without creating a plan. Initial browser startup timed out at the visible loading skeleton; a bounded cold-compilation wait fixed the test. An initial PDF-preview test incorrectly supplied unsupported TXT and correctly received 415; it was corrected to use an existing supported PDF format. No supported formats were changed.

The journeys confirmed editable summary, source-before-preferences disclosure, adjusted draft approval, visible preparation, speech-unavailable text fallback, reload without autoplay, and no microphone/lease before Start conversation. Deliberate permission denial after Start created one microphone request and no lease. The production audio transport and paid-provider quality require real preflight. No paid calls were made.

Thinking Orbs is pinned at de85557ca220332586d070d8788c0e1d6e877a0d with its MIT notice retained. The public export contains the Vue canvas wrapper, not React. Main private history, credentials, hosting bindings and learner records are excluded. Existing standalone hosting protection remains unchanged.

## Per-topic timing and voice turns — 2026-10-05

Implemented shared pacing for 5–15-minute topic blocks with 3/5-minute breaks, explicit pause/resume, a persisted owner clock and revision checks. Time does not complete learning gates. A take reserved before expiry may finish; new work waits for its break. Refresh anchoring avoids subtracting elapsed time twice. The optional realtime path checks the same clock before opening and stops at a block boundary.

Voice turns are now the default. Saved responses remain readable through a disclosure while audio is prepared; playback events and validated provider timestamps drive visible captions. Actual transcription/activity/reply/save phases are owner-scoped safe metadata. Audio failure keeps the saved reply and a manual replay path. No forced minimum delay or simulated reasoning was added.

Final unit runs: Flowst 213 passed, one live-provider test skipped; standalone 132 passed. Initial parallel checks hit two 5-second document extraction timeouts; targeted reruns and the final single-worker suite passed. A fixture provenance field and a corrupted test label were corrected. An old waiting-label assertion was aligned with the visible waiting state. Both hosts retain their existing authentication/ownership boundaries. Paid voice/model checks have not been performed in this task.

Production builds, browser results and publication are appended only after completion below.

Final local checks: both hosts passed type checking and production builds. Flowst and standalone each passed desktop/mobile prepared-entry → audio preparation → actual playback → waiting → pause/resume → denied-microphone journeys (2 each). The final layouts keep recording controls visible and were inspected on both viewports; no horizontal overflow was found. Browser synthesis uses a silent WAV with no timing data to exercise the documented fallback; timestamp positioning is unit-tested with provider-shaped alignment fixtures. This does not verify real speech or live provider timing. Standalone source regression checks passed (8) for GitHub/web/video attribution, approval, owner isolation and PDF preview. Shared parity passed for 47 modules/components; host auth/context adapters intentionally differ.

Documentation checks passed for 42 Markdown files and 154 local links; generated storage references are current. The public export is explicitly allowlisted and credential-pattern scanned. No private Flowst history, deployment bindings or learner records are exported. Existing standalone hosting protection remains unchanged. See [owner voice preflight](voice-turn-preflight.md).

Cloud builds and production deployments succeeded for both existing projects. Flowst is Ready at app.useflowst.com (deployment flowst-neo-webmcp-p15iuds9j-estheticallybawos-projects.vercel.app); standalone is Ready at amira-study-kv1i2lime-estheticallybawos-projects.vercel.app. Final layout changes were included in these cloud builds. Signed-out Flowst /airs/new returns 302 to its existing sign-in; context and pacing APIs return 401. The standalone production alias returns 302 to Vercel SSO: it is still not a signed-out judge-accessible deployment. No hosting/authentication protection was changed or bypassed. Authenticated production speech/model quality remains owner preflight. The repository is public and retains its codex/bring-your-source default branch.

Final replay cleanup clears previous captions before preparing another reply and restores full saved text if study access cannot synthesize audio. The shared changes were rechecked in the Flowst desktop/mobile journey (2 passed), and both final cloud builds/deployments are Ready. No paid provider test was performed.


## Final focused workspace checks — 2026-10-05

Flowst desktop/mobile full journeys pass (2), with viewport and mobile-navigation clearance assertions. Standalone type checking, 136 unit tests, desktop/mobile full guest journeys (2), source adapter/access checks (8) and the final production Node build pass. Shared parity covers 58 modules/components; line endings are normalized for Windows/Linux comparison, and authentication/host adapters intentionally differ. Documentation checks cover 44 Markdown files and 161 local links; generated storage extraction includes private speech cache records.

Fixture issues resolved: the guest test now checks whether host navigation exists before measuring it and allows bounded cold loading; the visible local fixture banner occupies space inside the viewport instead of pushing actions below it. Full reruns pass with no page errors. Fixtures use silent audio and cannot establish live provider quality or account availability.

Flowst cloud deployment is Ready at app.useflowst.com (flowst-neo-webmcp-2a38yjxjj-estheticallybawos-projects.vercel.app). Standalone cloud deployment is Ready at amira-study-2ncaq5l7e-estheticallybawos-projects.vercel.app. Anonymous Flowst /airs/new redirects to sign-in and its context API returns 401. The existing standalone production protection remains unchanged and requires separate judge-access resolution. No paid live diagnostic, protection change or private history export was performed.

## Voice allowance checks — 2026-10-05

The deployed public configuration was read without signing in: 300 input seconds and 6,000 generated speech characters per source-based study. Topic timing is separate. No limits were raised. Practice options now shows both remaining balances, refreshes usage after uncertain speech failures, disables new recording at zero input, and leaves saved replies available. The public allowance page uses configured limits and correctly describes replay after reload.

Atomic reservations prevent concurrent distinct recorded/TTS requests from passing the same balance. Legacy usage is adopted with consistent reads; recorded dispatch reserves before provider work; failures retain reservations and success charges once. Cached audio remains replayable after depletion. AWS dispatch uses maxAttempts 1. Live counters share the cumulative allowance; Sonic output is still metered after generation.

54 mocked tests across seven files passed. An initial combined run hit existing five-second PDF/DOCX extraction timeouts; the isolated companion run with one worker and a 60-second bound passed all 18 cases. The first Flowst browser run timed out during its 600-second dev-server startup and ran no journey assertions. Type checking, the bounded browser retry, standalone checks and deployment will be recorded when complete. No paid provider diagnostic was performed.
### Completed allowance follow-up checks

Flowst and standalone type checking pass. Standalone unit checks pass: 154 tests across 21 files. Its normal production Node build passes. Ten shared allowance service, page, test and design files match after Windows/Linux line-ending normalization. The final shared guest desktop/mobile journeys pass (2), including a failed speech request refreshing both balances to zero, removal of a nonretryable voice action, disabled new recording, readable saved replies, and unchanged microphone consent. Silent fixture audio does not establish live speech quality.

Browser verification found an always-rendered disabled Retry voice button; rendering it only for retryable outcomes fixes the confusing action. The quota-status assertion now targets persistent activity rather than matching both it and the temporary alert. The complete multi-stage journey uses a bounded five-minute test budget for cold hosts. Initial cold runs and Flowst-specific fixture boot attempts timed out; a disposable cached-build attempt also failed to finish Nitro. Those attempts did not establish native Flowst journey success. Native fixture results are recorded separately when available.

Production Flowst build flowst-neo-webmcp-gfm6eec3g-estheticallybawos-projects.vercel.app is Ready. Read-only app.useflowst.com checks return home/sign-in 200, /airs/new 302 to Flowst sign-in, and context API 401. Public configuration remains 300 input seconds and 6,000 speech characters. Standalone build amira-study-m9xg15jmv-estheticallybawos-projects.vercel.app is Ready; anonymous access still returns hosting sign-in 302. Existing hosting protection remains unchanged. These deployment checks precede the final Retry-button rendering correction; final build identifiers are recorded after promotion. No paid provider checks or limit increases were performed.

## Voice quota removal — 2026-10-05

This entry supersedes the cumulative-allowance policy recorded above. The owner explicitly authorized removing the 300-second input, 6,000-character output and standalone daily voice quotas. Voice usage remains accounted for atomically, but it does not restrict later practice, live-call duration or Misu's objective scope. Model and video-ingestion allowances are independent. Explicit microphone consent, active-study/ownership checks, two-minute recorded takes and technical per-call bounds remain.

The prior final Flowst desktop/mobile fixture journeys passed (2) before this policy change. New quota-removal checks, build identifiers and publication results are recorded below only after completion. No paid provider diagnostic or authentication change is part of this work.

Quota-removal validation passes: Flowst 114 mocked tests across 15 files; standalone 169 unit tests across 21 files; both hosts pass type checking. Standalone desktop/mobile complete journeys pass (2). Flowst desktop passes, and the isolated mobile rerun passes after a development-server connection reset interrupted the initial mobile run. The journey checks prove playback, saved text and recording controls remain available at 1,200 input seconds and 25,000 generated characters, without microphone requests or live leases before explicit actions.

Parity passes for 17 shared production service, interface, page and design files, with host-specific configuration/authentication kept separate. Documentation checks pass for 44 Markdown files and 161 local links; generated storage references contain 32 key objects. The current export check passes for 291 explicit paths and 290 reviewed hashes. No paid provider calls were made, and fixtures cannot verify provider billing, real speech quality or live account availability. Production results are appended after successful deployment.

Final production cloud builds and deployments pass. Flowst deployment flowst-neo-webmcp-ij4tw1xbz-estheticallybawos-projects.vercel.app is Ready at app.useflowst.com. A fresh signed-out request returns home 200 with no retired studyAwsVoiceTrialMax runtime keys; /airs/new redirects to ordinary Flowst sign-in and the context API returns 401. Standalone deployment amira-study-engjl948k-estheticallybawos-projects.vercel.app is Ready. Its public alias still requires Vercel hosting sign-in; hosting protection was preserved. Code readiness and successful deployment do not establish paid provider speech quality or signed-out judge access to the standalone application.

The final public documentation now consistently describes implemented, evidence-scoped Kai review, transcript-only guest video, authenticated Flowst paid-video preflight, and default recorded speech versus optional live-call prerequisites. No paid provider calls, authentication downgrade, hosting-protection changes or private Flowst history publication occurred.

## Sky-blue practice and required agent handoff — 2026-10-05

This entry supersedes the optional transition presentation above. Airs now uses a pale-blue canvas with readable blue controls, orbs and loaders. A required ten-second, four-stage guided handoff presents saved Misu/Amina/Kai responsibilities without a countdown, skip button, private reasoning or fabricated API-completion claims. Hidden tabs pause presentation and disposal cancels pending transitions. Start conversation and explicit recording retain microphone boundaries.

Misu’s avatar opens the existing saved plan and validated objective progress. Only a newly confirmed server checkpoint opens the three-agent celebration with finite confetti, reduced-motion support and Break/Continue actions. Practice timing and evidence gates remain separate. A safe text-only renderer formats saved messages and captions as conversational paragraphs, emphasis, lists and code while escaping HTML and executable links.

Audio recovery fixes the welcome action sending retry=false after a saved failure, and prevents silent browser priming from carrying callbacks belonging to a previous turn. Safe provider error classification distinguishes busy, configuration, credits, account restrictions and temporary service failure without exposing raw provider responses. No automatic paid retries or provider-account changes were introduced.

Verification passes: both hosts type checking; standalone 185 unit tests across 23 files; 21 focused handoff/escaping/audio-cache tests in Flowst; Flowst and standalone desktop/mobile full journeys (2 each), including four compulsory presentation stages, Escape not bypassing Kai handoff, saved-plan avatar navigation, confetti, denied microphone, explicit retry=true recovery and no audio replay after reload. Silent fixtures establish playback plumbing and state transitions, not actual provider speech quality.

Production environment retrieval and even filtered CLI key-listing were rejected by automatic approval review as potential production credential access. No production environment file was retrieved. Local account metadata cannot establish deployed provider configuration. Owner live voice preflight remains pending; production build and publication results are recorded separately after success.
