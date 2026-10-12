import { expect, test } from '@playwright/test'

test('voice controls remain usable while reading the conversation on small screens', async ({ page }) => {
  test.setTimeout(180000)
  await page.context().route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.request.post('/api/auth/dev-session', { data: { scenario: 'member' } })
  const study = {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', ownerId: 'mock-member', mode: 'DISCUSSION', revision: 1,
    document: { id: 'doc', name: 'source.pdf', title: 'Photosynthesis', kind: 'PDF', createdAt: '', excerpt: 'Plants capture sunlight.', sectionCount: 1 },
    practice: { questionNumber: 0, totalQuestions: 5, awaitingAnswer: false, attempts: [] },
    plan: { status: 'APPROVED', version: 1, activeObjectiveId: 'objective', objectives: [{ id: 'objective', title: 'Explain photosynthesis', outcome: 'Explain how plants use light.', sources: [{ id: 'page-1', label: 'Page 1', excerpt: 'Plants capture sunlight.' }] }], functionRefs: [{ id: 'explicit-instruction', version: '1', kind: 'framework' }, { id: 'self-explanation-teach-back', version: '1', kind: 'technique' }] },
    progression: { stage: 'COURSE', availableModes: ['DISCUSSION'], oralAnswersCompleted: 0, oralAnswersRequired: 5, scenarioAttemptCompleted: false },
    turns: Array.from({ length: 30 }, (_, i) => ({ id: 'turn-' + i, role: i % 2 ? 'USER' : 'AMIRA', text: 'Plants use light to make food. Explain the idea in your own words.', createdAt: '', mode: 'DISCUSSION', sources: [], kind: i === 0 ? 'INTRO' : 'CONTROL' })),
    createdAt: '', updatedAt: '',
  }
  await page.route('**/api/study/conversations/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', route => route.fulfill({ json: study }))
  await page.route('**/api/study/conversations/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/live', route => route.fulfill({ json: { enabled: true, provider: 'elevenlabs', socketUrl: '', message: '' } }))
  await page.route('**/api/study/conversations/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/speech', route => route.fulfill({ status: 503, json: { statusMessage: 'Fixture voice playback is unavailable.' } }))
  // A request is a test failure: opening the transcript must never start capture.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { throw new Error('Unexpected microphone capture') } } })
  })
  for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    for (const mode of ['recorded', 'live']) {
      await page.goto('/home/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee?practice=' + mode, { waitUntil: 'domcontentloaded' })
      const control = page.getByRole('button', { name: mode === 'live' ? 'Start conversation' : 'Start recording', exact: true })
      await expect(control).toBeVisible({ timeout: 60000 })
      await page.getByRole('button', { name: 'Open menu', exact: true }).click()
      await expect(page.getByRole('navigation', { name: 'Flowst Airs navigation', exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeFocused()
      await expect(page.getByRole('region', { name: 'Saved conversation', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Conversation', exact: true }).click()
      await expect(page.getByRole('region', { name: 'Saved conversation', exact: true })).toBeVisible()
      await expect(control).toBeVisible()
      await expect(page.locator('.call-state')).toContainText('Microphone off')
      await page.screenshot({ path: test.info().outputPath('voice-transcript-' + viewport.width + '-' + mode + '.png'), fullPage: true })
      const box = await control.boundingBox()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
      const usable = await control.evaluate(element => {
        const rect = element.getBoundingClientRect()
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
      })
      expect(usable).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)

      await page.getByRole('button', { name: 'Close conversation', exact: true }).click()
      await expect(control).toBeVisible()
    }
  }

  // A known quiet clip verifies actual reply playback and replay without a
  // provider call or physical audio output. The browser's decoder remains real.
  const quietWave = Buffer.alloc(44 + 8000 * 2)
  quietWave.write('RIFF'); quietWave.writeUInt32LE(quietWave.length - 8, 4); quietWave.write('WAVEfmt ', 8)
  quietWave.writeUInt32LE(16, 16); quietWave.writeUInt16LE(1, 20); quietWave.writeUInt16LE(1, 22)
  quietWave.writeUInt32LE(8000, 24); quietWave.writeUInt32LE(16000, 28); quietWave.writeUInt16LE(2, 32); quietWave.writeUInt16LE(16, 34)
  quietWave.write('data', 36); quietWave.writeUInt32LE(16000, 40)
  for (let i = 0; i < 8000; i++) quietWave.writeInt16LE(Math.round(900 * Math.sin(2 * Math.PI * 440 * i / 8000)), 44 + i * 2)
  let speechRequests = 0
  await page.route('**/api/study/conversations/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/speech', route => {
    speechRequests++
    return route.fulfill({json:{audioBase64:quietWave.toString('base64'),mimeType:'audio/wav',spokenText:'Plants use light to make food.',alignment:null}})
  })
  await page.goto('/home/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee?practice=recorded', {waitUntil:'domcontentloaded'})
  await expect(page.getByRole('button', {name:'Listen to reply',exact:true})).toBeEnabled({timeout:60000})
  await page.evaluate(() => {
    ;(window as any).__replyBlobs = []
    const create = URL.createObjectURL.bind(URL)
    URL.createObjectURL = blob => { (window as any).__replyBlobs.push(blob); return create(blob) }
    const NativeAudio = window.Audio
    ;(window as any).Audio = function () {
      const audio = new NativeAudio(); let paused = true
      Object.defineProperty(audio, 'paused', {get:()=>paused})
      audio.play = async () => {paused=false;audio.dispatchEvent(new Event('playing'))}
      audio.pause = () => {paused=true;audio.dispatchEvent(new Event('pause'))}
      return audio
    }
    ;(window as any).Audio.prototype = NativeAudio.prototype
  })
  await page.getByRole('button', {name:'Listen to reply',exact:true}).click()
  await expect(page.getByRole('button', {name:'Pause reply',exact:true})).toBeEnabled()
  const playback = await page.evaluate(async () => {
    const blob = (window as any).__replyBlobs[0] as Blob, view = new DataView(await blob.arrayBuffer())
    let peak = 0
    for (let offset = 44; offset < view.byteLength; offset += 2) peak = Math.max(peak, Math.abs(view.getInt16(offset, true)))
    return {peak, channels:view.getUint16(22,true), duration:(view.byteLength-44)/view.getUint32(28,true)}
  })
  expect(playback.peak).toBeGreaterThan(2000)
  expect(playback.peak).toBeLessThan(32767)
  expect(playback.channels).toBe(1)
  expect(playback.duration).toBeCloseTo(1,2)
  await page.getByRole('button', {name:'Pause reply',exact:true}).click()
  await page.getByRole('button', {name:'Listen to reply',exact:true}).click()
  await expect(page.getByRole('button', {name:'Pause reply',exact:true})).toBeEnabled()
  expect(speechRequests).toBe(1)
  expect(await page.evaluate(()=>(window as any).__replyBlobs.length)).toBe(1)
  await page.getByRole('button', {name:'Pause reply',exact:true}).click()
})
