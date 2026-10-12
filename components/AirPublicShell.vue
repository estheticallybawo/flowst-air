<script setup lang="ts">
import { Menu, X } from "lucide-vue-next";

defineProps<{ landing?: boolean }>();
const auth = useAuth();
await auth.ensureSession();
const authenticated = computed(() => auth.status.value === "AUTHENTICATED");
const route = useRoute();
const menuOpen = ref(false);
const header = ref<HTMLElement | null>(null);
const menuTrigger = ref<HTMLButtonElement | null>(null);
const navigation = ref<HTMLElement | null>(null);
const navigationId = "air-public-navigation-" + useId();

async function closeMenu(restoreFocus = true) {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  if (restoreFocus) {
    await nextTick();
    if (menuTrigger.value?.isConnected) menuTrigger.value.focus({ preventScroll: true });
  }
}

async function toggleMenu() {
  if (menuOpen.value) return closeMenu();
  menuOpen.value = true;
  await nextTick();
  navigation.value?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
}

function onNavigationClick(event: MouseEvent) {
  if ((event.target as Element | null)?.closest("a")) void closeMenu();
}

watch(() => route.fullPath, () => void closeMenu(false));

onMounted(() => {
  const desktop = window.matchMedia("(min-width: 900px)");
  const onDesktop = () => {
    const focused = document.activeElement;
    if (desktop.matches) {
      void closeMenu(false);
      if (focused === menuTrigger.value) navigation.value?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
      return;
    }
    if (!menuOpen.value && focused && navigation.value?.contains(focused)) menuTrigger.value?.focus({ preventScroll: true });
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !menuOpen.value) return;
    event.preventDefault();
    void closeMenu();
  };
  const onOutsideClick = (event: MouseEvent) => {
    const currentHeader = header.value;
    // Vue swaps Menu for X while this click bubbles, detaching its SVG target.
    // The original event path still identifies that click as inside the header.
    if (!menuOpen.value || !currentHeader || event.composedPath().includes(currentHeader) || !(event.target instanceof Node)) return;
    const interactive = event.target instanceof Element && event.target.closest('a[href],button,input,select,textarea,label,[tabindex],[contenteditable]:not([contenteditable="false"])');
    void closeMenu(!interactive);
  };
  const onFocus = (event: FocusEvent) => {
    if (menuOpen.value && event.target instanceof Node && !header.value?.contains(event.target)) void closeMenu(false);
  };
  desktop.addEventListener("change", onDesktop);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onOutsideClick);
  document.addEventListener("focusin", onFocus);
  onBeforeUnmount(() => {
    desktop.removeEventListener("change", onDesktop);
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("click", onOutsideClick);
    document.removeEventListener("focusin", onFocus);
  });
});
</script>

<template>
  <div class="air-public" :class="{ 'air-public-landing': landing }">
    <header ref="header" class="air-public-header">
      <AirBrand />
      <nav
        :id="navigationId"
        ref="navigation"
        class="air-public-navigation"
        :class="{ 'air-public-navigation-open': menuOpen }"
        aria-label="Flowst Airs public navigation"
        @click="onNavigationClick"
      >
        <a :href="landing ? '#how-it-works' : '/#how-it-works'">How it works</a>
        <template v-if="landing"><a href="#for-you">Who it’s for</a><a href="#growth">Tides</a><a href="#faq">FAQ</a></template>
        <template v-else><NuxtLink to="/home/pricing">Pricing</NuxtLink><NuxtLink to="/home/about">Privacy &amp; trust</NuxtLink></template>
      </nav>
      <NuxtLink
        class="air-button air-button-teal air-public-account"
        :to="authenticated ? '/home' : '/auth/sign-in?redirect=/home'"
        @click="closeMenu(false)"
        >{{ authenticated ? "Continue" : "Sign in" }}</NuxtLink
      >
      <button
        ref="menuTrigger"
        type="button"
        class="air-public-menu-trigger"
        :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
        :aria-expanded="menuOpen"
        :aria-controls="navigationId"
        @click="toggleMenu"
      >
        <X v-if="menuOpen" :size="22" aria-hidden="true" />
        <Menu v-else :size="22" aria-hidden="true" />
      </button>
    </header>
    <main id="main-content" tabindex="-1"><slot /></main>
    <footer class="air-footer">
      <AirBrand /><span>Understand. Explain. Keep growing.</span
      ><NuxtLink v-if="landing" to="/home/pricing">Access &amp; plans</NuxtLink><NuxtLink to="/home/about">About &amp; privacy</NuxtLink>
    </footer>
  </div>
</template>
<style scoped>
.air-public {
  background: var(--air-canvas, #eef8ff);
}
.air-public-header { position: relative; z-index: 40; }
.air-public-landing .air-public-header { margin-top: 0; padding: 16px 24px; border: 0; border-radius: 999px; background: #fff; box-shadow: 0 8px 28px rgb(2 80 125 / 6%); }
.air-public-landing .air-public-header nav { gap: 24px; }
.air-public-menu-trigger { display: none; }

@media (max-width: 899px) {
  .air-public-header,
  .air-public-landing .air-public-header { flex-wrap: nowrap; gap: 8px; padding: 12px; border-radius: 22px; }
  .air-public-account { margin-left: auto; flex-shrink: 0; min-height: 44px; padding: 8px 10px; font-size: .78rem; }
  .air-public-menu-trigger {
    display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    width: 44px; height: 44px; padding: 0; border: 1px solid #c8e5f7; border-radius: 50%;
    background: #eef8ff; color: #064463; cursor: pointer;
    transition: background-color 160ms ease, transform 160ms ease;
  }
  .air-public-menu-trigger:active { transform: scale(.96); }
  .air-public-menu-trigger:focus-visible,
  .air-public-navigation a:focus-visible { outline: 3px solid #007db8; outline-offset: 3px; }
  .air-public-header .air-public-navigation {
    display: none; position: absolute; inset: calc(100% + 10px) 0 auto; width: auto;
    margin: 0; padding: 12px; border: 1px solid #d5e9f5; border-radius: 24px;
    background: #fff; box-shadow: 0 18px 40px rgb(2 60 95 / 12%);
    max-height: calc(100dvh - 140px); overflow-y: auto; overscroll-behavior: contain;
    font-family: "Albert Sans", sans-serif; font-size: 1rem;
  }
  .air-public-header .air-public-navigation-open { display: flex; flex-direction: column; gap: 2px; }
  .air-public-navigation a { min-height: 48px; padding: 12px 16px; border-radius: 14px; color: #10394e; }
  .air-public-navigation a:focus-visible { background: #eef8ff; }
}
@media (max-width: 899px) and (hover: hover) and (pointer: fine) {
  .air-public-menu-trigger:hover,
  .air-public-navigation a:hover { background: #e1f3ff; }
}
@media (prefers-reduced-motion: reduce) {
  .air-public-menu-trigger { transition: none; }
  .air-public-menu-trigger:active { transform: none; }
}
</style>
