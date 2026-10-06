import {expect,test} from '@playwright/test'

// Labelled source fixture + real controller/storage. Speech intentionally fails;
// this verifies recovery and UI handoff, never provider quality or audibility.
test('deferred objectives remain gaps and an ended session opens Kai automatically',async({page,context})=>{
 test.setTimeout(300000)
 const errors:string[]=[];let liveStarts=0
 page.on('pageerror',error=>errors.push(error.message))
 page.on('request',request=>{if(request.method()==='POST' && /\/live\/start/.test(request.url()))liveStarts++})
 await page.addInitScript(()=>{
  // Simulated playback events keep this fixture independent of audio hardware.
  const NativeAudio = window.Audio;
  (window as any).Audio = function (src?: string) {
    const audio = new NativeAudio(src); let paused = true;
    Object.defineProperty(audio,'paused',{get:()=>paused});
    audio.play=async()=>{paused=false;audio.dispatchEvent(new Event('playing'))};
    audio.pause=()=>{paused=true;audio.dispatchEvent(new Event('pause'))};
    return audio;
  };
  (window as any).Audio.prototype=NativeAudio.prototype;
  (window as any).__objectiveMicRequests=0
  if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{}})
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{(window as any).__objectiveMicRequests++;throw new DOMException('Fixture microphone must remain off','NotAllowedError')}})
 })
 const headers={authorization:'Bearer mock:member'},api=context.request
 // Public pages bootstrap a guest session; pin this signed-in fixture's requests
 // to the same owner used by setup, including browser and SSR navigation.
 await context.setExtraHTTPHeaders(headers)
 await context.route('**/api/study/**',route=>route.continue({headers:{...route.request().headers(),...headers}}))
 expect((await api.post('/api/auth/dev-session',{data:{scenario:'member'}})).status()).toBe(200)
 const inspected=await api.post('/api/study/sources/inspect',{headers,data:{url:'',fixture:'WEB'}})
 expect(inspected.status()).toBe(200)
 const source=await inspected.json()
 const created=await api.post('/api/study/conversations/from-source',{headers,data:{sourceId:source.id,confirmSource:true,preferences:{purpose:'UNDERSTAND',scope:'BROAD',timeBudgetMinutes:15,context:'Explain the source clearly'}}})
 expect(created.status()).toBe(200)
 const {id}=await created.json(),base='/api/study/conversations/'+id
 try {
  expect((await api.post(base+'/plan',{headers,data:{}})).status()).toBe(200)
  const planned=await (await api.get(base,{headers})).json()
  expect(planned.plan.objectives.length).toBeGreaterThan(1)
  expect((await api.post(base+'/plan/approve',{headers,data:{version:planned.plan.version}})).status()).toBe(200)
  expect((await api.post(base+'/welcome',{headers,data:{}})).status()).toBe(200)
  if(planned.plan.pacing)expect((await api.post(base+'/pacing',{headers,data:{action:'START',revision:''}})).status()).toBe(200)
  expect((await api.post(base+'/control',{headers,data:{action:'INTRO'}})).status()).toBe(200)
  const first=await (await api.get(base,{headers})).json()
  expect(first.objectiveFlow.version).toBe('0.2')
  await page.route('**/api/study/conversations/*/speech',route=>route.fulfill({status:503,json:{statusMessage:'Fixture voice recovery required',data:{code:'SPEECH_PROVIDER_QUOTA',retryable:false}}}))
  await page.goto('/airs/'+id,{waitUntil:'domcontentloaded'})
  const controls=page.getByRole('region',{name:'Objective controls',exact:true})
  await expect(controls).toBeVisible({timeout:90000})
  const openControls=async()=>{const details=controls.locator('details');if(!await details.evaluate(node=>(node as HTMLDetailsElement).open)){await details.locator('summary').focus();await details.locator('summary').press('Enter')}}
  await openControls()
  await controls.getByRole('button',{name:'Pause',exact:true}).click()
  await expect(page.getByText('Practice is paused',{exact:true})).toBeVisible()
  const viewport=page.viewportSize()!
  if(test.info().project.name==='desktop')await page.setViewportSize({...viewport,height:600})
  await expect.poll(()=>page.locator('.call-stage').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1)
  expect(await page.locator('.call-stage').evaluate(el=>getComputedStyle(el).overflowY)).toBe('hidden')
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true)
  await page.screenshot({path:'test-results/objective-paused-'+test.info().project.name+'.png',fullPage:true})
  await openControls()
  await expect.poll(()=>page.locator('.call-stage').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1)
  expect(await controls.getByRole('button',{name:'Resume practice',exact:true}).evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  if(test.info().project.name==='desktop')await page.setViewportSize(viewport)
  await openControls()
  await controls.getByRole('button',{name:'Resume practice',exact:true}).click()
  await openControls()
  await controls.getByRole('button',{name:'Defer objective',exact:true}).click()
  await expect.poll(async()=> (await (await api.get(base,{headers})).json()).plan.activeObjectiveId).not.toBe(first.plan.activeObjectiveId)
  const deferred=await (await api.get(base,{headers})).json()
  expect(deferred.objectiveFlow.ledger[0].status).toBe('deferred')
  expect(deferred.turns.at(-1).nextPrompt.objectiveId).toBe(deferred.plan.activeObjectiveId)
  await expect(page.getByRole('button',{name:/Continue to next objective/})).toHaveCount(0)
  await expect(controls).toContainText('0 of')
  await openControls()
  await controls.getByRole('button',{name:'End session',exact:true}).click()
  const kai=page.getByRole('dialog',{name:'Kai’s practice review',exact:true})
  await expect(kai).toBeVisible({timeout:45000})
  await expect(kai.getByRole('region',{name:'Session outcomes'})).toContainText('Session ended with gaps')
  await expect(kai).toContainText('Understanding was not assessed')
  const ended=await (await api.get(base,{headers})).json()
  expect(ended.objectiveFlow.sessionStatus).toBe('ended_with_gaps')
  expect(ended.objectiveFlow.ledger.every((entry:any)=>entry.status==='deferred')).toBe(true)
  expect(ended.objectiveFlow.ledger[0].deferReason).toBe('learner_deferred')
  await expect(kai).toContainText('You deferred this objective for later practice.')
  expect(ended.plan.courseCompletedAt).toBeUndefined()
  expect(ended.journey.completedObjectiveIds).toEqual([])
  expect(await page.evaluate(()=>(window as any).__objectiveMicRequests)).toBe(0)
  expect(liveStarts).toBe(0);expect(errors).toEqual([])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'test-results/objective-gaps-'+test.info().project.name+'.png',fullPage:true})
 } finally {await api.post(base+'/abandon',{headers,data:{confirmAbandon:true}})}
})
