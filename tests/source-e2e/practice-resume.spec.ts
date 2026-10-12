import { expect, test } from '@playwright/test'

// Real fixture controller and storage; only speech playback and microphone
// permission are simulated. No provider calls or physical capture are used.
test('controller resume refreshes the timer and unlocks deliberate microphone start', async ({ page, context }) => {
  test.setTimeout(180000)
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
  const headers = { authorization: 'Bearer mock:resume-' + test.info().project.name }, api = context.request
  await context.setExtraHTTPHeaders(headers)
  await context.route('**/api/study/**', route => route.continue({ headers: { ...route.request().headers(), ...headers } }))
  await api.post('/api/auth/dev-session', { data: { scenario: 'member' } })
  await page.addInitScript(() => {
    const NativeAudio = window.Audio
    ;(window as any).Audio = function (src?: string) {
      const audio = new NativeAudio(src); let paused = true
      Object.defineProperty(audio, 'paused', { get: () => paused })
      audio.play = async () => {
        paused = false; audio.dispatchEvent(new Event('playing'))
        setTimeout(() => { paused = true; audio.dispatchEvent(new Event('ended')) }, 50)
      }
      audio.pause = () => { paused = true; audio.dispatchEvent(new Event('pause')) }
      return audio
    }
    ;(window as any).Audio.prototype = NativeAudio.prototype
    ;(window as any).__resumeMicRequests = 0
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
      ;(window as any).__resumeMicRequests++
      throw new DOMException('Fixture microphone permission denied', 'NotAllowedError')
    } } })
  })
  const wav = Buffer.alloc(44 + 800)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
  await page.route('**/api/study/conversations/*/speech', route => route.fulfill({ json: {
    audioBase64: wav.toString('base64'), mimeType: 'audio/wav', spokenText: 'We can continue from your saved question.', alignment: null,
  } }))
  await page.route('**/api/study/conversations/*/live', route => route.fulfill({ json: { enabled: true, provider: 'elevenlabs', socketUrl: '', message: '' } }))
  for (const mode of ['recorded', 'live']) {
    const inspected = await api.post('/api/study/sources/inspect', { headers, data: { url: '', fixture: 'WEB' } })
    expect(inspected.status()).toBe(200)
    const source = await inspected.json()
    const created = await api.post('/api/study/conversations/from-source', { headers, data: {
      sourceId: source.id, confirmSource: true, preferences: { purpose: 'UNDERSTAND', scope: 'BROAD', timeBudgetMinutes: 15,
        context: 'Pause and resume regression fixture', pacing: { mode: 'TOPIC_BLOCKS', practiceMinutes: 5, breakMinutes: 3 } },
    } })
    expect(created.status()).toBe(200)
    const { id } = await created.json(), base = '/api/study/conversations/' + id
    try {
      expect((await api.post(base + '/plan', { headers, data: {} })).status()).toBe(200)
      const planned = await (await api.get(base, { headers })).json()
      expect(planned.plan.pacing).toBeTruthy()
      expect((await api.post(base + '/plan/approve', { headers, data: { version: planned.plan.version } })).status()).toBe(200)
      expect((await api.post(base + '/welcome', { headers, data: {} })).status()).toBe(200)
      expect((await api.post(base + '/pacing', { headers, data: { action: 'START', revision: '' } })).status()).toBe(200)
      expect((await api.post(base + '/control', { headers, data: { action: 'INTRO' } })).status()).toBe(200)
      await page.goto('/home/' + id + '?practice=' + mode, { waitUntil: 'domcontentloaded' })
      const controls = page.getByRole('region', { name: 'Objective controls', exact: true })
      const timer = page.getByRole('region', { name: 'Practice and break timer', exact: true })
      const start = page.getByRole('button', { name: mode === 'recorded' ? 'Start recording' : 'Start conversation', exact: true })
      const openControls = async () => {
        await expect(controls).toBeVisible({ timeout: 60000 })
        const details = controls.locator('details')
        if (!await details.evaluate(node => (node as HTMLDetailsElement).open)) {
          await details.locator('summary').focus(); await details.locator('summary').press('Enter')
        }
      }
      await expect(timer).toContainText('Paused', { timeout: 60000 })
      await expect(start).toBeDisabled()
      await openControls()
      const beforeResume = await (await api.get(base, { headers })).json()
      await controls.getByRole('button', { name: 'Resume practice', exact: true }).click()
      await expect.poll(async () => (await (await api.get(base + '/pacing', { headers })).json()).pacing.phase).toBe('PRACTICE')
      const resumed = await (await api.get(base, { headers })).json()
      expect(resumed.objectiveFlow.paused).toBe(false)
      expect(resumed.turns.at(-1).text).toContain('continue')
      expect(resumed.objectiveFlow.ledger).toEqual(beforeResume.objectiveFlow.ledger)
      // This fails on the old UI although both server states above have resumed.
      await expect(timer).toContainText('Practice')
      await expect(start).toBeEnabled()
      const firstClock = await timer.locator('.pacing-clock').innerText()
      await expect.poll(() => timer.locator('.pacing-clock').innerText()).not.toBe(firstClock)
      await openControls()
      await controls.getByRole('button', { name: 'Pause', exact: true }).click()
      await expect(timer).toContainText('Paused')
      await expect(start).toBeDisabled()
      const pausedClock = await timer.locator('.pacing-clock').innerText()
      await expect.poll(async () => (await (await api.get(base, { headers })).json()).objectiveFlow.paused).toBe(true)
      let failClockRead = false
      const clockRead = async (route: any) => {
        if (failClockRead && route.request().method() === 'GET') return route.fulfill({ status: 503, json: { statusMessage: 'Fixture timer read unavailable.' } })
        return route.continue()
      }
      const controlResponse = async (route: any) => {
        const response = await route.fetch()
        if (route.request().postDataJSON().action === 'RESUME') failClockRead = true
        await route.fulfill({ response })
      }
      await page.route('**' + base + '/pacing', clockRead)
      await page.route('**' + base + '/control', controlResponse)
      await openControls()
      await controls.getByRole('button', { name: 'Resume practice', exact: true }).click()
      await expect(page.getByRole('alert').filter({ hasText: 'Fixture timer read unavailable.' })).toBeVisible({ timeout: 15000 })
      await expect(start).toBeDisabled()
      await expect(timer).toContainText('Paused')
      failClockRead = false
      await page.unroute('**' + base + '/control', controlResponse)
      await openControls()
      await controls.getByRole('button', { name: 'Resume practice', exact: true }).click()
      await expect(timer).toContainText('Practice')
      await expect(start).toBeEnabled()
      const seconds = (clock: string) => clock.split(':').reduce((total, part) => total * 60 + Number(part), 0)
      expect(seconds(await timer.locator('.pacing-clock').innerText())).toBeLessThanOrEqual(seconds(pausedClock))
      const micBefore = await page.evaluate(() => (window as any).__resumeMicRequests)
      expect(micBefore).toBe(0)
      // Resume permits an explicit start, and never silently captures audio.
      await start.click()
      await expect.poll(() => page.evaluate(() => (window as any).__resumeMicRequests)).toBe(micBefore + 1)
      await expect(page.getByText(/Allow microphone access|Microphone permission|permission denied/).first()).toBeVisible()
      await page.screenshot({ path: test.info().outputPath('practice-resumed-' + mode + '.png'), fullPage: true })
    } finally {
      // Cleanup a disposable in-memory fixture without hiding an assertion if
      // the development server resets its connection during a hot reload.
      await api.post(base + '/abandon', { headers, data: { confirmAbandon: true }, maxRetries: 2 }).catch(() => undefined)
    }
  }
})
