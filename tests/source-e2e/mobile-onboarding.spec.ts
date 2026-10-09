import { expect, test, type Page } from '@playwright/test';

async function saveContext(page: Page) {
  await page.goto('/airs/new', { waitUntil: 'domcontentloaded' });
  const context = page.getByLabel('Share context about yourself', { exact: true });
  await expect(context).toBeVisible({ timeout: 90000 });
  await context.fill('Synthetic layout check. I want to explain ideas clearly.');
  await page.getByRole('button', { name: 'Save context', exact: true }).click();
  await expect(page.getByLabel('My understanding — you can edit it')).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.addInitScript(() => {
    (window as any).__micRequests = 0;
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      (window as any).__micRequests++;
      throw new DOMException('Fixture microphone must not start', 'NotAllowedError');
    } });
  });
});

test('Misu keeps context and link entry reachable when the mobile visual viewport shrinks and pans', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Exercises a mobile software-keyboard viewport');
  test.setTimeout(180000);
  // Browser emulation has no OS keyboard. Reproduce iOS geometry independently
  // of the unchanged layout viewport, including the pan above the keyboard.
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    (window as any).__keyboardViewport = (height: number, offsetTop = 0) => {
      Object.assign(viewport, { height, offsetTop });
      viewport.dispatchEvent(new Event('resize'));
      viewport.dispatchEvent(new Event('scroll'));
    };
  });
  const viewport = (height: number, offsetTop = 0) => page.evaluate(([h, top]) => (window as any).__keyboardViewport(h, top), [height, offsetTop]);
  const expectVisibleAboveKeyboard = async (label: string, height: number, top = 0) => {
    await expect.poll(async () => {
      const box = await page.getByLabel(label, { exact: true }).boundingBox();
      return !!box && box.y >= top && box.y + box.height <= top + height;
    }).toBe(true);
    await expect.poll(() => page.locator('.air-study-frame').evaluate(el => Math.round(el.getBoundingClientRect().height))).toBe(height);
  };
  await page.goto('/airs/new', { waitUntil: 'domcontentloaded' });
  const context = page.getByLabel('Share context about yourself', { exact: true });
  await expect(context).toBeVisible({ timeout: 90000 });
  await context.focus();
  await viewport(320);
  await expectVisibleAboveKeyboard('Share context about yourself', 320);
  await context.fill('Synthetic iPhone keyboard check. I want to explain ideas clearly.');
  // Tapping an action must not collapse the form before its click completes.
  await page.getByRole('button', { name: 'Save context', exact: true }).click();
  await expect(page.getByLabel('My understanding — you can edit it')).toBeVisible();
  await viewport(await page.evaluate(() => innerHeight));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Link or transcript', { exact: true }).check();
  const link = page.getByLabel('Public source link', { exact: true });
  await link.focus();
  await viewport(300, 48);
  await expectVisibleAboveKeyboard('Public source link', 300, 48);
  expect(await link.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await link.fill('https://example.com/learning-guide');
  await viewport(await page.evaluate(() => innerHeight));
  await expect(link).toHaveValue('https://example.com/learning-guide');
  await link.focus();
  await viewport(320);
  await expectVisibleAboveKeyboard('Public source link', 320);
  let submittedLink = '';
  await page.route('**/api/study/sources/inspect', async route => {
    const body = route.request().postDataJSON();
    submittedLink = body.url;
    const response = await route.fetch({ postData: JSON.stringify({ ...body, fixture: 'WEB' }) });
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Inspect source', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review included text', exact: true })).toBeVisible();
  expect(submittedLink).toBe('https://example.com/learning-guide');
  await viewport(await page.evaluate(() => innerHeight));
  await expect(page.locator('.air-study-frame')).not.toHaveClass(/is-keyboard-open/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => (window as any).__micRequests)).toBe(0);
});

test('voice setup errors remain separated from controls and scroll on short screens', async ({ page, isMobile }) => {
  test.setTimeout(180000);
  let speechRequests = 0;
  let liveStarts = 0;
  page.on('request', request => { if (request.method() === 'POST' && /\/live\/start/.test(request.url())) liveStarts++; });
  await page.route('**/api/study/conversations/*/speech', route => {
    speechRequests++;
    return route.fulfill({ status: 503, json: { statusMessage: 'Amina’s voice is not selected on this server. Your saved reply remains available.', data: { code: 'SPEECH_NOT_CONFIGURED', retryable: false } } });
  });
  await saveContext(page);
  await page.getByLabel('Link or transcript', { exact: true }).check();
  await page.getByRole('button', { name: 'Try web fixture', exact: true }).click();
  await page.getByRole('button', { name: 'Use this source', exact: true }).click();
  await page.getByRole('button', { name: 'Draft my plan', exact: true }).click();
  await page.getByRole('button', { name: 'Approve plan', exact: true }).click();
  await page.getByRole('button', { name: 'Start conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Audio unavailable', exact: true })).toBeVisible();
  await expect(page.locator('.call-detail')).toHaveCount(0);
  const requestsBeforeResize = speechRequests;
  const sizes = isMobile ? [{ width: 390, height: 664 }, { width: 667, height: 375 }] : [{ width: 1313, height: 600 }, { width: 900, height: 480 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await expect.poll(() => page.evaluate(() => {
      const state = document.querySelector('.call-state')!.getBoundingClientRect();
      const controls = document.querySelector('.call-control-area')!.getBoundingClientRect();
      return state.bottom <= controls.top;
    })).toBe(true);
    const retry = page.getByRole('button', { name: 'Retry after account update', exact: true });
    await retry.scrollIntoViewIfNeeded();
    const bounds = await retry.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(speechRequests).toBe(requestsBeforeResize);
  expect(liveStarts).toBe(0);
  expect(await page.evaluate(() => (window as any).__micRequests)).toBe(0);
  await page.getByRole('button', { name: 'Read saved reply', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Saved conversation', exact: true })).toBeVisible();
});
