import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_AGENT_PRESENTATION, normalizeAgentPresentation } from "../../shared/agentPresentation";

interface ExperienceRuntime {
  __airsExperienceDevices: { microphone: number; screen: number };
  __airsExperienceRevokedUrls: string[];
  __airsExperienceNavigation?: { active: boolean; scrollCalls: number; focusCalls: number };
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
  await page.route("**/api/study/presentation", route => route.request().method() === "GET"
    ? route.fulfill({ json: { presentation: normalizeAgentPresentation(DEFAULT_AGENT_PRESENTATION), revision: "experience-saved-team" } })
    : route.abort("blockedbyclient"));
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
  await expect(page.locator(".experience-disclosures")).toBeVisible({ timeout: 60_000 });
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
  await expect(page.locator(".team-customizer")).toBeVisible();
  await page.getByRole("button", { name: "Keep current team", exact: true }).click();
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
  await expect(page.locator(".team-customizer")).toBeVisible();
  await page.getByRole("button", { name: "Keep current team", exact: true }).click();
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

test("experience accordions open inline one at a time without moving focus, scrolling, or changing the room", async ({ page }) => {
  await openExperiences(page);
  const entries = page.locator(".experience-disclosures");
  const animationEntry = entries.getByRole("button", { name: "Animation experience", exact: true });
  const characterEntry = entries.getByRole("button", { name: "Character unlocks", exact: true });
  const milestoneEntry = entries.getByRole("button", { name: "Milestones & share cards", exact: true });
  const companionEntry = entries.getByRole("button", { name: "Companion on Home", exact: true });
  const animationPanel = page.locator("#amina-animation-lab");
  const characterPanel = page.locator("#airs-character-unlocks");
  const milestonePanel = page.locator("#airs-milestone-unlocks");
  const companionPanel = page.locator("#airs-home-companion-preview");
  const panels = [animationPanel, characterPanel, milestonePanel, companionPanel];
  const triggers = [animationEntry, characterEntry, milestoneEntry, companionEntry];
  await expect(entries.locator(".experience-disclosure-trigger")).toHaveCount(4);
  for (const entry of triggers) await expect(entry).toHaveAttribute("aria-expanded", "false");
  for (const panel of panels) await expect(panel).toBeHidden();
  await page.locator(".context-exchanges button").nth(1).click();
  const roomText = await page.locator(".mode-workspace").innerText();
  await page.evaluate(() => {
    const runtime = window as unknown as ExperienceRuntime;
    runtime.__airsExperienceNavigation = { active: false, scrollCalls: 0, focusCalls: 0 };
    for (const method of ["scrollTo", "scrollBy"] as const) {
      const original = window[method];
      window[method] = (...args: unknown[]) => {
        if (runtime.__airsExperienceNavigation!.active) runtime.__airsExperienceNavigation!.scrollCalls += 1;
        return Reflect.apply(original, window, args);
      };
    }
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, options?: boolean | ScrollIntoViewOptions) {
      if (runtime.__airsExperienceNavigation!.active) runtime.__airsExperienceNavigation!.scrollCalls += 1;
      return originalScrollIntoView.call(this, options);
    };
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      if (runtime.__airsExperienceNavigation!.active) runtime.__airsExperienceNavigation!.focusCalls += 1;
      return originalFocus.call(this, options);
    };
  });
  const toggle = async (entry: Locator, expanded: boolean, key = "Enter", checkPosition = false) => {
    const viewport = page.viewportSize()!;
    for (let step = 0; step < 24; step += 1) {
      const bounds = await entry.boundingBox();
      if (bounds && bounds.y >= 45 && bounds.y + bounds.height <= viewport.height - 45) break;
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, bounds && bounds.y < 45 ? -250 : 250);
      await page.waitForTimeout(50);
    }
    await expect(entry).toBeInViewport();
    await entry.focus();
    const previousScroll = await page.evaluate(() => {
      const navigation = (window as unknown as ExperienceRuntime).__airsExperienceNavigation!;
      navigation.active = true;
      navigation.scrollCalls = navigation.focusCalls = 0;
      return window.scrollY;
    });
    await page.keyboard.press(key);
    await expect(entry).toHaveAttribute("aria-expanded", String(expanded));
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const navigation = await page.evaluate(() => {
      const state = (window as unknown as ExperienceRuntime).__airsExperienceNavigation!;
      state.active = false;
      return { ...state, scrollY: window.scrollY, maxScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight) };
    });
    expect(navigation.scrollCalls, "Accordion toggles must not call scrolling APIs").toBe(0);
    expect(navigation.focusCalls, "Accordion toggles must not move focus into their content").toBe(0);
    await expect(entry).toBeFocused();
    await expect(entry).toBeInViewport();
    if (checkPosition) expect(navigation.scrollY).toBeCloseTo(Math.min(previousScroll, navigation.maxScroll), 0);
    await expect(entries.locator('.experience-disclosure-trigger[aria-expanded="true"]')).toHaveCount(expanded ? 1 : 0);
    if (expanded) expect(await entry.evaluate(element => element.nextElementSibling?.id)).toBe(await entry.getAttribute("aria-controls"));
  };
  await toggle(animationEntry, true, "Enter", true);
  await expect(animationPanel).toBeVisible();
  await entries.screenshot({ path: test.info().outputPath("mode-experience-animation-inline.png") });
  await animationPanel.getByRole("button", { name: "thinking", exact: true }).click();
  await animationPanel.getByRole("checkbox", { name: /Animate the illustration/ }).uncheck();
  await expect(animationPanel.locator(".amina-demo-avatar")).toHaveAttribute("data-state", "thinking");
  await expect(animationPanel.locator(".amina-demo-avatar")).toHaveAttribute("data-active", "false");
  await animationPanel.getByRole("checkbox", { name: /Animate the illustration/ }).check();
  await expect(characterPanel).toBeHidden();
  await expect(milestonePanel).toBeHidden();
  await expect(animationPanel.locator(".lab-provider-trial, .lab-next-step, input[type=file]")).toHaveCount(0);
  await expect(animationPanel).not.toContainText(/agora|lemonslice|credentials|integration guide/i);
  await toggle(animationEntry, false, "Space", true);
  await expect(animationPanel).toBeHidden();
  await toggle(animationEntry, true);
  await expect(animationPanel.locator(".amina-demo-avatar")).toHaveAttribute("data-state", "thinking");
  await toggle(characterEntry, true);
  await expect(animationPanel).toBeHidden();
  await expect(characterPanel).toBeVisible();
  await expect(characterPanel.locator(".cosmetic-preview-agent .companion-motion")).toHaveAttribute("data-active", "true");
  await expect(milestonePanel).toBeHidden();
  await expect(characterPanel.locator(".sample-tide-label strong")).toHaveText("0");
  await entries.screenshot({ path: test.info().outputPath("mode-experience-character-inline.png") });
  await toggle(milestoneEntry, true);
  await expect(animationPanel).toBeHidden();
  await expect(characterPanel).toBeHidden();
  await expect(milestonePanel).toBeVisible();
  await expect(milestonePanel.locator(".milestone-sample-label strong")).toHaveText("10");
  await entries.screenshot({ path: test.info().outputPath("mode-experience-milestones-inline.png") });
  await toggle(companionEntry, true);
  for (const panel of [animationPanel, characterPanel, milestonePanel]) await expect(panel).toBeHidden();
  await expect(companionPanel).toBeVisible();
  await expect(companionPanel.locator('a[href="/home/companion"]')).toHaveCount(1);
  await expect(companionPanel.getByRole("checkbox", { name: "Enable companion demo", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("web-companion")).toHaveCount(0);
  await toggle(companionEntry, false, "Space", true);
  for (const [entry, panel, label] of [
    [animationEntry, animationPanel, "Close animation experience"],
    [characterEntry, characterPanel, "Close character unlocks"],
    [milestoneEntry, milestonePanel, "Close milestones and share cards"],
  ] as const) {
    await toggle(entry, true);
    await panel.getByRole("button", { name: label, exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(entry).toBeFocused();
  }
  for (const entry of triggers) await expect(entry).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".amina-modes")).toHaveAttribute("data-mode", "interview");
  expect(await page.locator(".mode-workspace").innerText()).toBe(roomText);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await entries.screenshot({ path: test.info().outputPath("mode-experience-accordions.png") });
});

