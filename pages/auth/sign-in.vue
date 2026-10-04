<script setup lang="ts">
import { accountError } from '~/shared/userErrors'
import { airReturnPath } from '~/shared/airNavigation'
const route = useRoute()
const auth = useAuth()
const standaloneAir = ['air', 'amira'].includes(useRuntimeConfig().public.appSurface)
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const notice = computed(() => route.query.reason === 'session-expired'
  ? 'Your previous session ended. Sign in again to continue where you stopped.'
  : route.query.reason === 'signed-out'
    ? 'You have been signed out safely.'
    : '')
useHead({ title: standaloneAir ? 'Sign in · Flowst Air' : 'Sign in · Flowst' })

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await auth.signIn(email.value, password.value)
    const requested = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') && !route.query.redirect.startsWith('//') ? route.query.redirect : ''
    const redirect = standaloneAir ? airReturnPath(requested) : (requested || '/home')
    await navigateTo(redirect)
  } catch (cause: any) {
    error.value = accountError(cause, 'sign-in')
  } finally { busy.value = false }
}
</script>

<template>
  <AuthShell eyebrow="Welcome back" :title="standaloneAir ? 'Sign in to Flowst Air' : 'Sign in to Flowst'" :description="standaloneAir ? 'Return to your documents and guided Voice conversation.' : 'Return to your community, approved Flows, and any school spaces you have been approved to access.'">
    <form @submit.prevent="submit">
      <div class="field"><label for="email">Email</label><input id="email" v-model="email" class="input" type="email" autocomplete="email" required></div>
      <PasswordField v-model="password" id="password" label="Password" autocomplete="current-password" required />
      <p v-if="notice" class="form-notice" role="status">{{ notice }}</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="auth-actions"><NuxtLink class="auth-link" :to="{ path: '/auth/recover', query: standaloneAir ? { redirect: airReturnPath(route.query.redirect) } : {} }">Forgot password?</NuxtLink><button class="btn btn-primary" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button></div>
      <p class="form-note">{{ standaloneAir ? 'New to Flowst Air?' : 'New to Flowst?' }} <NuxtLink class="auth-link" :to="{ path: '/auth/register', query: standaloneAir ? { redirect: airReturnPath(route.query.redirect) } : {} }">Create your learner account</NuxtLink></p>
    </form>
  </AuthShell>
</template>

<style scoped>
.form-notice{margin:0;padding:11px 13px;border-radius:13px;color:#3f4a45;background:rgba(143,134,255,.12);font-size:.8rem}
</style>
