# Objective-driven session flow v0.2 verification

Date: 6 October 2026. Shared implementation: [session policy](../design-docs/amina-objective-flow.md).

The standalone full suite passed 267 cases before the final recovery refinements. The final targeted run passed all 60 cases, including 22 controller/repository regressions. The same 22 controller cases pass in Flowst; its earlier host integration checks passed 119 cases across the main run and a cold-PDF rerun. Both Nuxt type checks passed before the final refinements; final type checks are in progress. Shared parity passes for 74 modules and components.

Controller cases cover faithful paraphrases, target budgets, distinct activities, replay, transcription uncertainty, self-correction, review/draft recovery, concurrent reviews, pauses, learner questions, spoken end, live-lease advancement, historical answer attribution, gaps and zero-evidence closure. They also verify that quota failure retains finalized live input and that end/deferral/pause/replay do not require a model call. Providers are mocked. The controller, transaction boundaries and persistence are real application code.

The remaining full suite, host checks, desktop/mobile journeys, builds, export checks and releases are being verified. This record will be updated with their final outcomes before release.

Browser checks use labelled source fixtures. The new journey calls the real session controller and storage, defers an objective, receives the next approved prompt without checkpoint confirmation, explicitly ends, and opens Kai’s factual closure automatically. Speech is simulated as unavailable to exercise recovery; it does not prove synthesis, audibility or transcription accuracy. Historical checkpoint fixtures remain explicitly separate.

The final targeted runs use a bounded 60-second unit timeout: cold PDF imports on this Windows host measured 24–33 seconds. Fixture startup allows 15 minutes after a measured 10-minute cold Nitro compile. These settings do not change application timeouts. The fixture runners strip provider credentials and do not load the owner's local provider environment.

Paid Groq/Bedrock, ElevenLabs recorded/live, AWS recorded speech and real microphone checks remain for the owner. AWS Sonic live is unavailable for this flow. No fixtures prove model quality, learning retention or longitudinal improvement.
