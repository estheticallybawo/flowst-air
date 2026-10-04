# Flowst Air — Bring Your Source

Status: creator-aligned product direction; implementation and verification are separate.

## Learner and problem

Independent learners can spend substantial time consuming resources without a clear way to examine what they retain, understand or can explain afterward. Completing an online course does not establish that its ideas can be used later. Coding assistants make another need visible: people need to understand their repositories and explain the decisions and mechanisms underneath products they build.

Flowst Air is an independent-learning slice of the parent Flowst product. It serves young independent learners, including recent graduates preparing for practical work and career-defining conversations. Its architecture combines learning science and engineering to offer bounded AI-native learning experiences.

## Intended outcome

The central aim is sustained development of verbal intelligence: retrieving ideas, organizing explanations, reasoning through language, self-monitoring and applying understanding in unfamiliar situations. Retention and understanding should be examined beyond immediate consumption. Confidence is a learner goal, not a state inferred from fluent speech or a guaranteed measured effect.

Bring Your Source is the entry journey into that larger aim. One-session completion, a good answer or a model recommendation does not establish durable learning or improvement in intelligence.

## Intended multi-agent loop

The learner brings a source and chooses a goal, available time and scope. Misu proposes a grounded plan for approval. Air compiles validated NeuroMap instructions. Amina conducts inquiry and spoken practice through manageable questions, requested hints, teach-back and application. Kai interprets recorded evidence at appropriate checkpoints and session end, presents contextual feedback and suggests practice needs. Misu can use those observations to propose subsequent study, with the learner controlling meaningful changes.

Flowst Air is the product. Misu plans and proposes instructional choices. Amina is the verbal learning partner. Kai is the evidence interpreter. NeuroMap defines policy; the backend owns permissions, state, validated handoffs and persistence. See [system responsibilities](../design-docs/flowst-air-system-design.md).

## Working proof of concept

Current implementation: one reviewed source, learner preferences, Misu's plan and visible planner identity, learner approval, Amina practice/application, source-linked records, bounded public adapters and a read-only development MCP. Sources include documents, selected public repository files, readable pages and speech transcripts. Timestamp references do not imply visual video inspection.

Kai's separate interpreter, comprehensive support-event packets, learner-controlled cross-session development views and delayed retention evidence remain target additions. Existing feedback must not be presented as already produced by Kai. Real video-provider callbacks, live voice and new live-model plan explanations still require deployed checks. See [verification](../references/verification.md).

## Operating conditions

Design for mobile use, bounded text retrieval, intermittent connectivity, explicit saved checkpoints and optional captions. Never promise offline voice or complete offline operation. Start with English; broader language support needs actual testing. Pace and accessibility options are learner choices, not fixed learner types. Source credibility requires traceability and honest coverage, not a guarantee that every public source is correct.

Records remain owner-scoped. Longitudinal memory needs inspectable evidence, contextual interpretation, retention/deletion controls and no fixed intelligence, accent or personality labels.

## Capstone positioning and originality

Primary connection: Guidance, Pathways & Opportunity through explanation and application for practical conversations. Engagement through continuing practice and inspectable development; Access through bounded retrieval of learner-selected sources. Air does not yet provide a broad resource-discovery search engine.

The idea and parent-product direction originate with the human creator. Codex assists specification, engineering, testing and documentation. Disclose the existing Amina deployment as the foundation and distinguish new submission work. This is a proof of concept, not a claim of production readiness or empirically demonstrated learning gains.
