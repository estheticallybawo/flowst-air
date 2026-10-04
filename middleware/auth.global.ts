import {
  canonicalAirsPath,
  isAirsStandalone,
  isAirsStandalonePage,
  isAirsPublicPage,
} from "~/shared/airsSurface";
import { airsReturnPath } from "~/shared/airsNavigation";

export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig();
  const standaloneAirs = isAirsStandalone(config.public.appSurface);
  if (standaloneAirs && canonicalAirsPath(to.fullPath) !== to.fullPath)
    return navigateTo(canonicalAirsPath(to.fullPath), { replace: true, redirectCode: 302 });
  if (standaloneAirs && !isAirsStandalonePage(to.path))
    return navigateTo("/airs");
  if (!config.public.authRequired) return;
  const welcomeRoute = to.path === "/";
  const authRoute = to.path.startsWith("/auth/");
  const neoRoute = to.path === "/neo" || to.path.startsWith("/neo/");
  const publicRoute = standaloneAirs
    ? isAirsPublicPage(to.path)
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
      standaloneAirs ? airsReturnPath(to.query.redirect) : "/home",
    );
});
