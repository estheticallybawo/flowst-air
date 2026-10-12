import fs from 'node:fs'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {files,routeAdaptations,writeBaseline,verifyBaseline,checkAgainstFlowst} from '../scripts/check-flowst-parity.mjs'
const data=new Map<string,Buffer>(),roots:string[]=[]
let sequence=0
const key=(p:any)=>String(p)
const local=(p:any)=>roots.some(root=>key(p).startsWith(root+path.sep))
beforeEach(()=>{
 data.clear();roots.length=0
 const read=fs.readFileSync.bind(fs),exists=fs.existsSync.bind(fs),write=fs.writeFileSync.bind(fs),mkdir=fs.mkdirSync.bind(fs)
 vi.spyOn(fs,'existsSync').mockImplementation((p:any)=>local(p)?data.has(key(p)):exists(p))
 vi.spyOn(fs,'readFileSync').mockImplementation(((p:any,encoding:any)=>{if(!local(p))return read(p,encoding);const b=data.get(key(p));if(!b)throw new Error('Missing fixture');return encoding==='utf8'?b.toString('utf8'):b}) as any)
 vi.spyOn(fs,'writeFileSync').mockImplementation(((p:any,value:any,options:any)=>{if(!local(p))return write(p,value,options);data.set(key(p),Buffer.from(value))}) as any)
 vi.spyOn(fs,'mkdirSync').mockImplementation(((p:any,options:any)=>{if(!local(p))return mkdir(p,options);return undefined}) as any)
})
afterEach(()=>vi.restoreAllMocks())
function fixture(shared=false){const root=path.resolve(tmpdir(),'airs-parity-memory-'+(++sequence));roots.push(root);for(const file of files){const sourceFile=shared?(routeAdaptations.sourcePaths as Record<string,string>)[file]||file:file;data.set(path.join(root,sourceFile),Buffer.from('fixture\n'))}return root}
it('blocks changed or missing shared files until cross-repository parity is restored',()=>{
 const a=fixture(true),b=fixture();expect(checkAgainstFlowst(a,b)).toEqual([]);writeBaseline(b);expect(verifyBaseline(b)).toEqual([])
 const file='server/services/studyMisu.ts';fs.writeFileSync(path.join(b,file),'changed\n')
 expect(verifyBaseline(b)).toContain('Unverified shared change: '+file);expect(checkAgainstFlowst(a,b)).toContain('Shared Airs mismatch: '+file)
 fs.writeFileSync(path.join(a,file),'changed\n');expect(checkAgainstFlowst(a,b)).toEqual([]);writeBaseline(b);expect(verifyBaseline(b)).toEqual([])
 data.delete(path.join(b,file));expect(verifyBaseline(b)).toContain('Unverified shared change: '+file)
})
it('does not exempt arbitrary future audio or keyboard changes',()=>{
 const a=fixture(true),b=fixture();for(const file of ['components/AirCallRoom.vue','components/AirStudyShell.vue'])fs.writeFileSync(path.join(b,file),'unreviewed\n')
 expect(checkAgainstFlowst(a,b)).toEqual(['Shared Airs mismatch: components/AirCallRoom.vue','Shared Airs mismatch: components/AirStudyShell.vue'])
})
it('rejects a baseline whose scope silently dropped a shared module',()=>{
 const root=fixture();writeBaseline(root);const file=path.join(root,'docs/generated/shared-parity.json');const baseline=JSON.parse(fs.readFileSync(file,'utf8'));baseline.files.pop();fs.writeFileSync(file,JSON.stringify(baseline));expect(verifyBaseline(root)[0]).toContain('does not match')
})

it('compares renamed workspace pages with the retained Flowst source paths',()=>{
 const host=fixture(true),target=fixture(),file='pages/home/new.vue',sourceFile='pages/airs/new.vue'
 expect(data.has(path.join(host,file))).toBe(false)
 expect(data.has(path.join(host,sourceFile))).toBe(true)
 expect(checkAgainstFlowst(host,target)).toEqual([])
 fs.writeFileSync(path.join(host,sourceFile),'unreviewed source change\n')
 expect(checkAgainstFlowst(host,target)).toEqual(['Shared Airs mismatch: '+file])
 data.delete(path.join(host,sourceFile))
 expect(checkAgainstFlowst(host,target)).toEqual(['Missing shared file: '+file+' (Flowst source: '+sourceFile+')'])
})
it('normalizes only reviewed workspace URL prefixes and leaves foreign literals exact',()=>{
 const host=fixture(true),target=fixture()
 const shared=[
  'const route = "/airs/new";',
  'const root = "/airs";',
  'const query = "/airs?from=source";',
  'const regex = /\\/airs\\//;',
  'const end = /\\/airs$/;',
  'const dynamic = '+String.fromCharCode(96)+'/airs/'+'$'+'{id}'+String.fromCharCode(96)+';',
  'const longer = "/homepage";',
  'const nested = "/other/home/new";',
  'const nestedRegex = /\\/other\\/home\\//;',
  'const anchored = /^\\/airs$/;',
  'const module = "~/home/file";',
 ].join('\n')
 const standalone=shared.replaceAll('/airs','/home')
 for(const file of routeAdaptations.normalizedFiles){
  const sourceFile=(routeAdaptations.sourcePaths as Record<string,string>)[file]||file
  fs.writeFileSync(path.join(host,sourceFile),shared)
  fs.writeFileSync(path.join(target,file),standalone)
 }
 expect(checkAgainstFlowst(host,target)).toEqual([])
 const adapted=routeAdaptations.normalizedFiles[0]!
 fs.writeFileSync(path.join(target,adapted),standalone.replace('/homepage','/airspage'))
 expect(checkAgainstFlowst(host,target)).toEqual(['Shared Airs mismatch: '+adapted])
 fs.writeFileSync(path.join(target,adapted),standalone)
 const excluded='server/services/studySources.ts'
 fs.writeFileSync(path.join(host,excluded),'const route = "/airs/new";')
 fs.writeFileSync(path.join(target,excluded),'const route = "/home/new";')
 expect(checkAgainstFlowst(host,target)).toEqual(['Shared Airs mismatch: '+excluded])
})
it('pins actual standalone route source and rejects unreviewed adaptation metadata',()=>{
 const host=fixture(true),target=fixture(),file=routeAdaptations.normalizedFiles[0]!
 fs.writeFileSync(path.join(host,file),'const route = "/airs/new";')
 fs.writeFileSync(path.join(target,file),'const route = "/home/new";')
 expect(checkAgainstFlowst(host,target)).toEqual([])
 writeBaseline(target)
 expect(verifyBaseline(target)).toEqual([])
 fs.writeFileSync(path.join(target,file),'const route = "/airs/new";')
 expect(checkAgainstFlowst(host,target)).toEqual([])
 expect(verifyBaseline(target)).toEqual(['Unverified shared change: '+file])
 fs.writeFileSync(path.join(target,file),'const route = "/home/new";')
 const baselineFile=path.join(target,'docs/generated/shared-parity.json'),baseline=JSON.parse(fs.readFileSync(baselineFile,'utf8'))
 baseline.routeAdaptations.normalizedFiles.push('server/services/studySources.ts')
 fs.writeFileSync(baselineFile,JSON.stringify(baseline))
 expect(verifyBaseline(target)[0]).toContain('does not match')
})
