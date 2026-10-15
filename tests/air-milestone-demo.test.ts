import { expect, test } from "vitest";
import {
  airMilestoneDemo,
  buildMilestoneShareSvg,
  DEFAULT_MILESTONE_SAMPLE_TIDES,
  isMilestoneUnlocked,
  MILESTONE_SAMPLE_COUNTS,
  nextMilestoneThreshold,
  normalizeMilestoneSampleTides,
} from "../shared/airMilestoneDemo";
import { growthCapabilities } from "../shared/airGrowthCapabilities";

test("appearance milestones use all seven current capability artworks once", () => {
  expect(MILESTONE_SAMPLE_COUNTS).toEqual([0, 5, 10, 25, 50, 100]);
  expect(DEFAULT_MILESTONE_SAMPLE_TIDES).toBe(10);
  expect(airMilestoneDemo.map((milestone) => milestone.threshold)).toEqual([
    5, 10, 25, 50, 100,
  ]);
  const artworkIds = airMilestoneDemo.flatMap((milestone) =>
    milestone.artworks.map((capability) => capability.id),
  );
  expect(artworkIds).toEqual(growthCapabilities.map((capability) => capability.id));
  expect(new Set(artworkIds).size).toBe(7);
  expect(
    airMilestoneDemo.every((milestone) =>
      milestone.artworks.every((capability) =>
        growthCapabilities.includes(capability),
      ),
    ),
  ).toBe(true);
});

test("each milestone opens at its exact threshold and locked cards cannot be shared", () => {
  for (const milestone of airMilestoneDemo) {
    expect(isMilestoneUnlocked(milestone.id, milestone.threshold - 1)).toBe(false);
    expect(buildMilestoneShareSvg(milestone.id, milestone.threshold - 1)).toBeNull();
    expect(isMilestoneUnlocked(milestone.id, milestone.threshold)).toBe(true);
    expect(buildMilestoneShareSvg(milestone.id, milestone.threshold)).toContain(
      `${milestone.threshold} Tides`,
    );
  }
  expect(isMilestoneUnlocked("missing", 100)).toBe(false);
  expect(buildMilestoneShareSvg("<script>alert(1)</script>", 100)).toBeNull();
});

test("sample counts reject non-finite input and normalize to whole demo Tides", () => {
  for (const invalidCount of [NaN, Infinity, -Infinity, -7]) {
    expect(normalizeMilestoneSampleTides(invalidCount)).toBe(0);
    expect(isMilestoneUnlocked("first-light", invalidCount)).toBe(false);
  }
  expect(normalizeMilestoneSampleTides(9.99)).toBe(9);
  expect(isMilestoneUnlocked("steady-current", 9.99)).toBe(false);
  expect(normalizeMilestoneSampleTides(1000)).toBe(100);
  expect(normalizeMilestoneSampleTides(0)).toBe(0);
  expect(nextMilestoneThreshold(0)).toBe(5);
  expect(nextMilestoneThreshold(5)).toBe(10);
  expect(nextMilestoneThreshold(24.99)).toBe(25);
  expect(nextMilestoneThreshold(99)).toBe(100);
  expect(nextMilestoneThreshold(100)).toBeNull();
  expect(nextMilestoneThreshold(1000)).toBeNull();
});

test("share SVG is self-contained and clearly identifies sample appearance", () => {
  const shareSvg = buildMilestoneShareSvg("steady-current", 10)!;
  expect(shareSvg).toMatch(/^<svg\s/);
  expect(shareSvg).toContain("SAMPLE · APPEARANCE CONCEPT");
  expect(shareSvg).toContain("Not an earned award");
  expect(shareSvg).toContain("Previewed with 10 sample Tides");
  expect(shareSvg).toContain("Steady Current");
  expect(shareSvg).not.toMatch(/(?:href|src)\s*=|<script|<foreignObject|@import|url\(/i);
});

test("share SVG embeds only PNG data for its fixed capability artwork", () => {
  const pngData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
  const shareSvg = buildMilestoneShareSvg("horizon-line", 50, {
    reasoning_aloud: pngData,
    self_monitoring: pngData,
    verbal_retrieval: "https://example.com/unrelated.png",
  })!;
  expect(shareSvg.match(/<image /g)).toHaveLength(2);
  expect(shareSvg).toContain(`href="${pngData}"`);
  expect(shareSvg).not.toContain("https://example.com");

  for (const unsafeData of [
    "https://example.com/tracker.png",
    "data:image/svg+xml;base64,PHN2Zy8+",
    'data:image/png;base64,AAAA" onload="alert(1)',
    "data:image/png;base64,AAAA\nAAAA",
  ]) {
    const fallbackSvg = buildMilestoneShareSvg("first-light", 5, {
      verbal_retrieval: unsafeData,
    })!;
    expect(fallbackSvg).not.toContain("<image ");
    expect(fallbackSvg).not.toContain(unsafeData);
    expect(fallbackSvg).toContain("SAMPLE · APPEARANCE CONCEPT");
  }
});
