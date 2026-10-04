# Context-aware first conversation

Implemented contracts: shared/airsOrchestration.ts, server/services/airsContext.ts, airsAgentRunner.ts, airsPlanning.ts, airsAminaFunctions.ts and airsKai.ts.

The learner saves confirmed background, career/communication goals and audience. Flowst additionally resolves the authenticated account display name through its own host adapter. Standalone does not invent a Flowst profile. Source and session preferences define the task. Misu retrieves application facts through bounded functions and proposes objectives, conversation strategy and evaluation criteria. Learner approval freezes the context used by the plan.

Amina receives approved plan context and passages. Backend validation restricts activity selection to the active phase. Kai receives saved attempts, source excerpts and approved criteria. Observations and next exercises must reference existing evidence. Transcript text cannot establish pronunciation or tempo.

Feedback and next-exercise choices are owner-scoped. The latest review is available as dated context for a subsequent plan, with relevance decided within the new task. It is not a trait or verified improvement score. Deleting a conversation removes its review memory. Profile context remains until separately changed.

Standalone guest access uses an HttpOnly, SameSite=Strict signed cookie and a scoped temporary bearer for voice/API calls. It expires after 24 hours; a new session cannot retrieve previous session records. Expiry is an access boundary, not a promise of automatic data erasure. Paid video transcription is unavailable to guests; supplied transcripts remain available. Production requires a server-only guest-signing secret. Existing voice limits and leases remain enforced.

Function catalogs are role-specific, owner-scoped and bounded by rounds/deadlines. Proposals pass schemas; application handlers save approved state. Tool traces expose confirmed capabilities, not private reasoning. Groq function selection is implemented; AWS and fixture activity selection remain deterministic within the approved phase.

Demo: Flowst sign-in → native /airs/new → source review → Misu plan → approval → Amina practice → Kai review. Public standalone is independently runnable. Fixtures and publication do not verify live speech, paid transcription or production account availability.

Public guest usage has deployment-wide daily reservations (default 30 model tasks and 10 voice-start requests), in addition to bounded function rounds and existing voice time limits. Clearing a cookie does not reset that deployment allowance. Operator limits are configurable and may be set to zero. No paid provider smoke calls were made during this implementation.
