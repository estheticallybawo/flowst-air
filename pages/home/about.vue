<script setup lang="ts">
definePageMeta({ middleware: [] });
useHead({ title: "Privacy & trust · Flowst Air" });
</script>
<template>
  <AirPublicShell>
    <article class="air-trust-copy">
      <p class="air-eyebrow">Built for learning, with care</p>
      <h1>Your curiosity deserves clarity.</h1>
      <section>
        <h2>About Flowst Air</h2>
        <p>
          Flowst Air is an independent learning environment. Misu proposes plans for your approval; Amina guides spoken practice. Amina is an AI learning partner, not a human
          tutor or accredited examiner. Upload a resource and practise it aloud
          in a guided conversation. Check important answers against the cited
          source.
        </p>
      </section>
      <section>
        <h2>How learning guidance works</h2>
        <p>
          Before uploading, choose your purpose, focused or broad coverage, and
          available time. Add a short brief if you need a particular focus. A
          planning service uses these choices and your material to propose
          source-backed objectives and estimated effort. Review the plan before
          starting; the estimates do not promise a fixed finish time.
        </p>
        <p>
          When you start a live call, Amina prepares an opening from your active
          objective, then responds aloud as you talk. You do not need to review
          a recording or press Send. Suggestions draw on saved evidence;
          completing an activity is not proof of mastery.
        </p>
      </section>
      <section>
        <h2>Your material and data</h2>
        <p>
          Your uploaded document or confirmed source snapshot is stored in cloud object storage. Extracted
          passages, session choices and any short brief, study plans, finalized
          transcripts, feedback, and learning activity records are stored in a
          cloud database. Study operations check the signed-in owner before
          accessing records. Authorized service operators may access data for
          operation and support.
        </p>
        <p>
          AWS stores your study records and provides account and backend
          services. Source passages, your planning choices and brief, and
          conversation text are sent to Groq to prepare learning plans and
          replies. ElevenLabs processes live voice calls and any separate
          recorded exercises. This experience does not run entirely on your
          device.
        </p>
        <p>
          Deleting a study chat removes its original document and associated
          study records from application storage. An active-session marker
          remains until its agreed objectives are completed or you explicitly
          abandon the plan. Deleting an unfinished document does not unlock a
          replacement by itself; Replace study document asks you to confirm
          abandonment, leaves any saved document read-only, and does not mark
          the objectives complete. No automatic
          retention period or deletion of provider-side records is promised by
          this interface.
        </p>
      </section>
      <section>
        <h2>Source links and video transcripts</h2>
        <p>
          Public repositories and readable web pages become attributed text snapshots.
          Review the included passages before creating a plan. Repository files are
          pinned to a commit; source content cannot give the agents new instructions.
        </p>
        <p>
          Where video transcription is configured, choosing Create transcript sends
          the public YouTube or TikTok link to ElevenLabs. This uses a separate source
          allowance, not your voice-practice time. AI transcripts can contain errors.
          Only speech is included; diagrams, demonstrations and on-screen text are
          not inspected. Pasted or uploaded transcripts are labelled as learner-supplied.
        </p>
        <p>
          Draft access expires after 30 minutes; storage cleanup may happen later.
          Cancelling a draft prevents its use but may not stop provider work already
          submitted. Deleting a study record does not delete the original public
          source or independent provider records.
        </p>
      </section>
      <section>
        <h2>Microphone and transcripts</h2>
        <p>
          Your microphone starts after you choose Start session or Start live
          call and grant permission. During the call, speak naturally and hear
          Amina reply aloud. Mute silences your input. End call, leaving the
          session, and sign-out stop microphone capture and playback. You can
          interrupt Amina while she speaks.
        </p>
        <p>
          Each live pilot call lasts up to 60 seconds. Voice practice has no
          cumulative study or daily voice quota. Usage is still recorded; a
          failed or uncertain provider request can be included in that record.
        </p>

        <p>
          Available live caption previews may change. Learner responses and
          generated replies appear as saved only after application storage
          confirms them. Transcripts can contain speech recognition errors. A
          saved generated reply does not prove you heard it completely,
          especially if you interrupted. Live call responses do not
          automatically advance assessed activities. Your microphone recording is not saved as an application audio file. Prepared Amina replies are saved privately for Replay and deleted with the study conversation. Replay of prepared audio does not send another synthesis request.
        </p>
        <details>
          <summary>About separate recorded exercises</summary>
          <p>
            Some existing exercises use Record, Stop, review, and Send to submit
            audio for transcription. These are separate from live calls and
            have no cumulative voice quota. Each take can be up to two minutes. Leaving an exercise with an unsent
            recording asks before discarding it.
          </p>
        </details>
      </section>
      <section>
        <h2>Accessibility</h2>
        <p>
          Controls support keyboard navigation and visible focus. Saved replies
          are readable in the conversation, and animation respects your device’s
          reduced-motion preference. Speech input requires microphone support
          and permission; typed input is not available. Available live captions
          remain separate from confirmed saved records.
        </p>
      </section>
      <section>
        <h2>Report a problem</h2>
        <p>
          If a request fails, use its retry control. For microphone problems,
          check this site’s permissions in your browser. For pilot support,
          contact the person who provided your access; include what happened
          without sharing private documents or recordings.
        </p>
      </section>
    </article>
  </AirPublicShell>
</template>
