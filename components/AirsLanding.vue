<script setup lang="ts">
import {
  BookOpen,
  Mic,
  ArrowRight,
  FileText,
  MessageCircle,
  Check,
  Minus,
} from "lucide-vue-next";
defineProps<{ authenticated: boolean }>();
</script>

<template>
  <AirsPublicShell>
    <section class="airs-hero">
      <div class="airs-hero-copy">
        <p class="airs-eyebrow">Flowst Airs · Bring Your Source</p>
        <h1>Bring your source.<br />Talk it through.</h1>
        <p>
          Bring a source to Flowst Airs. Review Misu’s plan, explore ideas with Amina, practise
          explaining it aloud, and apply it to the conversations that matter to you.
        </p>
        <div class="airs-action-row">
          <NuxtLink
            class="airs-button"
            :to="authenticated ? '/airs' : '/auth/register'"
            >{{ authenticated ? "Open my study space" : "Get started free" }}
            <ArrowRight :size="18" /></NuxtLink
          ><a class="airs-button airs-button-secondary" href="#how-it-works"
            >How Flowst Airs works</a
          >
        </div>
        <small>No payment required to get started</small>
        <div class="airs-hero-benefits">
          <span><Mic :size="20" /> Voice conversation</span
          ><span><BookOpen :size="20" /> Guided learning</span
          ><span><FileText :size="20" /> Your materials</span>
        </div>
      </div>
      <div class="airs-hero-art">
        <img
          src="/mascots/amina.png"
          alt="Amina, the illustrated AI study companion"
          width="768"
          height="1024"
          fetchpriority="high"
        />
        <div class="airs-greeting">
          <span>Amina · Verbal learning partner</span>
          <p>Your voice-first study partner</p>
        </div>
        <div class="airs-resource-note">
          <FileText :size="22" /><span
            >Bring your notes.<br /><strong
              >Let's get you owning your voice</strong
            ></span
          >
        </div>
      </div>
    </section>
    <section id="how-it-works" class="airs-how">
      <div>
        <p class="airs-eyebrow">From curiosity to conversation</p>
        <h2>Bring a resource.<br />Make space to understand it.</h2>
        <p>
          Bring a document, public GitHub repository, readable web page, or
          video transcript. Review the included material before Misu plans your session.
        </p>
      </div>
      <ol class="airs-steps">
        <li>
          <span>01</span>
          <div>
            <h3>Bring your material</h3>
            <p>
              Upload a text-based PDF, Word document, or PowerPoint, or share a source
              link. Video speech transcription is available where configured;
              you can also supply a transcript.
            </p>
          </div>
          <FileText :size="23" />
        </li>
        <li>
          <span>02</span>
          <div>
            <h3>Review your session plan</h3>
            <p>
              See source-backed objectives and the activities ahead. Start when
              you’re ready.
            </p>
          </div>
          <BookOpen :size="23" />
        </li>
        <li>
          <span>03</span>
          <div>
            <h3>Talk it through with Amina</h3>
            <p>
              Start a voice call with Amina. Speak naturally, hear a response,
              and follow available transcripts while you talk. Revisit
              confirmed, saved conversations.
            </p>
          </div>
          <MessageCircle :size="23" />
        </li>
      </ol>
    </section>
    <section id="learning-philosophy" class="airs-comparison" aria-labelledby="airs-difference">
      <div class="airs-comparison-intro">
        <p class="airs-eyebrow">The Flowst approach</p>
        <h2 id="airs-difference">An answer makes sense.<br />Can you make it your own?</h2>
        <p>Flowst Airs is built around a learning conversation: questions, your reasoning, and feedback you can use. The aim is understanding you can express, confidence to speak, and a say in what happens next.</p>
      </div>
      <div class="airs-comparison-grid">
        <article aria-labelledby="airs-answer-heading">
          <div class="airs-comparison-art airs-answer-art" aria-hidden="true"><FileText :size="48" /><span>A clear explanation.</span></div>
          <p class="airs-comparison-label">When you stop at the answer</p>
          <h3 id="airs-answer-heading">You follow the explanation.</h3>
          <p>Generated answers can help you get oriented. Reading a convincing explanation leaves some questions about your own understanding open.</p>
          <ul class="airs-comparison-points">
            <li><Minus :size="18" aria-hidden="true" /><span>Could you explain it without repeating the answer?</span></li>
            <li><Minus :size="18" aria-hidden="true" /><span>Which part of your reasoning needs another look?</span></li>
            <li><Minus :size="18" aria-hidden="true" /><span>Could you use the idea in a different situation?</span></li>
            <li><Minus :size="18" aria-hidden="true" /><span>What would help you feel ready to speak about it?</span></li>
          </ul>
        </article>
        <article class="airs-comparison-featured" aria-labelledby="airs-practice-heading">
          <div class="airs-comparison-art airs-practice-art" aria-hidden="true"><img src="/mascots/amina.png" alt="" width="768" height="1024" loading="lazy" /><span>Your turn to explain.</span></div>
          <p class="airs-comparison-label">Practice with Flowst Airs</p>
          <h3 id="airs-practice-heading">You talk through the idea.</h3>
          <p>Your material and chosen goal guide the conversation. Amina is instructed to make room for your explanation, then help you examine and refine it.</p>
          <ul class="airs-comparison-points">
            <li><Check :size="18" aria-hidden="true" /><span>Explain in your own words; explore the “why,” not just the wording.</span></li>
            <li><Check :size="18" aria-hidden="true" /><span>Get feedback tied to your attempt and the source, then try again.</span></li>
            <li><Check :size="18" aria-hidden="true" /><span>Talk through examples connected to your agreed objective.</span></li>
            <li><Check :size="18" aria-hidden="true" /><span>Ask for help, challenge a response, and choose when to move on.</span></li>
          </ul>
          <NuxtLink :to="authenticated ? '/airs/new' : '/auth/register'">Start with your learning goal <ArrowRight :size="15" /></NuxtLink>
        </article>
      </div>

      <div class="airs-expectations">

        <details class="airs-learning-basis">
          <summary>Why questions, explanation, and another attempt?</summary>
          <p>Flowst draws on learning-science research on <a href="https://onlinelibrary.wiley.com/doi/10.1207/s15516709cog1803_3" target="_blank" rel="noopener noreferrer">self-explanation</a> and <a href="https://learninglab.psych.purdue.edu/downloads/2011/2011_Karpicke_Blunt_Science.pdf" target="_blank" rel="noopener noreferrer">retrieval practice.</a> These studies inform the design for self evaluation of understanding during learning</p>
        </details>

        <small>Amina is Flowst Airs’s AI verbal learning partner. The learning design draws on <a href="https://www.queensu.ca/ctl/resources/instructors/instructional-strategies/inquiry-based-learning" target="_blank" rel="noopener noreferrer">inquiry-based learning</a> principles.</small>
      </div>
    </section>
  </AirsPublicShell>
</template>
