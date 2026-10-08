import { expect, test } from '@playwright/test'
const headers = { authorization: 'Bearer mock:member' }
test('Misu respects a provider retry delay across reload without automatically resubmitting', async ({ page, context }) => {
  test.setTimeout(300000)
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  await context.setExtraHTTPHeaders(headers)
  await context.route('**/api/study/**', route => route.continue({ headers: { ...route.request().headers(), ...headers } }))
  expect((await context.request.post('/api/auth/dev-session', { data: { scenario: 'member' } })).status()).toBe(200)
  const source = await (await context.request.post('/api/study/sources/inspect', { headers, data: { url: '', fixture: 'WEB' } })).json()
  const created = await context.request.post('/api/study/conversations/from-source', { headers, data: { sourceId: source.id, confirmSource: true, preferences: { purpose: 'UNDERSTAND', scope: 'BROAD', timeBudgetMinutes: 15, context: 'Provider recovery fixture' } } })
  expect(created.status()).toBe(200)
  const study = await created.json(), base = '/api/study/conversations/' + study.id
  let requests = 0
  try {
    await page.route('**' + base, route => route.fulfill({ json: { ...study, plan: { ...study.plan, status: 'FAILED', error: 'A previous fixture preparation failed.' } } }))
    await page.route('**' + base + '/plan', route => {
      requests++
      return route.fulfill({ status: 429, json: { statusCode: 429, statusMessage: 'The learning service has reached a request or token limit. Your source is still available. Wait before retrying this step.', data: { code: 'AGENT_PROVIDER_RATE_LIMITED', retryAfterSeconds: 20 } } })
    })
    await page.goto('/airs/' + study.id)
    await page.getByRole('button', { name: 'Retry plan', exact: true }).click()
    await expect(page.getByRole('button', { name: /Retry available in/ })).toBeDisabled()
    expect(requests).toBe(1)
    await page.reload()
    const retry = page.getByRole('button', { name: /Retry available in/ })
    await expect(retry).toBeDisabled()
    expect(requests).toBe(1)
    await page.screenshot({ path: test.info().outputPath('provider-retry-' + test.info().project.name + '.png'), fullPage: true })
    await expect(page.getByRole('button', { name: 'Retry plan', exact: true })).toBeEnabled({ timeout: 25000 })
    expect(requests).toBe(1)
    await page.getByRole('button', { name: 'Retry plan', exact: true }).click()
    await expect(page.getByRole('button', { name: /Retry available in/ })).toBeDisabled()
    expect(requests).toBe(2)
  } finally {
    await context.request.post(base + '/abandon', { headers, data: { confirmAbandon: true } })
    await context.request.delete(base, { headers })
  }
})
