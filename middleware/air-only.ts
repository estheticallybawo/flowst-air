/** These commercial/account pages belong to the separate Air product surface. */
export default defineNuxtRouteMiddleware(() => {
  if (!['air', 'amira'].includes(useRuntimeConfig().public.appSurface))
    return navigateTo("/air");
});
