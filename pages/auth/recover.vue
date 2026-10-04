<script setup lang="ts">
import { accountError } from '~/shared/userErrors'
import { airReturnPath } from '~/shared/airNavigation'
const route = useRoute()
const step = ref<'REQUEST' | 'CONFIRM' | 'DONE'>('REQUEST')
const email = ref('')
const code = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const standaloneAir = ['air', 'amira'].includes(useRuntimeConfig().public.appSurface)
const signInDestination = computed(() => ({ path: '/auth/sign-in', query: standaloneAir ? { redirect: airReturnPath(route.query.redirect) } : {} }))
useHead({ title: standaloneAir ? 'Recover account · Flowst Air' : 'Recover account · Flowst' })

async function requestCode() {
  busy.value = true; error.value = ''
  try { await $fetch('/api/auth/recover', { method: 'POST', body: { email: email.value } }); step.value = 'CONFIRM' }
  catch (cause: any) { error.value = accountError(cause, 'recover') }
  finally { busy.value = false }
}

async function confirm() {
  busy.value = true; error.value = ''
  try { await $fetch('/api/auth/recover-confirm', { method: 'POST', body: { email: email.value, code: code.value, password: password.value } }); step.value = 'DONE' }
  catch (cause: any) { error.value = accountError(cause, 'reset') }
  finally { busy.value = false }
}
</script>

<template>
  <AuthShell eyebrow="Account recovery" title="Return to your learning" :description="standaloneAir ? 'Use your verified email to regain access to your Flowst Air study chats.' : 'Use your verified email to reset access. School permissions and learning records remain attached to the same identity.'">
    <form v-if="step === 'REQUEST'" @submit.prevent="requestCode">
      <div class="field"><label for="email">Email</label><input id="email" v-model="email" class="input" type="email" autocomplete="email" required></div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="auth-actions"><NuxtLink class="auth-link" :to="signInDestination">Back to sign in</NuxtLink><button class="btn btn-primary" :disabled="busy">{{ busy ? 'Sending…' : 'Send recovery code' }}</button></div>
    </form>
    <form v-else-if="step === 'CONFIRM'" @submit.prevent="confirm">
      <div class="field"><label for="code">Recovery code</label><input id="code" v-model="code" class="input" inputmode="numeric" autocomplete="one-time-code" minlength="6" required></div>
      <PasswordField v-model="password" id="password" label="New password" autocomplete="new-password" :minlength="10" required help="At least 10 characters with upper-case, lower-case, and number characters." />
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="auth-actions"><button type="button" class="btn btn-secondary" @click="step='REQUEST'">Back</button><button class="btn btn-primary" :disabled="busy">{{ busy ? 'Changing…' : 'Change password' }}</button></div>
    </form>
    <div v-else class="stack"><p>Your password has been changed. Sign in with the new password.</p><NuxtLink class="btn btn-primary" :to="signInDestination">Return to sign in</NuxtLink></div>
  </AuthShell>
</template>
