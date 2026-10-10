import {expect,test} from '@playwright/test'

test('retries a saved response directly without recording or sending audio again',async({page,context})=>{
 test.setTimeout(300000)
 const headers={authorization:'Bearer mock:member'},api=context.request
 await context.route('https://fonts.googleapis.com/**',route=>route.fulfill({status:200,contentType:'text/css',body:''}))
 await context.setExtraHTTPHeaders(headers)
 await context.route('**/api/study/**',route=>route.continue({headers:{...route.request().headers(),...headers}}))
 await page.addInitScript(()=>{(window as any).__recoveryMic=0; if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{value:{}});Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{(window as any).__recoveryMic++;throw new Error('Fixture microphone must remain off')}})})
 const session=await api.post('/api/auth/dev-session',{data:{scenario:'member'},timeout:20000});expect(session.status(),await session.text()).toBe(200)
 const inspected=await api.post('/api/study/sources/inspect',{headers,data:{url:'',fixture:'WEB'},timeout:20000});expect(inspected.status(),await inspected.text()).toBe(200);const source=await inspected.json()
 const created=await api.post('/api/study/conversations/from-source',{headers,data:{sourceId:source.id,confirmSource:true,preferences:{purpose:'UNDERSTAND',scope:'BROAD',timeBudgetMinutes:15,context:'Saved response recovery fixture'}},timeout:20000});expect(created.status(),await created.text()).toBe(200);const study=await created.json()
 const base='/api/study/conversations/'+study.id
 let retries=0,recordings=0,pending=true
 const diagnostics:string[]=[],inFlight=new Set<string>()
 page.on('request',r=>inFlight.add(new URL(r.url()).pathname))
 page.on('requestfinished',r=>inFlight.delete(new URL(r.url()).pathname))
 page.on('pageerror',e=>diagnostics.push(e.message))
 page.on('requestfailed',r=>diagnostics.push(new URL(r.url()).pathname+': '+r.failure()?.errorText))
 try{
  expect((await api.post(base+'/plan',{headers,data:{}})).status()).toBe(200)
  const planned=await (await api.get(base,{headers})).json()
  expect((await api.post(base+'/plan/approve',{headers,data:{version:planned.plan.version}})).status()).toBe(200)
  expect((await api.post(base+'/welcome',{headers,data:{}})).status()).toBe(200)
  if(planned.plan.pacing)expect((await api.post(base+'/pacing',{headers,data:{action:'START',revision:''}})).status()).toBe(200)
  expect((await api.post(base+'/control',{headers,data:{action:'INTRO'}})).status()).toBe(200)
  const saved=await (await api.get(base,{headers})).json()
  const failure='Misu could not review your saved answer: the review is missing its interaction status. Retry saved response.'
  await page.route('**'+base,route=>route.fulfill({json:{...saved,revision:saved.revision+(pending?0:1),objectiveFlow:{...saved.objectiveFlow,pendingOperationId:pending?'fixture-saved-operation':undefined,pendingReview:pending,error:pending?failure:undefined}}}))
  await page.route('**'+base+'/objective/retry',route=>{retries++;if(retries===1)return route.fulfill({status:502,json:{statusCode:502,statusMessage:failure,data:{code:'MISU_REVIEW_INVALID'}}});pending=false;return route.fulfill({json:{}})})
  await page.route('**'+base+'/recorded-turn',route=>{if(route.request().method()==='POST')recordings++;return route.fulfill({status:500,json:{}})})
  await page.goto('/airs/'+study.id,{waitUntil:'domcontentloaded'})
  const recovery=page.getByTestId('saved-response-recovery')
  await expect(recovery).toBeVisible({timeout:90000});await expect(recovery).toContainText('Your input is saved')
  await expect(page.locator('.call-actions').getByText(failure,{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Send recording',exact:true})).toHaveCount(0)
  await page.reload({waitUntil:'domcontentloaded'});await expect(recovery).toBeVisible({timeout:90000});expect(retries).toBe(0)
  await recovery.getByRole('button',{name:'Retry saved response',exact:true}).click()
  await expect(recovery.getByRole('button',{name:'Retry saved response',exact:true})).toBeEnabled();expect(retries).toBe(1)
  await expect(page.locator('.call-actions').getByText(failure,{exact:true})).toBeVisible()
  await recovery.getByRole('button',{name:'Retry saved response',exact:true}).click()
  await expect(recovery).toHaveCount(0);expect(retries).toBe(2);expect(recordings).toBe(0)
  await expect(page.locator('.call-actions').getByText(failure,{exact:true})).toHaveCount(0)
  expect(await page.evaluate(()=>(window as any).__recoveryMic)).toBe(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 }catch(cause){console.log(JSON.stringify({browserDiagnostics:diagnostics,inFlight:[...inFlight]}));throw cause}finally{await api.post(base+'/abandon',{headers,data:{confirmAbandon:true},timeout:10000}).catch(()=>{});await api.delete(base,{headers,timeout:10000}).catch(()=>{})}
})
