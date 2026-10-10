import {
  canonicalAirPath,
  isAirStandalone,
  isAirStandalonePage,
  isAirPublicPage,
} from "~/shared/airSurface";
import { airReturnPath } from "~/shared/airNavigation";

export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig();
  const standaloneAir = isAirStandalone(config.public.appSurface);
  if (standaloneAir && canonicalAirPath(to.fullPath) !== to.fullPath)
    return navigateTo(canonicalAirPath(to.fullPath), {
      replace: true,
      redirectCode: 302,
    });
  if (standaloneAir && !isAirStandalonePage(to.path))
    return navigateTo("/airs");
  if (import.meta.dev && standaloneAir && config.public.airsGuestEnabled === true) {
    await useAuth().ensureSession();
    return;
  }
  // Standalone production always requires an account, including deployments that
  // still carry the former public authRequired=false configuration.
  if (!config.public.authRequired && (!standaloneAir || import.meta.dev)) return;
  const welcomeRoute = to.path === "/";
  const authRoute = to.path.startsWith("/auth/");
  const neoRoute = to.path === "/neo" || to.path.startsWith("/neo/");
  const publicRoute = standaloneAir
    ? isAirPublicPage(to.path)
    : welcomeRoute || authRoute || neoRoute;
  const auth = useAuth();
  const status = await auth.ensureSession();

  if (status !== "AUTHENTICATED" && !publicRoute) {
    return navigateTo({
      path: "/auth/sign-in",
      query: { redirect: to.fullPath },
    });
  }
  if (status === "AUTHENTICATED" && authRoute)
    return navigateTo(
      standaloneAir ? airReturnPath(to.query.redirect) : "/home",
    );
});
