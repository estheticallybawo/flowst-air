import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("production visitors sign in, including browsers with an old guest cookie", async ({ page, request, isMobile }) => {
  const openMobileMenu = async () => {
    if (!isMobile) return;
    const trigger = page.locator(".air-public-header").getByRole("button", { name: "Open menu", exact: true });
    if (await trigger.count() && await trigger.getAttribute("aria-expanded") === "false") {
      await trigger.click();
      await expect(page.locator(".air-public-menu-trigger")).toHaveAttribute("aria-expanded", "true");
    }
  };
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.context().addCookies([{ name: "airs_guest", value: "previous-guest-session", url: "http://127.0.0.1:4324" }]);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect((await response!.allHeaders())["cache-control"]).toBe("private, no-store");
  expect((await response!.allHeaders())["set-cookie"] || "").not.toContain("airs_guest=");
  await expect(page.getByRole("heading", { name: "Give your thoughts a stronger voice.", exact: true })).toBeVisible();
  await expect(page.locator("#for-you")).toContainText("Independent learners");
  await expect(page.locator("#for-you")).toContainText("Recent graduates");
  await expect(page.locator("#for-you")).toContainText("People building with AI");
  await expect(page.locator(".landing-features > article")).toHaveCount(3);
  await expect(page.locator(".landing-session-step")).toHaveCount(6);
  await expect(page.locator(".landing-tide-card")).toHaveCount(7);
  await expect(page.locator(".landing-tide-card h3")).toHaveText(["Clear Explanation", "Verbal Retrieval", "Conceptual Precision", "Reasoning Aloud", "Self-Monitoring", "Transfer", "Conversation Flow"]);
  await expect(page.locator(".landing-growth")).toContainText("Watch yourself Grow through earned Tides.");
  await expect(page.locator(".landing-growth")).toContainText("Complete a growth cycle to earn a Tide");
  await expect(page.locator(".landing-growth")).not.toContainText(/example|in development|coming soon/i);
  await expect(page.locator(".landing-expectation-list > div")).toHaveCount(4);
  await expect(page.locator(".landing-start .air-button")).toHaveAttribute("href", "/auth/sign-in?redirect=/home/new");

  await expect(page.locator(".landing-hero .air-hero-copy > p:not(.air-eyebrow)")).toHaveCount(1);
  await expect(page.locator(".landing-hero .air-action-row a")).toHaveCount(2);
  await expect(page.locator(".landing-hero .air-hero-benefits, .landing-hero .landing-team, .landing-hero-promise")).toHaveCount(0);
  await expect(page.locator(".landing-hero-visual img")).toHaveCount(3);

  // The complete desktop composition stays on screen. Only its clipped card
  // track moves upward; the page releases the stage after the last card.
  expect(await page.locator(".air-landing :is(h1,h2,h3,h4,h5,h6,dt,summary)").evaluateAll(elements => elements.every(element => getComputedStyle(element).fontFamily.startsWith("Unbounded")))).toBe(true);
  const heroStyle = await page.locator(".landing-hero h1").evaluate(element => ({size:parseFloat(getComputedStyle(element).fontSize),weight:parseFloat(getComputedStyle(element).fontWeight)}));
  expect(heroStyle.weight).toBeGreaterThanOrEqual(700);
  expect(heroStyle.size).toBeGreaterThanOrEqual(isMobile ? 40 : 60);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForLoadState("networkidle");
  const stories = page.locator(".air-scroll-story");
  await expect(stories).toHaveCount(5);
  for (const selector of ["#how-it-works", "#for-you", "#session-journey", "#growth", ".landing-expectations"]) {
    const story = page.locator(selector);
    await expect(story).toHaveAttribute("data-story-ready", "true");
    await expect(story).toHaveAttribute("data-story-mode", isMobile ? "flow" : "pinned");
    const panels = story.locator(".air-story-panel"), count = await panels.count();
    const intro = story.locator(".air-story-intro"), viewingArea = story.locator(".air-story-window");
    await expect(story.locator('.air-story-panel[aria-hidden="true"], .air-story-panel[inert]')).toHaveCount(0);
    const links = story.locator(".air-story-controls a");
    for (let index = 0; index < count; index++) {
      await links.nth(index).click();
      await expect(story).toHaveAttribute("data-active-item", String(index));
      await expect(panels.nth(index)).toBeInViewport({ratio: .9});
    }
    if (!isMobile) {
      await expect.poll(() => story.locator(".air-story-stage").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(2);
      // The next section cannot enter before the final chapter has completed.
      const end = await story.evaluate(element => scrollY + element.getBoundingClientRect().bottom - innerHeight);
      await page.evaluate(top => window.scrollTo({top,behavior:"instant"}),end + 120);
      expect((await story.locator(".air-story-stage").boundingBox())!.y).toBeLessThan(-100);
    }
    await links.nth(1).click();
    const before = await panels.nth(1).boundingBox(), railBefore = await intro.boundingBox(), windowBefore = await viewingArea.boundingBox();
    await page.evaluate(() => window.scrollBy({top:120,behavior:"instant"}));
    await expect.poll(async () => Math.abs((await panels.nth(1).boundingBox())!.y - before!.y + 120)).toBeLessThan(2);
    const railAfter = await intro.boundingBox(), windowAfter = await viewingArea.boundingBox();
    if (!isMobile) {
      expect(Math.abs(railAfter!.y - railBefore!.y)).toBeLessThan(2);
      expect(Math.abs(windowAfter!.y - windowBefore!.y)).toBeLessThan(2);
      expect(Math.abs(windowAfter!.height - windowBefore!.height)).toBeLessThan(2);
    } else {
      expect(Math.abs(railAfter!.y - railBefore!.y + 120)).toBeLessThan(2);
    }
    await links.nth(0).focus(); await page.keyboard.press("Enter");
    await expect(story).toHaveAttribute("data-active-item", "0");
    await expect(links.nth(0)).toBeFocused();
    await expect(panels.nth(0)).toBeInViewport({ratio:.9});
    await links.nth(1).focus(); await page.keyboard.press("Enter");
    await expect(story).toHaveAttribute("data-active-item", "1");
    await expect(links.nth(1)).toBeFocused();
    await expect(panels.nth(1)).toBeInViewport({ratio:.9});
    if (selector === "#growth" || selector === "#how-it-works") await page.screenshot({path:"test-results/scroll-" + (selector === "#growth" ? "tides" : "agents") + "-" + (isMobile ? "mobile" : "desktop") + ".png"});
    expect((await new AxeBuilder({ page }).include(selector).analyze()).violations).toEqual([]);
  }
  await page.goto("/#growth");
  await expect(page.locator("#growth")).toHaveAttribute("data-story-ready", "true");
  await expect.poll(() => page.locator("#growth").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(5);
  // Short desktop screens are covered by the dedicated geometry regression below.
  // In-page navigation must reach its section, including same-route hash changes.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".air-story-pinned")).toHaveCount(0);
  expect(await page.locator(".air-story-panel").evaluateAll(elements => elements.every(element => getComputedStyle(element).transform === "none" && getComputedStyle(element).visibility === "visible"))).toBe(true);
  await expect(page.locator('.air-story-panel[aria-hidden="true"]')).toHaveCount(0);
  await openMobileMenu();
  await page.locator(".air-public-header").getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect.poll(() => page.locator("#how-it-works").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(5);
  await expect(page.locator("#how-it-works").getByRole("heading", { name: "How it works", exact: true })).toBeVisible();
  await expect(page.locator(".landing-features h3")).toContainText(["Plan with Misu", "Practise with Amina", "Reflect with Kai"]);
  await page.locator("#how-it-works").screenshot({ path: "test-results/how-it-works-" + (isMobile ? "mobile" : "desktop") + ".png" });
  await page.getByRole("link", { name: "See your session step by step", exact: true }).click();
  await expect(page).toHaveURL(/#session-journey$/);
  await expect.poll(() => page.locator("#session-journey").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(5);
  await openMobileMenu();
  await page.locator(".air-public-header").getByRole("link", { name: "Tides", exact: true }).click();
  await expect(page).toHaveURL(/#growth$/);
  await expect.poll(() => page.locator(".landing-tide-card img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect.poll(() => page.locator("#growth").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(5);
  await page.locator("#growth").screenshot({ path: "test-results/tides-gallery-" + (isMobile ? "mobile" : "desktop") + ".png" });
  await openMobileMenu();
  await page.locator(".air-public-header").getByRole("link", { name: "FAQ", exact: true }).click();
  await expect(page).toHaveURL(/#faq$/);
  await expect.poll(() => page.locator("#faq").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(5);
  const tideQuestion = page.locator(".landing-questions summary").filter({ hasText: "How do I earn Tides?" });
  await tideQuestion.focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".landing-questions details[open]")).toContainText("fresh evidence and new contexts");
  await page.keyboard.press("Enter");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator(".air-hero-copy").evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  const originalViewport = page.viewportSize()!;
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if ((isMobile && width === 320) || (!isMobile && width === 1440)) {
      await page.evaluate(() => window.scrollTo(0,0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await page.screenshot({ path: "test-results/landing-page-" + (isMobile ? "mobile" : "desktop") + ".png", fullPage: true });
      await page.evaluate(() => window.scrollTo(0,0));
      await page.screenshot({ path: "test-results/landing-hero-" + (isMobile ? "mobile" : "desktop") + ".png" });
    }
  }
  await page.setViewportSize(originalViewport);
  const header = page.locator(".air-public-header");
  await expect(header.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/auth/sign-in?redirect=/home");
  await expect(page.getByRole("link", { name: /Open.*study space/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Continue", exact: true })).toHaveCount(0);
  await header.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=\/home$/);
  await expect(page.getByRole("heading", { name: "Sign in to Flowst Airs", exact: true })).toBeVisible();
  await expect(page.locator(".air-scroll-story")).toHaveCount(0);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/production-sign-in-" + (isMobile ? "mobile" : "desktop") + ".png", fullPage: true });
  for (const target of ["/home", "/home/new?source=returning", "/home/library", "/home/settings"]) {
    const protectedPage = await request.get(target, { maxRedirects: 0 });
    expect(protectedPage.status()).toBe(302);
    const destination = new URL(protectedPage.headers().location!, "http://127.0.0.1:4324");
    expect(destination.pathname).toBe("/auth/sign-in");
    expect(destination.searchParams.get("redirect")).toBe(target);
  }
  for (const prefix of ["/airs", "/air", "/amira"]) {
    const legacy = await request.get(prefix + "/new?source=bookmark", { maxRedirects: 0 });
    expect(legacy.status()).toBe(302);
    const location = new URL(legacy.headers().location!, "http://127.0.0.1:4324");
    expect(location.pathname).toBe("/home/new");
    expect(location.searchParams.get("source")).toBe("bookmark");
  }
  const session = await request.get("/api/auth/session", { headers: { cookie: "airs_guest=previous-guest-session" } });
  expect(session.status()).toBe(200);
  expect(await session.json()).toEqual({ authenticated: false });
  expect(session.headers()["set-cookie"] || "").not.toContain("airs_guest=");
  expect((await request.get("/api/study/conversations", { headers: { cookie: "airs_guest=previous-guest-session" } })).status()).toBe(401);
  for (const path of ["/api/auth/session", "/api/auth/sign-in", "/api/auth/sign-out", "/api/study/context"]) {
    const csrf = await request.post(path, { headers: { origin: "https://outside.invalid" } });
    expect(csrf.status()).toBe(403);
  }
  expect(errors).toEqual([]);
});

test("short desktop keeps both columns fixed while cards advance and releases after the last card", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop geometry; mobile retains its readable document flow.");
  test.setTimeout(120_000);
  const verifyBrandFonts = process.env.AIRS_VERIFY_BRAND_FONTS === "1";
  // The ordinary regression is deterministic. An explicit second run exercises
  // the same geometry with the real brand fonts and requires them to load.
  if (!verifyBrandFonts) await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1366, height: 720 });
  await page.goto("/");
  if (verifyBrandFonts) {
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      const heading = await document.fonts.load('700 36px "Unbounded"');
      const body = await document.fonts.load('400 16px "Albert Sans"');
      return {
        heading: heading.length > 0 && heading.every(face => face.status === "loaded") && document.fonts.check('700 36px "Unbounded"'),
        body: body.length > 0 && body.every(face => face.status === "loaded") && document.fonts.check('400 16px "Albert Sans"'),
      };
    });
    expect(loaded).toEqual({ heading: true, body: true });
  }
  await page.screenshot({ path: "test-results/hero-" + (verifyBrandFonts ? "brand-fonts" : "fallback-fonts") + ".png" });
  const selectors = ["#how-it-works", "#for-you", "#session-journey", "#growth", ".landing-expectations"];
  await expect(page.locator('.air-scroll-story[data-story-ready="true"]')).toHaveCount(5);
  const agents = page.locator("#how-it-works");
  await agents.locator(".air-story-controls a").nth(1).click();
  await expect(agents).toHaveAttribute("data-active-item", "1");
  // Resizing a section already in progress must keep its current chapter.
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('.air-scroll-story[data-story-mode="pinned"]')).toHaveCount(5);
  await expect(agents).toHaveAttribute("data-active-item", "1");
  await expect(agents.locator(".air-story-panel").nth(1)).toBeInViewport({ ratio: .9 });

  // Longer owner-written headings and all seven chapter controls must fit on a
  // typical 1280px desktop without making Growth switch to another scroll mode.
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('.air-scroll-story[data-story-mode="pinned"]')).toHaveCount(5);
  for (const selector of selectors) {
    const story = page.locator(selector);
    await story.locator(".air-story-controls a").nth(1).click();
    const rail = (await story.locator(".air-story-intro").boundingBox())!, viewingArea = (await story.locator(".air-story-window").boundingBox())!;
    expect(rail.y).toBeGreaterThanOrEqual(-1);
    expect(rail.y + rail.height).toBeLessThanOrEqual(601);
    expect(viewingArea.y).toBeGreaterThanOrEqual(-1);
    expect(viewingArea.y + viewingArea.height).toBeLessThanOrEqual(601);
    await expect(story.locator(".air-story-panel").nth(1)).toBeInViewport({ ratio: .98 });
  }
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('.air-scroll-story[data-story-mode="pinned"]')).toHaveCount(5);

  for (const selector of selectors) {
    const story = page.locator(selector), panels = story.locator(".air-story-panel"), links = story.locator(".air-story-controls a");
    const intro = story.locator(".air-story-intro"), viewingWindow = story.locator(".air-story-window"), stage = story.locator(".air-story-stage");
    const count = await panels.count();
    await expect(story).toHaveAttribute("data-story-mode", "pinned");
    const entry = await story.evaluate(element => {
      const first = element.querySelector(".air-story-panel")!.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      const count = element.querySelectorAll(".air-story-panel").length;
      return { top: scrollY + bounds.top, hold: (bounds.height - innerHeight - (count - 1) * first.height) / 2 };
    });
    await page.evaluate(top => window.scrollTo({ top, behavior: "instant" }), entry.top - 120);
    await page.mouse.move(900, 300);
    await page.mouse.wheel(0, Math.round(120 + entry.hold));
    await expect(story).toHaveAttribute("data-active-item", "0");
    await expect.poll(async () => Math.abs((await stage.boundingBox())!.y)).toBeLessThan(2);
    await expect(panels.first()).toBeInViewport({ ratio: .98 });
    const rail = (await intro.boundingBox())!, heading = (await intro.locator("h2").boundingBox())!, viewingArea = (await viewingWindow.boundingBox())!, firstCard = (await panels.first().boundingBox())!;
    expect(rail.y).toBeGreaterThanOrEqual(-1);
    expect(rail.y + rail.height).toBeLessThanOrEqual(601);
    expect(viewingArea.y).toBeGreaterThanOrEqual(-1);
    expect(viewingArea.y + viewingArea.height).toBeLessThanOrEqual(601);
    await page.mouse.move(viewingArea.x + viewingArea.width / 2, viewingArea.y + viewingArea.height / 2);
    const proof = selector === "#how-it-works" ? "agents" : selector === "#growth" ? "tides" : undefined;
    const fontSuffix = verifyBrandFonts ? "brand-fonts" : "fallback-fonts";
    if (proof) await page.screenshot({ path: "test-results/short600-" + proof + "-card1-" + fontSuffix + ".png" });
    // Native wheel input advances cards inside the same stationary composition.
    // Checking only chapter links would miss the owner's reported failure.
    const assertStationary = async () => {
      const currentWindow = (await viewingWindow.boundingBox())!;
      expect(Math.abs((await intro.boundingBox())!.y - rail.y)).toBeLessThan(2);
      expect(Math.abs((await intro.locator("h2").boundingBox())!.y - heading.y)).toBeLessThan(2);
      expect(Math.abs(currentWindow.y - viewingArea.y)).toBeLessThan(2);
      expect(Math.abs(currentWindow.height - viewingArea.height)).toBeLessThan(2);
      expect(Math.abs((await stage.boundingBox())!.y)).toBeLessThan(2);
    };
    for (let index = 1; index < count; index++) {
      for (let step = 1; step <= 4; step++) {
        const travelled = Math.round(firstCard.height * step / 4), previous = Math.round(firstCard.height * (step - 1) / 4);
        await page.mouse.wheel(0, travelled - previous);
        await expect.poll(async () => Math.abs((await panels.nth(index).boundingBox())!.y - (firstCard.y + firstCard.height - travelled))).toBeLessThan(2);
        await assertStationary();
      }
      await expect(story).toHaveAttribute("data-active-item", String(index));
      await expect(panels.nth(index)).toBeInViewport({ ratio: .98 });
      if (proof && index <= 2) await page.screenshot({ path: "test-results/short600-" + proof + "-card" + (index + 1) + "-" + fontSuffix + ".png" });
    }
    for (let index = count - 2; index >= 0; index--) {
      for (let step = 1; step <= 4; step++) {
        const travelled = Math.round(firstCard.height * step / 4), previous = Math.round(firstCard.height * (step - 1) / 4);
        await page.mouse.wheel(0, previous - travelled);
        await expect.poll(async () => Math.abs((await panels.nth(index).boundingBox())!.y - (firstCard.y - firstCard.height + travelled))).toBeLessThan(2);
        await assertStationary();
      }
      await expect(story).toHaveAttribute("data-active-item", String(index));
      await expect(panels.nth(index)).toBeInViewport({ ratio: .98 });
    }
    // Every chapter remains directly reachable with the keyboard and focus stays
    // on the chapter control rather than being lost during the scroll update.
    for (let index = 0; index < count; index++) {
      await links.nth(index).focus();
      await page.keyboard.press("Enter");
      await expect(links.nth(index)).toBeFocused();
      await expect(story).toHaveAttribute("data-active-item", String(index));
      await expect(panels.nth(index)).toBeInViewport({ ratio: .98 });
      expect(Math.abs((await intro.boundingBox())!.y - rail.y)).toBeLessThan(2);
      expect(Math.abs((await viewingWindow.boundingBox())!.y - viewingArea.y)).toBeLessThan(2);
    }
    const release = await story.evaluate(element => scrollY + element.getBoundingClientRect().bottom - innerHeight - scrollY);
    await page.mouse.wheel(0, Math.ceil(release) + 120);
    await expect.poll(async () => (await stage.boundingBox())!.y).toBeLessThan(-100);
  }

  // A short desktop browser still pins the composition when its compact layout
  // fits. A narrow, enlarged-text-sized viewport may use readable native flow.
  await page.setViewportSize({ width: 1366, height: 480 });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('.air-scroll-story[data-story-mode="pinned"]')).toHaveCount(5);
  for (const selector of selectors) {
    const story = page.locator(selector);
    await story.locator(".air-story-controls a").nth(1).click();
    const rail = (await story.locator(".air-story-intro").boundingBox())!, viewingArea = (await story.locator(".air-story-window").boundingBox())!;
    expect(rail.y).toBeGreaterThanOrEqual(-1);
    expect(rail.y + rail.height).toBeLessThanOrEqual(481);
    expect(viewingArea.y + viewingArea.height).toBeLessThanOrEqual(481);
    await page.mouse.wheel(0, 80);
    expect(Math.abs((await story.locator(".air-story-intro").boundingBox())!.y - rail.y)).toBeLessThan(2);
    expect(Math.abs((await story.locator(".air-story-window").boundingBox())!.y - viewingArea.y)).toBeLessThan(2);
  }
  await page.setViewportSize({ width: 1024, height: 480 });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  for (const selector of selectors) {
    const story = page.locator(selector), panels = story.locator(".air-story-panel"), links = story.locator(".air-story-controls a");
    await expect(story.locator('.air-story-panel[aria-hidden="true"], .air-story-panel[inert]')).toHaveCount(0);
    for (let index = 0; index < await panels.count(); index++) {
      await links.nth(index).click();
      await expect(story).toHaveAttribute("data-active-item", String(index));
      const heading = panels.nth(index).locator("h3,dt").first(), description = panels.nth(index).locator("p,dd").first();
      if (await story.getAttribute("data-story-mode") === "flow") await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeInViewport({ ratio: .99 });
      if (await story.getAttribute("data-story-mode") === "flow") await description.scrollIntoViewIfNeeded();
      await expect(description).toBeInViewport({ ratio: .99 });
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("signed-in navigation shows Continue and opens integrated Growth and Tides", async ({ page, isMobile }) => {
  const mutations: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  // Account responses and owned data reads are browser fixtures. Production's
  // real anonymous/guest-denial boundary is exercised separately above.
  await page.route("**/api/**", route => {
    const r = route.request(), pathname = new URL(r.url()).pathname;
    if (pathname === "/api/auth/session") return route.continue();
    if (pathname === "/api/auth/sign-in" && r.method() === "POST") return route.fulfill({ json: { authenticated: true, accessToken: "browser-fixture-account-token", expiresIn: 3600 } });
    if (r.method() !== "GET") { mutations.push(pathname); return route.abort(); }
    if (pathname === "/api/me") return route.fulfill({ json: { profile: { userId: "browser-fixture-learner", email: "learner@example.test", displayName: "Airs Learner", initials: "AL", complete: true }, schools: [], cohorts: [], platformPermissions: [], community: { canView: false, canInteract: false, canPublish: false, canModerate: false } } });
    if (pathname === "/api/air/access") return route.fulfill({ json: { tier: "FREE_PILOT", allowedActions: { UPLOAD: true, PLAN: true, PRACTISE: true, SPEECH: true }, limits: { uploadBytes: 10000000, uploadPolicy: "OBJECTIVE_COMPLETION" }, usage: { completionRequired: false }, upgradeAvailable: false } });
    if (pathname === "/api/study/upload-eligibility") return route.fulfill({ json: { canUpload: true, completionRequired: false } });
    if (pathname === "/api/study/conversations") return route.fulfill({ json: [] });
    if (pathname === "/api/study/context") return route.fulfill({ json: { context: { background: "", goals: "", audience: "", origin: "LEARNER_CONFIRMED", recordedAt: "" }, memory: null } });
    return route.fulfill({ json: {} });
  });
  await page.goto("/auth/sign-in?redirect=/home");
  await page.getByLabel("Email", { exact: true }).fill("learner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('.growth-home[data-growth-ready="true"]')).toBeVisible();
  await expect(page.locator(".capability-card")).toHaveCount(7);

  const assertHostedGrowthArtwork = async () => {
    await expect.poll(() => page.locator(".growth-ring .art-image").evaluateAll(images =>
      images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
    )).toBe(true);
    const geometry = await page.locator(".growth-ring").evaluateAll(rings => rings
      .filter(ring => ring.getBoundingClientRect().width > 0)
      .map(ring => {
        const art = ring.querySelector(".growth-ring-art")!, medallion = art.querySelector(".art-medallion")!, image = art.querySelector(".art-image")!;
        const a = ring.getBoundingClientRect(), b = art.getBoundingClientRect(), c = medallion.getBoundingClientRect(), d = image.getBoundingClientRect();
        const centerGap = (outer: DOMRect, inner: DOMRect) => Math.max(
          Math.abs(outer.x + outer.width / 2 - inner.x - inner.width / 2),
          Math.abs(outer.y + outer.height / 2 - inner.y - inner.height / 2),
        );
        return {
          label: ring.getAttribute("aria-label"), position: getComputedStyle(art).position,
          squares: [a, b, c, d].map(box => Math.abs(box.width - box.height)),
          centers: [centerGap(a, b), centerGap(b, c), centerGap(c, d)],
          widthRatio: b.width / a.width, heightRatio: b.height / a.height,
          fit: getComputedStyle(image).objectFit,
        };
      }));
    expect(geometry).toHaveLength(isMobile ? 7 : 8);
    for (const item of geometry) {
      expect(item.position, item.label || "Growth ring").toBe("absolute");
      for (const difference of [...item.squares, ...item.centers]) expect(difference).toBeLessThan(2);
      expect(item.widthRatio).toBeCloseTo(.8, 2);
      expect(item.heightRatio).toBeCloseTo(.8, 2);
      expect(item.fit).toBe("contain");
    }
  };
  await assertHostedGrowthArtwork();

  await expect(page.locator(".growth-home")).toContainText("You earn Tides as you progress.");
  await expect(page.locator(".growth-data-note")).toContainText("Example growth data");
  await expect(page.locator(".air-account")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a new session", exact: true })).toHaveAttribute("href", "/home/new");
  await expect(page.locator(".growth-example-tools")).not.toHaveAttribute("open");
  await page.getByText("Explore example progress", { exact: true }).click();
  await page.getByRole("button", { name: "Apply example session", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("72% → 84%");
  await page.getByRole("button", { name: "Back to growth", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Flowst Airs navigation" });
  for (const [name, route] of [["New session", "new"], ["Library", "library"], ["Settings", "settings"]]) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/home/" + route + "$"));
    if (route === "new") await expect(page.getByLabel("Share context about yourself", { exact: true })).toBeVisible();
    if (route === "library") await expect(page.locator(".air-library")).toBeVisible();
    if (route === "settings") await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    if (route === "new") await page.goBack();
    else await nav.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page.getByRole("button", { name: "Explore Clear Explanation", exact: true })).toContainText("84%");
  }
  // Navigate through the existing brand link, preserving the signed-in account.
  await page.getByRole("link", { name: "Flowst Airs home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".air-public-header").getByRole("link", { name: "Continue", exact: true })).toHaveAttribute("href", "/home");
  await expect(page.locator(".air-hero").getByRole("link", { name: "Continue", exact: true })).toBeVisible();
  await page.locator(".air-public-header").getByRole("link", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "Explore Clear Explanation", exact: true })).toContainText("84%");
  await assertHostedGrowthArtwork();
  expect((await page.context().cookies()).some(c => c.name === "airs_guest")).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(mutations).toEqual([]); expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/integrated-tides-" + (isMobile ? "mobile" : "desktop") + ".png", fullPage: true });
});
