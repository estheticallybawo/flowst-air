import { expect, test, type Locator, type Page } from '@playwright/test'
import { DEFAULT_AGENT_PRESENTATION, normalizeAgentPresentation, type AgentPresentation } from '../../shared/agentPresentation'
import { eyeColorFilter, hairColorFilter, skinToneFilter } from '../../shared/agentAppearanceAssets'
import { companionMotionAgents, companionMotionCatalog } from '../../shared/companionMotion'
import { COMPANION_MOTION_FRAME_ATLASES } from '../../shared/companionMotionFrames.generated'

interface AvatarRuntime {
  __avatarRecoveryDevices: { microphone: number; screen: number }
}

interface AvatarFixture {
  presentation: AgentPresentation
  mutations: string[]
  providers: string[]
  runtimeErrors: string[]
}

const fixtures = new WeakMap<Page, AvatarFixture>()
const providerPattern = /(?:agora\.(?:io|cn|api)|lemonslice\.(?:com|ai)|api\.openai\.com|api\.elevenlabs\.io|api\.groq\.com|api\.deepgram\.com|api\.minimax\.io|bedrock-runtime\.[^/]+\.amazonaws\.com)/i

function customizedTeam() {
  const presentation = normalizeAgentPresentation(DEFAULT_AGENT_PRESENTATION)
  presentation.agents.AMIRA = { skinTone: 'honey', hairColor: 'brown', voiceId: '2vbhUP8zyKg4dEZaTWGn' }
  presentation.agents.MIRO = { skinTone: 'bronze', hairColor: 'black', eyeColor: 'green' }
  presentation.agents.KAI = { skinTone: 'beige', hairColor: 'blonde', eyeColor: 'blue' }
  return presentation
}

test.beforeEach(async ({ page }) => {
  await page.context().route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.addInitScript(() => {
    const runtime = window as unknown as AvatarRuntime
    runtime.__avatarRecoveryDevices = { microphone: 0, screen: 0 }
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          runtime.__avatarRecoveryDevices.microphone += 1
          throw new Error('Avatar samples must not request microphone access')
        },
        getDisplayMedia: async () => {
          runtime.__avatarRecoveryDevices.screen += 1
          throw new Error('Avatar samples must not request screen access')
        },
      },
    })
  })
  const session = await page.request.post('/api/auth/dev-session', { data: { scenario: 'member' } })
  expect(session.ok()).toBe(true)
  const fixture: AvatarFixture = {
    presentation: normalizeAgentPresentation(DEFAULT_AGENT_PRESENTATION), mutations: [], providers: [], runtimeErrors: [],
  }
  fixtures.set(page, fixture)
  page.on('pageerror', error => fixture.runtimeErrors.push(error.message))
  page.on('request', request => {
    const requestUrl = new URL(request.url())
    if (requestUrl.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) fixture.mutations.push(request.url())
    if (providerPattern.test(request.url()) || /^\/api\/(?:study(?:\/|$)|pilot\/avatar-trial(?:\/|$))/.test(requestUrl.pathname) && requestUrl.pathname !== '/api/study/presentation') fixture.providers.push(request.url())
  })
  await page.route(providerPattern, route => route.abort('blockedbyclient'))
  await page.route('**/api/**', route => {
    const request = route.request()
    if (new URL(request.url()).pathname.startsWith('/api/study/') || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.abort('blockedbyclient')
    return route.continue()
  })
  await page.route('**/api/study/presentation', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { presentation: fixture.presentation, revision: 'avatar-recovery-saved-team' } })
    : route.abort('blockedbyclient'))
})

test.afterEach(async ({ page }) => {
  const fixture = fixtures.get(page)!
  expect(fixture.mutations, 'Appearance previews must not save or mutate application records').toEqual([])
  expect(fixture.providers, 'Illustrated animation must not call a study or avatar provider').toEqual([])
  expect(fixture.runtimeErrors).toEqual([])
  expect(await page.evaluate(() => (window as unknown as AvatarRuntime).__avatarRecoveryDevices)).toEqual({ microphone: 0, screen: 0 })
})

