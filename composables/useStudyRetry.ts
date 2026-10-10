import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from "vue";
import { studyRetryAt } from "~/shared/studyRetry";

export function useStudyRetry(key: Ref<string>) {
  const deadline = ref(0),
    now = ref(Date.now());
  const remaining = computed(() =>
    Math.max(0, Math.ceil((deadline.value - now.value) / 1000)),
  );
  let timer: ReturnType<typeof setInterval> | undefined;
  function restore() {
    deadline.value = 0;
    if (typeof sessionStorage === "undefined") return;
    try {
      const value = Number(sessionStorage.getItem(key.value));
      if (value > Date.now() && value <= Date.now() + 86400000)
        deadline.value = value;
    } catch {
      /* Current visit still respects the delay. */
    }
  }
  function retain(cause: unknown) {
    now.value = Date.now();
    deadline.value = Math.max(deadline.value, studyRetryAt(cause, now.value));
    if (deadline.value)
      try {
        sessionStorage.setItem(key.value, String(deadline.value));
      } catch {
        /* Optional persistence. */
      }
  }
  watch(key, restore);
  restore();
  onMounted(() => {
    restore();
    timer = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
  });
  return { remaining, retain };
}
