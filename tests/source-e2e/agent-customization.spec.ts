import { expect, test } from '@playwright/test'
import { DEFAULT_AGENT_PRESENTATION, normalizeAgentPresentation } from '../../shared/agentPresentation'

async function waitForModePicker(page: import('@playwright/test').Page) {
  await expect(page.getByRole('button', { name: 'Customize your team', exact: true })).toBeEnabled({ timeout: 60_000 })
}

async function swipeUp(page: import('@playwright/test').Page) {
  const viewport = page.viewportSize()!
  const input = await page.context().newCDPSession(page)
  const x = Math.round(viewport.width / 2), start = Math.round(viewport.height * .82), end = Math.round(viewport.height * .18)
  try {
    // Real touchmove events exercise Chrome's scrolling of the app shell.
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] })
    for (let step = 1; step <= 24; step++) {
      await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(start + (end - start) * step / 24) }] })
      await page.waitForTimeout(16)
    }
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } finally { await input.detach() }
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  await page.addInitScript(() => {
    (window as any).__teamMicrophoneRequests = 0
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      (window as any).__teamMicrophoneRequests++
      throw new DOMException('Synthetic customization test', 'NotAllowedError')
    } })
  })
  const session = await page.request.post('/api/auth/dev-session', { data: { scenario: 'member' } })
  expect(session.ok()).toBe(true)
})

test('team customization scrolls to the actions with wheel, touch and keyboard input', async ({ page }, testInfo) => {
  await page.route('**/api/study/presentation', route => route.fulfill({ json: { presentation: DEFAULT_AGENT_PRESENTATION, revision: '' } }))
  const continueButton = page.getByRole('button', { name: 'Continue with these choices', exact: true })
  const viewport = page.viewportSize()!
  const shell = page.locator('.new-session-shell')
  const openCustomizer = async () => {
    // Each input path starts on a fresh page, without another gesture's momentum.
    await page.goto('/home/new?mode=study', { waitUntil: 'domcontentloaded' })
    await expect(page.getByLabel('Amina’s voice', { exact: true })).toBeEnabled({ timeout: 60_000 })
    await expect.poll(() => shell.evaluate(node => Math.max(node.scrollTop, document.scrollingElement?.scrollTop || 0))).toBe(0)
  }
  await openCustomizer()
  await expect(page.getByRole('group', { name: 'Eye color', exact: true })).toHaveCount(0)
  // Real scroll input catches clipped ancestors that scrollIntoView can bypass.
  await page.mouse.move(viewport.width / 2, viewport.height * .65)
  await page.mouse.wheel(0, 1800)
  await expect(continueButton).toBeInViewport()
  await expect.poll(() => shell.evaluate(node => Math.max(node.scrollTop, document.scrollingElement?.scrollTop || 0))).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath('customization-scrolled.png') })
  await openCustomizer()
  await page.getByRole('heading', { name: 'Make your team feel familiar.' }).focus()
  await page.keyboard.press('Control+End')
  await expect(continueButton).toBeInViewport()
  if (testInfo.project.name === 'mobile') {
    await openCustomizer()
    await swipeUp(page)
    await expect.poll(() => shell.evaluate(node => Math.max(node.scrollTop, document.scrollingElement?.scrollTop || 0))).toBeGreaterThan(0)
    await expect(continueButton).toBeInViewport()
  }
})

