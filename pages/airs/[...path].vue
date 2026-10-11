<script setup lang="ts">
import { canonicalAirPath } from "~/shared/airSurface";
const route = useRoute();
await navigateTo(canonicalAirPath(route.fullPath), { replace: true, redirectCode: 302 });
</script>
