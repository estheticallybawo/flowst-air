# Avatar animation recovery

15 October 2026. The newer customization work was recovered from the separate
`Downloads/Flowst's Airs/experiments/kai-pilot` folder into the owner's main Git
checkout, `C:/Users/DELL/Desktop/flowst-air`. The experiment remains a backup;
it is not the source to edit going forward. This recovery is local, not a
deployment or a live avatar integration.

## Confirmed causes

- Customized appearances bypassed animation and used a static portrait.
- The three referenced face-only sheets had not been installed.
- Uniform 256-pixel row crops included portions of adjacent expressions because
  several full heads extend outside those nominal cells.
- The original Amina expression sheet was intact and remains preserved.

## Two presentation formats

The owner clarified that head-only artwork belongs to small avatars and facial
unlocks, not Amina's interaction stage. The initial recovery reused the face
renderer too broadly. Interaction rooms and the animation lab now return to the
deployed transparent half-body presentation; the separate face collection stays.

`components/demo/AminaDemoAvatar.vue` uses the original 1448-by-1086, 4-by-2
sheet from deployed reference `4ab7361f47b38c41bb897559e79f58d89eae542c`.
Its bytes are unchanged. The top row contains four speaking mouth shapes;
the bottom row contains listening, thinking with a hand on her chin,
celebration, and a raised-hand greeting. The 2:3 framing and subtle body motion
preserve the previous interaction style rather than enlarging a floating head.

Native generation supplies only a technical skin/hair region map for that
unchanged sheet. `scripts/prepare-amina-interaction-masks.mjs` produces two
aligned masks, preserving clothing, glasses and other facial details. Original
and customized speaking frames share the same frame position. Pause freezes
the current frame and body motion; reduced motion retains a static pose.
Speaking remains illustrative, not live lip synchronization. A missing matching
color mask is labelled, rather than silently replacing the body with a head.

Small avatar portraits remain face-framed. Facial unlocks are a labelled local
preview, not earned or persisted rewards or an applied account animation.

## Facial unlock rendering

`components/demo/CompanionMotionAvatar.vue` renders four fixed frame groups per
state. One inherited animation clock controls visibility for the original art
and every masked color layer. Original and customized appearances use the same
face-only frames. Pause freezes the visible frame; thumbnails and reduced-motion
previews are still. Missing assets produce a labelled static fallback.

`scripts/prepare-agent-motion-frames.mjs` records full-head bounds using opaque
seeds and connected alpha regions in each column. It requires six uniquely
matched heads, non-overlapping vertical bounds, and unchanged source hashes.
The generated metadata preserves heads taller than 256 pixels without admitting
the preceding row's chin. Neither original art nor color masks are cropped or
repainted. The renderer fits each rectangle without stretching the face.

The three 1024-by-1536 lossless sheets live in `public/mascots`.
Native-generated technical maps and prompt provenance are retained in
`scripts/assets/agent-appearance`; green selects skin, red hair, and blue irises.
`scripts/prepare-agent-motion-masks.mjs` exports eight aligned masks. Misu and
Kai's portrait masks are separately registered to the main checkout's existing
portraits by `scripts/prepare-agent-portrait-masks.mjs`; those originals are not
replaced by the experiment's different artwork.

```powershell
node scripts/prepare-agent-motion-frames.mjs --check
node scripts/prepare-agent-motion-masks.mjs --check
node scripts/prepare-agent-portrait-masks.mjs --check
node scripts/prepare-amina-interaction-masks.mjs --check
```

Amina's speaking sample uses illustrated mouth frames. It is an approximation,
not live lip synchronization. Animation exploration does not change preferences,
generate speech, open a microphone, or connect to a live provider. Prepared
voice clips are served locally. See [customization boundaries](agent-customization.md).

## Local preview and verification

Run `npm run demo` from the main checkout, then open
`http://127.0.0.1:4322/home/new`. This localhost fixture strips provider credentials,
does not load `.env.local`, and uses an in-memory sample account. It is not
production learner data; localhost requires the local server to remain running.

Focused tests cover presentation ownership, revisions and immutable session
snapshots; selected voice/cache identity; complete head geometry; assets;
and desktop/mobile playback, masks, pause and reduced motion. Results belong to
this checkout and must not be inferred from older experiment-only checks.
The owner README and prior New Session scrolling fix are preserved.

Before the half-body clarification, main-checkout verification on 15 October
2026 recorded 518 unit tests in 59 files passing.
Thirty-six distinct desktop/mobile browser cases are verified across the
recovery, mode, experience and customization suites, including bounded reruns
after correcting legacy selectors and fresh-scroll test assumptions. Wheel,
keyboard and mobile touch scrolling remain usable without changing `app.vue`.
Visual checks confirm complete customized heads without adjacent-row chin bleed.
Portrait masks, motion masks and frame-metadata generators validate locally.
Documentation links, the 120-file local parity snapshot, and the explicit
public-export scan pass. The separate private cross-repository release check
still retains its 33 pre-existing differences; those were not silently accepted.
Nuxt type checking and the production build pass. A strict tuple-type issue in
one updated browser assertion was corrected before those checks were repeated.
No commit, push, deployment, paid media generation or live avatar call is part
of this recovery.
