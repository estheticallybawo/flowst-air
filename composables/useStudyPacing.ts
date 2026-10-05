import { pacingAt, type StudyPacingState } from "~/shared/studyPacing";
export function useStudyPacing(id: Ref<string>) {
  const auth = useAuth(),
    state = ref<StudyPacingState | null>(null),
    busy = ref(false),
    error = ref(""),
    now = ref(0);
  let receivedAt = 0,
    ticker: ReturnType<typeof setInterval> | undefined,
    disposed = false;
  const current = computed(() =>
    state.value
      ? pacingAt(
          state.value,
          state.value.serverNow + Math.max(0, now.value - receivedAt),
        )
      : null,
  );
  const remaining = computed(() =>
    Math.ceil((current.value?.remainingMs || 0) / 1000),
  );
  const clock = computed(
    () =>
      `${Math.floor(remaining.value / 60)
        .toString()
        .padStart(
          2,
          "0",
        )}:${(remaining.value % 60).toString().padStart(2, "0")}`,
  );
  function receive(value: StudyPacingState | null) {
    if (disposed) return;
    state.value = value;
    receivedAt = performance.now();
    now.value = receivedAt;
  }
  async function refresh() {
    const result = await auth.authorizedFetch<{
      pacing: StudyPacingState | null;
    }>(`/api/study/conversations/${id.value}/pacing`);
    receive(result.pacing);
  }
  async function change(
    action: "START" | "BREAK" | "SKIP_BREAK" | "RESUME" | "PAUSE" | "RECORD",
    recordingId?: string,
  ) {
    if (busy.value) return false;
    busy.value = true;
    error.value = "";
    try {
      const result = await auth.authorizedFetch<{
        pacing: StudyPacingState | null;
      }>(`/api/study/conversations/${id.value}/pacing`, {
        method: "POST",
        body: {
          action,
          revision: state.value?.revision || "",
          ...(recordingId ? { recordingId } : {}),
        },
      });
      receive(result.pacing);
      return true;
    } catch (cause: any) {
      error.value =
        cause?.data?.statusMessage ||
        "Your timer could not be saved. Retry before continuing.";
      await refresh().catch(() => undefined);
      return false;
    } finally {
      busy.value = false;
    }
  }
  onMounted(() => {
    now.value = performance.now();
    ticker = setInterval(() => {
      now.value = performance.now();
    }, 250);
  });
  onBeforeUnmount(() => {
    disposed = true;
    if (ticker) clearInterval(ticker);
  });
  return { state, current, busy, error, remaining, clock, refresh, change };
}
