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
