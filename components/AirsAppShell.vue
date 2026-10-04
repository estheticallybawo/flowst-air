<script setup lang="ts">
import {
  Home,
  Plus,
  BookOpen,
  Settings,
  LogOut,
  ArrowUpRight,
} from "lucide-vue-next";
const props = defineProps<{ session?: boolean }>();
const route = useRoute();
const auth = useAuth();
const signingOut = ref(false);
const logoutError = ref("");
const accountMenu = ref<HTMLDetailsElement>();
const navigation = [
  { label: "Home", to: "/airs", icon: Home },
  { label: "New session", to: "/airs/new", icon: Plus },
  { label: "Library", to: "/airs#library", icon: BookOpen },
  { label: "Settings", to: "/airs/settings", icon: Settings },
];
const displayName = computed(
  () => auth.me.value?.profile.displayName || "Your account",
);
function active(to: string) {
  return (
    route.fullPath === to ||
    (to === "/airs" && route.path === "/airs" && !route.hash)
  );
}
function closeMenu(event: PointerEvent) {
  if (!accountMenu.value?.contains(event.target as Node) && accountMenu.value)
    accountMenu.value.open = false;
}
onMounted(() => document.addEventListener("pointerdown", closeMenu));
onBeforeUnmount(() => document.removeEventListener("pointerdown", closeMenu));
async function signOut() {
  if (signingOut.value) return;
  // The study room registers this guard to handle unsent recordings and stop media.
  const lifecycle = useAirsMediaLifecycle();
  if (!((await lifecycle.beforeExit.value?.()) ?? true)) return;
  signingOut.value = true;
  logoutError.value = "";
  try {
    await auth.signOut("/?reason=signed-out");
  } catch {
    logoutError.value =
      "We could not confirm sign-out. Please try again before leaving this device.";
  } finally {
    signingOut.value = false;
  }
}
</script>

<template>
  <div class="airs-app" :class="{ 'call-shell': props.session }">
    <header class="airs-app-header">
      <NuxtLink
        v-if="props.session"
        to="/"
        class="call-brand"
        aria-label="Flowst Airs home"
        ><img
          src="/brand/flowst-mark-blue.png"
          width="26"
          height="24"
          alt=""
        /><span>Flowst</span
        ><span class="call-brand-airs">Airs</span></NuxtLink
      ><AirsBrand v-else />
      <div v-if="props.session" class="call-navigation">
        <slot name="session-navigation" />
      </div>
      <nav v-else class="airs-top-navigation" aria-label="Flowst Airs navigation">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          :class="{ active: active(item.to) }"
          :aria-current="active(item.to) ? 'page' : undefined"
          ><component :is="item.icon" :size="17" /><span>{{
            item.label
          }}</span></NuxtLink
        >
      </nav>
      <details
        ref="accountMenu"
        class="airs-account"
        @keydown.esc="accountMenu && (accountMenu.open = false)"
      >
        <summary :aria-label="`Open ${displayName}'s account menu`">
          {{
            auth.me.value?.profile.initials ||
            displayName.slice(0, 1).toUpperCase()
          }}
        </summary>
        <div class="airs-account-menu">
          <strong>{{ displayName }}</strong
          ><small>{{ auth.me.value?.profile.email }}</small
          ><NuxtLink to="/airs/settings">Account &amp; access</NuxtLink
          ><button type="button" :disabled="signingOut" @click="signOut">
            <LogOut :size="16" /> {{ signingOut ? "Signing out…" : "Sign out" }}
          </button>
          <p v-if="logoutError" role="alert">{{ logoutError }}</p>
        </div>
      </details>
    </header>
    <div class="airs-app-layout">
      <main id="main-content" class="airs-app-content" tabindex="-1">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.call-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  font-family: "Unbounded", sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: #0d0f14;
  flex: none;
}
.call-brand img {
  object-fit: contain;
}
.call-brand-airs {
  border-left: 1px solid #dbdee5;
  padding-left: 14px;
  margin-left: 5px;
  font-size: 0.8rem;
}
.call-navigation {
  flex: 1;
  min-width: 0;
}
.call-shell .airs-app-header {
  flex-wrap: nowrap;
}
.call-shell .airs-app-header {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid #fff;
  border-radius: 24px;
  padding: 0 20px;
  gap: 20px;
  box-shadow: 0 14px 35px rgba(48, 69, 98, 0.07);
}
.call-shell .airs-account summary {
  background: #eef3fb;
  border: 1px solid #dbdee5;
  color: #0d0f14;
}
@media (max-width: 767px) {
  .call-brand {
    gap: 5px;
  }
  .call-brand > span:not(.call-brand-airs) {
    display: none;
  }
  .call-brand-airs {
    padding-left: 0;
    margin: 0;
    border: 0;
    font-size: 0.75rem;
  }
  .call-shell .airs-app-header {
    gap: 8px;
    padding: 0 10px;
    border-radius: 18px;
  }
}

.airs-session-nav {
  display: flex;
  gap: 24px;
  align-items: center;
  font-size: 0.8rem;
}
.airs-session-nav a,
.airs-session-nav span {
  min-height: 44px;
  display: flex;
  align-items: center;
}
.airs-session-nav span {
  border-bottom: 2px solid var(--agent-amina);
  font-weight: 700;
}
@media (max-width: 767px) {
  .airs-session-nav {
    gap: 12px;
    font-size: 0.7rem;
    margin-left: auto;
  }
  .airs-session-nav a:not(:first-child) {
    display: none;
  }
}
</style>
