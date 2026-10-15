# Agent customization

New Session presents the mode picker first. **Start a study session** opens an
optional team editor before Misu's setup. Keeping defaults or confirming choices
continues to Misu. **Customize your team** returns to the mode picker; Settings
edits future defaults. Opening customization does not request a plan.

The supported catalog offers skin tone and hair color for Misu, Amina and Kai,
eye color for Misu and Kai, and voice choices for Amina only. It preserves the
same source face. Unsupported legacy choices normalize safely to Original.
Porcelain is not offered for Amina; Espresso is not offered for Misu or Kai.

## State and ownership

`GET/PUT /api/study/presentation` reads and writes the authenticated learner's
`AGENT_PRESENTATION` artifact. Writes require the last confirmed revision,
strict supported IDs and a bounded request body. Conflicts require reload.
Failed writes do not produce saved-success feedback.

New document and reviewed-link sessions capture a server-side presentation
snapshot. Existing sessions retain their selected appearance and voice; legacy
sessions use original art and the configured voice. Changing account defaults
cannot relabel cached speech as another voice. No lesson policy, learning
evidence, progression or model instructions are changed.

## Artwork and voice

`AgentPortrait.vue` masks color adjustments onto unchanged portraits. Small
avatars and the facial unlock collection use faces. Amina's interaction rooms
and animation lab instead retain the deployed transparent half-body sheet,
including mouth shapes, listening, thinking, celebration and a hand greeting.
Both formats use separately registered matching skin/hair masks and preserve
pause and reduced motion. Her speaking illustration is not live lip sync.
See [the recovery record](avatar-animation-recovery.md).

Eight characteristic voice labels have prepared auditions. The recovered 41
MP3s contain eight auditions and a subset of fixed mode-demo lines. The UI
offers a complete recording only when all lines exist for that exact voice;
otherwise it explains the unavailability and offers captions or another
prepared voice. Listening uses local media events, not synthesis or a microphone.
No audio generation script or credentials are needed for this recovery.

Dynamic study speech resolves the voice from the owned session on the server.
Live voice checks override permission before acquiring a session lease; it
does not mutate shared remote agent settings. A transport or permission
mismatch produces a setup error, not a silent substitute voice.

## Verification boundaries

Fixture tests cover strict IDs, ownership, revisions, malformed legacy records,
immutable document/link session snapshots, voice/cache identity and live override
permission. Browser checks exercise the optional editor, preserved scrolling,
prepared media and matching face animations at desktop and mobile sizes.
Local fixtures do not establish live provider quality or production readiness.
