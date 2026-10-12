<script setup lang="ts">
const route = useRoute();
await navigateTo(route.fullPath.replace(/^\/air(?=\/|\?|#|$)/, "/home"), {
  replace: true,
});
</script>
