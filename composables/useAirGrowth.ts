import type {
  GrowthDimensionId,
  GrowthScenario,
  GrowthSnapshot,
} from "~/shared/airGrowth";
import { growthCapabilities } from "~/shared/airGrowthCapabilities";
import {
  applyGrowthSession,
  completeGrowthCycle,
  createGrowthPrototype,
  retryGrowthPreview,
} from "~/shared/airGrowthPrototype";

/** Growth's UI reads a source-independent snapshot. Only this adapter supplies example records.
 * A future owned backend read can replace snapshot loading without changing capability components.
 * Example transitions never consume Kai feedback or write learner records.
 */
export function useAirGrowth() {
  const example = useState("air-growth-example-v2", () =>
    createGrowthPrototype(),
  );
  const snapshot = computed<GrowthSnapshot>(() => ({
    source: example.value.source,
    reviewStatus: example.value.reviewStatus,
    dimensions: example.value.dimensions,
    flowmarks: example.value.flowmarks,
    sessionChanges: example.value.sessionChanges,
    completion: example.value.completion,
  }));
  const selectedDimension = computed(() => example.value.selectedDimension);
  return {
    snapshot,
    selectedDimension,
    capabilities: growthCapabilities,
    selected: computed(
      () =>
        snapshot.value.dimensions.find(
          (d) => d.dimensionId === selectedDimension.value,
        )!,
    ),
    select: (id: GrowthDimensionId) => {
      example.value.selectedDimension = id;
    },
    examples: {
      scenario: computed(() => example.value.scenario),
      sessionApplied: computed(() => example.value.sessionApplied),
      completionApplied: computed(() => example.value.completionApplied),
      setScenario: (scenario: GrowthScenario) => {
        example.value = createGrowthPrototype(scenario);
      },
      reset: () => {
        example.value = createGrowthPrototype();
      },
      applySession: () => applyGrowthSession(example.value),
      completeCycle: () => completeGrowthCycle(example.value),
      retry: () => retryGrowthPreview(example.value),
    },
  };
}
