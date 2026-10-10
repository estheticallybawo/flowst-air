# Growth Home prototype

Status: completed — labelled frontend prototype, verified locally on 10 October 2026. Live assessment remains future work. Scope: integrated Home with example Growth data, independent adult learners.

## Decisions and behavior

Growth is the default Home in development and production and displays seven capabilities inside the existing Airs product. New session retains Misu setup at /airs/new; an explicit AIR_GROWTH_ENABLED=false rolls Home back to setup. Example data is identified with one discreet notice per visible view; no reward API, model request, microphone access or learning-record write was added.

Product definitions live separately from the example adapter, which owns starting values, evidence, history and scripted transitions. Nuxt request-isolated state survives client navigation, resets on reload, and resets when a scenario or Reset example is selected. Returning learner, New learner, Review pending and Review failed are inspectable. Pending/failed presets retain the returning learner's established sample progress; retry restores the ready preset.

The walkthrough applies one session update (Clear Explanation +12, Reasoning Aloud +8, Self-Monitoring +6; Transfer unchanged), then one Reasoning Aloud completion. The completion shows 100%, five completed cycles, an evolved badge frame and a sample Flowmark. Continuing shows 0% toward cycle 6. Reopening a reflection never reapplies its update. Flowmark sharing is a local card preview only.

Desktop selection updates a detail panel. Mobile selection opens a native modal dialog with keyboard dismissal and focus restoration. Badge frame stages begin at 0, 1, 3, 5 and 10 cycles. Reduced motion disables progress transitions. Counts describe completed evidence cycles, never ability grades.

## Implementation and verification

Presentation contracts and fixtures remain independent of Kai's existing four-domain assessment. Browser checks cover the full sample journey, scenarios, memory/reset semantics, setup access, no study mutations/microphone starts, accessibility and overflow. Shared parity records pin the Home adaptation; other shared learning/voice components remain unchanged. See [verification](../../references/verification.md) for actual results.

## Next milestone

After visual/product review, specify seven-capability evidence assessment and support-event packets, versioned deterministic cycle policies, durable duplicate-credit prevention, atomic cycle/Flowmark storage, private learner history and controlled publication. Stable criteria require fresh evidence and varied contexts in later cycles. These backend capabilities and real longitudinal improvement are not implemented by this prototype.

## Backend proposal after prototype review

1. Define versioned policies for the seven capabilities, separately from Kai's four-domain session review. Specify accepted evidence, support levels, minimum fresh examples and varied-context requirements; later cycles keep stable criteria.
2. Produce assessment packets referencing owned saved learner turns, approved source snapshots, context and support events. Validate attribution and confidence before accepting evidence. Pending or failed assessments preserve earlier progress and support explicit retry.
3. Apply deterministic progression in the backend. Persist a unique credit key for learner, evidence item and capability across all cycles; store policy version and cycle attribution as metadata rather than making old evidence eligible again. Retries, replay and policy changes cannot award duplicate credit. Corrections need an explicit audit/reversal path. One conversation may support multiple capabilities only with distinct qualifying evidence.
4. Complete a cycle and create its private Flowmark in one transaction, with concurrency/version checks and unique completion identity. Advance to a fresh cycle at zero while retaining immutable completion history. Keep policy versions and the credited evidence available for explanation and correction.
5. Serve learner-owned progress, evidence, cycle history and private Flowmarks through authorized reads. Publication requires a separate learner-controlled action and revocation; a share preview alone never publishes. Decide consent, exposed evidence, moderation and deletion behavior before implementing public links.
6. Verify duplicate/reordered events, concurrent completion, authorization, review failure and correction, then compare judgments with reviewed human examples before enabling real credit. Roll out behind a separate backend feature flag. No part of this proposal is implemented or authorized for deployment by the prototype milestone.

## Airs brand and owner-supplied artwork

The visual refinement uses Airs' existing blue accent, pale-blue canvas, white panels, Albert Sans body text and Unbounded headings. Buttons reuse the Airs controls; Amina uses the existing avatar. The seven capability accent colours are retained. Botanical ornament and the oversized motivational hero have been removed. Styling remains scoped to Growth.

Seven owner-supplied transparent 3D PNGs represent Verbal Retrieval (teal voice chat), Clear Explanation (purple lightbulb), Conceptual Precision (orange bullseye), Reasoning Aloud (teal megaphone), Self-Monitoring, Transfer (blue water exchange) and Conversation Flow (purple chat exchange). Source images live unchanged in public/growth. Artwork is configured in shared/airGrowthCapabilities.ts. Badge frames evolve at 0, 1, 3, 5 and 10 completed cycles. Cards, evidence details and Flowmarks share the same capability image. The owner’s lighter accents are retained; progress text uses Airs dark ink for contrast.

## Product integration correction

The owner clarified that example data should demonstrate future progression inside Airs, not isolate Growth as a separate product. Removed the hosted workaround's demo-info route, forced redirects, account-menu replacement, guest-session bypass and blanket API denial. Normal navigation and authentication remain intact. Home activation changes presentation only; the former hosted branch flag is retained as a migration alias.

Moved scenario/reset and scripted progression into a collapsed **Explore example progress** section, reduced repeated sample wording, and retained a compact provenance notice. Product capability definitions and formatting now live separately from example records. The UI consumes a source-independent GrowthSnapshot; example-only walkthrough state stays behind useAirGrowth. This prepares the UI boundary, while real backend assessment, transactions and learner-owned records remain outstanding as described above.

The owner confirmed there is no separate Preview backend and explicitly requested the integrated Growth Home in live production. Release through the existing production environment and release branch after verification. The missing Preview signing key was a deployment configuration issue; provider or Production credentials are not copied into Preview. See the verification record for actual checks and deployment status.
