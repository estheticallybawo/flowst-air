import fs from 'node:fs'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {files,writeBaseline,verifyBaseline,checkAgainstFlowst} from '../scripts/check-flowst-parity.mjs'
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
function fixture(){const root=path.resolve(tmpdir(),'airs-parity-memory-'+(++sequence));roots.push(root);for(const file of files)data.set(path.join(root,file),Buffer.from('fixture\n'));return root}
it('blocks changed or missing shared files until cross-repository parity is restored',()=>{
 const a=fixture(),b=fixture();expect(checkAgainstFlowst(a,b)).toEqual([]);writeBaseline(b);expect(verifyBaseline(b)).toEqual([])
 const file='server/services/studyMisu.ts';fs.writeFileSync(path.join(b,file),'changed\n')
 expect(verifyBaseline(b)).toContain('Unverified shared change: '+file);expect(checkAgainstFlowst(a,b)).toContain('Shared Airs mismatch: '+file)
 fs.writeFileSync(path.join(a,file),'changed\n');expect(checkAgainstFlowst(a,b)).toEqual([]);writeBaseline(b);expect(verifyBaseline(b)).toEqual([])
 data.delete(path.join(b,file));expect(verifyBaseline(b)).toContain('Unverified shared change: '+file)
})
it('does not exempt arbitrary future audio or keyboard changes',()=>{
 const a=fixture(),b=fixture();for(const file of ['components/AirCallRoom.vue','components/AirStudyShell.vue'])fs.writeFileSync(path.join(b,file),'unreviewed\n')
 expect(checkAgainstFlowst(a,b)).toEqual(['Shared Airs mismatch: components/AirCallRoom.vue','Shared Airs mismatch: components/AirStudyShell.vue'])
})
it('rejects a baseline whose scope silently dropped a shared module',()=>{
 const root=fixture();writeBaseline(root);const file=path.join(root,'docs/generated/shared-parity.json');const baseline=JSON.parse(fs.readFileSync(file,'utf8'));baseline.files.pop();fs.writeFileSync(file,JSON.stringify(baseline));expect(verifyBaseline(root)[0]).toContain('does not match')
})
