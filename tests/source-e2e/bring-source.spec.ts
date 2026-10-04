import {test,expect} from '@playwright/test'
import {PDFDocument} from 'pdf-lib'
const preferences={purpose:'INTERVIEW',scope:'FOCUSED',timeBudgetMinutes:15,context:'Explain the material clearly'}
for(const fixture of ['GITHUB','WEB','VIDEO']) test(fixture+' review retains attribution, approval and owner isolation',async({request})=>{
 const owner='source-'+fixture.toLowerCase(),headers={authorization:'Bearer mock:'+owner}
 const inspected=await request.post('/api/study/sources/inspect',{headers,data:{url:'',fixture}})
 expect(inspected.status()).toBe(200)
 const draft=await inspected.json()
 expect(draft.status).toBe('READY');expect(draft.fixture).toBe(true)
 const reviewed=await request.get('/api/study/sources/'+draft.id,{headers})
 expect(reviewed.status()).toBe(200)
 const created=await request.post('/api/study/conversations/from-source',{headers,data:{sourceId:draft.id,preferences,confirmSource:true}})
 expect(created.status()).toBe(200)
 const conversation=await created.json(),id=conversation.id
 try {
 const planned=await request.post('/api/study/conversations/'+id+'/plan',{headers,data:{}})
 expect(planned.status()).toBe(200)
 const current=await (await request.get('/api/study/conversations/'+id,{headers})).json()
 expect(current.document.provenance.fixture).toBe(true)
 expect(current.plan.status).toBe('DRAFT')
 const approval=await request.post('/api/study/conversations/'+id+'/plan/approve',{headers,data:{version:current.plan.version}})
 expect(approval.status()).toBe(200)
 const other=await request.get('/api/study/conversations/'+id,{headers:{authorization:'Bearer mock:other'}})
 expect(other.status()).toBe(404)
 const gated=await request.post('/api/study/sources/inspect',{headers,data:{url:'',fixture:'WEB'}})
 expect(gated.status()).toBe(409)
 } finally {await request.post('/api/study/conversations/'+id+'/abandon',{headers,data:{confirmAbandon:true}})}
})
test('document preview is bounded and does not create a plan',async({request})=>{
 const pdf=await PDFDocument.create();pdf.addPage().drawText('Retrieval practice means recalling before checking your notes.');const data=Buffer.from(await pdf.save())
 const response=await request.post('/api/study/sources/document-preview',{headers:{authorization:'Bearer mock:document-preview'},multipart:{file:{name:'notes.pdf',mimeType:'application/pdf',buffer:data}}})
 expect(response.status()).toBe(200)
 const preview=await response.json();expect(preview.sections.length).toBeGreaterThan(0);expect(preview.plan).toBeUndefined()
})
