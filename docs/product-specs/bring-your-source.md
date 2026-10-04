# Capstone specification — Flowst Airs source-learning slice

The product is Flowst Airs. This slice implements its source journey through Misu and Amina on the existing standalone Amina foundation. Kai’s separate interpretation service and full cross-session orchestration remain target additions, not claims in the acceptance criteria below. See [system responsibilities](../design-docs/flowst-airs-system-design.md).

## Acceptance criteria

1. Documents, selected public GitHub files, a public HTML page, and supported video/transcript inputs reach the same owner-scoped learning pipeline.
2. Source review identifies actual included text, omissions, provenance, and timestamps before plan creation.
3. Misu proposes source-supported objectives requiring learner approval.
4. Amina supports spoken explanation and a hypothetical transfer application, with durable source-linked evidence and existing progression controls.
5. A fresh public checkout runs a labelled local fixture demonstration and includes an actually exercised read-only GitHub MCP workflow.

## Implementation tasks

1. Preserve document extraction and existing ownership/voice behavior.
2. Add bounded public URL retrieval and pinned GitHub snapshots.
3. Add transcript normalization, duration preflight, async jobs, signature verification, and separate cost reservations.
4. Connect source review and saved citations to the existing learning journey.
5. Keep source content outside system instructions and ground contextual learner answers.
6. Implement and exercise the four-tool GitHub MCP through the shared reader.
7. Verify security, failure states, regression behavior, desktop/mobile journeys, and build/setup.
8. Review an allowlisted export, record actual evidence, and rehearse a 60-second and 3–5-minute demo.

## Limits and operating context

One source per session. GitHub: 12 files, 64 KiB/file, 100,000 text characters, 16 requests, 2 MiB tree response, 2,000 candidates. HTML: one HTTPS page, three redirects, 2 MiB compressed/decompressed, 100,000 characters, 20 seconds. Video: verified public completed video up to 30 minutes; transcript at most 100,000 characters. No source mutations, private repositories, playlists, crawling, full lectures, visual video analysis, or multi-source plans.

Low bandwidth and intermittent connectivity matter for the intended Nigerian learner. Retrieve text server-side, show measured states, support reconnecting to an unexpired draft, and preserve only confirmed saved work. Do not require the learner to upload a full video.

Live video is off until credentials, a signed callback, pricing, and an operator ceiling are configured. Platform-page metadata can change; unverifiable duration or accessibility produces a supplied-transcript fallback. A post-transcription character limit does not cap provider billing.
