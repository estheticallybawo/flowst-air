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

## Growth Home prototype

In nonproduction source-fixture mode, Home displays the labelled [Growth prototype](docs/exec-plans/completed/growth-home-prototype.md). New session keeps Misu setup at `/airs/new`. Seven capabilities, evidence details, sample session updates, badge evolution and local Flowmark card previews use app-memory fixtures. Production Home and Kai assessment are unchanged.

Growth uses Airs' existing typography, controls and mascot assets, with distinct capability accent colours. Capability artwork lives in the prototype adapter: Verbal Retrieval uses the owner-supplied teal voice-chat PNG; Clear Explanation uses the purple lightbulb; Conceptual Precision uses the orange bullseye; Reasoning Aloud uses the teal megaphone; Transfer uses the blue water exchange; Conversation Flow uses the purple chat exchange. Six original transparent assets live in `public/growth`; Self-Monitoring retains its temporary initial placeholder until its image is supplied. Set a capability's `artwork.src` to replace its placeholder across cards, detail views and Flowmarks. Optional `artwork.scale` accommodates different transparent canvases without editing source images. Badge frames evolve independently of the source image.
