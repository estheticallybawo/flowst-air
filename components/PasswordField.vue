<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  id: string
  label: string
  modelValue: string
  autocomplete?: string
  help?: string
}>(), {
  autocomplete: 'current-password',
  help: '',
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const visible = ref(false)
const clientReady = ref(false)
const helpId = computed(() => props.help ? `${props.id}-help` : undefined)

onMounted(() => {
  clientReady.value = true
})
</script>

<template>
  <div class="field password-field">
    <label :for="props.id">{{ props.label }}</label>
    <div class="password-control">
      <input
        :id="props.id"
        v-bind="$attrs"
        class="input"
        :type="visible ? 'text' : 'password'"
        :value="props.modelValue"
        :autocomplete="props.autocomplete"
        :aria-describedby="helpId"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
      <button
        type="button"
        class="password-toggle"
        :disabled="!clientReady"
        :aria-label="visible ? `Hide ${props.label.toLowerCase()}` : `Show ${props.label.toLowerCase()}`"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        <EyeOff v-if="visible" :size="19" aria-hidden="true" />
        <Eye v-else :size="19" aria-hidden="true" />
      </button>
    </div>
    <small v-if="props.help" :id="helpId" class="muted">{{ props.help }}</small>
  </div>
</template>

<style scoped>
.password-control{position:relative}.password-control .input{padding-right:52px}.password-toggle{position:absolute;top:1px;right:1px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--ink-soft);background:transparent;transition:color 160ms ease,background 160ms ease}.password-toggle:disabled{cursor:default}.password-toggle:hover:not(:disabled){color:var(--ink);background:rgba(143,134,255,.1)}.password-toggle:focus-visible{outline:3px solid rgba(143,134,255,.42);outline-offset:2px}
</style>
