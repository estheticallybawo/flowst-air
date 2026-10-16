import { expect, test, type Page } from '@playwright/test'
import { DEFAULT_AGENT_PRESENTATION, normalizeAgentPresentation } from '../../shared/agentPresentation'

interface LibraryAppearanceRuntime {
  __libraryAppearanceDevices: { microphone: number; screen: number }
}

interface LibraryAppearanceEffects {
  mutations: string[]
  providers: string[]
  external: string[]
  unexpectedReads: string[]
  errors: string[]
}

const effects = new WeakMap<Page, LibraryAppearanceEffects>()
const providerPattern = /(?:agora\.(?:io|cn|api)|lemonslice\.(?:com|ai)|api\.openai\.com|api\.elevenlabs\.io|api\.groq\.com|api\.deepgram\.com|api\.minimax\.io|bedrock-runtime\.[^/]+\.amazonaws\.com)/i
const normalReads = new Set(['/api/auth/session', '/api/me', '/api/air/access', '/api/study/conversations', '/api/study/upload-eligibility', '/api/study/presentation'])
test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.addInitScript(() => {
    const runtime = window as unknown as LibraryAppearanceRuntime
    runtime.__libraryAppearanceDevices = { microphone: 0, screen: 0 }
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => { runtime.__libraryAppearanceDevices.microphone += 1; throw new Error('Library appearance must not use the microphone') },
        getDisplayMedia: async () => { runtime.__libraryAppearanceDevices.screen += 1; throw new Error('Library appearance must not share a screen') },
      },
    })
  })
  const session = await page.request.post('/api/auth/dev-session', { data: { scenario: 'member' } })
  expect(session.ok()).toBe(true)
  const observed: LibraryAppearanceEffects = { mutations: [], providers: [], external: [], unexpectedReads: [], errors: [] }
  effects.set(page, observed)
  page.on('pageerror', error => observed.errors.push(error.message))
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) observed.mutations.push(url.pathname)
    if (providerPattern.test(request.url())) observed.providers.push(url.origin + url.pathname)
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:4322' && url.origin !== 'https://fonts.googleapis.com') observed.external.push(url.origin + url.pathname)
    if (url.pathname.startsWith('/api/') && request.method() === 'GET' && !normalReads.has(url.pathname)) observed.unexpectedReads.push(url.pathname)
  })
  const presentation = normalizeAgentPresentation(DEFAULT_AGENT_PRESENTATION)
  presentation.agents.AMIRA = { ...presentation.agents.AMIRA, skinTone: 'honey', hairColor: 'blonde' }
  await page.route(providerPattern, route => route.abort('blockedbyclient'))
  await page.route('**/api/**', route => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.method() !== 'GET' || !normalReads.has(pathname)) return route.abort('blockedbyclient')
    if (pathname === '/api/study/presentation') return route.fulfill({ json: { presentation, revision: 'library-appearance-read-only' } })
    return route.continue()
  })
  await page.route(/^https?:\/\//, route => {
    const url = new URL(route.request().url())
    return url.origin === 'http://127.0.0.1:4322' || url.origin === 'https://fonts.googleapis.com' ? route.fallback() : route.abort('blockedbyclient')
  })
})

test.afterEach(async ({ page }) => {
  const observed = effects.get(page)!
  expect(observed.mutations, 'Viewing saved appearance must not mutate application records').toEqual([])
  expect(observed.providers, 'Library portraits must not contact AI or voice providers').toEqual([])
  expect(observed.external, 'Library portrait rendering must stay local').toEqual([])
  expect(observed.unexpectedReads, 'Only existing Library, authentication and saved-appearance reads are permitted').toEqual([])
  expect(observed.errors).toEqual([])
  expect(await page.evaluate(() => (window as unknown as LibraryAppearanceRuntime).__libraryAppearanceDevices)).toEqual({ microphone: 0, screen: 0 })
})

test('saved Amina skin and hair remain registered to the Library half-body portrait', async ({ page, isMobile }) => {
  await page.goto('/home/library', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean((document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null)?.__vue_app__), undefined, { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: /Bring the notes\.\s*Own the idea\./ })).toBeVisible()
  const hero = page.locator('.air-library .intro-image')
  if (isMobile) {
    await expect(hero).toBeHidden()
    await page.screenshot({ path: test.info().outputPath('customized-amina-library-mobile.png') })
    return
  }
  await expect(hero).toBeVisible()
  const portrait = hero.locator('.agent-portrait[data-agent="AMIRA"]')
  await expect(portrait.locator('.agent-portrait__base')).toBeVisible()
  await expect(portrait.locator('.agent-portrait__layer')).toHaveCount(2)
  await expect.poll(() => portrait.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth === 768 && (image as HTMLImageElement).naturalHeight === 960))).toBe(true)
  const geometry = await portrait.evaluate(async root => {
    const readImage = (image: HTMLImageElement) => {
      const style = getComputedStyle(image)
      const bounds = image.getBoundingClientRect()
      return {
        source: new URL(image.currentSrc).pathname,
        dimensions: [image.naturalWidth, image.naturalHeight],
        bounds: [bounds.x, bounds.y, bounds.width, bounds.height],
        fit: style.objectFit, position: style.objectPosition, filter: style.filter,
        maskSize: style.maskSize, maskPosition: style.maskPosition, maskImage: style.maskImage,
      }
    }
    const base = readImage(root.querySelector<HTMLImageElement>('.agent-portrait__base')!)
    const layers = await Promise.all(Array.from(root.querySelectorAll<HTMLImageElement>('.agent-portrait__layer')).map(async image => {
      const layer = readImage(image)
      const maskUrl = layer.maskImage.match(/url\(["']?(.*?)["']?\)/)?.[1]
      if (!maskUrl) throw new Error('Customized Library layers require a registered region mask')
      const mask = new Image()
      mask.src = maskUrl
      await mask.decode()
      return { ...layer, maskSource: new URL(maskUrl).pathname, maskDimensions: [mask.naturalWidth, mask.naturalHeight] }
    }))
    return { base, layers }
  })
  expect(geometry.base.source).toBe('/optimized/v1/mascots/amina/portrait.webp')
  expect(geometry.base.dimensions).toEqual([768, 960])
  expect(geometry.base.fit).toBe('contain')
  expect(geometry.base.position).toBe('50% 100%')
  expect(geometry.layers.map(layer => layer.maskSource).sort()).toEqual(['/mascots/appearance-v1/amina-hair.png', '/mascots/appearance-v1/amina-skin.png'])
  for (const layer of geometry.layers) {
    expect(layer.source).toBe(geometry.base.source)
    expect(layer.dimensions).toEqual(geometry.base.dimensions)
    expect(layer.bounds).toEqual(geometry.base.bounds)
    expect(layer.maskDimensions).toEqual(geometry.base.dimensions)
    expect(layer.fit).toBe(geometry.base.fit)
    expect(layer.maskSize).toBe(geometry.base.fit)
    expect(layer.position).toBe(geometry.base.position)
    expect(layer.maskPosition).toBe(geometry.base.position)
    expect(layer.filter).not.toBe('none')
  }
  await hero.screenshot({ path: test.info().outputPath('customized-amina-library-half-body.png') })
})
