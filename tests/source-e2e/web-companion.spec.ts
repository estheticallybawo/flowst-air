import { expect, test, type Locator, type Page } from '@playwright/test'
import { DEFAULT_AGENT_PRESENTATION } from '../../shared/agentPresentation'
import { getWebCompanionInvitation, getWebCompanionTopic, WEB_COMPANION_TOPICS } from '../../shared/webCompanionDemo'

interface CompanionRuntime {
  __homeCompanionDevices: { microphone: number; screen: number }
  __homeCompanionStorage: string[]
}

interface CompanionEffects {
  mutations: string[]
  providers: string[]
  external: string[]
  unexpectedReads: string[]
  errors: string[]
}

const effects = new WeakMap<Page, CompanionEffects>()
const providerPattern = /(?:agora\.(?:io|cn|api)|lemonslice\.(?:com|ai)|api\.openai\.com|api\.elevenlabs\.io|api\.groq\.com|api\.deepgram\.com|api\.minimax\.io|bedrock-runtime\.[^/]+\.amazonaws\.com)/i
const normalReads = new Set(['/api/auth/session', '/api/me', '/api/study/presentation'])
test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.addInitScript(() => {
    const runtime = window as unknown as CompanionRuntime
    runtime.__homeCompanionDevices = { microphone: 0, screen: 0 }
    runtime.__homeCompanionStorage = []
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => { runtime.__homeCompanionDevices.microphone += 1; throw new Error('Home companion must not use the microphone') },
        getDisplayMedia: async () => { runtime.__homeCompanionDevices.screen += 1; throw new Error('Home companion must not share a screen') },
      },
    })
    for (const method of ['setItem', 'removeItem', 'clear'] as const) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value: function (this: Storage) { runtime.__homeCompanionStorage.push(`${this === localStorage ? 'local' : 'session'}:${method}`) },
      })
    }
    if (window.indexedDB) Object.defineProperty(window.indexedDB, 'open', { configurable: true, value: () => {
      runtime.__homeCompanionStorage.push('indexedDB:open')
      throw new Error('Home companion must not open persistent storage')
    } })
  })
  const session = await page.request.post('/api/auth/dev-session', { data: { scenario: 'member' } })
  expect(session.ok()).toBe(true)
  const observed: CompanionEffects = { mutations: [], providers: [], external: [], unexpectedReads: [], errors: [] }
  effects.set(page, observed)
  page.on('pageerror', error => observed.errors.push(error.message))
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) observed.mutations.push(url.pathname)
    if (providerPattern.test(request.url())) observed.providers.push(url.origin + url.pathname)
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:4322' && url.origin !== 'https://fonts.googleapis.com') observed.external.push(url.origin + url.pathname)
    if (url.pathname.startsWith('/api/') && request.method() === 'GET' && !normalReads.has(url.pathname)) observed.unexpectedReads.push(url.pathname)
  })
  await page.route(providerPattern, route => route.abort('blockedbyclient'))
  await page.route('**/api/**', route => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || !normalReads.has(pathname)) return route.abort('blockedbyclient')
    if (pathname === '/api/study/presentation') return route.fulfill({ json: { presentation: DEFAULT_AGENT_PRESENTATION, revision: 'home-companion-test' } })
    return route.continue()
  })
  await page.route(/^https?:\/\//, route => {
    const url = new URL(route.request().url())
    return url.origin === 'http://127.0.0.1:4322' || url.origin === 'https://fonts.googleapis.com' ? route.fallback() : route.abort('blockedbyclient')
  })
})

test.afterEach(async ({ page }) => {
  const observed = effects.get(page)!
  expect(observed.mutations, 'Home companion must not save or create study records').toEqual([])
  expect(observed.providers, 'Home companion must not contact external AI or voice providers').toEqual([])
  expect(observed.external, 'Home companion must not fetch external websites or assets').toEqual([])
  expect(observed.unexpectedReads, 'Only existing authentication and portrait preference reads are permitted').toEqual([])
  expect(observed.errors).toEqual([])
  await expectLocalSafety(page)
})

