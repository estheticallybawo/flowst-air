# Objective-driven session flow v0.2 verification

Date: 6 October 2026. Shared implementation: [session policy](../design-docs/amina-objective-flow.md).

The final standalone suite passes all 269 cases across 28 test files. Flowst's 22 shared-controller regressions pass, including preservation of earlier deferral reasons when ending. Its final controller/live-callback run passes 25 cases; earlier host integration checks passed 119 cases across the main run and a cold-PDF rerun. These runs overlap and their totals must not be added together.

Final type checks pass in both apps using the generated Nuxt project types. Both production builds pass, including the final replay and Kai outcome changes. The Flowst deployment build retains its Vercel project-identity guard. Shared parity passes for 74 modules and components, with host authentication and adapter aliases preserved.

Controller cases cover faithful paraphrases, target budgets, distinct activities, replay, transcription uncertainty, self-correction, review/draft recovery, concurrent reviews, pauses, learner questions, spoken end, live-lease advancement, historical answer attribution, gaps and zero-evidence closure. They also verify that quota failure retains finalized live input and that end/deferral/pause/replay do not require a model call. Providers are mocked. The controller, transaction boundaries and persistence are real application code.

The standalone browser run passes all 12 checks across desktop and mobile. Flowst's desktop and mobile objective journeys both pass. The historical guest journey also verifies plan adjustment/approval, microphone consent, simulated playback recovery, retained recording retries and the single transcript scroller. Final screenshots were inspected on desktop and mobile.

Browser checks use labelled source fixtures. The new journey calls the real session controller and storage, defers an objective, receives the next approved prompt without checkpoint confirmation, explicitly ends, and opens Kai's factual closure automatically. It checks that the original deferral reason survives and deferred goals remain gaps. Speech is simulated as unavailable to exercise recovery; it does not prove synthesis, audibility or transcription accuracy. Historical checkpoint fixtures remain explicitly separate.

The final targeted runs use a bounded 60-second unit timeout: cold PDF imports on this Windows host measured 24–33 seconds. Fixture startup allows 15 minutes after a measured 10-minute cold Nitro compile. These settings do not change application timeouts. The fixture runners strip provider credentials and do not load the owner's local provider environment.

Paid Groq/Bedrock, ElevenLabs recorded/live, AWS recorded speech and real microphone checks remain for the owner. AWS Sonic live is unavailable for this flow. No fixtures prove model quality, learning retention or longitudinal improvement.
