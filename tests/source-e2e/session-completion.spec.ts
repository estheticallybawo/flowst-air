import { randomUUID } from 'node:crypto'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const headers = { authorization: 'Bearer mock:member' }
async function browserGuards(page: Page) {
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource.*(?:502|503)/i.test(message.text())) failures.push(message.text())
  })
  await page.route(/\/api\/study\/conversations\/[^/]+\/(?:speech|transcribe|live\/start)(?:\?|$)/, route => route.fulfill({
    status: 503, json: { statusMessage: 'Voice is disabled in this local completion fixture.', data: { code: 'FIXTURE_VOICE_DISABLED' } },
  }))
  await page.addInitScript(() => {
    const state = window as unknown as { __completionMicRequests: number }
    state.__completionMicRequests = 0
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      state.__completionMicRequests++
      throw new DOMException('Microphone is disabled in this local fixture.', 'NotAllowedError')
    } })
  })
  return failures
}
async function closedFixture(context: BrowserContext) {
  const api = context.request
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  await context.setExtraHTTPHeaders(headers)
  await context.route('**/api/study/**', route => route.continue({ headers: { ...route.request().headers(), ...headers } }))
  expect((await api.post('/api/auth/dev-session', { data: { scenario: 'member' } })).status()).toBe(200)
  const inspected = await api.post('/api/study/sources/inspect', { headers, data: { url: '', fixture: 'WEB' } })
  expect(inspected.status()).toBe(200)
  const source = await inspected.json()
  const created = await api.post('/api/study/conversations/from-source', { headers, data: { sourceId: source.id, confirmSource: true, preferences: { purpose: 'UNDERSTAND', scope: 'BROAD', timeBudgetMinutes: 15, context: 'Completion invitation fixture' } } })
  expect(created.status()).toBe(200)
  const { id } = await created.json(), base = '/api/study/conversations/' + id
  expect((await api.post(base + '/plan', { headers, data: {} })).status()).toBe(200)
  const planned = await (await api.get(base, { headers })).json()
  expect((await api.post(base + '/plan/approve', { headers, data: { version: planned.plan.version } })).status()).toBe(200)
  expect((await api.post(base + '/welcome', { headers, data: {} })).status()).toBe(200)
  if (planned.plan.pacing) expect((await api.post(base + '/pacing', { headers, data: { action: 'START', revision: '' } })).status()).toBe(200)
  expect((await api.post(base + '/control', { headers, data: { action: 'INTRO' } })).status()).toBe(200)
  expect((await api.post(base + '/control', { headers, data: { action: 'END' } })).status()).toBe(200)
  const reviewed = await api.post(base + '/review', { headers, data: {} })
  expect(reviewed.status()).toBe(200)
  return { id, base, review: await reviewed.json(), study: await (await api.get(base, { headers })).json() }
}
async function finishReview(page: Page) {
  const kai = page.getByRole('dialog', { name: 'Kai’s practice review', exact: true })
  await expect(kai).toBeVisible({ timeout: 90000 })
  const finish = kai.getByRole('button', { name: 'Finish review', exact: true })
  for (let index = 0; index < 12 && !await finish.isVisible(); index++) {
    await kai.getByRole('button', { name: /Next observation|What to practise next|Next assessment|Next criterion|Next skill/i }).click()
  }
  await expect(finish).toBeVisible()
  await finish.click()
  return page.getByRole('dialog', { name: 'Your next session', exact: true })
}
async function reopenInvitation(page: Page) {
  const controls = page.getByRole('region', { name: 'Objective controls', exact: true })
  const details = controls.locator('details')
  if (!await details.evaluate(node => (node as HTMLDetailsElement).open)) {
    await details.locator('summary').focus()
    await details.locator('summary').press('Enter')
  }
  await controls.getByRole('button', { name: 'Next session', exact: true }).click()
}
async function cleanup(context: BrowserContext, id: string) {
  const base = '/api/study/conversations/' + id
  await context.request.post(base + '/abandon', { headers, data: { confirmAbandon: true } })
  await context.request.delete(base, { headers })
}

