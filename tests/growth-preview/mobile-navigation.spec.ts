import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("public navigation keeps desktop links and offers a dismissible mobile menu", async ({ page, isMobile }) => {
  const errors: string[] = [], mutations: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/") && request.method() !== "GET") mutations.push(request.url());
  });
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const header = page.locator(".air-public-header");
  expect((await header.boundingBox())!.y).toBeLessThanOrEqual(20);
  const navigation = header.getByRole("navigation", { name: "Flowst Airs public navigation", includeHidden: true });
  const trigger = header.getByRole("button", { name: "Open menu", exact: true, includeHidden: true });
  await expect(header.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/auth/sign-in?redirect=/home");
  if (!isMobile) {
    await expect(trigger).toBeHidden();
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole("link")).toHaveCount(4);
    expect(errors).toEqual([]);
    expect(mutations).toEqual([]);
    return;
  }

  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-controls", await navigation.getAttribute("id") as string);
  await trigger.focus();
  await page.keyboard.press("Enter");
  const close = header.getByRole("button", { name: "Close menu", exact: true });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "How it works", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(trigger).toBeFocused();

  // Hit the changing SVG itself: its original event target is detached during
  // Vue's update, but that opening gesture must not become an outside click.
  await trigger.locator("svg").tap();
  await expect(navigation).toBeVisible();
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await close.locator("svg").tap();
  await expect(navigation).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.locator("svg").click();
  await expect(navigation).toBeVisible();
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await page.mouse.click(8, 180);
  await expect(navigation).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  const heroAction = page.locator(".landing-hero .air-button").first();
  await heroAction.focus();
  await expect(navigation).toBeHidden();
  await expect(heroAction).toBeFocused();
  for (const [label, hash] of [["How it works", "how-it-works"], ["Who it’s for", "for-you"], ["Tides", "growth"], ["FAQ", "faq"], ["FAQ", "faq"]]) {
    await trigger.click();
    await navigation.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp("#" + hash + "$"));
    await expect(navigation).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    await expect.poll(() => page.locator("#" + hash).evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(5);
  }

  for (const width of [320, 393, 768]) {
    await page.setViewportSize({ width, height: 851 });
    await trigger.click();
    await expect(navigation).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include(".air-public-header").analyze()).violations).toEqual([]);
    if (width === 393) await page.screenshot({ path: "test-results/mobile-navigation-open.png" });
    await close.click();
    await expect(trigger).toBeFocused();
  }
  await trigger.click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(trigger).toBeHidden();
  await expect(navigation).toBeVisible();
  await page.setViewportSize({ width: 393, height: 851 });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).toBeHidden();
  await expect(trigger).toBeFocused();
  // Closing the menu must not strand focus when the responsive controls change.
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(trigger).toBeHidden();
  await expect(navigation.getByRole("link", { name: "How it works", exact: true })).toBeFocused();
  await page.setViewportSize({ width: 393, height: 851 });
  await expect(navigation).toBeHidden();
  await expect(trigger).toBeFocused();
  await header.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=\/home$/);
  await expect(page.getByRole("heading", { name: "Sign in to Flowst Airs", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(mutations).toEqual([]);
});

test("verification Back and account links preserve the requested Home destination", async ({ page }) => {
  const mutations: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/") && request.method() !== "GET") mutations.push(request.url());
  });
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  const destination = "/home/new?source=returning#review";
  await page.goto("/auth/verify?redirect=" + encodeURIComponent(destination));
  await page.getByRole("link", { name: "Back", exact: true }).click();
  expect(new URL(page.url()).pathname).toBe("/auth/register");
  expect(new URL(page.url()).searchParams.get("redirect")).toBe(destination);
  await page.getByRole("link", { name: "I already have an account", exact: true }).click();
  expect(new URL(page.url()).pathname).toBe("/auth/sign-in");
  expect(new URL(page.url()).searchParams.get("redirect")).toBe(destination);
  expect(mutations).toEqual([]);
});
