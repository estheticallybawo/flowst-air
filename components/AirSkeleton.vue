<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string;
    variant?: "access" | "documents" | "account" | "upload" | "plan" | "room";
    withPreferences?: boolean;
  }>(),
  { label: "Loading", variant: "access" },
);
</script>

<template>
  <div
    class="amina-loading"
    :class="`amina-loading--${variant}`"
    role="status"
    :aria-label="label"
    aria-busy="true"
  >
    <span class="amina-loading-label">{{ label }}</span>
    <div v-if="variant === 'room'" class="loading-room" aria-hidden="true">
      <span class="loading-block loading-portrait" />
      <span class="loading-block loading-title" />
      <span class="loading-block loading-line" />
      <span class="loading-block loading-button" />
    </div>
    <div v-else-if="variant === 'plan'" class="loading-plan" aria-hidden="true">
      <span class="loading-block loading-title" />
      <div v-for="item in 2" :key="item" class="loading-objective">
        <span class="loading-block loading-title" />
        <span class="loading-block loading-line" />
        <span class="loading-block loading-line loading-line--short" />
      </div>
      <span class="loading-block loading-button" />
    </div>
    <div
      v-else-if="variant === 'documents'"
      class="loading-documents"
      aria-hidden="true"
    >
      <div v-for="item in 3" :key="item" class="loading-document">
        <span class="loading-block loading-icon" />
        <span class="loading-block loading-meta" />
        <span class="loading-block loading-title" />
        <span class="loading-block loading-line" />
        <span class="loading-block loading-line loading-line--short" />
        <span class="loading-block loading-button" />
      </div>
    </div>
    <div
      v-else-if="variant === 'upload'"
      class="loading-upload"
      aria-hidden="true"
    >
      <span class="loading-block loading-icon" />
      <span class="loading-block loading-title" />
      <span class="loading-block loading-line" />
      <span class="loading-block loading-dropzone" />
      <div v-if="withPreferences" class="loading-preferences">
        <div class="loading-preferences-heading">
          <span class="loading-block loading-title" /><span
            class="loading-block loading-line"
          />
        </div>
        <div v-for="item in 2" :key="item" class="loading-preference">
          <span class="loading-block loading-meta" /><span
            class="loading-block loading-field"
          />
        </div>
        <div class="loading-preference loading-preference--wide">
          <span class="loading-block loading-meta" /><span
            class="loading-block loading-scope"
          />
        </div>
        <div class="loading-preference loading-preference--wide">
          <span class="loading-block loading-meta" /><span
            class="loading-block loading-brief"
          />
        </div>
      </div>
      <span class="loading-block loading-button" />
    </div>
    <div v-else class="loading-details" aria-hidden="true">
      <span class="loading-block loading-title" />
      <span class="loading-block loading-line" />
      <span class="loading-block loading-line loading-line--short" />
      <template v-if="variant === 'account'">
        <span class="loading-block loading-meta" />
        <span class="loading-block loading-line" />
        <span class="loading-block loading-line loading-line--short" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.amina-loading {
  min-width: 0;
  width: 100%;
}
.amina-loading-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.loading-block {
  display: block;
  background: #d7edf9;
  border-radius: 7px;
  animation: amina-skeleton-pulse 1.5s ease-in-out infinite alternate;
}
.loading-details {
  min-height: 154px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 0;
}
.loading-title {
  width: 64%;
  height: 22px;
}
.loading-line {
  width: 100%;
  height: 13px;
}
.loading-line--short {
  width: 76%;
}
.loading-meta {
  width: 42%;
  height: 11px;
}
.loading-icon {
  width: 52px;
  height: 52px;
  border-radius: 15px;
}
.loading-button {
  width: 124px;
  height: 44px;
  border-radius: 14px;
}
.loading-documents {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.loading-document {
  min-width: 0;
  min-height: 260px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  border: 1px solid #c7e4f5;
  border-radius: 16px;
  background: #fff;
}
.loading-document .loading-button {
  margin-top: auto;
}
.loading-upload {
  min-height: 424px;
  margin: 24px 0 18px;
  padding: 35px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  border: 1px solid #c7e4f5;
  border-radius: 18px;
  background: #fff;
}
.loading-upload .loading-line {
  max-width: 350px;
}
.loading-upload .loading-title {
  max-width: 270px;
}
.loading-dropzone {
  min-height: 160px;
  width: 100%;
  border-radius: 14px;
}
.loading-preferences {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  width: 100%;
  gap: 20px;
  padding-top: 24px;
  border-top: 1px solid #c7e4f5;
}
.loading-preferences-heading,
.loading-preference--wide {
  grid-column: 1/-1;
}
.loading-preferences-heading,
.loading-preference {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.loading-preferences-heading .loading-title {
  width: 55%;
  height: 20px;
}
.loading-preferences-heading .loading-line {
  max-width: none;
}
.loading-field {
  width: 100%;
  height: 46px;
  border-radius: 12px;
}
.loading-scope {
  width: 100%;
  height: 66px;
  border-radius: 12px;
}
.loading-brief {
  width: 100%;
  height: 82px;
  border-radius: 12px;
}
.amina-loading--access {
  margin: 24px 0 18px;
  padding: 24px;
  border: 1px solid #c7e4f5;
  border-radius: 20px;
  background: #fff;
}
.amina-loading--account .loading-details {
  min-height: 196px;
}
.loading-plan {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.loading-objective {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px;
  border: 1px solid #c7e4f5;
  border-radius: 16px;
  background: #fff;
}
.loading-room {
  min-height: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
}
.loading-portrait {
  width: 132px;
  height: 132px;
  border-radius: 50%;
  margin-bottom: 5px;
}
.loading-room .loading-title {
  max-width: 270px;
}
.loading-room .loading-line {
  width: 55%;
  max-width: 200px;
}
@keyframes amina-skeleton-pulse {
  to {
    opacity: 0.48;
  }
}
@media (max-width: 767px) {
  .loading-documents {
    grid-template-columns: minmax(0, 1fr);
  }
  .loading-upload {
    padding: 24px 18px;
  }
}
@media (max-width: 650px) {
  .loading-preferences {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (prefers-reduced-motion: reduce) {
  .loading-block {
    animation: none;
  }
}
</style>