test("facial unlocks honor sample thresholds for all companions and keep rooms optional", async ({ page }) => {
  await openExperiences(page);
  await page.locator(".experience-disclosures").getByRole("button", { name: "Character unlocks", exact: true }).click();
  const rewards = page.locator("#airs-character-unlocks .tide-unlocks");
  const scene = rewards.locator(".cosmetic-preview-scene");
  const counts = rewards.getByRole("group", { name: "Choose a sample Tide count" });
  const motions = rewards.getByRole("group", { name: "Choose an illustrated motion" });
  await expect(scene).toHaveAttribute("data-background", "neutral");
  await expect(scene.locator(".cosmetic-preview-environment")).toHaveCount(0);
  await expect(rewards.locator(".optional-room-settings")).not.toHaveAttribute("open", "");
  for (const state of ["idle", "listening"]) await expect(motions.locator(`.companion-motion-option[data-state="${state}"]`)).toBeEnabled();
  for (const state of ["greeting", "thinking", "celebrate", "dance"]) await expect(motions.locator(`.companion-motion-option[data-state="${state}"]`)).toBeDisabled();
  for (const [threshold, state] of [[1, "greeting"], [3, "thinking"], [5, "celebrate"], [10, "dance"]] as const) {
    await counts.getByRole("button", { name: String(threshold), exact: true }).click();
    await motions.locator(`.companion-motion-option[data-state="${state}"]`).click();
    await expect(scene).toHaveAttribute("data-state", state);
  }
  const agents = rewards.getByRole("group", { name: "Choose a companion for the motion preview" });
  for (const [agentName, agentId] of [["Amina", "AMIRA"], ["Misu", "MIRO"], ["Kai", "KAI"]] as const) {
    await agents.getByRole("button", { name: agentName, exact: true }).click();
    await expect(scene).toHaveAttribute("data-agent", agentId);
    const character = scene.locator(".companion-motion");
    await expect(character).toHaveAttribute("data-ready", "true");
    await expect(character.locator(".companion-motion__frame")).toHaveCount(4);
    await expect(scene.locator(".cosmetic-static-agent")).toHaveCount(0);
    for (const state of ["idle", "listening", "greeting", "thinking", "celebrate", "dance"]) {
      await motions.locator(`.companion-motion-option[data-state="${state}"]`).click();
      await expect(character).toHaveAttribute("data-state", state);
    }
    const face = await character.locator(".companion-motion__face").boundingBox();
    expect(face).not.toBeNull();
    expect(Math.abs(face!.width - face!.height)).toBeLessThan(1);
    await expect(rewards.locator('.motion-thumbnail .companion-motion[data-thumbnail="true"]')).toHaveCount(6);
    const motion = rewards.getByRole("checkbox", { name: `Animate ${agentName}`, exact: true });
    await motion.uncheck();
    await expect(character).toHaveAttribute("data-active", "false");
    await motion.check();
    await expect(character).toHaveAttribute("data-active", "true");
  }
  await expect(rewards.locator(".accessory-concept")).toHaveCount(0);
  await rewards.getByText("Optional room settings", { exact: true }).click();
  await counts.getByRole("button", { name: "0", exact: true }).click();
  await expect(scene).toHaveAttribute("data-state", "idle");
  await expect(rewards.getByRole("button", { name: /Workspace, available/ })).toBeEnabled();
  for (const room of ["Café", "Garden", "Night"]) await expect(rewards.getByRole("button", { name: new RegExp(`^${room}, locked`) })).toBeDisabled();
  for (const [threshold, room, background, image] of [
    [0, "Workspace", "studio", "amina-workspace-v1.webp"],
    [1, "Café", "cafe", "amina-cafe-v1.webp"],
    [3, "Garden", "garden", "amina-garden-v1.webp"],
    [5, "Night", "night", "amina-workspace-v1.webp"],
  ] as const) {
    await counts.getByRole("button", { name: String(threshold), exact: true }).click();
    await rewards.getByRole("button", { name: new RegExp(`^${room}, available`) }).click();
    await expect(scene).toHaveAttribute("data-background", background);
    await expect(scene.locator(".cosmetic-preview-environment")).toHaveAttribute("src", `/environments/${image}`);
  }
  await counts.getByRole("button", { name: "0", exact: true }).click();
  await expect(scene).toHaveAttribute("data-background", "neutral");
  await expect(scene).toHaveAttribute("data-state", "idle");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("sample milestones unlock and export a self-contained watermarked SVG", async ({ page }) => {
  await openExperiences(page);
  await page.locator(".experience-disclosures").getByRole("button", { name: "Milestones & share cards", exact: true }).click();
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
