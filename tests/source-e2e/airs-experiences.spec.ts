import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

interface ExperienceRuntime {
  __airsExperienceDevices: { microphone: number; screen: number };
  __airsExperienceRevokedUrls: string[];
}
interface ExperienceRequests {
  mutations: string[];
  providers: string[];
  errors: string[];
}

const requestGuards = new WeakMap<Page, ExperienceRequests>();
const providerPattern = /(?:agora\.(?:io|cn|api)|lemonslice\.(?:com|ai)|api\.openai\.com|api\.elevenlabs\.io|api\.groq\.com|api\.deepgram\.com|api\.minimax\.io|bedrock-runtime\.[^/]+\.amazonaws\.com)/i;
const providerApiPattern = /^\/api\/(?:pilot\/avatar-trial|study\/(?:llm|voice|audio|speech|tts|live))(?:\/|$)/;

test.beforeEach(async ({ page }) => {
  await page.context().route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const runtime = window as unknown as ExperienceRuntime;
    runtime.__airsExperienceDevices = { microphone: 0, screen: 0 };
    runtime.__airsExperienceRevokedUrls = [];
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          runtime.__airsExperienceDevices.microphone += 1;
          throw new Error("Experience samples must not request microphone access");
        },
        getDisplayMedia: async () => {
          runtime.__airsExperienceDevices.screen += 1;
          throw new Error("Experience samples must not request screen access");
        },
      },
    });
    const revokeObjectUrl = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = objectUrl => {
      runtime.__airsExperienceRevokedUrls.push(objectUrl);
      revokeObjectUrl(objectUrl);
    };
  });
  const session = await page.request.post("/api/auth/dev-session", { data: { scenario: "member" } });
  expect(session.ok()).toBe(true);
  const requests: ExperienceRequests = { mutations: [], providers: [], errors: [] };
  requestGuards.set(page, requests);
  page.on("pageerror", error => requests.errors.push(error.message));
  page.on("request", request => {
    const requestUrl = new URL(request.url());
    if (requestUrl.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) requests.mutations.push(request.url());
    if (providerPattern.test(request.url()) || providerApiPattern.test(requestUrl.pathname)) requests.providers.push(request.url());
  });
  await page.route(providerPattern, route => route.abort("blockedbyclient"));
  await page.route("**/api/**", route => {
    const request = route.request();
    if (providerApiPattern.test(new URL(request.url()).pathname) || !["GET", "HEAD", "OPTIONS"].includes(request.method())) return route.abort("blockedbyclient");
    return route.continue();
  });
});

test.afterEach(async ({ page }) => {
  const requests = requestGuards.get(page)!;
  expect(requests.mutations, "Experience samples must not mutate application APIs").toEqual([]);
  expect(requests.providers, "Experience samples must not contact paid or avatar providers").toEqual([]);
  expect(requests.errors).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as ExperienceRuntime).__airsExperienceDevices)).toEqual({ microphone: 0, screen: 0 });
});

async function openExperiences(page: Page) {
  await page.goto("/home/modes?mode=interview", { waitUntil: "domcontentloaded" });
  await waitForExperienceHydration(page);
  await expect(page.getByRole("navigation", { name: "Explore the Airs experience" })).toBeVisible({ timeout: 60_000 });
}

async function waitForExperienceHydration(page: Page) {
  await page.waitForFunction(() => Boolean((document.getElementById("__nuxt") as (HTMLElement & { __vue_app__?: unknown }) | null)?.__vue_app__), undefined, { timeout: 60_000 });
}

async function navigateProduct(page: Page, label: string) {
  await waitForExperienceHydration(page);
  const menu = page.getByRole("button", { name: "Open menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Flowst Airs navigation", exact: true }).getByRole("link", { name: label, exact: true }).click();
}