async function openCharacterLibrary(page: Page) {
  await page.goto('/home/modes?mode=interview&avatar=1', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#demo-amina-voice')).toBeEnabled({ timeout: 60_000 })
  const entries = page.locator('.experience-disclosures')
  await entries.getByRole('button', { name: /Character unlocks/ }).click()
  const panel = page.locator('#airs-character-unlocks')
  await expect(panel).toBeVisible()
  await panel.getByRole('group', { name: 'Choose a sample Tide count' }).getByRole('button', { name: '10', exact: true }).click()
  return panel
}

async function captureFrame(avatar: Locator) {
  const agent = await avatar.getAttribute('data-agent') as keyof typeof COMPANION_MOTION_FRAME_ATLASES
  const state = await avatar.getAttribute('data-state')
  const motion = companionMotionCatalog.find(candidate => candidate.id === state)!
  return avatar.evaluate(async (root, framing) => {
    const groups = Array.from(root.querySelectorAll<HTMLElement>('.companion-motion__frame'))
    const visible = groups.filter(group => Number(getComputedStyle(group).opacity) > .5)
    if (groups.length !== 4 || visible.length !== 1) throw new Error('A recovered avatar must display exactly one of its four fixed face frames')
    const group = visible[0]!
    const column = Number(group.dataset.frame)
    const rectangle = framing.frames[framing.row * 4 + column]!
    const base = group.querySelector<HTMLElement>('.companion-motion__atlas')!
    const style = getComputedStyle(base)
    const imageUrl = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]
    if (!imageUrl) throw new Error('A recovered avatar must render its frame atlas')
    const readLayers = (frame: HTMLElement) => Array.from(frame.querySelectorAll<HTMLElement>('.companion-motion__layer')).map(layer => {
      const layerStyle = getComputedStyle(layer)
      return {
        name: layer.dataset.layer, position: layerStyle.backgroundPosition, size: layerStyle.backgroundSize,
        maskPosition: layerStyle.maskPosition, maskSize: layerStyle.maskSize, mask: layerStyle.maskImage,
        image: layerStyle.backgroundImage, filter: layerStyle.filter,
      }
    })
    const frameGroups = groups.map(frame => {
      const frameBase = frame.querySelector<HTMLElement>('.companion-motion__atlas')!
      const frameStyle = getComputedStyle(frameBase)
      const bounds = frame.getBoundingClientRect()
      return {
        column: Number(frame.dataset.frame), opacity: Number(getComputedStyle(frame).opacity),
        position: frameStyle.backgroundPosition, size: frameStyle.backgroundSize,
        width: bounds.width, height: bounds.height, layers: readLayers(frame),
      }
    })
    const bounds = root.querySelector('.companion-motion__face')!.getBoundingClientRect()
    const snapshot = {
      column, row: framing.row, imageUrl,
      width: bounds.width, height: bounds.height,
      backgroundPosition: style.backgroundPosition, backgroundSize: style.backgroundSize,
      animationName: getComputedStyle(root).animationName, playState: getComputedStyle(root).animationPlayState,
      layers: readLayers(group), groups: frameGroups,
      expectedFrames: framing.frames.slice(framing.row * 4, framing.row * 4 + 4),
    }
    const image = new Image()
    image.src = imageUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d')!
    context.drawImage(image, rectangle.x, rectangle.y, rectangle.width, rectangle.height, 0, 0, 64, 64)
    const pixels = context.getImageData(0, 0, 64, 64).data
    let pixelHash = 2166136261
    for (const value of pixels) pixelHash = Math.imul(pixelHash ^ value, 16777619)
    return { ...snapshot, pixelHash: pixelHash >>> 0, imageWidth: image.naturalWidth, imageHeight: image.naturalHeight }
  }, { ...COMPANION_MOTION_FRAME_ATLASES[agent], row: motion.row })
}

