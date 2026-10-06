# Objective-based Amina practice

Historical checkpoint flow. [Objective-driven session policy v0.2](amina-objective-flow.md) supersedes confirmation and live-lease advancement rules for current discussion sessions. This document describes retained historical execution records and compatibility behavior.

The unit of progress is an approved learning outcome with saved learner evidence. A spoken turn, a timer finishing, or Amina's praise does not complete an objective.

## Interaction contract

1. Misu proposes source-backed objectives; the learner approves the plan.
2. Amina introduces the active objective and asks one useful question. A new objective gets its own introduction; an earlier objective's question is not reused.
3. The learner explains the idea. Greetings, readiness and names stay in the transcript without becoming explanation evidence or consuming assessment questions. Requests for help cannot support a ready decision.
4. The application saves the attempt, source references and executed NeuroMap trace together. Misu then independently reviews the saved explanation against the approved outcome and full approved passages. Amina's previous feedback is excluded from this decision.
5. If the outcome is covered, Misu saves a recommendation with evidence and passage IDs. After the current reply finishes, the interface opens the checkpoint. During a live call, this appears after the learner ends the call. No extra attempt or timer expiry is required. A visible Misu control keeps Continue or retry available after the learner closes the checkpoint.
6. **Continue to next objective** confirms the checkpoint. Amina introduces the next objective. The learner can keep practising or take a break; continuing starts a separate timer for the next topic.
7. The final checkpoint leads to Kai's existing review cards. Kai summarizes saved evidence against the plan's criteria and proposes a next exercise. Further oral/scenario practice is optional; completing the objective journey does not prove durable mastery.

## Meaning, not recitation

For an outcome asking the learner to explain a canonical system-design reference, “the main authoritative reference people use to understand the design” can cover the outcome. The learner need not reproduce “canonical” verbatim. Harmless transcription repetitions or false starts are not misconceptions.

Amina names a gap only when an actual missing or mistaken idea warrants it. If an outcome requires reasoning or application, she asks one fresh probe for that evidence. She does not demand the same rephrasing indefinitely or add an invented weakness to satisfy a feedback template. New plans use teach-back version 2; existing version 1 approvals remain readable and usable.

Amina addresses the learner as “you.” She does not adopt a personal name from speech recognition, document text or generated context. Amina, Misu and Kai have separate roles.

## Persistence and recovery

- An unsaved execution cannot trigger progress review. A review failure preserves the saved attempt, keeps the current objective and exposes retry.
- A ready decision must cite saved evidence and approved passages. Unknown IDs and stale revisions are rejected. Cross-account access remains denied.
- The learner's checkpoint confirmation stays separate from conversational feedback. A live voice lease must end before changing the objective.
- A new objective cannot use the previous objective's timer to authorize a recording. Time boundaries offer recovery breaks; elapsed time supplies no learning evidence.
- The same runtime changes apply to the private Flowst study experience and the independent public Flowst Airs checkout. Public export includes only the selected shared implementation, synthetic regressions and this contract. Personal transcripts, credentials and private platform history are excluded.

## Validation and limits

Regression coverage includes paraphrases, wrong answers, greetings, speech false starts, objective introductions, source scope, invalid citations, failed persistence, failed review, stale decisions and a two-objective journey into Kai's evidence cards. The browser contract verifies that a saved checkpoint appears without another review click and that the final action reaches the cards.

These tests validate coordination and recovery using synthetic evidence and model doubles. The deployed voice and live model behavior still require a real session check; no paid provider test or deployment is implied.

Trust UX impact: the learner sees what their saved explanation supports, the next objective and available Continue/Keep practising/break controls. Existing transcript/provider storage remains in use; evidence IDs added to the progress recommendation stay within the owned study record.