async function expectLocalSafety(page: Page) {
  expect(await page.evaluate(() => (window as unknown as CompanionRuntime).__homeCompanionDevices)).toEqual({ microphone: 0, screen: 0 })
  expect(await page.evaluate(() => (window as unknown as CompanionRuntime).__homeCompanionStorage)).toEqual([])
}

async function hydrated(page: Page) {
  await page.waitForFunction(() => Boolean((document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null)?.__vue_app__), undefined, { timeout: 60_000 })
}

async function enableOnHome(page: Page) {
  await page.goto('/home/companion', { waitUntil: 'domcontentloaded' })
  await hydrated(page)
  const enable = page.getByRole('checkbox', { name: 'Enable companion demo', exact: true })
  await expect(enable).toBeEnabled()
  await enable.check()
  await page.getByText('Go to Home', { exact: true }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.locator('.growth-home')).toHaveAttribute('data-growth-ready', 'true')
  const widget = page.getByTestId('web-companion')
  await expect(widget).toHaveAttribute('data-stage', 'invite')
  await expect(widget).toHaveAttribute('data-agent', 'MIRO')
  await expect(widget).toHaveAttribute('data-topic', 'explanation')
  expect(await widget.evaluate(element => getComputedStyle(element).position)).toBe('fixed')
  const head = widget.locator('.web-companion__head')
  await expect(head.locator('.companion-motion')).toHaveAttribute('data-ready', 'true')
  const faceBounds = await head.boundingBox()
  expect(faceBounds!.width).toBeGreaterThanOrEqual(80)
  expect(faceBounds!.width).toBeLessThanOrEqual(96)
  expect(await head.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('0px')
  await expect(widget.getByRole('link', { name: 'Start a study session', exact: true })).toHaveAttribute('href', '/home/new?mode=study')
  await expect(widget.getByRole('button', { name: 'Companion options', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(widget.getByRole('checkbox', { name: 'Animate companion', exact: true })).toBeHidden()
  return widget
}

async function options(widget: Locator, open: boolean) {
  const button = widget.getByRole('button', { name: 'Companion options', exact: true })
  if (await button.getAttribute('aria-expanded') !== String(open)) await button.click()
  await expect(button).toHaveAttribute('aria-expanded', String(open))
  await expect(widget).toHaveAttribute('data-options-open', String(open))
}

async function selectCapability(page: Page, widget: Locator, topicId: string) {
  const topic = getWebCompanionTopic(topicId)
  const card = page.getByRole('button', { name: `Explore ${topic.title}`, exact: true })
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  await expect(widget).toHaveAttribute('data-topic', topic.id)
  if (page.viewportSize()!.width < 900) {
    const dialog = page.getByRole('dialog', { name: topic.title, exact: true })
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
    await dialog.getByRole('button', { name: 'Back to growth dashboard', exact: true }).click()
    await expect(dialog).not.toBeVisible()
  }
  await expect(card).toBeFocused()
}

async function navigate(page: Page, label: string) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('navigation', { name: 'Flowst Airs navigation', exact: true }).getByRole('link', { name: label, exact: true }).click()
}

async function visibleFrame(avatar: Locator) {
  return avatar.evaluate(root => ({
    frame: Array.from(root.querySelectorAll<HTMLElement>('.companion-motion__frame')).filter(frame => Number(getComputedStyle(frame).opacity) > .5).map(frame => frame.dataset.frame),
    name: getComputedStyle(root).animationName,
    state: getComputedStyle(root).animationPlayState,
  }))
}

async function reachWithWheel(page: Page, widget: Locator, control: Locator) {
  const height = page.viewportSize()!.height
  for (let step = 0; step < 16; step += 1) {
    const bounds = await control.boundingBox()
    const widgetBounds = await widget.boundingBox()
    const top = Math.max(0, widgetBounds?.y ?? 0)
    const bottom = Math.min(height, widgetBounds ? widgetBounds.y + widgetBounds.height : height)
    if (bounds && bounds.y >= top && bounds.y + bounds.height <= bottom) break
    await page.mouse.move(widgetBounds ? widgetBounds.x + widgetBounds.width / 2 : 100, Math.max(30, Math.min(height - 30, (top + bottom) / 2)))
    await page.mouse.wheel(0, bounds && bounds.y < top ? -250 : 250)
    await page.waitForTimeout(50)
  }
  await expect(control).toBeInViewport()
}

test('enable is explicit and the launcher leads to the actual protected Home rather than a mock site', async ({ page }) => {
  await page.goto('/home?companion=1', { waitUntil: 'domcontentloaded' })
  await hydrated(page)
  await expect(page.getByRole('heading', { name: 'The reward is in seeing your growth', exact: true })).toBeVisible()
  await expect(page.getByTestId('web-companion')).toHaveCount(0)
  await expectLocalSafety(page)
  await page.goto('/home/companion?enabled=1', { waitUntil: 'domcontentloaded' })
  await hydrated(page)
  const enable = page.getByRole('checkbox', { name: 'Enable companion demo', exact: true })
  await expect(enable).not.toBeChecked()
  await expect(page.getByText('Go to Home', { exact: true })).toBeDisabled()
  await enable.check()
  await expect(page.getByText('Go to Home', { exact: true })).toBeEnabled()
  await page.getByText('Go to Home', { exact: true }).click()
  await expect(page).toHaveURL(/\/home$/)
  const widget = page.getByTestId('web-companion')
  await expect(widget).toHaveAttribute('data-stage', 'invite')
  for (const topic of WEB_COMPANION_TOPICS) await expect(page.getByRole('button', { name: `Explore ${topic.title}`, exact: true })).toHaveCount(1)
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(widget.getByRole('link', { name: 'Start a study session', exact: true })).toHaveAttribute('href', '/home/new?mode=study')
  await options(widget, true)
  await widget.getByRole('button', { name: 'Turn off companion', exact: true }).click()
  await expect(widget).toHaveCount(0)
  await expect(page.locator('#main-content')).toBeFocused()
  const card = page.getByRole('button', { name: 'Explore Reasoning Aloud', exact: true })
  await card.focus()
  await page.keyboard.press('Enter')
  if (page.viewportSize()!.width < 900) await page.getByRole('dialog', { name: 'Reasoning Aloud', exact: true }).getByRole('button', { name: 'Back to growth dashboard', exact: true }).click()
  await expect(widget).toHaveCount(0)
})

test('Misu approval gates Amina practice and optional Kai reflection uses only the scripted answer', async ({ page }) => {
  const widget = await enableOnHome(page)
  await page.screenshot({ path: test.info().outputPath('home-companion-first-invite.png'), fullPage: true })
  await page.screenshot({ path: test.info().outputPath('home-companion-desktop-dock.png') })
  await widget.screenshot({ path: test.info().outputPath('home-companion-banner.png') })
  for (const [name, agentId] of [['Misu', 'MIRO'], ['Amina', 'AMIRA'], ['Kai', 'KAI']] as const) {
    await widget.getByRole('button', { name: `Invite with ${name}`, exact: true }).click()
    await expect(widget).toHaveAttribute('data-agent', agentId)
    await expect(widget).toHaveAttribute('data-stage', 'invite')
    await expect(widget.locator('.web-companion__head .companion-motion')).toHaveAttribute('data-ready', 'true')
    await expect(widget).toContainText(getWebCompanionInvitation(getWebCompanionTopic('explanation'), agentId))
    await expect(widget.getByRole('button', { name: 'Approve sample plan', exact: true })).toHaveCount(0)
    await expect(widget.getByRole('button', { name: 'Show sample reflection', exact: true })).toHaveCount(0)
    await widget.screenshot({ path: test.info().outputPath(`home-companion-${name.toLowerCase()}-invite.png`) })
  }
  const topic = getWebCompanionTopic('retrieval')
  await selectCapability(page, widget, topic.id)
  await expect(widget).toHaveAttribute('data-agent', 'KAI')
  await expect(widget).toContainText(getWebCompanionInvitation(topic, 'KAI'))
  await expect(widget.getByLabel('Companion topic', { exact: true })).toHaveCount(0)
  await options(widget, true)
  await widget.getByText('What this preview uses', { exact: true }).click()
  await expect(widget.getByText(topic.context, { exact: true })).toBeVisible()
  await options(widget, false)
  await expect(widget.getByRole('button', { name: 'Approve sample plan', exact: true })).toHaveCount(0)
  await expect(widget.getByRole('button', { name: 'Show sample answer', exact: true })).toHaveCount(0)
  await expect(widget.getByRole('button', { name: 'Show sample reflection', exact: true })).toHaveCount(0)
  await expect(widget.locator('textarea, input[type=text]')).toHaveCount(0)
  await widget.getByRole('button', { name: 'Preview a sample', exact: true }).click()
  await expect(widget).toHaveAttribute('data-stage', 'plan')
  await expect(widget.getByRole('heading')).toBeFocused()
  await expect(widget).toHaveAttribute('data-agent', 'MIRO')
  for (const objective of topic.objectives) await expect(widget).toContainText(objective)
  await reachWithWheel(page, widget.locator('.web-companion__body'), widget.getByRole('button', { name: 'Approve sample plan', exact: true }))
  await page.screenshot({ path: test.info().outputPath('home-companion-plan.png'), fullPage: true })
  await widget.getByRole('button', { name: 'Approve sample plan', exact: true }).click()
  await expect(widget).toHaveAttribute('data-stage', 'practice')
  await expect(widget.getByRole('heading')).toBeFocused()
  await expect(widget).toHaveAttribute('data-agent', 'AMIRA')
  await expect(widget).toContainText(topic.prompt)
  await expect(widget).not.toContainText(topic.sampleAnswer)
  await expect(widget.getByRole('button', { name: 'Show sample reflection', exact: true })).toHaveCount(0)
  await widget.getByRole('button', { name: 'Show sample answer', exact: true }).click()
  await expect(widget).toHaveAttribute('data-stage', 'answer')
  await expect(widget.getByRole('heading')).toBeFocused()
  await expect(widget).toHaveAttribute('data-agent', 'KAI')
  await expect(widget).toContainText(topic.sampleAnswer)
  await expect(widget).not.toContainText(topic.reflection.observation)
  await widget.getByRole('button', { name: 'Show sample reflection', exact: true }).click()
  await expect(widget).toHaveAttribute('data-stage', 'reflection')
  await expect(widget.getByRole('heading')).toBeFocused()
  for (const text of Object.values(topic.reflection)) await expect(widget).toContainText(text)
  await expect(widget).toContainText(/sample|scripted/i)
  await expect(widget).not.toContainText(/you (?:mastered|improved)|your IQ|your intelligence score/i)
  await page.screenshot({ path: test.info().outputPath('home-companion-kai-reflection.png'), fullPage: true })
  await selectCapability(page, widget, 'reasoning')
  await expect(widget).toHaveAttribute('data-stage', 'invite')
  await expect(widget).toHaveAttribute('data-agent', 'KAI')
  await expect(widget).not.toContainText(topic.sampleAnswer)
  await expect(widget.getByRole('button', { name: 'Show sample answer', exact: true })).toHaveCount(0)
  await expect(widget.getByRole('button', { name: 'Approve sample plan', exact: true })).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('home-companion-approval-flow.png'), fullPage: true })
})

test('dismiss and snooze require manual reopen while route leave and reload revoke prior approval', async ({ page }) => {
  const widget = await enableOnHome(page)
  for (const [label, visibility, topicId] of [['Dismiss suggestion', 'minimized', 'precision'], ['Snooze companion', 'snoozed', 'reasoning']] as const) {
    await widget.getByRole('button', { name: 'Preview a sample', exact: true }).click()
    await widget.getByRole('button', { name: 'Approve sample plan', exact: true }).click()
    if (label === 'Snooze companion') await options(widget, true)
    await widget.getByRole('button', { name: label, exact: true }).click()
    await expect(widget).toHaveAttribute('data-visibility', visibility)
    await expect(widget.getByRole('button', { name: 'Reopen companion', exact: true })).toBeFocused()
    await expect(widget.getByRole('button', { name: 'Show sample answer', exact: true })).toHaveCount(0)
    await selectCapability(page, widget, topicId)
    await expect(widget).toHaveAttribute('data-visibility', visibility)
    await expect(widget).toHaveAttribute('data-stage', 'invite')
    await widget.getByRole('button', { name: 'Reopen companion', exact: true }).click()
    await expect(widget).toHaveAttribute('data-visibility', 'open')
    await expect(widget).toHaveAttribute('data-stage', 'invite')
    await expect(widget.getByRole('heading')).toBeFocused()
  }
  await widget.getByRole('button', { name: 'Preview a sample', exact: true }).click()
  await widget.getByRole('button', { name: 'Approve sample plan', exact: true }).click()
  await navigate(page, 'Mode demos')
  await expect(page).toHaveURL(/\/home\/modes$/)
  await expect(widget).toHaveCount(0)
  await navigate(page, 'Home')
  await expect(page).toHaveURL(/\/home$/)
  await expect(widget).toHaveAttribute('data-stage', 'invite')
  await expect(widget).toHaveAttribute('data-agent', 'MIRO')
  await expectLocalSafety(page)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await hydrated(page)
  await expect(widget).toHaveCount(0)
})

test('motion controls and reduced motion pause only the local face illustration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const widget = await enableOnHome(page)
  const avatar = widget.locator('.web-companion__head .companion-motion')
  await expect(avatar).toHaveAttribute('data-ready', 'true')
  await options(widget, true)
  const animate = widget.getByRole('checkbox', { name: 'Animate companion', exact: true })
  await animate.uncheck()
  await expect(avatar).toHaveAttribute('data-active', 'false')
  const paused = await visibleFrame(avatar)
  await page.waitForTimeout(350)
  expect(await visibleFrame(avatar)).toEqual(paused)
  expect(paused.state === 'paused' || paused.name === 'none').toBe(true)
  await animate.check()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduced = await visibleFrame(avatar)
  await page.waitForTimeout(350)
  expect(await visibleFrame(avatar)).toEqual(reduced)
  expect(reduced.state === 'paused' || reduced.name === 'none').toBe(true)
  await widget.screenshot({ path: test.info().outputPath('home-companion-local-mascot.png') })
  await widget.getByRole('button', { name: 'Turn off companion', exact: true }).click()
  await expect(widget).toHaveCount(0)
  await expect(page.locator('#main-content')).toBeFocused()
})

test('short desktop and mobile keep companion controls reachable with real wheel and keyboard input', async ({ page, isMobile }) => {
  await page.setViewportSize({ width: isMobile ? 393 : 1280, height: 565 })
  const widget = await enableOnHome(page)
  await expect(widget).toBeInViewport({ ratio: 1 })
  await widget.getByRole('button', { name: 'Preview a sample', exact: true }).click()
  const body = widget.locator('.web-companion__body')
  expect(await body.evaluate(element => getComputedStyle(element).overflowY)).toBe('auto')
  const approval = widget.getByRole('button', { name: 'Approve sample plan', exact: true })
  await reachWithWheel(page, body, approval)
  await options(widget, true)
  const controls = widget.locator('button:visible, input:visible, a[href]:visible, summary:visible')
  const lastControl = controls.last()
  await controls.first().focus()
  for (let step = 0; step < 24 && !await lastControl.evaluate(element => element === document.activeElement); step += 1) await page.keyboard.press('Tab')
  await expect(lastControl).toBeFocused()
  await expect(lastControl).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('home-companion-short-viewport.png'), fullPage: true })
})