async function expectMovingFrames(avatar: Locator) {
  await expect(avatar).toHaveAttribute('data-ready', 'true', { timeout: 30_000 })
  await expect(avatar.locator('.agent-portrait')).toHaveCount(0)
  await expect(avatar.locator('.companion-motion__frame')).toHaveCount(4)
  const snapshots = []
  for (let sample = 0; sample < 13; sample += 1) {
    snapshots.push(await captureFrame(avatar))
    if (new Set(snapshots.map(frame => frame.column)).size > 1 && new Set(snapshots.map(frame => frame.pixelHash)).size > 1) break
    await avatar.page().waitForTimeout(110)
  }
  expect(new Set(snapshots.map(frame => frame.column)).size, 'The visible face frame must advance, not merely bob a static portrait').toBeGreaterThan(1)
  expect(new Set(snapshots.map(frame => frame.pixelHash)).size, 'Advancing frames must contain different facial artwork').toBeGreaterThan(1)
  for (const snapshot of snapshots) {
    expect(snapshot.imageWidth).toBe(1024)
    expect(snapshot.imageHeight).toBe(1536)
    expect(Math.abs(snapshot.width - snapshot.height)).toBeLessThan(1)
    expect(snapshot.groups.filter(group => group.opacity > .5)).toHaveLength(1)
    for (const group of snapshot.groups) {
      const rectangle = snapshot.expectedFrames[group.column]!
      const size = group.size.split(' ').map(value => parseFloat(value))
      const position = group.position.split(' ').map(value => parseFloat(value))
      expect(size[0]).toBeCloseTo(snapshot.imageWidth / rectangle.width * 100, 3)
      expect(size[1]).toBeCloseTo(snapshot.imageHeight / rectangle.height * 100, 3)
      expect(position[0]).toBeCloseTo(rectangle.x / (snapshot.imageWidth - rectangle.width) * 100, 3)
      expect(position[1]).toBeCloseTo(rectangle.y / (snapshot.imageHeight - rectangle.height) * 100, 3)
      expect(group.width / group.height, 'Full-head crops must retain their actual aspect ratio').toBeCloseTo(rectangle.width / rectangle.height, 2)
      for (const layer of group.layers) {
        expect(layer.position).toBe(group.position)
        expect(layer.maskPosition).toBe(group.position)
        expect(layer.size).toBe(group.size)
        expect(layer.maskSize).toBe(group.size)
        expect(layer.image).toContain(snapshot.imageUrl)
        expect(layer.filter).not.toBe('none')
      }
    }
  }
  return snapshots
}

