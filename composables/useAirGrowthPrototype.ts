import type { GrowthDimensionId, GrowthScenario } from "~/shared/airGrowth";
import {
  applyGrowthSession,
  completeGrowthCycle,
  createGrowthPrototype,
  growthCapabilities,
  retryGrowthPreview,
} from "~/shared/airGrowthPrototype";

/** Nuxt state is isolated per SSR request and retained only in this browser's app memory. */
export function useAirGrowthPrototype() {
  const state = useState("air-growth-prototype-v1", () =>
    createGrowthPrototype(),
  );
  return {
    state,
    capabilities: growthCapabilities,
    selected: computed(
      () =>
        state.value.dimensions.find(
          (d) => d.dimensionId === state.value.selectedDimension,
        )!,
    ),
    select: (id: GrowthDimensionId) => {
      state.value.selectedDimension = id;
    },
    setScenario: (scenario: GrowthScenario) => {
      state.value = createGrowthPrototype(scenario);
    },
    reset: () => {
      state.value = createGrowthPrototype();
    },
    applySession: () => applyGrowthSession(state.value),
    completeCycle: () => completeGrowthCycle(state.value),
    retry: () => retryGrowthPreview(state.value),
  };
}
