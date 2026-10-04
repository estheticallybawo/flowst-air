<script setup lang="ts">
const route=useRoute();await navigateTo(route.fullPath.replace(/^\/air(?=\/|\?|#|$)/,'/airs'),{replace:true})
</script>
