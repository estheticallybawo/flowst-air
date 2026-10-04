<script setup lang="ts">
import { accountError } from '~/shared/userErrors'
import { airReturnPath } from '~/shared/airNavigation'
const route = useRoute()
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const code = ref('')
const busy = ref(false)
const error = ref('')
useHead({ title: ['air', 'amira'].includes(useRuntimeConfig().public.appSurface) ? 'Verify email · Flowst Air' : 'Verify email · Flowst' })

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/verify', { method: 'POST', body: { email: email.value, code: code.value } })
    await navigateTo({ path: '/auth/sign-in', query: { verified: 'true', ...(['air', 'amira'].includes(useRuntimeConfig().public.appSurface) ? { redirect: airReturnPath(route.query.redirect) } : {}) } })
  } catch (cause: any) {
    error.value = accountError(cause, 'verify')
  } finally { busy.value = false }
}
</script>

<template>
  <AuthShell eyebrow="Check your email" title="Verify your account" description="Enter the code sent to your email. This confirms the account belongs to you.">
    <form @submit.prevent="submit">
      <div class="field"><label for="email">Email</label><input id="email" v-model="email" class="input" type="email" autocomplete="email" required></div>
      <div class="field"><label for="code">Verification code</label><input id="code" v-model="code" class="input" inputmode="numeric" autocomplete="one-time-code" minlength="6" required></div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="auth-actions"><NuxtLink class="auth-link" to="/auth/register">Back</NuxtLink><button class="btn btn-primary" :disabled="busy">{{ busy ? 'Verifying…' : 'Verify email' }}</button></div>
    </form>
  </AuthShell>
</template>
