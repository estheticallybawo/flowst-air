import { computed, getCurrentInstance, onBeforeUnmount, ref } from "vue";
import { airsHandoffStep } from "../shared/airsHandoff";
/** Required presentation after durable preparation; never starts audio capture. */
export function useAgentHandoff() {
  const active = ref(false), elapsed = ref(0), duration = ref(10000);
  const step = computed(() => airsHandoffStep(elapsed.value, duration.value));
  let timer: ReturnType<typeof setInterval> | undefined;
  let finish: ((completed: boolean) => void) | undefined;
  let lastTick = 0;
  function settle(completed: boolean) {
    if (timer) clearInterval(timer);
    timer = undefined;
    active.value = false;
    const resolve = finish;
    finish = undefined;
    resolve?.(completed);
  }
  function cancel() { settle(false); }
  async function prepare(seconds = 10): Promise<boolean> {
    cancel();
    duration.value = Math.max(10000, seconds * 1000);
    elapsed.value = 0;
    active.value = true;
    lastTick = Date.now();
    return new Promise<boolean>((resolve) => {
      finish = resolve;
      timer = setInterval(() => {
        const now = Date.now();
        if (typeof document === "undefined" || !document.hidden)
          elapsed.value += Math.min(500, Math.max(0, now - lastTick));
        lastTick = now;
        if (elapsed.value >= duration.value) settle(true);
      }, 100);
    });
  }
  if (getCurrentInstance()) onBeforeUnmount(cancel);
  return { active, step, prepare, cancel };
}