// Real owned source/controller/review storage; no recorded speech or provider calls.
test('Misu offers factual next steps after the review, supports dismissal, and repeats into an independent unapproved session', async ({ page, context }) => {
  test.setTimeout(300000)
  const failures = await browserGuards(page)
  const original = await closedFixture(context)
  let freshId = ''
  try {
    await page.goto('/airs/' + original.id, { waitUntil: 'domcontentloaded' })
    const invitation = await finishReview(page)
    await expect(invitation).toBeVisible()
    await expect(invitation).toContainText('understanding was not assessed')
    await expect(invitation.locator('.completion-confetti')).toHaveCount(0)
    await expect(invitation.locator('.misu-invitation [data-agent-avatar]')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await invitation.getByRole('button', { name: 'Practise again', exact: true }).focus()
    await page.keyboard.press('Tab')
    expect(await invitation.evaluate(node => node.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(invitation).toBeHidden()

    // Closing the already-read Kai dialog does not produce an automatic invitation loop.
    await page.getByRole('button', { name: 'Kai: view feedback', exact: true }).click()
    const kai = page.getByRole('dialog', { name: 'Kai’s practice review', exact: true })
    await expect(kai).toBeVisible()
    await kai.getByRole('button', { name: 'Close kai’s practice review', exact: true }).click()
    await expect(invitation).toBeHidden()
    await reopenInvitation(page)
    await expect(invitation).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('misu-next-session-' + test.info().project.name + '.png'), fullPage: true })
    const response = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(original.base + '/repeat'))
    await invitation.getByRole('button', { name: 'Practise again', exact: true }).click()
    const repeated = await response
    expect(repeated.status()).toBe(201)
    const fresh = await repeated.json()
    freshId = fresh.id
    expect(freshId).not.toBe(original.id)
    expect(fresh.plan.status).toBe('PENDING')
    expect(fresh.plan.approvedAt).toBeUndefined()
    expect(fresh.turns).toEqual([])
    expect(fresh.practice.attempts).toEqual([])
    await expect(page).toHaveURL(new RegExp('/airs/' + freshId + '$'))
    const current = await (await context.request.get('/api/study/conversations/' + freshId, { headers })).json()
    expect(['PENDING', 'DRAFT']).toContain(current.plan.status)
    expect(current.plan.approvedAt).toBeUndefined()
    expect(await (await context.request.get(original.base, { headers })).json()).toEqual(original.study)
    expect(await page.evaluate(() => (window as unknown as { __completionMicRequests: number }).__completionMicRequests)).toBe(0)
    expect(failures).toEqual([])
  } finally {
    if (freshId) await cleanup(context, freshId)
    await cleanup(context, original.id)
  }
})

// Explicitly mocked covered-review presentation tests timing and animation only.
// Actual covered-session preservation is verified by study-repeat.test.ts.
test('covered-review confetti waits until the assessment is read and honors reduced motion', async ({ page, context }) => {
  test.setTimeout(300000)
  const failures = await browserGuards(page)
  const original = await closedFixture(context)
  const evidenceId = randomUUID()
  const review = {
    ...original.review, closureOnly: false, sessionStatus: 'covered', assessmentVersion: '0.3',
    objectiveOutcomes: original.review.objectiveOutcomes.map((item: object) => ({ ...item, status: 'met_for_session' })),
    evidence: [{ id: evidenceId, attempt: 'Scripted presentation: the authoritative design reference.' }],
    observations: [{ text: 'Scripted presentation: a saved explanation is linked to this objective.', evidenceIds: [evidenceId], criterionId: 'ACCURACY', kind: 'observation' }],
    nextPractice: { goal: 'Apply the reference', exercise: 'Use a different example in a future session.', evidenceIds: [evidenceId] },
  }
  try {
    await page.route('**' + original.base + '/review', route => route.fulfill({ json: route.request().method() === 'GET' ? { review } : review }))
    await page.goto('/airs/' + original.id, { waitUntil: 'domcontentloaded' })
    const kai = page.getByRole('dialog', { name: 'Kai’s practice review', exact: true })
    await expect(kai).toBeVisible({ timeout: 90000 })
    await kai.getByRole('button', { name: 'Close kai’s practice review', exact: true }).click()
    const invitation = page.getByRole('dialog', { name: 'Your next session', exact: true })
    await expect(invitation).toBeHidden()
    await page.getByRole('button', { name: 'Kai: view feedback', exact: true }).click()
    await finishReview(page)
    await expect(invitation).toBeVisible()
    await expect(invitation).toContainText('You covered your session objectives')
    await expect(invitation.locator('.completion-confetti i')).toHaveCount(30)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await invitation.locator('.completion-confetti').evaluate(node => getComputedStyle(node).display)).toBe('none')
    await page.screenshot({ path: test.info().outputPath('misu-covered-reduced-motion-' + test.info().project.name + '.png'), fullPage: true })
    await invitation.getByRole('button', { name: 'New session', exact: true }).click()
    await expect(page).toHaveURL(/\/airs$/)
    expect(failures).toEqual([])
  } finally { await cleanup(context, original.id) }
})

test('a Kai review error has no finish control or completion invitation', async ({ page, context }) => {
  test.setTimeout(300000)
  const failures = await browserGuards(page)
  const original = await closedFixture(context)
  try {
    await page.route('**' + original.base + '/review', route => route.fulfill({ status: 502, json: { statusMessage: 'Kai could not link this review to your saved evidence. Your practice is saved; retry the review.' } }))
    await page.goto('/airs/' + original.id, { waitUntil: 'domcontentloaded' })
    const kai = page.getByRole('dialog', { name: 'Kai’s practice review', exact: true })
    await expect(kai).toBeVisible({ timeout: 90000 })
    await expect(kai).toContainText('Your practice is saved; retry the review.')
    await expect(kai.getByRole('button', { name: 'Finish review', exact: true })).toHaveCount(0)
    await kai.getByRole('button', { name: 'Close kai’s practice review', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Your next session', exact: true })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Next session', exact: true })).toHaveCount(0)
    expect(failures).toEqual([])
  } finally { await cleanup(context, original.id) }
})
