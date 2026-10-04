/** These commercial/account pages belong to the separate Airs product surface. */
export default defineNuxtRouteMiddleware(() => {
  if (!['airs', 'air', 'amira'].includes(useRuntimeConfig().public.appSurface))
    return navigateTo("/airs");
});