test("Study stays prominent while New session, Library, Settings, and mode previews remain reachable", async ({ page }) => {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".growth-home")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".growth-heading").getByRole("link", { name: "Start a study session", exact: true })).toHaveAttribute("href", "/home/new?mode=study");
  await navigateProduct(page, "New session");
  await expect(page).toHaveURL(/\/home\/new$/);
  const picker = page.locator(".session-mode-picker");
  await expect(picker).toBeVisible();
  await expect(picker.locator(".available-badge")).toHaveText("Available now");
  await expect(picker.getByRole("link", { name: "Start a study session", exact: true })).toHaveAttribute("href", "/home/new?mode=study");
  await expect(picker.getByRole("list", { name: "Study session roles" }).getByRole("listitem")).toHaveCount(3);
  for (const [label, modeId] of [["Interview practice", "interview"], ["Conversation rehearsal", "conversation"], ["Language practice", "language"]]) {
    const card = picker.locator(".upcoming-card").filter({ has: page.getByRole("heading", { name: label, exact: true }) });
    await expect(card.getByRole("button")).toBeDisabled();
    await expect(card.getByRole("link")).toHaveAttribute("href", `/home/modes?mode=${modeId}`);
  }
  await picker.getByRole("link", { name: "Preview interview practice", exact: true }).click();
  await expect(page.locator(".amina-modes")).toHaveAttribute("data-mode", "interview");
  await navigateProduct(page, "Library");
  await expect(page).toHaveURL(/\/home\/library$/);
  await expect(page.locator(".air-library")).toBeVisible();
  await navigateProduct(page, "Settings");
  await expect(page).toHaveURL(/\/home\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await navigateProduct(page, "Mode demos");
  await expect(page).toHaveURL(/\/home\/modes$/);
  await expect(page.locator(".amina-modes")).toBeVisible();
  await navigateProduct(page, "New session");
  await picker.getByRole("link", { name: "Start a study session", exact: true }).click();
  await expect(page).toHaveURL(/\/home\/new\?mode=study$/);
  await expect(page.locator(".misu-setup")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("New session picker scrolls in short viewports while Study keeps its bounded workspace", async ({ page, isMobile }) => {
  const viewport = { width: isMobile ? 393 : 1360, height: 565 };
  await page.setViewportSize(viewport);
  await page.goto("/home/new", { waitUntil: "domcontentloaded" });
  await waitForExperienceHydration(page);
  const picker = page.locator(".session-mode-picker");
  await expect(picker).toBeVisible();
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.wheel(0, 5000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(picker.getByRole("link", { name: "Preview language practice", exact: true })).toBeInViewport();
  await expect(page.locator(".app-shell")).not.toHaveClass(/workspace-host/);
  await picker.getByRole("link", { name: "Start a study session", exact: true }).click();
  await expect(page.locator(".misu-setup")).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveClass(/workspace-host/);
  await page.goBack();
  await expect(page).toHaveURL(/\/home\/new$/);
  await expect(picker).toBeVisible();
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.wheel(0, 5000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(picker.getByRole("link", { name: "Preview language practice", exact: true })).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath("new-session-scroll.png"), fullPage: true });
});

test("animation, character looks, and milestones expand independently with focus restored", async ({ page }) => {
  await openExperiences(page);
  const entries = page.getByRole("navigation", { name: "Explore the Airs experience" });
  const animationEntry = entries.getByRole("button", { name: /Animation experience/ });
  const characterEntry = entries.getByRole("button", { name: /Character unlocks/ });
  const milestoneEntry = entries.getByRole("button", { name: /Milestones & share cards/ });
  const animationPanel = page.locator("#amina-animation-lab");
  const characterPanel = page.locator("#airs-character-unlocks");
  const milestonePanel = page.locator("#airs-milestone-unlocks");
  for (const entry of [animationEntry, characterEntry, milestoneEntry]) await expect(entry).toHaveAttribute("aria-expanded", "false");
  for (const panel of [animationPanel, characterPanel, milestonePanel]) await expect(panel).toHaveCount(0);
  await animationEntry.focus();
  await page.keyboard.press("Enter");
  await expect(animationEntry).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#animation-lab-heading")).toBeFocused();
  await animationPanel.getByRole("button", { name: "thinking", exact: true }).click();
  await animationPanel.getByRole("checkbox", { name: /Animate the illustration/ }).uncheck();
  await expect(animationPanel.locator(".amina-demo-avatar")).toHaveAttribute("data-state", "thinking");
  await expect(animationPanel.locator(".amina-demo-avatar")).toHaveAttribute("data-active", "false");
  await expect(characterPanel).toHaveCount(0);
  await expect(milestonePanel).toHaveCount(0);
  await expect(animationPanel.locator(".lab-provider-trial, .lab-next-step, input[type=file]")).toHaveCount(0);
  await expect(animationPanel).not.toContainText(/agora|lemonslice|credentials|integration guide/i);
  await characterEntry.click();
  await expect(page.locator("#character-unlocks-heading")).toBeFocused();
  await expect(characterPanel.locator(".amina-demo-avatar")).toHaveAttribute("data-active", "true");
  await expect(milestonePanel).toHaveCount(0);
  await milestoneEntry.click();
  await expect(page.locator("#milestones-heading")).toBeFocused();
  for (const panel of [animationPanel, characterPanel, milestonePanel]) await expect(panel).toBeVisible();
  await expect(animationPanel.locator(".amina-demo-avatar")).toHaveAttribute("data-state", "thinking");
  await expect(characterPanel.locator(".sample-tide-label strong")).toHaveText("0");
  await expect(milestonePanel.locator(".milestone-sample-label strong")).toHaveText("10");
  await animationPanel.getByRole("button", { name: "Close animation experience", exact: true }).click();
  await expect(animationPanel).toHaveCount(0);
  await expect(animationEntry).toBeFocused();
  await expect(characterPanel).toBeVisible();
  await expect(milestonePanel).toBeVisible();
  await characterPanel.getByRole("button", { name: "Close character unlocks", exact: true }).click();
  await expect(characterPanel).toHaveCount(0);
  await expect(characterEntry).toBeFocused();
  await expect(milestonePanel).toBeVisible();
  await milestonePanel.getByRole("button", { name: "Close milestones and share cards", exact: true }).click();
  await expect(milestonePanel).toHaveCount(0);
  await expect(milestoneEntry).toBeFocused();
  for (const entry of [animationEntry, characterEntry, milestoneEntry]) await expect(entry).toHaveAttribute("aria-expanded", "false");
});

test("stable cosmetic rooms and presets honor sample thresholds and keep Misu and Kai static", async ({ page }) => {
  await openExperiences(page);
  await page.getByRole("navigation", { name: "Explore the Airs experience" }).getByRole("button", { name: /Character unlocks/ }).click();
  const rewards = page.locator("#airs-character-unlocks .tide-unlocks");
  const scene = rewards.locator(".cosmetic-preview-scene");
  const counts = rewards.getByRole("group", { name: "Choose a sample Tide count" });
  const environment = scene.locator(".cosmetic-preview-environment");
  const character = scene.locator(".amina-demo-avatar");
  await expect(scene).toHaveAttribute("data-background", "studio");
  await expect(environment).toHaveAttribute("src", "/environments/amina-workspace-v1.webp");
  await expect(rewards.getByRole("button", { name: /Workspace, available/ })).toBeEnabled();
  for (const room of ["Café", "Garden", "Night"]) await expect(rewards.getByRole("button", { name: new RegExp(`^${room}, locked`) })).toBeDisabled();
  await expect(rewards.getByRole("button", { name: /^Thoughtful, .*locked/ })).toBeDisabled();
  await expect(rewards.getByRole("button", { name: /^Celebrate, .*locked/ })).toBeDisabled();
  await counts.getByRole("button", { name: "1", exact: true }).click();
  await rewards.getByRole("button", { name: /Café, available/ }).click();
  await expect(scene).toHaveAttribute("data-background", "cafe");
  await expect(environment).toHaveAttribute("src", "/environments/amina-cafe-v1.webp");
  await rewards.getByRole("button", { name: /^Thoughtful, .*available/ }).click();
  await expect(character).toHaveAttribute("data-state", "thinking");
  await expect(rewards.getByRole("button", { name: /Garden, locked/ })).toBeDisabled();
  await counts.getByRole("button", { name: "3", exact: true }).click();
  await rewards.getByRole("button", { name: /Garden, available/ }).click();
  await expect(scene).toHaveAttribute("data-background", "garden");
  await expect(environment).toHaveAttribute("src", "/environments/amina-garden-v1.webp");
  await rewards.getByRole("button", { name: /^Celebrate, .*available/ }).click();
  await expect(character).toHaveAttribute("data-expression", "celebrate");
  await expect(scene.locator(".amina-demo-avatar__artwork")).toHaveCSS("background-position", /66\.666\d*% 100%/);
  await expect(rewards.getByRole("button", { name: /Night, locked/ })).toBeDisabled();
  await counts.getByRole("button", { name: "5", exact: true }).click();
  await rewards.getByRole("button", { name: /Night, available/ }).click();
  await expect(scene).toHaveAttribute("data-background", "night");
  await expect(character).toHaveAttribute("data-dark", "true");
  await expect(rewards.locator(".accessory-concept")).toHaveAttribute("data-unlocked", "true");
  await expect(rewards.locator(".accessory-concept")).toContainText("artwork not available yet");
  const motion = rewards.getByRole("checkbox", { name: "Animate Amina", exact: true });
  await motion.uncheck();
  await expect(character).toHaveAttribute("data-active", "false");
  await expect(scene.locator(".amina-demo-avatar__character")).toHaveCSS("animation-name", "none");
  await motion.check();
  await expect(character).toHaveAttribute("data-active", "true");
  await expect(scene.locator(".amina-demo-avatar__character")).toHaveCSS("animation-name", "none");
  const agents = rewards.getByRole("group", { name: "Choose a companion for the cosmetic concept" });
  for (const [agentName, agentId, portrait] of [["Misu", "MIRO", "/optimized/v1/mascots/misu/portrait.webp"], ["Kai", "KAI", "/optimized/v1/mascots/kai/portrait.webp"]] as const) {
    await agents.getByRole("button", { name: agentName, exact: true }).click();
    await expect(scene).toHaveAttribute("data-agent", agentId);
    await expect(scene.locator(".cosmetic-static-agent")).toHaveAttribute("src", portrait);
    await expect.poll(() => scene.locator(".cosmetic-static-agent").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(scene.locator(".amina-demo-avatar")).toHaveCount(0);
    await expect(rewards.getByRole("group", { name: "Try a presence preset" })).toHaveCount(0);
    await expect(rewards.getByRole("checkbox", { name: "Animate Amina", exact: true })).toHaveCount(0);
    await expect(rewards.locator(".cosmetic-agent-preview")).toContainText("this character stays still");
  }
  await agents.getByRole("button", { name: "Amina", exact: true }).click();
  await expect(character).toHaveAttribute("data-state", "idle");
  await rewards.getByRole("button", { name: /^Celebrate, .*available/ }).click();
  await counts.getByRole("button", { name: "0", exact: true }).click();
  await expect(scene).toHaveAttribute("data-background", "studio");
  await expect(character).toHaveAttribute("data-state", "idle");
  await expect(character).toHaveAttribute("data-expression", "auto");
  await expect(character).toHaveAttribute("data-dark", "false");
  await expect(rewards.locator(".accessory-concept")).toHaveAttribute("data-unlocked", "false");
  for (const image of await rewards.locator(".background-swatch img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("sample milestones unlock and export a self-contained watermarked SVG", async ({ page }) => {
  await openExperiences(page);
  await page.getByRole("navigation", { name: "Explore the Airs experience" }).getByRole("button", { name: /Milestones & share cards/ }).click();
  const milestones = page.locator("#airs-milestone-unlocks .milestone-unlocks");
  const counts = milestones.getByRole("group", { name: "Choose a sample Tide count" });
  const cards = milestones.locator(".milestone-card");
  const horizon = cards.filter({ has: page.getByRole("heading", { name: "Horizon Line", exact: true }) });
  const northern = cards.filter({ has: page.getByRole("heading", { name: "Northern Lights", exact: true }) });
  await expect(cards).toHaveCount(5);
  await expect(milestones.locator('.milestone-card[data-unlocked="true"]')).toHaveCount(2);
  await expect(milestones.locator(".milestone-artwork img")).toHaveCount(7);
  await expect(milestones.locator(".milestone-demo-note")).toContainText("do not award Tides");
  for (const image of await milestones.locator(".milestone-artwork img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await counts.getByRole("button", { name: "0", exact: true }).click();
  await expect(milestones.locator('.milestone-card[data-unlocked="true"]')).toHaveCount(0);
  for (const card of await cards.all()) await expect(card.getByRole("button")).toBeDisabled();
  await counts.getByRole("button", { name: "50", exact: true }).click();
  await expect(milestones.locator('.milestone-card[data-unlocked="true"]')).toHaveCount(4);
  await expect(horizon.getByRole("button")).toBeEnabled();
  await expect(northern.getByRole("button")).toBeDisabled();
  await horizon.getByRole("button").click();
  const sharePanel = milestones.locator(".milestone-share-panel");
  await expect(sharePanel).toBeVisible();
  await expect(sharePanel).toBeFocused();
  const previousUrl = await sharePanel.locator(".milestone-share-image").getAttribute("src");
  expect(previousUrl).toMatch(/^blob:/);
  await counts.getByRole("button", { name: "0", exact: true }).click();
  await expect(sharePanel).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as ExperienceRuntime).__airsExperienceRevokedUrls)).toContain(previousUrl);
  await counts.getByRole("button", { name: "100", exact: true }).click();
  await expect(milestones.locator('.milestone-card[data-unlocked="true"]')).toHaveCount(5);
  await northern.getByRole("button").click();
  await expect(sharePanel).toBeVisible();
  await expect.poll(() => sharePanel.locator(".milestone-share-image").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const shareUrl = await sharePanel.locator(".milestone-share-image").getAttribute("src");
  const downloadEvent = page.waitForEvent("download");
  await sharePanel.getByRole("link", { name: /Download SVG/ }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("flowst-airs-northern-lights-sample.svg");
  const downloadPath = test.info().outputPath(download.suggestedFilename());
  await download.saveAs(downloadPath);
  const downloadedSvg = await readFile(downloadPath, "utf8");
  expect(downloadedSvg).toContain("SAMPLE · APPEARANCE CONCEPT");
  expect(downloadedSvg).toContain("Not an earned award");
  expect(downloadedSvg).toContain("Previewed with 100 sample Tides");
  expect(downloadedSvg.match(/<image /g)).toHaveLength(2);
  expect(downloadedSvg).toContain("data:image/png;base64,");
  expect(downloadedSvg).not.toMatch(/<script|<foreignObject|\son\w+=|(?:href|src)="https?:\/\//i);
  await sharePanel.getByRole("button", { name: "Close sample share card", exact: true }).click();
  await expect(sharePanel).toHaveCount(0);
  await expect(northern.getByRole("button")).toBeFocused();
  expect(await page.evaluate(() => (window as unknown as ExperienceRuntime).__airsExperienceRevokedUrls)).toContain(shareUrl);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
