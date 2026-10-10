/** Hosted Growth previews never enable the real learning backend. */
export function growthPreviewEnabled(
  enabled: unknown,
  deploymentEnvironment: unknown,
  nodeEnvironment: unknown,
): boolean {
  if (enabled !== true && enabled !== "true") return false;
  if (deploymentEnvironment === "preview") return true;
  return !deploymentEnvironment && nodeEnvironment !== "production";
}
