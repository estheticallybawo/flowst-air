# Home companion prototype

16 October 2026. This is an opt-in demonstration on Airs' own Home page, not a
browser extension, external-site reader, live agent session or learning assessment.
No external website or embedded page is needed.

## Try it

Open Mode demos, expand **Companion on Home** below the mode preview, follow its
launcher link, enable the demo, then choose
**Go to Home**. A free-floating animated face and compact speech cloud appear at
the bottom-right of the existing Growth Home, including on mobile. Choose Misu,
Amina or Kai as the inviter. Select any of the seven existing capability cards
on Home to change the invitation's context. This uses Home's known selection,
not an inference about what you have read.

**Start a study session** opens the normal New session setup, where you choose
your material and review Misu's plan. The page is not automatically imported.
For a no-microphone walkthrough, choose **Preview a sample** instead:

1. Misu offers a short sample plan. The learner reviews and explicitly approves it.
2. Amina invites an explanation. **Show sample answer** reveals fictional text;
   the prototype does not capture a voice, transcribe speech or assess typed input.
3. Kai offers an optional reflection on that scripted answer, with an observation,
   a limitation and a possible next exercise. It is not feedback on the learner.

Dismiss collapses the speech cloud to a small mascot/reopen control; snooze lasts
until manual reopening, without an automatic timer. **Companion options** reveals
pause, restart, snooze, off and context details. Turn off removes the companion
and clears its walkthrough. Reduced motion is respected. Other routes do not
show the widget. Returning to Home starts a fresh invitation rather than retaining
an approved plan. Changing capability or inviter also resets the sample approval,
without reopening a dismissed or snoozed companion. A hard reload or account
change clears activation entirely.

## Boundaries

- Explicit enabling is required. Query parameters do not grant activation.
- Context is authored demo text mapped to the known Airs Home capability selection, not DOM scraping,
  browsing-history access, scroll surveillance or inference about what was read.
- State lives only in a separate Nuxt memory store scoped to the authenticated
  account. No local/session storage, new API, background process or persistence.
- No microphone, screen capture, provider request, generated speech, growth
  evidence, Tides, grades or authoritative learning state is created.
- The existing source-review, plan approval, voice consent, entitlement and
  ownership boundaries of real study sessions remain unchanged.
- Tiny mascots use face-only artwork. Amina's half-body interaction renderer and
  existing mode simulations are not replaced.

## Implementation

`shared/webCompanionDemo.ts` owns the catalog and guarded walkthrough transitions.
`composables/useWebCompanionDemo.ts` owns ephemeral, account-scoped state.
`pages/home/companion.vue` is the launcher; `AirsWebsiteCompanion.vue` supplies
the Home widget through an optional Growth Home slot. The ordinary authenticated
route policy is retained; no page is added to the public-page allowlist.

## Later, outside this prototype

Cross-website support would need a separately reviewed browser-side integration,
explicit context sharing, supported content extraction and source review. A page
from one origin is not evidence that Airs can inspect unrelated tabs. A possible
Chrome extension could request temporary, user-triggered access using
[activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
and offer a user-opened
[side panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel).
That is a future design direction, not a capability of this demo. Video support
would require an available, permitted transcript; it cannot be promised for every
site or video. Real Kai assessment would still require owned learner evidence.

## Verification

Reducer and browser regressions cover activation, explicit approval, fictional
answer/reflection boundaries, hiding and reopening, topic changes, route leaving,
reload, keyboard access, mobile layout, motion and absence of unexpected device,
provider or record-writing requests. Final local results are recorded after
checks; local fixtures do not establish deployment or cross-site access.

The initial 16 October panel prototype passed 535 unit tests in 61 files and 32
desktop/mobile browser cases, including all 22 earlier avatar/mode/experience
cases. That is a prior baseline, not verification of the revised floating-mascot
layout, inviter choices or Home-context binding.

The revised floating layout passes all 21 companion unit tests and all 10
desktop/mobile companion browser cases. Local startup was unusually slow;
the passing browser retry used an ignored validation config with bounded
30-second assertion waits and 180-second case limits. Request, device, storage,
approval and evidence guards were not relaxed. Captures verify all three
inviters, real Home selection changes and mobile native-dialog focus restoration.
The broader retry was stopped after existing image tests exceeded their
5-second limits and existing browser cases hit hydration timeouts. It is not
a new full-suite pass. Normal study navigation is not replaced by a pretend
live session.

The local 120-file shared snapshot retains the previously reviewed standalone
Home slot and all private-Flowst reference hashes. The explicit export allowlist
includes the eight prototype source/document/test files.
No commit, push, deployment, external-site access or paid provider call was
performed for this prototype. The owner README is unchanged.
