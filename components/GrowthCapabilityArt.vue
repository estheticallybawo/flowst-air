<script setup lang="ts">
import type { GrowthDimensionId } from "~/shared/airGrowth";
import { growthBadgeStage } from "~/shared/airGrowth";
import { growthCapabilities } from "~/shared/airGrowthPrototype";

const props = defineProps<{
  dimension: GrowthDimensionId;
  cycles: number;
  color: string;
  tint: string;
}>();
const artwork = computed(
  () =>
    growthCapabilities.find((capability) => capability.id === props.dimension)!
      .artwork,
);
const stage = computed(() => growthBadgeStage(props.cycles));
</script>

<template>
  <div
    class="growth-art"
    :class="`art-stage-${stage}`"
    :data-badge-stage="stage"
    :style="{
      '--art-accent': color,
      '--art-tint': tint,
      '--art-scale': artwork.scale || 1,
    }"
    aria-hidden="true"
  >
    <div class="art-medallion">
      <img
        v-if="artwork.src"
        class="art-image"
        :src="artwork.src"
        alt=""
        decoding="async"
      />
      <span v-else class="art-placeholder">{{ artwork.placeholder }}</span>
    </div>
    <span v-if="stage > 1" class="art-milestones"
      ><i v-for="n in stage" :key="n"
    /></span>
  </div>
</template>

<style scoped>
.growth-art {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
}
.art-medallion {
  position: relative;
  display: grid;
  place-items: center;
  width: 82%;
  height: 82%;
  overflow: hidden;
  border: 1px dashed color-mix(in srgb, var(--art-accent) 30%, white);
  border-radius: 50%;
  background: var(--art-tint);
}
.art-image {
  position: absolute;
  width: calc(100% * var(--art-scale));
  height: calc(100% * var(--art-scale));
  max-width: none;
  object-fit: contain;
}
.art-placeholder {
  color: var(--air-ink);
  font:
    600 clamp(12px, 2vw, 22px) "Unbounded",
    sans-serif;
  letter-spacing: -0.06em;
}
.art-stage-1 .art-medallion {
  border-style: solid;
  background: var(--art-tint);
}
.art-stage-2 .art-medallion {
  border: 3px double color-mix(in srgb, var(--art-accent) 60%, white);
  background: var(--art-tint);
}
.art-stage-3 .art-medallion {
  border: 2px solid var(--art-accent);
  background: linear-gradient(145deg, #fff, var(--art-tint));
  box-shadow:
    inset 0 0 0 3px #fff,
    0 3px 10px #0284c712;
}
.art-stage-4 .art-medallion {
  border: 4px double var(--art-accent);
  background: linear-gradient(145deg, #fff, var(--art-tint));
  box-shadow:
    inset 0 0 0 3px #fff,
    0 3px 12px #0284c71a;
}
.art-milestones {
  position: absolute;
  display: flex;
  justify-content: center;
  gap: 3px;
  bottom: 5%;
  border: 2px solid #fff;
  border-radius: 8px;
  padding: 4px 6px;
  background: var(--art-tint);
}
.art-milestones i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--art-accent);
}
.art-stage-3 .art-milestones,
.art-stage-4 .art-milestones {
  background: var(--art-accent);
}
.art-stage-3 .art-milestones i,
.art-stage-4 .art-milestones i {
  background: #fff;
}
</style>
