<script lang="ts">
import { defineComponent, h } from 'vue';
import { renderAirsMessage } from '~/shared/airsMessage';

export default defineComponent({
  props: { text: { type: String, required: true } },
  setup: props => () => h('div', { class: 'airs-message' }, renderAirsMessage(props.text)),
});
</script>

<style scoped>
.airs-message { min-width: 0; line-height: 1.6; overflow-wrap: anywhere; text-align: left; }
.airs-message :deep(> :first-child) { margin-top: 0; }
.airs-message :deep(> :last-child) { margin-bottom: 0; }
.airs-message :deep(p) { margin: 0 0 .8em; }
.airs-message :deep(.message-heading) { margin-top: 1em; }
.airs-message :deep(ul), .airs-message :deep(ol) { margin: .6em 0; padding-left: 1.3em; }
.airs-message :deep(li) { margin: .3em 0; }
.airs-message :deep(code) { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .86em; padding: .15em .3em; border-radius: 4px; background: #e6f0f8; }
.airs-message :deep(pre) { padding: 12px; margin: .8em 0; overflow-x: auto; border-radius: 8px; background: #e6f0f8; white-space: pre; }
.airs-message :deep(pre code) { padding: 0; }
.airs-message :deep(blockquote) { margin: .8em 0; padding-left: 12px; border-left: 3px solid #afcfe5; color: #3d5d75; }
</style>
