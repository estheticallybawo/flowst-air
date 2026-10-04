# Topic pacing and synchronized voice turns

Status: implemented; verification is recorded separately. Applies to independent Airs sessions, not classroom authority rules.

## Learner experience

New plans choose 5–15 minutes per topic practice block and a 3- or 5-minute break. This is not a total conversation budget. A three-topic plan at five minutes shows 15 minutes of practice plus its breaks. A topic can need another block; elapsed time never proves understanding or completes an assessment. Legacy plans retain their original total-time meaning.

The application owns a persisted, owner-scoped clock. Pause preserves remaining time. Reload restores the actual state and pauses active practice. Breaks finish before an explicit Resume; a completed break permits the next recommended topic only through existing learner confirmation and evidence gates. A take reserved before the deadline can finish; expiry blocks new takes and questions. The final recovery break is available without redefining completion gates.

Voice turns are the default: Start conversation, record, review/send, hear feedback. No microphone or live lease starts during planning, approval or welcome. The realtime transport remains an optional compatibility path, not the default.

## Honest activity and audio

Amina's saved response is held behind a readable full-text disclosure while its audio is prepared. Provider character timestamps and actual audio playback position drive captions. No guessed typewriter timing, artificial minimum wait, private reasoning transcript or fabricated thought process is used. When timing is unavailable, the response appears on playback start. Audio failure or blocked autoplay restores readable text and explicit Replay.

Preparing audio, buffering, speaking and waiting follow request/audio events. Recording progress reports actual transcription, activity selection, reply generation and durable saving; failure is distinct. Safe progress metadata contains identifiers, timestamps and phases, excluding personal context, source text and reasoning.

ElevenLabs uses one bounded `/with-timestamps` synthesis request and reserves existing output usage before dispatch. Invalid alignment falls back to untimed text. Failed or uncertain paid requests are not automatically repeated. Provider keys stay server-side. Voice limits and source ingestion allowances remain separate.

## Implementation map

- `shared/studyPacing.ts`, `server/services/studyPacing.ts`: derived clocks, owner records, revision checks and turn gates.
- `server/api/study/conversations/[id]/pacing.*`: clock reads and explicit actions.
- `shared/studySpeech.ts`, `server/services/studyElevenSpeech.ts`: validated timing and bounded synthesis.
- `recorded-turn.get.ts` / `recorded-turn.post.ts`: owner-scoped operation status and durable turn processing.
- `composables/useStudyPacing.ts`, `pages/airs/[id].vue`: visible timer, breaks, microphone controls and audio events.

## Verification boundary

Unit tests cover pacing bounds, legacy compatibility, clocks, pauses, breaks, stale writes, reserved late takes, ownership, caption alignment and synthesis reservation without paid retries. Browser fixtures use a silent WAV to check preparation/playback state; this does not verify live speech quality, account availability or provider latency. Paid provider checks are left for the owner and require the existing spending authorization.