for (const customized of [false, true]) {
  test(`${customized ? 'customized' : 'original'} Amina, Misu and Kai retain all six animated face states`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const fixture = fixtures.get(page)!
    fixture.presentation = customized ? customizedTeam() : normalizeAgentPresentation(DEFAULT_AGENT_PRESENTATION)
    const savedChoices = structuredClone(fixture.presentation)
    const panel = await openCharacterLibrary(page)
    for (const agent of companionMotionAgents) {
      await panel.getByRole('group', { name: 'Choose a companion for the motion preview' }).getByRole('button', { name: agent.name, exact: true }).click()
      const avatar = panel.locator('.cosmetic-preview-agent .companion-motion')
      await expect(avatar).toHaveAttribute('data-agent', agent.id)
      await expect(avatar).toHaveAttribute('data-customized', String(customized))
      const appearance = savedChoices.agents[agent.id]
      const expectedFilters = await page.evaluate(filters => {
        const probe = document.createElement('span')
        document.body.append(probe)
        const normalized = Object.fromEntries(Object.entries(filters).map(([layer, filter]) => {
          probe.style.filter = filter
          return [layer, getComputedStyle(probe).filter]
        }))
        probe.remove()
        return normalized
      }, {
        skin: skinToneFilter(agent.id, appearance.skinTone),
        hair: hairColorFilter(agent.id, appearance.hairColor),
        iris: eyeColorFilter('eyeColor' in appearance ? appearance.eyeColor : 'original'),
      })
      for (const motion of companionMotionCatalog) {
        await panel.locator(`.companion-motion-option[data-state="${motion.id}"]`).click()
        await expect(avatar).toHaveAttribute('data-state', motion.id)
        const snapshots = await expectMovingFrames(avatar)
        expect(snapshots.every(snapshot => snapshot.row === motion.row)).toBe(true)
        expect(snapshots.every(snapshot => snapshot.imageUrl.endsWith(agent.atlas))).toBe(true)
        const expectedLayers = customized ? agent.id === 'AMIRA' ? ['hair', 'skin'] : ['hair', 'iris', 'skin'] : []
        for (const snapshot of snapshots) {
          expect(snapshot.layers.map(layer => layer.name).sort()).toEqual(expectedLayers)
          for (const layer of snapshot.layers) expect(layer.filter).toBe(expectedFilters[layer.name!])
        }
      }
      const thumbnails = panel.locator('.motion-thumbnail .companion-motion')
      await expect(thumbnails).toHaveCount(6)
      await expect.poll(() => thumbnails.evaluateAll(nodes => nodes.every(node => node.getAttribute('data-ready') === 'true'))).toBe(true)
      const before = await Promise.all((await thumbnails.all()).map(captureFrame))
      await page.waitForTimeout(350)
      const after = await Promise.all((await thumbnails.all()).map(captureFrame))
      expect(after.map(frame => [frame.column, frame.row])).toEqual(before.map(frame => [frame.column, frame.row]))
      expect(after.every(frame => frame.playState === 'paused')).toBe(true)
      await panel.locator('.cosmetic-preview-scene').screenshot({ path: test.info().outputPath(`${customized ? 'customized' : 'original'}-${agent.name.toLowerCase()}-face.png`) })
    }
    expect(fixture.presentation).toEqual(savedChoices)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#demo-amina-voice')).toBeEnabled({ timeout: 60_000 })
    await expect(page.locator('#demo-amina-voice')).toHaveValue(savedChoices.agents.AMIRA.voiceId || '')
    expect(fixture.presentation).toEqual(savedChoices)
  })
}

test('customized face layers freeze together when paused and under reduced motion', async ({ page }) => {
  test.setTimeout(180_000)
  fixtures.get(page)!.presentation = customizedTeam()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const panel = await openCharacterLibrary(page)
  for (const agent of companionMotionAgents) {
    await panel.getByRole('group', { name: 'Choose a companion for the motion preview' }).getByRole('button', { name: agent.name, exact: true }).click()
    await panel.locator('.companion-motion-option[data-state="dance"]').click()
    const avatar = panel.locator('.cosmetic-preview-agent .companion-motion')
    const animate = panel.getByRole('checkbox', { name: `Animate ${agent.name}`, exact: true })
    await animate.check()
    await expectMovingFrames(avatar)
    await animate.uncheck()
    await expect(avatar).toHaveAttribute('data-active', 'false')
    const paused = await captureFrame(avatar)
    await page.waitForTimeout(450)
    const pausedLater = await captureFrame(avatar)
    expect(pausedLater).toEqual(paused)
    expect(paused.playState).toBe('paused')
    await animate.check()
    await expectMovingFrames(avatar)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const reduced = await captureFrame(avatar)
    await page.waitForTimeout(450)
    expect(await captureFrame(avatar)).toEqual(reduced)
    expect(reduced.playState === 'paused' || reduced.animationName === 'none').toBe(true)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  }
})

