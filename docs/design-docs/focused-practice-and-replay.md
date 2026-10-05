# Focused practice, optional recovery and replay

Status: implemented in Flowst; validation and extraction results are recorded as they finish.

## Decisions

- Recovery after a topic block is optional. SKIP_BREAK is an owner/revision-checked action. It permits resuming or confirming an evidence-backed next-topic recommendation; it never grants completion.
- Misu context, source and preferences remain sequential setup tasks. Plan review shows a short objective list with optional outcomes, references and rationale. Loading shows Misu's portrait and factual activity.
- The practice room removes the duplicate Misu goal card. Conversation starts closed and is the only transcript/caption panel. Plan, checkpoint, options and Kai review have separate native dialogs with focus containment, Escape dismissal and return focus.
- The Misu → Amina → Kai avatar rail uses confirmed setup stages and objective checkpoints. Completed objectives require learner confirmation and validated saved source/turn/execution evidence. Time, model prose and a timer reaching zero do not fill it.
- Checkpoint celebrations follow successful durable confirmation. Kai's separate review becomes available after all planned objectives are confirmed with evidence. Feedback presents one observation at a time, then one next exercise. Existing oral/scenario gates remain available under Practice options.
- Transfers have a ten-second visible ready transition after preparation succeeds. Continue now shortens it. The copy says the work is ready; it does not invent thinking. Reload does not replay the welcome or start audio. Start conversation remains the only entry into practice; recording additionally requires its own explicit action.

## Speech defect and correction

A regression test also found the synthesis character limit was passed as the input-seconds parameter, leaving the default character limit in effect. Both ElevenLabs and AWS synthesis now use the configured character limit correctly; defaults and spending ceilings were not raised.

Previously the browser discarded provider error detail, so a quota or connection failure looked like a generic retry. Audio was cached only in browser memory, so Replay after a reload could request and reserve another synthesis for the same saved turn.

The new service claims each turn before dispatch, persists bounded audio/timing in private encrypted object storage, and reuses it for Replay. Concurrent dispatch is rejected. A failed or ambiguous request is not retried automatically; a deliberate Retry may send a new request and consume allowance. Audio saved before its ready marker can be recovered without dispatch. Owner checks guard reads/writes; conversation deletion includes cached speech. Guest cache metadata is time bounded; deployment object-retention cleanup must cover guest objects independently of DynamoDB TTL. No retention guarantee is inferred from metadata expiry.

Production request metadata inspected on 5 October showed 429, 503, 404 and successful speech requests. It did not identify the exact cause of the owner's silent reply. No private transcripts were exported and no paid provider diagnostics were run. Exhausted allowance, provider/pending errors and browser playback failures now retain distinct learner-facing outcomes. Text remains readable. Increasing spend limits is not part of this fix.

## Verification

Unit checks cover optional breaks, stale and cross-account actions, unchanged completion, replay reuse and usage, concurrent dispatch, explicit retry, deletion, grounded journey progress and Kai's completion gate. Desktop/mobile fixtures cover prepared handoff, skipped transition, closed transcripts, dialog dismissal, actual playback/waiting events, pause/resume, denied microphone and optional recovery. Silent audio fixtures do not verify real provider speech quality.

The design follows Hick's Law, chunking and cognitive load, with connected avatar stages and evidence-backed progress. Activity explanations remain factual; private reasoning and hidden prompts are not exposed.

## Viewport workspace

The setup and practice routes use a bounded viewport workspace with the host navigation preserved. Compact headers and the avatar rail reduce repeated chrome. Context/source/preferences, plan review and welcome have reachable primary action rows. Long source text opens in a focused reader; scope and plan adjustments use separate dialogs. Longer content scrolls inside its own panel rather than expanding the document. Short viewports and larger text can still require internal scrolling; content is not silently clipped to enforce a fit. No manifest, installability or offline guarantee is inferred from this layout change.

Browser assertions check the primary setup/approval/start controls against viewport and mobile bottom-navigation geometry, and check that the document itself does not scroll. Readers support Escape and return focus. Existing practice, evidence, ownership and paid-provider boundaries remain in force.
