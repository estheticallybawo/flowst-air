# Focused Airs practice verification — 2026-10-05

Implemented in native Flowst: optional recovery, separate plan/checkpoint/options/Kai dialogs, a closed-by-default Conversation panel, evidence-backed avatar journey, checkpoint celebration, ten-second skippable ready transitions, Misu activity during loading, and private per-turn audio replay caching.

The original speech UI discarded provider errors and lost audio on reload. Replay could dispatch synthesis again. The new service bounds and stores audio/timing, prevents duplicate dispatch, reuses prepared audio, requires deliberate retry after failure, and participates in deletion. Exhausted allowance and playback/provider outcomes retain readable replies and specific messages. No spend limit was increased.

Read-only production metadata showed five 429, two 503, one 404 and three 200 speech responses in the inspected window. It did not establish the exact cause of the owner's silent reply. No learner content or credentials were printed/exported and no paid diagnostic was submitted.

Checks so far: Flowst type checking passed; 217 unit tests passed, one live-provider test skipped. Initial desktop/mobile journeys passed (2). Additional layout and checkpoint/Kai fixture checks, final extraction, deployment and publication are recorded below after completion. Browser fixtures use silent audio and do not verify live provider speech quality. Authentication and classroom authority remain unchanged.

See [design and implementation](design-docs/focused-practice-and-replay.md).

Final local Flowst checks passed: type checking, full 217-test unit run (one live test skipped), 14 targeted quota/replay/pacing/AWS regressions after correcting the limit parameter, and production Node build. Desktop/mobile complete fixture journeys passed through optional recovery, checkpoint celebration and the separate Kai review. The final mobile recording button clears the bottom navigation. Page errors are asserted absent. One cold dev-server startup timed out; subsequent runs were successful. A fixture confirmation handler was corrected to return the full conversation shape, and mobile clearance assertions drove removal of a redundant voice-controls heading. These fixtures do not establish production voice quality.

The synthesis limit configuration bug is corrected for both ElevenLabs and AWS: the character ceiling is passed as the character parameter, not input seconds. Configured ceilings/defaults were not increased.

Viewport workspace checks passed in Flowst on desktop and mobile: primary Save context, Draft my plan, Approve plan and Start conversation controls stay within the viewport and above the mobile navigation; the document does not scroll. Long source material opens in a separate reader. The first run exposed a hidden adjustment form reading missing timing values; conditional mounting fixed it and the full rerun passed without page errors.

The final Flowst cloud build is Ready at app.useflowst.com (flowst-neo-webmcp-2a38yjxjj-estheticallybawos-projects.vercel.app). Anonymous checks returned home/sign-in 200, /airs/new 302 to Flowst sign-in, and the context API 401. This verifies reachability/auth boundaries, not authenticated production speech quality.

Standalone extraction preserves its guest authentication adapter. Type checking, 136 unit tests and the production Node build pass. Shared parity covers 58 modules/components. Live provider checks remain owner preflight; no paid provider diagnostics were run.


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
