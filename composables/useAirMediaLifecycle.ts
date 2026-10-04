/** Client-only lifecycle hooks; media objects and recordings never enter SSR state. */
export function useAirMediaLifecycle() {
  return {
    beforeExit: useState<(() => boolean | Promise<boolean>) | null>(
      "air-media-before-exit",
      () => null,
    ),
  };
}
