# Frontend map

Status: current Nuxt/Vue; product visual rebranding proposed.

- [Library/upload](components/AirLibraryView.vue): source, purpose/time/scope and eligibility.
- [Source picker](components/AirSourcePicker.vue): drafts, review and omissions.
- [Study route](pages/airs/[id].vue): plan approval, practice and lifecycle gates.
- [Misu panel](components/MisuPlanGuide.vue): avatar, real plan states and saved basis.
- [Call room](components/AirCallRoom.vue): voice controls, captions and planner handoff.
- [Identity](shared/agents.ts): public names and compatible IDs.
- [Contracts](shared/study.ts): source/plan/turns; old objectives without planningNote remain usable.
- [Surface styles](assets/css/air.css), [call-room styles](assets/css/air-call-room.css).

Separate product navigation from agent identity. UI states follow actual request, persistence and voice events. No working-looking future Kai controls. Preserve mobile wrapping, focus, labels and citations.

[Browser checks](tests/source-e2e/bring-source.spec.ts) cover source/Misu review, approval handoff, accessibility/overflow and ownership gates. Fixtures do not validate live inference/voice. See [verification](docs/references/verification.md).

## Growth Home integration

Growth is the default Home in development and production inside the normal Airs shell. New session remains `/airs/new`, and Library, Settings, account actions and APIs retain their existing behavior. An explicit `AIR_GROWTH_ENABLED=false` rolls Home back to setup without changing backend access.

`useAirGrowth` exposes a source-independent `GrowthSnapshot` with dimensions, evidence, history, Flowmarks, session changes and review status. Capability definitions and display formatting are separate from example records. Scripted controls remain inside the example adapter and a collapsed section; assessed snapshots can use the same presentation contracts. A provenance indicator distinguishes example records without repeating demo labels throughout the product. Kai's four-domain assessment is not translated into the seven Growth capabilities.

Growth keeps Airs typography, controls, blue canvas and seven capability accents. Original owner-supplied transparent images cover Verbal Retrieval, Clear Explanation, Conceptual Precision, Reasoning Aloud, Transfer, Conversation Flow and Self-Monitoring. Artwork is configured in `shared/airGrowthCapabilities.ts`; optional scale accommodates transparent canvases. Badge frames evolve independently at 0, 1, 3, 5 and 10 cycles. Dialog focus, keyboard access and reduced motion remain supported.

Real assessment, persistence, duplicate-credit prevention and publication remain backend work. No reward API, provider invocation, microphone permission or learner-record write is introduced by the example progression controls.
