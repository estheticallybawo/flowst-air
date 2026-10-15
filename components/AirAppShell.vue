<script setup lang="ts">
import {
  Home,
  Plus,
  BookOpen,
  PanelsTopLeft,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-vue-next";
const props = defineProps<{ session?: boolean; focusMode?: boolean }>();
const route = useRoute();
const auth = useAuth();
const signingOut = ref(false);
const logoutError = ref("");
const accountMenu = ref<HTMLDetailsElement>();
const header = ref<HTMLElement>();
const menuTrigger = ref<HTMLButtonElement>();
const productNavigation = ref<HTMLElement>();
const menuOpen = ref(false);
const navigationReady = ref(false);
const navigationId = "air-product-navigation-" + useId();
const navigation = [
  { label: "Home", to: "/home", icon: Home },
  { label: "New session", to: "/home/new", icon: Plus },
  { label: "Library", to: "/home/library", icon: BookOpen },
  { label: "Mode demos", to: "/home/modes", icon: PanelsTopLeft },
  { label: "Settings", to: "/home/settings", icon: Settings },
];
const displayName = computed(
  () => auth.me.value?.profile.displayName || "Your account",
);
function active(to: string) {
  return route.path === to;
}
function closeAccountMenu(event: PointerEvent) {
  if (!accountMenu.value?.contains(event.target as Node) && accountMenu.value)
    accountMenu.value.open = false;
}
async function closeMenu(restoreFocus = true) {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  if (restoreFocus) {
    await nextTick();
    menuTrigger.value?.focus({ preventScroll: true });
  }
}
async function toggleMenu() {
  if (menuOpen.value) return closeMenu();
  if (accountMenu.value) accountMenu.value.open = false;
  menuOpen.value = true;
  await nextTick();
  productNavigation.value?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
}
function onNavigationClick(event: MouseEvent) {
  if ((event.target as Element | null)?.closest("a")) void closeMenu();
}
watch(() => route.fullPath, () => {
  void closeMenu(false);
  if (accountMenu.value) accountMenu.value.open = false;
});
onMounted(() => {
  navigationReady.value = true;
  const desktop = window.matchMedia("(min-width: 900px)");
  const compact = window.matchMedia("(max-width: 899px) and (max-height: 500px)");
  let lastHeaderFocus: Element | null = null;
  const focusedHeaderControl = () => document.activeElement === document.body
    ? lastHeaderFocus
    : document.activeElement;
  const onCompact = () => {
    if (!compact.matches || !props.focusMode) return;
    // CSS can hide and blur the control before the media-query event fires.
    const focused = focusedHeaderControl();
    if (accountMenu.value) accountMenu.value.open = false;
    if (focused && header.value?.contains(focused) && !productNavigation.value?.contains(focused) && focused !== menuTrigger.value) {
      menuTrigger.value?.focus({ preventScroll: true });
    }
  };
  const onDesktop = () => {
    const focused = focusedHeaderControl();
    if (desktop.matches) {
      void closeMenu(false);
      if (focused === menuTrigger.value || (props.focusMode && focused && header.value?.contains(focused))) {
        if (props.focusMode) document.getElementById("main-content")?.focus({ preventScroll: true });
        else productNavigation.value?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
      }
    } else if (!menuOpen.value && focused && productNavigation.value?.contains(focused)) {
      menuTrigger.value?.focus({ preventScroll: true });
    }
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !menuOpen.value) return;
    event.preventDefault();
    void closeMenu();
  };
  const onOutsideClick = (event: MouseEvent) => {
    if (!menuOpen.value || !header.value || event.composedPath().includes(header.value) || !(event.target instanceof Node)) return;
    const interactive = event.target instanceof Element && event.target.closest('a[href],button,input,select,textarea,label,[tabindex],[contenteditable]:not([contenteditable="false"])');
    void closeMenu(!interactive);
  };
  const onFocus = (event: FocusEvent) => {
    lastHeaderFocus = event.target instanceof Element && header.value?.contains(event.target) ? event.target : null;
    if (menuOpen.value && event.target instanceof Node && !header.value?.contains(event.target)) void closeMenu(false);
  };
  desktop.addEventListener("change", onDesktop);
  compact.addEventListener("change", onCompact);
  document.addEventListener("pointerdown", closeAccountMenu);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onOutsideClick);
  document.addEventListener("focusin", onFocus);
  onBeforeUnmount(() => {
    desktop.removeEventListener("change", onDesktop);
    compact.removeEventListener("change", onCompact);
    document.removeEventListener("pointerdown", closeAccountMenu);
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("click", onOutsideClick);
    document.removeEventListener("focusin", onFocus);
  });
});
async function signOut() {
  if (signingOut.value) return;
  // The study room registers this guard to handle unsent recordings and stop media.
  const lifecycle = useAirMediaLifecycle();
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
  <div class="air-app" :class="{ 'call-shell': props.session, 'air-focus-mode': focusMode }">
    <header ref="header" class="air-app-header">
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
        /><span>Flowst</span><span class="call-brand-air">Airs</span></NuxtLink
      ><AirBrand v-else />
      <div v-if="props.session" class="call-navigation">
        <slot name="session-navigation" />
      </div>
      <nav
        :id="navigationId"
        ref="productNavigation"
        class="air-top-navigation"
        :class="{ 'air-product-navigation-open': menuOpen, 'air-session-product-navigation': props.session }"
        aria-label="Flowst Airs navigation"
        @click="onNavigationClick"
      >
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
        class="air-account"
        @keydown.esc="accountMenu && (accountMenu.open = false)"
      >
        <summary :aria-label="`Open ${displayName}'s account menu`" @click="closeMenu(false)">
          {{
            auth.me.value?.profile.initials ||
            displayName.slice(0, 1).toUpperCase()
          }}
        </summary>
        <div class="air-account-menu">
          <strong>{{ displayName }}</strong
          ><small>{{ auth.me.value?.profile.email }}</small
          ><NuxtLink to="/home/settings">Account &amp; access</NuxtLink
          ><button type="button" :disabled="signingOut" @click="signOut">
            <LogOut :size="16" /> {{ signingOut ? "Signing out…" : "Sign out" }}
          </button>
          <p v-if="logoutError" role="alert">{{ logoutError }}</p>
        </div>
      </details>
      <button
        ref="menuTrigger"
        type="button"
        class="air-product-menu-trigger"
        :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
        :aria-expanded="menuOpen"
        :aria-controls="navigationId"
        :disabled="!navigationReady"
        @click="toggleMenu"
      >
        <X v-if="menuOpen" :size="22" aria-hidden="true" />
        <Menu v-else :size="22" aria-hidden="true" />
      </button>
    </header>
    <div class="air-app-layout">
      <main id="main-content" class="air-app-content" tabindex="-1">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.air-app-header { position: relative; z-index: 40; }
.air-product-menu-trigger,
.air-session-product-navigation,
.air-focus-mode > .air-app-header { display: none; }
@media (max-width: 899px) {
  .air-app .air-app-header {
    flex-wrap: nowrap;
    gap: 10px;
    min-height: 68px;
    height: auto;
    padding: 10px 12px;
  }
  .air-app.air-focus-mode > .air-app-header {
    display: flex;
    min-height: 44px;
    height: 44px;
    flex: none;
    padding: 0;
    margin-bottom: 8px;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  .air-app-header .air-account { margin-left: auto; }
  .air-product-menu-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid #c7e4f5;
    border-radius: 50%;
    background: #e0f2fe;
    color: #102b3f;
  }
  .air-app-header .air-top-navigation {
    display: none;
    position: absolute;
    inset: calc(100% + 8px) 0 auto;
    margin: 0;
    padding: 10px;
    border: 1px solid #c7e4f5;
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 16px 36px rgb(2 60 95 / 12%);
    max-height: calc(var(--study-viewport-height, 100dvh) - 110px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .air-app-header .air-product-navigation-open {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
  }
  .air-app-header .air-top-navigation a {
    min-height: 48px;
    padding: 10px 14px;
    font-size: 1rem;
  }
  .air-app-header .air-top-navigation a svg { display: block; }
  .air-product-menu-trigger:focus-visible,
  .air-top-navigation a:focus-visible { outline: 3px solid #0369a1; outline-offset: 3px; }
  .air-top-navigation a:focus-visible { background: #eef8ff; }
  .call-navigation { display: none; }
  .air-focus-mode :deep(.setup-nav) { display: none; }
}
/* Share the existing workspace toolbar when a phone is held in landscape. */
@media (max-width: 899px) and (max-height: 500px) {
  .air-app.air-focus-mode > .air-app-header {
    height: 0;
    min-height: 0;
    margin-bottom: 0;
  }
  .air-focus-mode > .air-app-header > :not(.air-product-menu-trigger):not(.air-top-navigation) { display: none; }
  .air-focus-mode .air-product-menu-trigger { position: absolute; top: 0; right: 0; }
  .air-focus-mode .air-app-header .air-top-navigation { top: 52px; }
  .air-focus-mode :deep(.session-toolbar),
  .air-focus-mode :deep(.setup-room-nav) { padding-inline-end: 52px; }
  .air-focus-mode :deep(.setup-nav) { display: flex; min-height: 44px; padding-inline-end: 52px; }
}
.call-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  font-family: "Unbounded", sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: #102b3f;
  flex: none;
}
.call-brand img {
  object-fit: contain;
}
.call-brand-air {
  color: var(--air-accent-strong, #0369a1);
  border-left: 1px solid #c7e4f5;
  padding-left: 14px;
  margin-left: 5px;
  font-size: 0.8rem;
}
.call-navigation {
  flex: 1;
  min-width: 0;
}
.call-shell .air-app-header {
  flex-wrap: nowrap;
}
.call-shell .air-app-header {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid #fff;
  border-radius: 24px;
  padding: 0 20px;
  gap: 20px;
  box-shadow: 0 14px 35px rgba(2, 80, 125, 0.07);
}
.call-shell .air-account summary {
  background: #e0f2fe;
  border: 1px solid #c7e4f5;
  color: #102b3f;
}
@media (max-width: 767px) {
  .call-brand {
    gap: 5px;
  }
  .call-brand > span:not(.call-brand-air) {
    display: none;
  }
  .call-brand-air {
    padding-left: 0;
    margin: 0;
    border: 0;
    font-size: 0.75rem;
  }
  .call-shell .air-app-header {
    gap: 8px;
    padding: 0 10px;
    border-radius: 18px;
  }
}

.air-session-nav {
  display: flex;
  gap: 24px;
  align-items: center;
  font-size: 0.8rem;
}
.air-session-nav a,
.air-session-nav span {
  min-height: 44px;
  display: flex;
  align-items: center;
}
.air-session-nav span {
  border-bottom: 2px solid var(--air-accent, #0284c7);
  font-weight: 700;
}
@media (max-width: 767px) {
  .air-session-nav {
    gap: 12px;
    font-size: 0.7rem;
    margin-left: auto;
  }
  .air-session-nav a:not(:first-child) {
    display: none;
  }
}
</style>