test('Amina interaction keeps customized half-body mouth and gesture frames while unlocks stay face-only', async ({ page }) => {
  test.setTimeout(180_000)
  const fixture = fixtures.get(page)!
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/home/modes?mode=interview&avatar=1', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#demo-amina-voice')).toBeEnabled({ timeout: 60_000 })
  const original = page.locator('.mode-room .amina-demo-avatar')
  await expect(original).toHaveAttribute('data-framing', 'half-body')
  await expect(original).toHaveAttribute('data-ready', 'true')
  await expect(original).toHaveAttribute('data-customized', 'false')
  await page.locator('.mode-room').screenshot({ path: test.info().outputPath('original-interview-half-body.png') })
  fixture.presentation = customizedTeam()
  const savedChoices = structuredClone(fixture.presentation)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('#demo-amina-voice')).toBeEnabled({ timeout: 60_000 })
  const panel = page.locator('#amina-animation-lab')
  const amina = panel.locator('.amina-demo-avatar')
  const artwork = amina.locator('.amina-demo-avatar__artwork')
  await expect(amina).toHaveAttribute('data-framing', 'half-body')
  await expect(amina).toHaveAttribute('data-ready', 'true')
  await expect(amina).toHaveAttribute('data-customized', 'true')
  await expect(amina.locator('.companion-motion, .agent-portrait')).toHaveCount(0)
  const captureBody = () => amina.evaluate(async root => {
    const artwork = root.querySelector<HTMLElement>('.amina-demo-avatar__artwork')!
    const base = root.querySelector<HTMLElement>('.amina-demo-avatar__sprite')!
    const style = getComputedStyle(base)
    const imageUrl = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]
    if (!imageUrl) throw new Error('Amina interaction must render the original half-body atlas')
    const position = style.backgroundPosition.split(' ').map(value => parseFloat(value))
    const column = Math.round(position[0]! / 100 * 3)
    const row = Math.round(position[1]! / 100)
    const image = new Image()
    image.src = imageUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 96
    const context = canvas.getContext('2d')!
    context.drawImage(image, column * image.naturalWidth / 4, row * image.naturalHeight / 2, image.naturalWidth / 4, image.naturalHeight / 2, 0, 0, 64, 96)
    let pixelHash = 2166136261
    for (const value of context.getImageData(0, 0, 64, 96).data) pixelHash = Math.imul(pixelHash ^ value, 16777619)
    const bounds = artwork.getBoundingClientRect()
    return {
      row, column, imageUrl, pixelHash: pixelHash >>> 0,
      imageWidth: image.naturalWidth, imageHeight: image.naturalHeight,
      width: bounds.width, height: bounds.height,
      position: style.backgroundPosition, size: style.backgroundSize,
      mouthPlayState: getComputedStyle(artwork).animationPlayState,
      bodyPlayState: getComputedStyle(root.querySelector('.amina-demo-avatar__character')!).animationPlayState,
      bodyTransform: getComputedStyle(root.querySelector('.amina-demo-avatar__character')!).transform,
      layers: Array.from(root.querySelectorAll<HTMLElement>('.amina-demo-avatar__layer')).map(layer => {
        const layerStyle = getComputedStyle(layer)
        return { name: layer.dataset.layer, position: layerStyle.backgroundPosition, size: layerStyle.backgroundSize,
          maskPosition: layerStyle.maskPosition, maskSize: layerStyle.maskSize, mask: layerStyle.maskImage,
          image: layerStyle.backgroundImage, filter: layerStyle.filter }
      }),
    }
  })
  const assertLayers = (snapshot: Awaited<ReturnType<typeof captureBody>>) => {
    expect(snapshot.imageUrl).toContain('/mascots/amina-expression-atlas-v1.png')
    expect([snapshot.imageWidth, snapshot.imageHeight]).toEqual([1448, 1086])
    expect(snapshot.width / snapshot.height).toBeCloseTo(2 / 3, 2)
    expect(snapshot.size).toBe('400% 200%')
    expect(snapshot.layers.map(layer => layer.name).sort()).toEqual(['hair', 'skin'])
    for (const layer of snapshot.layers) {
      expect(layer.position).toBe(snapshot.position)
      expect(layer.maskPosition).toBe(snapshot.position)
      expect(layer.size).toBe(snapshot.size)
      expect(layer.maskSize).toBe(snapshot.size)
      expect(layer.image).toContain(snapshot.imageUrl)
      expect(layer.mask).toContain(`/mascots/appearance-interaction-v1/amina-${layer.name}.png`)
      expect(layer.filter).not.toBe('none')
    }
  }
  for (const [state, column, row] of [['idle', 0, 0], ['listening', 0, 1], ['thinking', 1, 1]] as const) {
    await panel.getByRole('button', { name: state, exact: true }).click()
    await expect(amina).toHaveAttribute('data-state', state)
    await expect.poll(async () => { const snapshot = await captureBody(); return [snapshot.column, snapshot.row] }).toEqual([column, row])
    assertLayers(await captureBody())
    if (state === 'thinking') await panel.locator('.lab-stage').screenshot({ path: test.info().outputPath('customized-amina-half-body-thinking.png') })
  }
  for (const [label, expression, column] of [['A little hello', 'wave', 3], ['Celebrate together', 'celebrate', 2]] as const) {
    await panel.getByRole('button', { name: label, exact: true }).click()
    await expect(amina).toHaveAttribute('data-expression', expression)
    await expect.poll(async () => { const snapshot = await captureBody(); return [snapshot.column, snapshot.row] }).toEqual([column, 1])
    assertLayers(await captureBody())
    if (expression === 'wave') await panel.locator('.lab-stage').screenshot({ path: test.info().outputPath('customized-amina-half-body-wave.png') })
  }
  await panel.getByRole('button', { name: 'speaking', exact: true }).click()
  const speakingFrames: Awaited<ReturnType<typeof captureBody>>[] = []
  for (let sample = 0; sample < 18; sample += 1) {
    const snapshot = await captureBody()
    assertLayers(snapshot)
    expect(snapshot.row).toBe(0)
    speakingFrames.push(snapshot)
    if (new Set(speakingFrames.map(frame => frame.column)).size === 4) break
    await page.waitForTimeout(80)
  }
  expect(new Set(speakingFrames.map(frame => frame.column)).size, 'Speaking restores all four original mouth frames').toBe(4)
  expect(new Set(speakingFrames.map(frame => frame.pixelHash)).size).toBe(4)
  await panel.locator('.lab-stage').screenshot({ path: test.info().outputPath('customized-amina-half-body-speaking.png') })
  await expect(panel).toContainText('Speech motion is approximate')
  await panel.getByRole('checkbox', { name: /Animate the illustration/ }).uncheck()
  await expect(amina).toHaveAttribute('data-active', 'false')
  const paused = await captureBody()
  await page.waitForTimeout(450)
  expect(await captureBody()).toEqual(paused)
  expect(paused.mouthPlayState).toBe('paused')
  expect(paused.bodyPlayState).toBe('paused')
  await panel.getByRole('checkbox', { name: /Animate the illustration/ }).check()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduced = await captureBody()
  await page.waitForTimeout(450)
  expect(await captureBody()).toEqual(reduced)
  expect([reduced.column, reduced.row]).toEqual([0, 0])
  const entries = page.locator('.experience-disclosures')
  await entries.getByRole('button', { name: /Character unlocks/ }).click()
  const collection = page.locator('#airs-character-unlocks')
  const face = collection.locator('.cosmetic-preview-agent .companion-motion')
  await expect(face).toHaveAttribute('data-ready', 'true')
  expect(await face.locator('.companion-motion__atlas').first().evaluate(element => getComputedStyle(element).backgroundImage)).toContain('amina-motion-atlas-v1.webp')
  await expect(collection.locator('.amina-demo-avatar')).toHaveCount(0)
  await expect(panel).toBeHidden()
  await expect(artwork).toBeHidden()
  await collection.locator('.cosmetic-preview-scene').screenshot({ path: test.info().outputPath('customized-amina-face-unlocks.png') })
  const smallAvatar = page.locator('.agent-presence-portrait[data-agent="AMIRA"]')
  const smallBounds = await smallAvatar.boundingBox()
  expect(smallBounds!.width).toBeLessThan(60)
  expect(smallBounds!.width).toBeCloseTo(smallBounds!.height, 1)
  await smallAvatar.screenshot({ path: test.info().outputPath('customized-amina-small-face-avatar.png') })
  expect(fixture.presentation).toEqual(savedChoices)
})
