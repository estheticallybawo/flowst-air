import { afterEach, describe, expect, it, vi } from "vitest";
import { useAgentHandoff } from "../composables/useAgentHandoff";
import { AIRS_HANDOFF_STEPS, airsHandoffStep } from "../shared/airsHandoff";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("required saved-session handoff", () => {
  it("presents each role without a bypass or visible countdown", async () => {
    vi.useFakeTimers();
    const handoff = useAgentHandoff(), ready = handoff.prepare();
    expect(handoff.active.value).toBe(true);
    expect(handoff).not.toHaveProperty("continueNow");
    expect(handoff).not.toHaveProperty("remaining");
    await vi.advanceTimersByTimeAsync(2500); expect(handoff.step.value).toBe(1);
    await vi.advanceTimersByTimeAsync(2500); expect(handoff.step.value).toBe(2);
    await vi.advanceTimersByTimeAsync(2500); expect(handoff.step.value).toBe(3);
    expect(handoff.active.value).toBe(true);
    await vi.advanceTimersByTimeAsync(2500); expect(await ready).toBe(true);
    expect(handoff.active.value).toBe(false);
  });
  it("cancels old waits instead of completing replaced handoffs", async () => {
    vi.useFakeTimers();
    const handoff = useAgentHandoff(), old = handoff.prepare();
    const next = handoff.prepare(); expect(await old).toBe(false);
    handoff.cancel(); expect(await next).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it("pauses presentation in hidden tabs and enforces a ten-second minimum", async () => {
    vi.useFakeTimers();
    const visibility = { hidden: true }; vi.stubGlobal("document", visibility);
    const handoff = useAgentHandoff(), ready = handoff.prepare(1);
    await vi.advanceTimersByTimeAsync(10000); expect(handoff.step.value).toBe(0);
    visibility.hidden = false;
    await vi.advanceTimersByTimeAsync(9900); expect(handoff.active.value).toBe(true);
    await vi.advanceTimersByTimeAsync(100); expect(await ready).toBe(true);
  });
  it("bounds phases and introduces Amina only after the welcome is saved", () => {
    expect(airsHandoffStep(-10)).toBe(0); expect(airsHandoffStep(50000)).toBe(3);
    expect(AIRS_HANDOFF_STEPS.AMINA[3]!.description).toContain("welcome is saved");
  });
});
