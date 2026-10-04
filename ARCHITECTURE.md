# Flowst Airs architecture map

Status: current package map plus explicit target responsibilities. Air is the product; Amina is its verbal learning agent. See [product brief](docs/product-specs/product-brief.md) and [system design](docs/design-docs/flowst-air-system-design.md).

| Domain | Current code | Responsibility |
| --- | --- | --- |
| Interface | pages/air, components, composables, assets/css | Review, agent presence, voice states and learner control |
| Contracts | shared/study.ts, studyMaterial.ts, studyPedagogy.ts, studyProgression.ts | Typed source, plan, instruction, evidence and progression boundaries |
| Sources | server/services/sources, studySources.ts; source API routes | Safe adapters, owner drafts, jobs, callbacks and snapshots |
| Policy | server/domain/neuromap/studyFunctions.ts | Published versioned instruction functions; current registry smaller than target |
| Learning | studyMisu.ts, studyAmina.ts, studyInference.ts; conversation routes | Misu proposals, compiled Amina guidance, inference and turns |
| State/access | studyRepository.ts, auth/access/voice services | Owner persistence, entitlements, leases, approval and progression |
| Providers | Source, model, speech and AWS adapters | Bounded external capabilities; secrets stay server-side |
| Development MCP | mcp, launcher script | Same bounded GitHub reader, exactly four read-only tools |

Dependencies: UI → server API → domain/services → provider/storage adapters. Shared contracts carry typed data. Models propose; server handlers validate and write. Sources cannot override policy; approved snapshots remain stable.

Current flow: source → review → Misu proposal → learner approval → Amina practice/application → evidence. Target: Kai interpretation → Misu proposes subsequent activity → learner choice, with controlled cross-session memory.

## Detail

- [System responsibilities](docs/design-docs/flowst-air-system-design.md).
- [Source limits/architecture](docs/design-docs/source-ingestion.md).
- [Generated storage patterns](docs/generated/db-schema.md).
- [Frontend](FRONTEND.md), [plans](PLANS.md), [verification](docs/references/verification.md).

Kai now provides an evidence-linked review and next-practice proposal. Richer phases and longitudinal development views remain target work. Legacy MIRO/AMIRA IDs and /air routes remain compatible.

## Context-aware practice

Application-owned context and memory feed bounded Misu functions, approved Amina guidance and a separate Kai evidence review. See [context orchestration](docs/design-docs/context-aware-practice.md). Standalone uses expiring signed guest sessions. The Flowst host uses existing sign-in and native Airs routes. Longitudinal improvement and acoustic assessment remain unverified.
