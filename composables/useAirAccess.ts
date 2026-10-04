import type { AirAccess } from "~/shared/airAccess";
export function useAirAccess(enabled = true) {
  const auth = useAuth();
  const access = ref<AirAccess | null>(null);
  const loading = ref(true);
  const error = ref("");
  async function refresh() {
    loading.value = true;
    error.value = "";
    access.value = null;
    try {
      access.value =
        await auth.authorizedFetch<AirAccess>("/api/air/access");
    } catch {
      error.value = "We could not check your access. Please try again.";
    } finally {
      loading.value = false;
    }
  }
  onMounted(() => {
    if (enabled) void refresh();
    else loading.value = false;
  });
  return { access, loading, error, refresh };
}
