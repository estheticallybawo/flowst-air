import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("production visitors sign in, including browsers with an old guest cookie", async ({ page, request, isMobile }) => {
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.context().addCookies([{ name: "airs_guest", value: "previous-guest-session", url: "http://127.0.0.1:4324" }]);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect((await response!.allHeaders())["cache-control"]).toBe("private, no-store");
  expect((await response!.allHeaders())["set-cookie"] || "").not.toContain("airs_guest=");
  await expect(page.getByRole("heading", { name: "Make what you learn your own.", exact: true })).toBeVisible();
  await expect(page.locator("#for-you")).toContainText("Independent learners");
  await expect(page.locator("#for-you")).toContainText("Recent graduates");
  await expect(page.locator("#for-you")).toContainText("People building with AI");
  await expect(page.locator(".landing-features > article")).toHaveCount(3);
  await expect(page.locator(".landing-session-step")).toHaveCount(6);
  await expect(page.locator(".landing-tide-card")).toHaveCount(7);
  await expect(page.locator(".landing-tide-card h3")).toHaveText(["Clear Explanation", "Verbal Retrieval", "Conceptual Precision", "Reasoning Aloud", "Self-Monitoring", "Transfer", "Conversation Flow"]);
  await expect(page.locator(".landing-growth")).toContainText("You earn Tides as you progress.");
  await expect(page.locator(".landing-growth")).not.toContainText(/example|in development|coming soon/i);
  await expect(page.locator(".landing-expectation-list > div")).toHaveCount(4);
  await expect(page.locator(".landing-start .air-button")).toHaveAttribute("href", "/auth/sign-in?redirect=/airs/new");

  // Scroll through every group in both directions. Only the current panel is
  // visible/exposed; keyboard controls switch immediately and keep focus.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForLoadState("networkidle");
  const stories = page.locator(".air-scroll-story");
  await expect(stories).toHaveCount(5);
  for (const selector of ["#how-it-works", "#for-you", "#session-journey", "#growth", ".landing-expectations"]) {
    const story = page.locator(selector);
    await expect(story).toHaveAttribute("data-story-mode", "sequential");
    const panels = story.locator(".air-story-panel"), count = await panels.count();
    const bounds = await story.evaluate(element => ({ start: scrollY + element.getBoundingClientRect().top, distance: element.getBoundingClientRect().height - innerHeight }));
    for (let index = 0; index < count; index++) {
      await page.evaluate(({top}) => window.scrollTo({ top, behavior: "instant" }), {top: bounds.start + bounds.distance * (index + .25) / count});
      try { await expect(story).toHaveAttribute("data-active-item", String(index)); } catch (error) {
        console.log("Scroll geometry", JSON.stringify(await story.evaluate(element => ({id:element.id,scroll:scrollY,top:element.getBoundingClientRect().top,height:element.getBoundingClientRect().height,stage:element.querySelector(".air-story-stage")!.getBoundingClientRect().toJSON()})))); throw error;
      }
      await expect(story.locator('.air-story-panel:not([aria-hidden="true"])')).toHaveCount(1);
      await expect(panels.nth(index)).toBeVisible();
      await expect.poll(() => panels.nth(index).evaluate(element => element.getBoundingClientRect().top >= -.5 && element.getBoundingClientRect().bottom <= innerHeight + .5)).toBe(true);
      for (let other = 0; other < count; other++) if (other !== index) {
        await expect(panels.nth(other)).toBeHidden();
        await expect(panels.nth(other)).toHaveAttribute("inert", "");
      }
    }
    await page.evaluate(({top}) => window.scrollTo({ top, behavior: "instant" }), {top: bounds.start});
    await expect(story).toHaveAttribute("data-active-item", "0");
    const next = story.getByRole("button", {name:/^Next /});
    await next.focus(); await page.keyboard.press("Enter");
    await expect(story).toHaveAttribute("data-active-item", "1");
    await expect(next).toBeFocused();
    expect(await panels.nth(1).evaluate(element => getComputedStyle(element).opacity)).toBe("1");
    if (selector === "#growth" || selector === "#how-it-works") await page.screenshot({path:"test-results/scroll-" + (selector === "#growth" ? "tides" : "agents") + "-" + (isMobile ? "mobile" : "desktop") + ".png"});
    expect((await new AxeBuilder({ page }).include(selector).analyze()).violations).toEqual([]);
  }
  // Hash deep links survive hydration, not just navigation after mounting.
  await page.goto("/#growth");
  await expect(page.locator("#growth")).toHaveAttribute("data-story-mode", "sequential");
  await expect.poll(() => page.locator("#growth .air-story-stage").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(5);
  // Short/zoomed screens and reduced motion get the complete natural layout.
  const motionViewport = page.viewportSize()!;
  await page.setViewportSize({width: motionViewport.width, height: 600});
  await expect(page.locator('.air-scroll-story[data-story-mode="sequential"]')).toHaveCount(0);
  await expect(page.locator('.air-story-panel[aria-hidden="true"]')).toHaveCount(0);
  await page.setViewportSize(motionViewport);
  // In-page navigation must reach its section, including same-route hash changes.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".air-story-sequential")).toHaveCount(0);
  await expect(page.locator('.air-story-panel[aria-hidden="true"]')).toHaveCount(0);
  await page.locator(".air-public-header").getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect.poll(() => page.locator("#how-it-works").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(5);
  await expect(page.locator("#how-it-works").getByRole("heading", { name: "How it works", exact: true })).toBeVisible();
  await expect(page.locator(".landing-features h3")).toContainText(["Plan with Misu", "Practise with Amina", "Reflect with Kai"]);
  await page.locator("#how-it-works").screenshot({ path: "test-results/how-it-works-" + (isMobile ? "mobile" : "desktop") + ".png" });
  await page.getByRole("link", { name: "See your session step by step", exact: true }).click();
  await expect(page).toHaveURL(/#session-journey$/);
  await expect.poll(() => page.locator("#session-journey").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(5);
  await page.locator(".air-public-header").getByRole("link", { name: "Tides", exact: true }).click();
  await expect(page).toHaveURL(/#growth$/);
  await expect.poll(() => page.locator(".landing-tide-card img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect.poll(() => page.locator("#growth").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(5);
  await page.locator("#growth").screenshot({ path: "test-results/tides-gallery-" + (isMobile ? "mobile" : "desktop") + ".png" });
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
  await expect(header.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/auth/sign-in?redirect=/airs");
  await expect(page.getByRole("link", { name: /Open.*study space/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Continue", exact: true })).toHaveCount(0);
  await header.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=\/airs$/);
  await expect(page.getByRole("heading", { name: "Sign in to Flowst Airs", exact: true })).toBeVisible();
  await expect(page.locator(".air-story-sequential")).toHaveCount(0);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/production-sign-in-" + (isMobile ? "mobile" : "desktop") + ".png", fullPage: true });
  for (const target of ["/airs", "/airs/new?source=returning", "/airs/library", "/airs/settings"]) {
    const protectedPage = await request.get(target, { maxRedirects: 0 });
    expect(protectedPage.status()).toBe(302);
    const destination = new URL(protectedPage.headers().location!, "http://127.0.0.1:4324");
    expect(destination.pathname).toBe("/auth/sign-in");
    expect(destination.searchParams.get("redirect")).toBe(target);
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
  await page.goto("/auth/sign-in?redirect=/airs");
  await page.getByLabel("Email", { exact: true }).fill("learner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/airs$/);
  await expect(page.locator('.growth-home[data-growth-ready="true"]')).toBeVisible();
  await expect(page.locator(".capability-card")).toHaveCount(7);
  await expect(page.locator(".growth-home")).toContainText("You earn Tides as you progress.");
  await expect(page.locator(".growth-data-note")).toContainText("Example growth data");
  await expect(page.locator(".air-account")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a new session", exact: true })).toHaveAttribute("href", "/airs/new");
  await expect(page.locator(".growth-example-tools")).not.toHaveAttribute("open");
  await page.getByText("Explore example progress", { exact: true }).click();
  await page.getByRole("button", { name: "Apply example session", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("72% → 84%");
  await page.getByRole("button", { name: "Back to growth", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Flowst Airs navigation" });
  for (const [name, route] of [["New session", "new"], ["Library", "library"], ["Settings", "settings"]]) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/airs/" + route + "$"));
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
  await expect(page.locator(".air-public-header").getByRole("link", { name: "Continue", exact: true })).toHaveAttribute("href", "/airs");
  await expect(page.locator(".air-hero").getByRole("link", { name: "Continue", exact: true })).toBeVisible();
  await page.locator(".air-public-header").getByRole("link", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "Explore Clear Explanation", exact: true })).toContainText("84%");
  expect((await page.context().cookies()).some(c => c.name === "airs_guest")).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(mutations).toEqual([]); expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/integrated-tides-" + (isMobile ? "mobile" : "desktop") + ".png", fullPage: true });
});
