import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("hosted Growth works without guest keys, cookies or backend requests", async ({ page, request, isMobile }) => {
  const apiRequests: string[] = [], errors: string[] = [];
  page.on("request", r => { if (new URL(r.url()).pathname.startsWith("/api/")) apiRequests.push(r.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  const response = await page.goto("/airs");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["set-cookie"]).toBeUndefined();
  await expect(page.locator('.growth-home[data-prototype-ready="true"]')).toBeVisible();
  await expect(page.locator(".capability-card")).toHaveCount(7);
  await expect(page.getByText("Prototype · Sample data", { exact: true })).toBeVisible();
  await expect(page.locator(".air-demo-label")).toHaveText("Demo");
  await page.getByRole("button", { name: "Explore Clear Explanation", exact: true }).click();
  const detail = isMobile ? page.getByRole("dialog") : page.locator(".desktop-detail");
  await expect(detail).toContainText("Evidence this cycle");
  if (isMobile) await page.getByRole("button", { name: "Back to growth dashboard" }).click();
  await page.getByRole("button", { name: "Preview a session update", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("72% → 84%");
  await page.getByRole("button", { name: "Back to growth", exact: true }).click();
  await page.getByRole("button", { name: "Preview cycle completion", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("5 cycles completed");
  await page.getByRole("button", { name: "Continue to the next cycle" }).click();
  const reasoning = page.getByRole("button", { name: "Explore Reasoning Aloud", exact: true });
  await expect(reasoning).toContainText("toward cycle 6");
  await page.locator(".recent-flowmarks").getByRole("button", { name: "View Reasoning Aloud cycle 5 sample Flowmark", exact: true }).click();
  await page.getByRole("button", { name: "Preview share card", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Nothing has been published or shared.");
  await page.keyboard.press("Escape");
  for (const name of ["New session", "Library", "Settings"]) {
    await page.getByRole("navigation", { name: "Flowst Airs navigation" }).getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(/\/airs\/demo-info$/);
    await expect(page.getByRole("heading", { name: "Explore your growth" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Growth", exact: true }).click();
    await expect(page.getByRole("button", { name: "Explore Clear Explanation", exact: true })).toContainText("84%");
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const [path, method] of [["/api/auth/session", "GET"], ["/api/study/context", "GET"], ["/api/study/conversations", "POST"], ["/api/study/llm/v1/chat/completions", "POST"]]) {
    const denied = await request.fetch(path!, { method });
    expect(denied.status()).toBe(503);
    expect(await denied.text()).toContain("GROWTH_SAMPLE_PREVIEW");
  }
  expect(await page.context().cookies()).toEqual([]);
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `test-results/hosted-growth-${isMobile ? "mobile" : "desktop"}.png`, fullPage: true });
});
