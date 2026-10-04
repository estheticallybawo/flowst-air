/** Client-only lifecycle hooks; media objects and recordings never enter SSR state. */
export function useAirsMediaLifecycle() {
  return {
    beforeExit: useState<(() => boolean | Promise<boolean>) | null>(
      "airs-media-before-exit",
      () => null,
    ),
  };
}
