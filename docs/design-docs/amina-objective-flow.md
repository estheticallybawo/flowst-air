# Amina objective-driven session flow — policy v0.2

Misu defines source-backed evaluation modes, meanings, activity targets and sufficient evidence before the learner approves a plan. Amina delivers the conversation governed by that plan. Kai reviews saved evidence after the session and outside the live call.

The backend keeps a versioned objective ledger with not_started, active, partially_met, met_for_session, needs_revisit and deferred states. Semantic equivalence is accepted by default; source fidelity requires explicit approval. Deferral and skipping keep gaps visible. They never become met objectives.

Finalized input is saved first. Misu extracts and evaluates structured evidence, including exact learner quotes, demonstrated and unresolved meanings, source references and material transcription uncertainty. The controller selects the next action. Amina supplies constrained prose; only the controller can append an approved target question. A met objective receives specific acknowledgement and advances automatically. There is no objective-confirmation button.

Each underlying evidence target has at most two attempts and two automatically issued prompts. Rephrasing, switching techniques, reloading, reconnecting and replaying cannot reset its budget. After exhaustion, Amina explains or gives a worked example, offers an unattempted distinct approved activity when available, and offers deferral or a break. A met target cannot be requested again automatically.

Input, reviewed decision and completed output have separate durable records. Conversation revisions and operation leases prevent concurrent review or duplicate advancement. Output, evidence, trace, pointer, pacing and recorded completion commit together. Retry reuses the transcript and validated review. A pending review cannot authorize another question. Speech failure preserves the saved response and decision; generated speech never proves it was heard.

Repeat, explain again, hint, change approach, skip, defer, pause, resume and end are visible controls and recognized explicit spoken requests. Ambiguous requests are clarified. Pauses and due breaks hold the next prompt; resuming continues from the saved target without a new Start checkpoint. Learners retain plan approval and microphone consent.

Existing chats preserve transcripts, source snapshots, approvals and historical execution records. Resumption creates a ledger from approved goals and saved evidence. Previously verified checkpoints carry forward. Missing historical support is unknown; unreconstructable old questions do not grant a fresh attempt budget. Saved answers are reviewed before another question.

When all objectives are met or deferred, or the learner explicitly ends, the session closes. Kai opens after final playback and live lease cleanup. Covered objectives and ended-with-gaps outcomes remain distinct. With no learning evidence, Kai returns a factual closure summary and not assessed, without calling the model for learning judgments. Optional oral and scenario practice retain their ordering and prerequisites and do not block the session review.

Recorded turns, including AWS text/transcription/TTS, and ElevenLabs callbacks use the same controller. AWS Sonic live is disabled for this flow until separately integrated. Host authentication and adapters remain distinct. Longitudinal trends and scheduled practice remain later work.

The new published pedagogy versions are explicit-instruction@2 and self-explanation-teach-back@3. Earlier definitions remain immutable. The runtime flag AIR_OBJECTIVE_FLOW_ENABLED defaults on; disabling it does not revert a chat that already has a v0.2 ledger.

Verification separates mocked provider results, browser fixtures, deployment smoke checks and owner-run paid voice/model checks. See [verification procedures](../references/development-and-verification.md). Unit tests exercise the real controller and repository transaction boundaries with mocked providers; browser fixtures do not establish model quality, transcription accuracy or real voice behavior.
