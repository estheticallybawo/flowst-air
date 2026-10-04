<script setup lang="ts">
definePageMeta({ alias: '/amira/pricing', middleware: ["air-only"] });
useHead({ title: "Access & plans · Flowst Air" });
</script>
<template>
  <AirPublicShell>
    <div class="air-trust-copy">
      <p class="air-eyebrow">Access &amp; plans</p>
      <h1>Start with your curiosity.<br />The pilot is free.</h1>
      <p>
        Bring one resource, review your plan, and start a guided voice call with
        Flowst Air. No payment is required.
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
          Each document includes up to 300 voice input seconds and 6,000
          generated reply characters for voice. Each live testing call reserves
          up to 60 seconds before connecting; unused reserved time is not
          refunded. You can speak naturally during the call without a separate
          Send step.
        </p>
        <p>
          Start another document after completing the agreed objectives, or use
          Replace study document to explicitly abandon the current plan.
          Deleting an unfinished document alone does not unlock a replacement.
          Abandonment leaves the old document read-only and does not claim
          completion or mastery. Saved conversations
          remain readable and can be deleted when a voice allowance is
          exhausted.
        </p>
        <details>
          <summary>Allowance for existing recorded exercises</summary>
          <p>
            Separate recorded exercises share the same document allowance. Each
            recording can be up to two minutes. Replaying audio already cached
            on the page does not use more allowance; replaying after a reload
            may.
          </p>
        </details>
        <NuxtLink class="air-button" to="/airs"
          >Open my study space</NuxtLink
        >
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
