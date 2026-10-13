import {afterEach,beforeEach,expect,it,vi} from 'vitest'
vi.mock('../server/services/sources/web',()=>({websiteSnapshot:vi.fn()}))
import {websiteSnapshot} from '../server/services/sources/web'
import {relatedStudyReferences} from '../server/services/studyRelatedResearch'
const topic='Venture creation. Explain how entrepreneurs validate market demand.'
const page={title:'Venture creation research',extraction:{kind:'WEB' as const,excerpt:'Venture creation',sections:[{id:'p1',label:'Research',text:'Venture creation requires entrepreneurs to validate market demand before scaling.'}],provenance:{url:'https://example.org/venture',retrievedAt:'2026-10-12T10:00:00Z',provider:'Public HTML / Readability',hash:'original',omissions:[]}}}
beforeEach(()=>{vi.stubGlobal('useRuntimeConfig',()=>({groqApiKey:'fixture-key'}));vi.mocked(websiteSnapshot).mockReset();vi.mocked(websiteSnapshot).mockResolvedValue(page)})
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()})
const response=(content:string,finish_reason='stop')=>new Response(JSON.stringify({choices:[{finish_reason,message:{content}}]}))

it('uses browser search only to discover URLs, then saves readable related pages with their provenance',async()=>{
 const fetcher=vi.fn(async()=>response('https://example.org/venture\nhttps://example.org/venture'));vi.stubGlobal('fetch',fetcher)
 const refs=await relatedStudyReferences(topic)
 expect(fetcher).toHaveBeenCalledTimes(1);expect(websiteSnapshot).toHaveBeenCalledTimes(1)
 const payload=JSON.parse((fetcher.mock.calls as any)[0][1].body)
 expect(payload).toMatchObject({model:'openai/gpt-oss-20b',tools:[{type:'browser_search'}],tool_choice:'required',reasoning_effort:'low'})
 expect(JSON.stringify(payload)).not.toMatch(/learnerTurnIds|answers|history|response_format/)
 expect(refs).toHaveLength(1);expect(refs[0]).toMatchObject({origin:'RELATED_WEB',label:page.title,location:{url:'https://example.org/venture'},retrievedAt:page.extraction.provenance.retrievedAt,excerpt:page.extraction.sections[0]!.text})
 expect(refs[0]!.id).toMatch(/^related-web:[a-f0-9]{24}$/);expect(refs[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/)
})
it('ignores private destinations, non-URLs, unrelated pages and pages that cannot be read',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>response('javascript:alert(1) https://127.0.0.1/private https://example.org/unrelated https://example.net/unreadable')))
 vi.mocked(websiteSnapshot).mockResolvedValueOnce({...page,title:'Weather report',extraction:{...page.extraction,sections:[{id:'w',label:'Weather',text:'Tomorrow brings clear skies.'}]}}).mockRejectedValueOnce(new Error('Unavailable'))
 expect(await relatedStudyReferences(topic)).toEqual([])
 expect(websiteSnapshot).toHaveBeenCalledTimes(2)
 expect(vi.mocked(websiteSnapshot).mock.calls.map(call=>call[0])).toEqual(['https://example.org/unrelated','https://example.net/unreadable'])
})
it.each(['connection','rate limit','truncated','no URLs'])('does not retry an unavailable %s search or return model claims as sources',async failure=>{
 const fetcher=vi.fn(async()=>{if(failure==='connection')throw new Error('Unknown dispatch outcome');return failure==='rate limit'?new Response('',{status:429}):response(failure==='no URLs'?'An unsupported model answer.':'https://example.org/venture',failure==='truncated'?'length':'stop')})
 vi.stubGlobal('fetch',fetcher)
 expect(await relatedStudyReferences(topic)).toEqual([]);expect(fetcher).toHaveBeenCalledTimes(1);expect(websiteSnapshot).not.toHaveBeenCalled()
})
it('does not dispatch when research credentials are unavailable',async()=>{
 vi.stubGlobal('useRuntimeConfig',()=>({groqApiKey:''}));const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
 expect(await relatedStudyReferences(topic)).toEqual([]);expect(fetcher).not.toHaveBeenCalled()
})
