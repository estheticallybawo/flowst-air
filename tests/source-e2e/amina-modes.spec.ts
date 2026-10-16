import { expect, test, type Page } from '@playwright/test'
import { DEFAULT_AGENT_PRESENTATION, normalizeAgentPresentation } from '../../shared/agentPresentation'

async function waitForModeHydration(page: Page) {
  await page.waitForFunction(() => Boolean((document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null)?.__vue_app__), undefined, { timeout: 60_000 })
}

test.beforeEach(async ({ page }) => {
  await page.context().route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.addInitScript(() => {
    Object.assign(window, { __modeDemoDeviceRequests: 0 })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => {
        const runtime = window as unknown as { __modeDemoDeviceRequests: number }
        runtime.__modeDemoDeviceRequests += 1
        throw new Error('A mode demonstration must not request device access')
      } },
    })
  })
  const session = await page.request.post('/api/auth/dev-session', { data: { scenario: 'member' } })
  expect(session.ok()).toBe(true)
  await page.route('**/api/study/presentation', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { presentation: normalizeAgentPresentation(DEFAULT_AGENT_PRESENTATION), revision: 'mode-test-team' } })
    : route.abort('blockedbyclient'))
})

test('all four settings remain usable without media access or study-provider requests', async ({ page }) => {
  const providerRequests: string[] = []
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('request', request => {
    if ((/\/api\/study\//.test(request.url()) && new URL(request.url()).pathname !== '/api/study/presentation') || /agora\.io|lemonslice\.com|api\.elevenlabs\.io/.test(request.url())) providerRequests.push(request.url())
  })
  await page.goto('/home/modes', { waitUntil: 'domcontentloaded' })
  await waitForModeHydration(page)
  const main = page.locator('.amina-modes')
  await expect(main).toBeVisible({ timeout: 60_000 })
  await expect(main).toHaveAttribute('data-mode', 'interview')
  await expect(page.getByText('Simulated call · no devices connected')).toBeVisible()
  await expect(page.getByText('More companions on the horizon')).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Study session roles' }).getByRole('listitem')).toHaveCount(3)
  expect(await main.locator('h1').evaluate(element => getComputedStyle(element).fontFamily)).toContain('Unbounded')
  expect(await main.evaluate(element => getComputedStyle(element).fontFamily)).toContain('Albert Sans')
  const modeNavigation = page.getByRole('navigation', { name: 'Demonstration modes' })
  for (const [index, modeId] of ['study', 'interview', 'conversation', 'language'].entries()) {
    await modeNavigation.getByRole('button').nth(index).click()
    await expect(main).toHaveAttribute('data-mode', modeId)
    await expect(modeNavigation.getByRole('button').nth(index)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.room-caption')).toContainText('sample prompt')
    await expect(page.locator('.room-caption > p').first()).not.toBeEmpty()
    const illustration = page.locator('.mode-room .amina-demo-avatar')
    await expect(illustration).toBeVisible()
    await expect(illustration).toHaveAttribute('data-framing', 'half-body')
    await expect(illustration).toHaveAttribute('data-ready', 'true')
    await expect(illustration.locator('.companion-motion')).toHaveCount(0)
    expect(await illustration.locator('.amina-demo-avatar__sprite').evaluate(element => getComputedStyle(element).backgroundImage)).toContain('amina-expression-atlas-v1.png')
    const artwork = await illustration.locator('.amina-demo-avatar__artwork').boundingBox()
    expect(artwork!.width / artwork!.height).toBeCloseTo(2 / 3, 2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(modeId + '.png'), fullPage: true })
  }
  await page.getByRole('button', { name: 'Hide English translation', exact: true }).click()
  await expect(page.locator('.caption-translation')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show English translation', exact: true }).click()
  await expect(page.locator('.caption-translation')).toBeVisible()
  await page.clock.install()
  await page.getByRole('button', { name: 'Play sample', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause preview', exact: true })).toBeVisible()
  await expect.poll(() => page.locator('.room-controls audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0)
  await page.clock.runFor(1200)
  await expect(page.locator('.sample-clock')).not.toContainText('00:00')
  await page.getByRole('button', { name: 'Pause preview', exact: true }).click()
  const pausedClock = await page.locator('.sample-clock').innerText()
  await page.clock.runFor(12_000)
  await expect(page.locator('.sample-clock')).toHaveText(pausedClock)
  await expect(page.locator('.preview-runtime-status')).toContainText('Ready to preview')
  await page.getByRole('button', { name: 'Play sample', exact: true }).click()
  await modeNavigation.getByRole('button').nth(1).click()
  await expect(page.getByRole('button', { name: 'Play sample', exact: true })).toBeVisible()
  await expect(page.locator('.sample-clock')).toContainText('00:00')
  await page.clock.runFor(30_000)
  await expect(page.locator('.sample-clock')).toContainText('00:00')
  await page.getByRole('button', { name: 'See a sample reflection', exact: true }).click()
  await expect(page.locator('#sample-feedback')).toContainText('not your performance')
  expect(providerRequests).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { __modeDemoDeviceRequests: number }).__modeDemoDeviceRequests)).toBe(0)
  expect(runtimeErrors).toEqual([])
})

test('animation exploration respects reduced motion and omits developer setup controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const uploads: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') uploads.push(request.url()) })
  await page.goto('/home/modes?mode=interview', { waitUntil: 'domcontentloaded' })
  await waitForModeHydration(page)
  await page.locator('.experience-disclosures').getByRole('button', { name: 'Animation experience', exact: true }).click()
  const lab = page.locator('#amina-animation-lab')
  await expect(lab).toBeVisible()
  await expect(lab).toContainText('Animated expression sample · simulated speech')
  await lab.getByRole('button', { name: 'thinking', exact: true }).click()
  await expect(lab.getByRole('button', { name: 'thinking', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(lab.locator('.amina-demo-avatar')).toHaveAttribute('data-state', 'thinking')
  const avatar = lab.locator('.amina-demo-avatar')
  await expect(avatar).toHaveAttribute('data-framing', 'half-body')
  await expect(avatar).toHaveAttribute('data-ready', 'true')
  const reduced = await avatar.locator('.amina-demo-avatar__artwork, .amina-demo-avatar__character').evaluateAll(elements => elements.every(element => {
    const style = getComputedStyle(element)
    return style.animationName === 'none' || style.animationPlayState.split(',').every(state => state.trim() === 'paused')
  }))
  expect(reduced).toBe(true)
  await lab.getByRole('checkbox', { name: /Animate the illustration/ }).uncheck()
  await expect(lab.locator('.amina-demo-avatar')).toHaveAttribute('data-active', 'false')
  await expect(lab.locator('input[type="file"]')).toHaveCount(0)
  await expect(lab.locator('video')).toHaveCount(0)
  await expect(lab.locator('.lab-next-step, .lab-provider-trial, .lab-video-trial')).toHaveCount(0)
  await expect(lab).not.toContainText(/agora|lemonslice|credentials|integration guide/i)
  await expect(lab.locator('.amina-demo-avatar__artwork')).toBeVisible()
  expect(uploads.filter(url => !url.includes('/api/auth/') && !url.includes('/_nuxt/'))).toEqual([])
})
