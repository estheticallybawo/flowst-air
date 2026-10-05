<script setup lang="ts">
definePageMeta({ middleware: [] });
useHead({ title: "Access & plans · Flowst Airs" });
</script>
<template>
  <AirPublicShell>
    <div class="air-trust-copy">
      <p class="air-eyebrow">Access &amp; plans</p>
      <h1>Start with your curiosity.<br />The pilot is free.</h1>
      <p>
        Bring one resource, review your plan, and start a guided voice call with
        Flowst Airs. No payment is required.
      </p>
      <section>
        <h2>Free pilot</h2>
        <p>
          Work with one active document at a time, up to 4 MB. Text-based PDF,
          DOCX, and PPTX files are supported; scanned-image documents are not.
          Choose a purpose, focused or broad coverage, and available time to
          shape your plan.
        </p>
        <p>
          Voice practice has no cumulative input-time or generated-speech quota.
          Each recorded take can be up to two minutes. Live pilot calls remain
          limited to 60 seconds per call and can be started again. Your chosen
          practice time applies to each topic block.
        </p>
        <p>
          Start another document after completing the agreed objectives, or use
          Replace study document to explicitly abandon the current plan.
          Deleting an unfinished document alone does not unlock a replacement.
          Abandonment leaves the old document read-only and does not claim
          completion or mastery. Saved conversations remain readable and can be
          deleted at any time.
        </p>
        <details>
          <summary>Recorded exercises and replay</summary>
          <p>
            Recorded exercises use Record, Stop, review, and Send. Each
            recording can be up to two minutes. Replaying audio already cached
            by the study does not send another synthesis request, including after a reload.
            Preparing new audio or explicitly retrying a failed speech request
            can call the speech provider. The timer is separate from each recording.
          </p>
        </details>
        <NuxtLink class="air-button" to="/airs">Open my study space</NuxtLink>
      </section>
      <section>
        <h2>Paid plans are coming later</h2>
        <p>
          Paid access is not available yet. There is no checkout or subscription
          to purchase in this pilot.
        </p>
      </section>
      <NuxtLink class="air-text-link" to="/airs/about"
        >Understand how your material and microphone are used</NuxtLink
      >
    </div>
  </AirPublicShell>
</template>