test('new session shows modes before customization and scrolls before and after team changes', async ({ page }, testInfo) => {
  await page.route('**/api/study/presentation', route => route.fulfill({ json: { presentation: DEFAULT_AGENT_PRESENTATION, revision: 'confirmed-team' } }))
  await page.route('**/api/study/context', route => route.fulfill({ json: { context: { revision: '', summaryStatus: 'NONE' } } }))
  const shell = page.locator('.session-mode-picker')
  const lastPreview = page.getByRole('link', { name: 'Preview language practice', exact: true })
  const viewport = page.viewportSize()!
  const openModePicker = async (afterCustomization: boolean) => {
    await page.goto('/home/new', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'What would you like to practise?' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Make your team feel familiar.' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Your learning context' })).toHaveCount(0)
    await waitForModePicker(page)
    if (afterCustomization) {
      await page.getByRole('button', { name: 'Customize your team', exact: true }).click()
      await expect(page.getByLabel('Amina’s voice', { exact: true })).toBeEnabled({ timeout: 60_000 })
      await page.getByRole('button', { name: 'Keep current team', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'What would you like to practise?' })).toBeVisible()
    }
    await page.getByRole('heading', { name: 'What would you like to practise?' }).focus()
    await page.keyboard.press('Control+Home')
    await expect.poll(() => shell.evaluate(node => Math.max(node.scrollTop, document.scrollingElement?.scrollTop || 0))).toBe(0)
  }
  for (const afterCustomization of [false, true]) {
    await openModePicker(afterCustomization)
    await page.mouse.move(viewport.width / 2, viewport.height * .65)
    await page.mouse.wheel(0, 5000)
    await expect(lastPreview).toBeInViewport()
    await expect.poll(() => shell.evaluate(node => Math.max(node.scrollTop, document.scrollingElement?.scrollTop || 0))).toBeGreaterThan(0)
    await page.screenshot({ path: testInfo.outputPath(`modes-${afterCustomization ? 'after-customization' : 'initial'}-scrolled.png`) })

    await openModePicker(afterCustomization)
    await page.getByRole('button', { name: 'Customize your team', exact: true }).focus()
    await page.keyboard.press('Control+End')
    await expect(lastPreview).toBeInViewport()
    await expect.poll(() => shell.evaluate(node => Math.max(node.scrollTop, document.scrollingElement?.scrollTop || 0))).toBeGreaterThan(0)

    if (testInfo.project.name === 'mobile') {
      await openModePicker(afterCustomization)
      for (let attempt = 0; attempt < 8; attempt++) {
        const insideViewport = await lastPreview.evaluate(node => { const rect = node.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight })
        if (insideViewport) break
        await swipeUp(page)
      }
      await expect(lastPreview).toBeInViewport()
      await expect.poll(() => shell.evaluate(node => Math.max(node.scrollTop, document.scrollingElement?.scrollTop || 0))).toBeGreaterThan(0)
    }
  }
  // Customizing from the mode picker already confirms the team for this visit.
  await openModePicker(true)
  await page.getByRole('link', { name: 'Start a study session', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Your learning context' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Make your team feel familiar.' })).toHaveCount(0)
})

