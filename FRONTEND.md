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

## Public entry and authentication

The landing offers **Sign in** to anonymous visitors and **Continue** when the existing Cognito account session is restored. Public calls to action use the existing auth routes with an Airs return destination. Production learning routes always require account authentication, even if old public bypass flags remain configured. Private guest cookies and bearers are accepted only in development/testing; set `AIRS_GUEST_ENABLED=false` locally to test Cognito.

## Growth Home integration

Growth is the default Home in development and production inside the normal Airs shell. New session remains `/airs/new`, and Library, Settings, account actions and APIs retain their existing behavior. An explicit `AIR_GROWTH_ENABLED=false` rolls Home back to setup without changing backend access.

The reward is called a **Tide**. Learners earn one per completed growth cycle; the dashboard uses “You earn Tides as you progress,” “Tides earned,” and “You earned a Tide.” Completed cycles remain the progression unit. Tide records use `GrowthTide`, `tideId`, `tides`, and `earnedAt`, separate from cycle completion dates.

`useAirGrowth` exposes a source-independent `GrowthSnapshot` with dimensions, evidence, history, Tides, session changes and review status. Capability definitions and display formatting are separate from example records. Scripted controls remain inside the example adapter and a collapsed section; assessed snapshots can use the same presentation contracts. A provenance indicator distinguishes example records without repeating demo labels throughout the product. Kai's four-domain assessment is not translated into the seven Growth capabilities.

Growth keeps Airs typography, controls, blue canvas and seven capability accents. Original owner-supplied transparent images cover Verbal Retrieval, Clear Explanation, Conceptual Precision, Reasoning Aloud, Transfer, Conversation Flow and Self-Monitoring. Artwork is configured in `shared/airGrowthCapabilities.ts`; optional scale accommodates transparent canvases. Badge frames evolve independently at 0, 1, 3, 5 and 10 cycles. Dialog focus, keyboard access and reduced motion remain supported.

Real assessment, persistence, duplicate-credit prevention and publication remain backend work. No reward API, provider invocation, microphone permission or learner-record write is introduced by the example progression controls.

## Landing narrative

The public landing leads with “Make what you learn your own” and follows the owner’s trycrush.ai arrangement cue: outcome, learner problem, agent-led How it works, audience, session journey, Tides, expectations, FAQ and a final account-linked action. It keeps Airs’ existing typography, blue canvas, mascots and capability accent colours. Scoped layout changes include a centred hero, a landing-only floating public header, agent portraits, all seven supplied Tide images, and native keyboard-accessible FAQ disclosures. How it works introduces Plan with Misu → Practise with Amina → Reflect with Kai → continuing Growth, and links to the detailed session steps. Native section links preserve in-page navigation.

Audience copy names independent adult learners, recent graduates and people building with AI. The journey includes Misu’s confirmed context, source coverage, preferences/plan approval, explicit microphone consent, Amina practice, Kai’s saved-evidence review, and continuing Growth/Tides. Public marketing describes the intended complete product at the owner’s explicit request; implementation status remains in engineering documentation and the dashboard’s existing data-origin indicator. It does not add real assessment or award persistence.


The owner clarified the public landing’s scroll composition: on desktop, the entire two-column stage stays pinned in the same viewport. The left introduction and the right viewing area remain stationary while a continuous card track moves upward inside the clipped right area, controlled by document scroll. The section releases only after its final card. Numbered links jump immediately in either direction with keyboard focus retained. All chapter content remains available to assistive technology. GSAP ScrollTrigger maps scroll progress to track translation; CSS sticky holds the stage. The site’s ProductEditorial and ScrollReveal components were inspected for layout and reading-focus conventions. Mobile, reduced motion, short screens and content that cannot fit retain the full natural document. Hash links, resizing and route cleanup are supported. Every landing heading, including audience/expectation titles and FAQ questions, explicitly uses Unbounded. The editorial hero is larger and uses weight 700. These changes are scoped to the public landing.
