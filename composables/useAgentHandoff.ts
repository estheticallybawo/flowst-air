/** Deliberate learner-facing transition after work finishes, never presented as agent reasoning. */
export function useAgentHandoff() {
  const active = ref(false),
    remaining = ref(0);
  let timer: ReturnType<typeof setInterval> | undefined,
    finish: (() => void) | undefined;
  function continueNow() {
    if (timer) clearInterval(timer);
    timer = undefined;
    active.value = false;
    remaining.value = 0;
    finish?.();
    finish = undefined;
  }
  async function prepare(seconds = 10) {
    continueNow();
    active.value = true;
    remaining.value = seconds;
    const end = Date.now() + seconds * 1000;
    await new Promise<void>((resolve) => {
      finish = resolve;
      timer = setInterval(() => {
        remaining.value = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        if (!remaining.value) continueNow();
      }, 250);
    });
  }
  onBeforeUnmount(continueNow);
  return { active, remaining, prepare, continueNow };
}
