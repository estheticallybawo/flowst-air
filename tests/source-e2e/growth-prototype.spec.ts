import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Full evidence/dialog walkthroughs allow bounded local compilation time.
test.setTimeout(180_000);

async function openGrowth(page: Page) {
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
  await page.goto("/airs", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Your growth", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(page.locator(".growth-home")).toHaveAttribute(
    "data-growth-ready",
    "true",
    { timeout: 90000 },
  );
}
const capabilityArtwork = {
  "Verbal Retrieval": "/growth/verbal-retrieval-3d.png",
  "Clear Explanation": "/growth/clear-explanation-3d.png",
  "Conceptual Precision": "/growth/conceptual-precision-3d.png",
  "Reasoning Aloud": "/growth/reasoning-aloud-3d.png",
  "Self-Monitoring": "/growth/self-monitoring-3d.png",
  "Transfer": "/growth/transfer-3d.png",
  "Conversation Flow": "/growth/conversation-flow-3d.png",
};
const card = (page: Page, name: string) =>
  page.getByRole("button", { name: `Explore ${name}`, exact: true });

test("Growth walkthrough keeps sample updates single-use and creates one evolved Flowmark", async ({
  page,
  isMobile,
}) => {
  const mutations: string[] = [],
    errors: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/study\//.test(request.url()) && request.method() !== "GET")
      mutations.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).__growthMicRequests = 0;
    if (!navigator.mediaDevices)
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {},
      });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        (window as any).__growthMicRequests++;
        throw new DOMException(
          "Prototype cannot open a microphone",
          "NotAllowedError",
        );
      },
    });
  });
  await openGrowth(page);
  await expect(page.locator(".capability-card")).toHaveCount(7);
  for (const [name, src] of Object.entries(capabilityArtwork)) {
    const image = card(page, name).locator("img");
    await expect(image).toHaveAttribute("src", src);
    await expect
      .poll(() => image.evaluate((element) =>
        element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
      ))
      .toBe(true);
  }
  await expect(page.locator(".capability-card .art-placeholder")).toHaveCount(0);
  expect(
    await page
      .locator(".growth-home")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--air-accent").trim(),
      ),
  ).toBe("#0284c7");
  await expect(card(page, "Clear Explanation")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(card(page, "Clear Explanation")).toContainText("72%");
  await expect(card(page, "Reasoning Aloud")).toContainText(
    "4 cycles completed",
  );
  await page.screenshot({
    path: `test-results/growth-home-${test.info().project.name}.png`,
    fullPage: true,
  });

  for (const name of [
    "Verbal Retrieval",
    "Clear Explanation",
    "Conceptual Precision",
    "Reasoning Aloud",
    "Self-Monitoring",
    "Conversation Flow",
  ]) {
    await card(page, name).click();
    const detail = isMobile
      ? page.getByRole("dialog")
      : page.locator(".desktop-detail");
    await expect(
      detail
        .getByRole("region", { name: `${name} details`, exact: true })
        .getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(detail).toContainText("Evidence this cycle");
    await expect(detail).toContainText("Cycle history");
    const artwork = Object.entries(capabilityArtwork).find(
      ([capability]) => capability === name,
    )?.[1];
    if (artwork)
      await expect(detail.locator(".detail-ring img")).toHaveAttribute(
        "src", artwork,
      );
    else
      await expect(detail.locator(".detail-ring .art-placeholder")).toHaveText(
        "SM",
      );
    if (isMobile)
      await page
        .getByRole("button", { name: "Back to growth dashboard" })
        .click();
  }

  await card(page, "Transfer").click();
  const details = isMobile
    ? page.getByRole("dialog")
    : page.locator(".desktop-detail");
  await expect(details).toContainText(
    "Apply an idea in a meaningfully different situation.",
  );
  await expect(details.locator(".detail-ring img")).toHaveAttribute(
    "src", capabilityArtwork.Transfer,
  );
  await details
    .getByText("View evidence", { exact: true })
    .first()
    .click();
  await expect(details.getByRole("blockquote").first()).toBeVisible();
  if (isMobile) {
    await page
      .getByRole("button", { name: "Back to growth dashboard" })
      .click();
    await expect(card(page, "Transfer")).toBeFocused();
  }

  if (!(await page.locator(".growth-example-tools").evaluate(el => el.hasAttribute("open"))))
    await page.getByText("Explore example progress", { exact: true }).click();
  await page.getByRole("button", { name: "Apply example session", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("72% → 84%");
  await expect(page.getByRole("dialog")).toContainText(
    "Transfer · unchanged at 30%",
  );
  await page
    .getByRole("button", { name: "Back to growth", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View reflection", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("72% → 84%");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(card(page, "Clear Explanation")).toContainText("84%");
  await expect(card(page, "Reasoning Aloud")).toContainText("96%");
  await expect(card(page, "Self-Monitoring")).toContainText("46%");
  await page
    .getByRole("button", { name: "Complete example cycle", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("5 cycles completed");
  await expect(
    page.getByRole("dialog").getByRole("progressbar"),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(
    page.getByRole("dialog").locator("[data-badge-stage]"),
  ).toHaveAttribute("data-badge-stage", "3");
  await expect(
    page.getByRole("dialog").locator(".growth-art img"),
  ).toHaveAttribute("src", capabilityArtwork["Reasoning Aloud"]);
  await page
    .getByRole("button", { name: "Continue to the next cycle" })
    .click();
  await expect(
    page.getByRole("button", { name: "View reflection", exact: true }),
  ).toBeFocused();
  await expect(card(page, "Reasoning Aloud")).toContainText(
    "5 cycles completed",
  );
  await expect(card(page, "Reasoning Aloud")).toContainText("toward cycle 6");
  await expect(
    card(page, "Reasoning Aloud").locator('[role="progressbar"]'),
  ).toHaveAttribute("aria-valuenow", "0");
  await expect(
    card(page, "Reasoning Aloud").locator("[data-badge-stage]"),
  ).toHaveAttribute("data-badge-stage", "3");
  await expect(
    page.getByRole("button", { name: "Complete example cycle", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .locator(".recent-flowmarks")
      .getByRole("button", {
        name: "View Reasoning Aloud cycle 5 Flowmark",
        exact: true,
      }),
  ).toHaveCount(1);
  await page
    .locator(".recent-flowmarks")
    .getByRole("button", {
      name: "View Reasoning Aloud cycle 5 Flowmark",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Example growth data",
  );
  await page
    .getByRole("button", { name: "Preview share card", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Nothing has been published or shared.",
  );
  await expect(
    page.getByRole("dialog").locator(".growth-art img"),
  ).toHaveAttribute("src", capabilityArtwork["Reasoning Aloud"]);
  await expect(
    page.getByRole("dialog").locator(".share-brand"),
  ).toBeInViewport();
  await page.screenshot({
    path: `test-results/growth-flowmark-${test.info().project.name}.png`,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(mutations).toEqual([]);
  expect(await page.evaluate(() => (window as any).__growthMicRequests)).toBe(
    0,
  );
  expect(errors).toEqual([]);
});

test("Growth scenarios preserve established sample progress and reset the walkthrough", async ({
  page,
}) => {
  await openGrowth(page);
  await page.getByText("Explore example progress", { exact: true }).click();
  await page.getByLabel("Example scenario").selectOption("pending");
  await expect(page.locator(".review-status")).toContainText("review pending");
  await expect(card(page, "Clear Explanation")).toContainText("72%");
  await expect(
    page.getByRole("button", { name: "Apply example session", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Show completed review" }).click();
  await expect(page.getByLabel("Example scenario")).toHaveValue("returning");
  await page.getByLabel("Example scenario").selectOption("failed");
  await expect(card(page, "Reasoning Aloud")).toContainText("88%");
  await page.getByRole("button", { name: "Retry review" }).click();
  await expect(page.getByLabel("Example scenario")).toHaveValue("returning");
  await page.getByLabel("Example scenario").selectOption("new");
  await expect(page.locator(".capability-card")).toHaveCount(7);
  await expect(
    page
      .locator(".capability-card")
      .filter({ hasText: "No evidence collected yet" }),
  ).toHaveCount(7);
  await expect(page.locator(".flowmark-tile")).toHaveCount(0);
  await expect(
    card(page, "Clear Explanation").locator("[data-badge-stage]"),
  ).toHaveAttribute("data-badge-stage", "0");
  await page
    .getByRole("button", { name: "Reset example", exact: true })
    .click();
  await expect(card(page, "Clear Explanation")).toContainText("72%");
  await expect(
    page.getByRole("button", { name: "Apply example session", exact: true }),
  ).toBeEnabled();
});

test("Growth retains app-memory state across navigation, resets on reload, and keeps New session", async ({
  page,
}) => {
  await openGrowth(page);
  if (!(await page.locator(".growth-example-tools").evaluate(el => el.hasAttribute("open"))))
    await page.getByText("Explore example progress", { exact: true }).click();
  await page.getByRole("button", { name: "Apply example session", exact: true }).click();
  await page
    .getByRole("button", { name: "Back to growth", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Flowst Airs navigation" })
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Flowst Airs navigation" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(card(page, "Clear Explanation")).toContainText("84%");
  await page.reload();
  await expect(card(page, "Clear Explanation")).toContainText("72%");
  await page
    .getByRole("navigation", { name: "Flowst Airs navigation" })
    .getByRole("link", { name: "New session", exact: true })
    .click();
  await expect(page).toHaveURL(/\/airs\/new$/);
  await expect(
    page.getByLabel("Share context about yourself", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
});

test("Growth dashboard and dialogs are accessible, responsive, and respect reduced motion", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openGrowth(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const width of isMobile ? [320, 390, 768] : [900, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: isMobile ? 390 : 1280, height: 900 });
  await card(page, "Clear Explanation").focus();
  await page.keyboard.press("Enter");
  if (isMobile) {
    await expect(page.getByRole("dialog")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(card(page, "Clear Explanation")).toBeFocused();
  }
  expect(
    await card(page, "Clear Explanation").evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe("0s");
  if (!(await page.locator(".growth-example-tools").evaluate(el => el.hasAttribute("open"))))
    await page.getByText("Explore example progress", { exact: true }).click();
  await page.getByRole("button", { name: "Apply example session", exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