test('back to session choices discards unsaved customization and keeps Misu unopened', async ({ page }) => {
  let contextReads = 0, paidRequests = 0
  const writes: any[] = []
  await page.route('**/api/study/presentation', route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON(); writes.push(body)
      return route.fulfill({ json: { presentation: body.presentation, revision: 'confirmed-defaults' } })
    }
    return route.fulfill({ json: { presentation: DEFAULT_AGENT_PRESENTATION, revision: '' } })
  })
  await page.route('**/api/study/context', route => {
    contextReads++
    return route.fulfill({ json: { context: { revision: '', summaryStatus: 'NONE' } } })
  })
  page.on('request', request => {
    if (request.method() === 'POST' && /\/(speech|live\/start|summary)$/.test(new URL(request.url()).pathname)) paidRequests++
  })
  await page.goto('/home/new', { waitUntil: 'domcontentloaded' })
  await waitForModePicker(page)
  await page.getByRole('link', { name: 'Start a study session', exact: true }).click()
  await expect(page.getByLabel('Amina’s voice', { exact: true })).toBeEnabled({ timeout: 60_000 })
  await page.getByLabel('Brown hair color', { exact: true }).check()
  await expect(page.getByLabel('Brown hair color', { exact: true })).toBeChecked()
  await page.getByRole('link', { name: /Back to session choices/ }).click()
  await expect(page).toHaveURL(/\/home\/new$/)
  await expect(page.getByRole('heading', { name: 'What would you like to practise?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Make your team feel familiar.' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Your learning context' })).toHaveCount(0)
  expect(contextReads).toBe(0)
  expect(writes).toHaveLength(0)

  await waitForModePicker(page)
  await page.getByRole('link', { name: 'Start a study session', exact: true }).click()
  await expect(page.getByLabel('Amina’s voice', { exact: true })).toBeEnabled({ timeout: 60_000 })
  await expect(page.getByLabel('Original hair color', { exact: true })).toBeChecked()
  await expect(page.getByLabel('Brown hair color', { exact: true })).not.toBeChecked()
  expect(contextReads).toBe(0)
  await page.getByRole('button', { name: 'Keep defaults', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Your learning context' })).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0].presentation.agents.AMIRA.hairColor).toBe('original')
  expect(paidRequests).toBe(0)
  expect(await page.evaluate(() => (window as any).__teamMicrophoneRequests)).toBe(0)
})

test('study selection precedes customization, which keeps faces, remembers choices and offers voice only for Amina', async ({ page }) => {
  let saved = { presentation: normalizeAgentPresentation(DEFAULT_AGENT_PRESENTATION), revision: '' }, contextReads = 0, paidRequests = 0
  const writes: any[] = []
  await page.route('**/api/study/presentation', async route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON(); writes.push(body)
      saved = { presentation: body.presentation, revision: 'confirmed-team' }
    }
    await route.fulfill({ json: saved })
  })
  await page.route('**/api/study/context', route => {
    contextReads++
    return route.fulfill({ json: { context: { revision: '', summaryStatus: 'NONE' } } })
  })
  page.on('request', request => {
    if (request.method() === 'POST' && /\/(speech|live\/start|summary)$/.test(new URL(request.url()).pathname)) paidRequests++
  })
  await page.goto('/home/new', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'What would you like to practise?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Make your team feel familiar.' })).toHaveCount(0)
  await expect(page.locator('.journey-rail')).toHaveCount(0)
  expect(contextReads).toBe(0)
  await waitForModePicker(page)
  await page.getByRole('link', { name: 'Start a study session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Make your team feel familiar.' })).toBeVisible()
  await expect(page.locator('.journey-rail, .session-mode-picker')).toHaveCount(0)
  await expect(page.getByLabel('Amina’s voice', { exact: true })).toBeEnabled({ timeout: 60_000 })
  await expect(page.getByLabel('Porcelain skin tone', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Amina’s voice', { exact: true }).locator('option')).toHaveText(['Original Amina voice', 'Professional', 'Enthusiastic', 'Upbeat', 'Conversational', 'Clear', 'Storytelling', 'Calm', 'Playful'])
  await page.getByLabel('Amina’s voice', { exact: true }).selectOption('2vbhUP8zyKg4dEZaTWGn')
  await page.getByRole('button', { name: 'Listen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop sample', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Stop sample', exact: true }).click()
  expect(contextReads).toBe(0)
  await page.getByLabel('Honey skin tone', { exact: true }).check()
  await page.getByLabel('Brown hair color', { exact: true }).check()
  await expect(page.locator('.team-customizer__portrait .agent-portrait__layer')).toHaveCount(2)
  await expect(page.locator('.team-customizer__portrait .agent-portrait__base')).toHaveAttribute('src', '/optimized/v1/mascots/amina/portrait.webp')
  await page.screenshot({ path: test.info().outputPath('customize-amina.png'), fullPage: true })
  await page.getByRole('button', { name: 'Customize Misu', exact: true }).click()
  await expect(page.getByLabel('Amina’s voice', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Espresso skin tone', { exact: true })).toHaveCount(0)
  await page.getByLabel('Black hair color', { exact: true }).check()
  await page.getByLabel('Green eye color', { exact: true }).check()
  await expect(page.locator('.team-customizer__portrait .agent-portrait__eyes')).toHaveAttribute('style', /misu-eyes\.png/)
  await expect(page.locator('.team-customizer__portrait .agent-portrait__base')).toHaveAttribute('src', '/optimized/v1/mascots/misu/portrait.webp')
  await page.screenshot({ path: test.info().outputPath('customize-misu.png'), fullPage: true })
  await page.getByRole('button', { name: 'Customize Kai', exact: true }).click()
  await expect(page.getByLabel('Amina’s voice', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Espresso skin tone', { exact: true })).toHaveCount(0)
  await page.getByLabel('Bronze skin tone', { exact: true }).check()
  await page.getByLabel('Blue eye color', { exact: true }).check()
  await expect(page.locator('.team-customizer__portrait .agent-portrait__eyes')).toHaveAttribute('style', /kai-eyes\.png/)
  await page.screenshot({ path: test.info().outputPath('customize-kai.png'), fullPage: true })
  const continueButton = page.getByRole('button', { name: 'Continue with these choices', exact: true })
  await continueButton.scrollIntoViewIfNeeded()
  await expect(continueButton).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await continueButton.click()
  await expect(page.getByRole('region', { name: 'Your learning context' })).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0].revision).toBe('')
  expect(writes[0].presentation.agents.AMIRA).toEqual({ skinTone: 'honey', hairColor: 'brown', voiceId: '2vbhUP8zyKg4dEZaTWGn' })
  expect(writes[0].presentation.agents.MIRO.hairColor).toBe('black')
  expect(writes[0].presentation.agents.MIRO.eyeColor).toBe('green')
  expect(writes[0].presentation.agents.KAI.skinTone).toBe('bronze')
  expect(writes[0].presentation.agents.KAI.eyeColor).toBe('blue')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Make your team feel familiar.' })).toBeVisible()
  await expect(page.getByLabel('Honey skin tone', { exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Keep current team', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Your learning context' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Make your team feel familiar.' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Customize', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Customize your team' })).toBeVisible()
  await expect(page.getByLabel('Honey skin tone', { exact: true })).toBeChecked()
  await expect(page.getByLabel('Brown hair color', { exact: true })).toBeChecked()
  await expect(page.getByRole('group', { name: 'Eye color', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Customize Misu', exact: true }).click()
  await expect(page.getByLabel('Green eye color', { exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Customize Kai', exact: true }).click()
  await expect(page.getByLabel('Blue eye color', { exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Reset Kai', exact: true }).click()
  await expect(page.getByLabel('Original eye color', { exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Customize Amina', exact: true }).click()
  await page.getByRole('button', { name: 'Reset Amina', exact: true }).click()
  await expect(page.getByLabel('Original skin tone', { exact: true })).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Customize your team' })).toBeHidden()
  expect(writes).toHaveLength(1)
  expect(paidRequests).toBe(0)
  expect(await page.evaluate(() => (window as any).__teamMicrophoneRequests)).toBe(0)
})

test('legacy Espresso choices return to Original for Misu and Kai', async ({ page }) => {
  const legacy = structuredClone(DEFAULT_AGENT_PRESENTATION)
  legacy.agents.MIRO.skinTone = legacy.agents.KAI.skinTone = legacy.agents.AMIRA.skinTone = 'espresso'
  let written: any
  await page.route('**/api/study/presentation', route => {
    if (route.request().method() === 'PUT') {
      written = route.request().postDataJSON()
      return route.fulfill({ json: { presentation: written.presentation, revision: 'safe-team' } })
    }
    return route.fulfill({ json: { presentation: legacy, revision: 'legacy-team' } })
  })
  await page.goto('/home/new?mode=study', { waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('Espresso skin tone', { exact: true })).toBeChecked()
  for (const name of ['Misu', 'Kai']) {
    await page.getByRole('button', { name: `Customize ${name}`, exact: true }).click()
    await expect(page.getByLabel('Espresso skin tone', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Original skin tone', { exact: true })).toBeChecked()
  }
  await page.getByRole('button', { name: 'Continue with these choices', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Your learning context' })).toBeVisible()
  expect(written.presentation.agents.MIRO.skinTone).toBe('original')
  expect(written.presentation.agents.KAI.skinTone).toBe('original')
  expect(written.presentation.agents.AMIRA.skinTone).toBe('espresso')
})

test('Amina excludes Porcelain and restores an older saved choice to Original', async ({ page }) => {
  const legacy = structuredClone(DEFAULT_AGENT_PRESENTATION)
  legacy.agents.MIRO.skinTone = legacy.agents.KAI.skinTone = legacy.agents.AMIRA.skinTone = 'porcelain'
  let written: any
  await page.route('**/api/study/presentation', route => {
    if (route.request().method() === 'PUT') {
      written = route.request().postDataJSON()
      return route.fulfill({ json: { presentation: written.presentation, revision: 'safe-team' } })
    }
    return route.fulfill({ json: { presentation: legacy, revision: 'legacy-team' } })
  })
  await page.goto('/home/new?mode=study', { waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('Amina’s voice', { exact: true })).toBeEnabled({ timeout: 60_000 })
  await expect(page.getByLabel('Porcelain skin tone', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Original skin tone', { exact: true })).toBeChecked()
  for (const name of ['Misu', 'Kai']) {
    await page.getByRole('button', { name: `Customize ${name}`, exact: true }).click()
    await expect(page.getByLabel('Porcelain skin tone', { exact: true })).toBeChecked()
  }
  await page.getByRole('button', { name: 'Continue with these choices', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Your learning context' })).toBeVisible()
  expect(written.presentation.agents.AMIRA.skinTone).toBe('original')
  expect(written.presentation.agents.MIRO.skinTone).toBe('porcelain')
  expect(written.presentation.agents.KAI.skinTone).toBe('porcelain')
})

test('failed saves stay editable and continuing retains the last confirmed team', async ({ page }) => {
  await page.route('**/api/study/presentation', route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 503, json: { statusMessage: 'Synthetic write failure' } })
    : route.fulfill({ json: { presentation: DEFAULT_AGENT_PRESENTATION, revision: '' } }))
  await page.route('**/api/study/context', route => route.fulfill({ json: { context: { revision: '', summaryStatus: 'NONE' } } }))
  await page.goto('/home/new?mode=study', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Honey skin tone', { exact: true }).check()
  await page.getByRole('button', { name: 'Continue with these choices', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('not confirmed saved')
  await expect(page.getByRole('region', { name: 'Your learning context' })).toHaveCount(0)
  await expect(page.getByLabel('Honey skin tone', { exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Continue with current team', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Your learning context' })).toBeVisible()
  await expect(page.locator('.setup-team-strip .agent-portrait__layer')).toHaveCount(0)
})
