<script setup lang="ts">
defineProps<{ eyebrow: string, title: string, description: string }>()
const standaloneAirs = true
</script>

<template>
  <main id="main-content" class="auth-page" :class="{ 'airs-auth': standaloneAirs }" tabindex="-1">
    <section class="auth-layout">
      <aside class="auth-story">
        <AirsBrand v-if="standaloneAirs" />
        <div class="auth-story-copy">
          <template v-if="standaloneAirs">
            <p class="eyebrow">Study out loud</p>
            <h1>Bring your notes. Find your voice.</h1>
            <p>Upload a resource and practise it aloud in a guided conversation. Your AI study assistant, at your pace.</p>
          </template>
        </div>
        <img v-if="standaloneAirs" class="auth-art" src="/mascots/amina.png" alt="Amina, your AI study companion" width="410" height="558">
      </aside>
      <section class="auth-card">
        <p class="eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
        <p class="auth-description">{{ description }}</p>
        <slot />
        <p v-if="standaloneAirs" class="form-note"> 18+ <NuxtLink class="auth-link" to="/airs/about">Privacy &amp; microphone information</NuxtLink></p>
      </section>
    </section>
  </main>
</template>

<style scoped>
.auth-page{min-height:100dvh;padding:18px}.auth-layout{width:min(100%,1020px);min-height:calc(100dvh - 36px);margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:18px}.auth-story,.auth-card{padding:clamp(28px,5vw,58px);border:1px solid rgba(255,255,255,.82);box-shadow:var(--shadow)}.auth-story{display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;border-radius:42px;color:#fff;background:var(--ink)}.auth-story-copy{margin-top:80px}.auth-story .eyebrow{color:#b9b3ff}.auth-story h1{font-size:clamp(1.75rem,4vw,3rem);line-height:1.1}.auth-story-copy>p:last-child{color:rgba(255,255,255,.64)}.auth-card{align-self:center;border-radius:34px;background:rgba(255,255,255,.72);backdrop-filter:blur(18px)}.auth-card h2{font-size:clamp(1.55rem,3vw,2.4rem)}.auth-description{margin:13px 0 24px;color:var(--ink-soft)}.auth-card :deep(form){display:grid;gap:15px}.auth-card :deep(.auth-actions){display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:7px}.auth-card :deep(.auth-link){color:#554bbe;font-size:.82rem;font-weight:650}.auth-card :deep(.form-error){margin:0;padding:11px 13px;border-radius:13px;color:#9a3d2b;background:#fff0ec;font-size:.8rem}.auth-card :deep(.form-note){margin:0;color:var(--ink-soft);font-size:.78rem}@media(max-width:760px){.auth-layout{grid-template-columns:1fr;min-height:auto}.auth-story{min-height:300px}.auth-story-copy{margin-top:64px}.auth-card{width:100%}}
.airs-auth-brand{min-height:44px;display:inline-flex;align-items:center;gap:9px;color:#fff;font-weight:800}

.airs-auth .auth-layout { width: min(100%,1100px); gap: 24px; }
.airs-auth .auth-story { background: #eef3fb; color: #0d0f14; border: 1px solid #dbdee5; border-radius: 28px; box-shadow: none; }
.airs-auth .auth-story-copy { margin-top: 32px; }
.airs-auth .auth-story .eyebrow { color: #464a53; }
.airs-auth .auth-story h1 { font-size: clamp(1.8rem,3.2vw,2.6rem); line-height: 1.25; }
.airs-auth .auth-story-copy>p:last-child { color: #464a53; line-height: 1.65; }
.airs-auth .auth-card { border: 1px solid #dbdee5; border-radius: 28px; background: #fff; box-shadow: none; }
.airs-auth .auth-card :deep(.auth-link) { color: #315d82; min-height: 44px; display: inline-flex; align-items: center; }
.airs-auth .auth-card :deep(.btn-primary) { background: #2e2f30; color: #fff; min-height: 48px; box-shadow: none; }
.airs-auth .auth-card :deep(.input) { background: #f7faff; border-color: #dbdee5; min-height: 48px; }
@media(max-width:760px) { .airs-auth .auth-story { min-height: 240px; }.airs-auth .auth-story-copy { margin-top: 24px; }.airs-auth .auth-story h1 { font-size: 1.8rem; }.airs-auth .auth-art { display: none; }.airs-auth .auth-card { padding: 26px; } }
</style>
