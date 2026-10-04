<script setup lang="ts">
import { accountError } from '~/shared/userErrors'
import { airReturnPath } from '~/shared/airNavigation'
const route = useRoute()
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const standaloneAir = ['air', 'amira'].includes(useRuntimeConfig().public.appSurface)
useHead({ title: standaloneAir ? 'Create account · Flowst Air' : 'Create account · Flowst' })

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/register', { method: 'POST', body: { email: email.value, password: password.value } })
    await navigateTo({ path: '/auth/verify', query: { email: email.value, ...(standaloneAir ? { redirect: airReturnPath(route.query.redirect) } : {}) } })
  } catch (cause: any) {
    error.value = accountError(cause, 'register')
  } finally { busy.value = false }
}
</script>

<template>
  <AuthShell :eyebrow="standaloneAir ? 'Start studying' : 'Join the learning community'" title="Create your account" :description="standaloneAir ? 'Create a learner account to save your documents, study plans, and voice transcripts.' : 'Everyone begins with the same learner identity. School responsibilities are provisioned separately and cannot be self-selected.'">
    <form @submit.prevent="submit">
      <div class="field"><label for="email">Email</label><input id="email" v-model="email" class="input" type="email" autocomplete="email" required></div>
      <PasswordField v-model="password" id="password" label="Password" autocomplete="new-password" :minlength="10" required help="At least 10 characters with upper-case, lower-case, and number characters." />
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="auth-actions"><NuxtLink class="auth-link" :to="{ path: '/auth/sign-in', query: standaloneAir ? { redirect: airReturnPath(route.query.redirect) } : {} }">I already have an account</NuxtLink><button class="btn btn-primary" :disabled="busy">{{ busy ? 'Creating…' : 'Create account' }}</button></div>
    </form>
  </AuthShell>
</template>
