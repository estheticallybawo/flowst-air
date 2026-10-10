# Objective-driven session flow v0.2 verification

Date: 6 October 2026. Shared implementation: [session policy](../design-docs/amina-objective-flow.md).

Before the side-control and pause/resume fixes, the standalone suite passed all 269 cases across 28 test files. Flowst's 22 shared-controller regressions passed, including preservation of earlier deferral reasons when ending. Its controller/live-callback run passed 25 cases; earlier host integration checks passed 119 cases across the main run and a cold-PDF rerun. These runs overlap and their totals must not be added together.

Baseline type checks and production builds passed in both apps, including replay and Kai outcome changes. The Flowst deployment build retains its Vercel project-identity guard.

After the side-control, recovery-break and library fixes, the standalone unit suite passed 280 cases across 29 files. Flowst passed 39 controller/pacing/live cases and 15 agent-boundary/deletion cases in separate runs (54 cases across six files). Current type checks and production builds passed in both apps; seven changed Vue templates parsed successfully. Shared parity passed for 76 modules and components, with host authentication and adapter aliases preserved.

The new cases verify pause time captured before response drafting, practice and recovery-break resumption without a reset, a visible retriable deletion failure, ownership metadata retained until cleanup succeeds, and safe errors for rejected, incomplete or invalid agent output. Misu's structured planning response has a bounded 4,000-token output allowance and low reasoning effort on gpt-oss. Provider tests are mocked and do not verify production credentials, quota or model quality.

Controller cases cover faithful paraphrases, target budgets, distinct activities, replay, transcription uncertainty, self-correction, review/draft recovery, concurrent reviews, pauses, learner questions, spoken end, live-lease advancement, historical answer attribution, gaps and zero-evidence closure. They also verify that quota failure retains finalized live input and that end/deferral/pause/replay do not require a model call. Providers are mocked. The controller, transaction boundaries and persistence are real application code.

The baseline standalone browser run passed all 12 checks across desktop and mobile. Flowst's desktop and mobile objective journeys both passed. The historical guest journey verifies plan adjustment/approval, microphone consent, simulated playback recovery, retained recording retries and the single transcript scroller. Baseline screenshots were inspected on desktop and mobile.

Current standalone browser coverage passed all 14 unique checks across the main run and a four-case objective/library rerun. The rerun fixed fixture cleanup: deleting unfinished practice deliberately retains the standalone document gate, so an owned deleted fixture must be explicitly abandoned before another is created. The guest recording fixture waits for generated audio time rather than wall time. Wide desktop, short desktop and mobile screenshots were inspected; the main voice stage stays within the viewport, with controls at the sides or in compact menus.

Flowst's current browser run passed all four objective/library checks across desktop and mobile. It verifies pending and failed deletion feedback, acknowledged deletion, pause/resume, automatic advancement after deferral, automatic Kai review, and preservation of gaps. Its desktop and mobile screenshots were inspected.

Browser checks use labelled source fixtures. The new journey calls the real session controller and storage, defers an objective, receives the next approved prompt without checkpoint confirmation, explicitly ends, and opens Kai's factual closure automatically. It checks that the original deferral reason survives and deferred goals remain gaps. Speech is simulated as unavailable to exercise recovery; it does not prove synthesis, audibility or transcription accuracy. Historical checkpoint fixtures remain explicitly separate.

The final targeted runs use a bounded 60-second unit timeout: cold PDF imports on this Windows host measured 24–33 seconds. Fixture startup allows 15 minutes after a measured 10-minute cold Nitro compile. These settings do not change application timeouts. The fixture runners strip provider credentials and do not load the owner's local provider environment.

Paid Groq/Bedrock, ElevenLabs recorded/live, AWS recorded speech and real microphone checks remain for the owner. AWS Sonic live is unavailable for this flow. No fixtures prove model quality, learning retention or longitudinal improvement.
