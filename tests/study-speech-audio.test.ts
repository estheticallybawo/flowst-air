import {afterEach,expect,it,vi} from 'vitest'
import {studySpeechPlaybackBlob} from '../shared/studySpeechAudio'

afterEach(()=>vi.unstubAllGlobals())
const bytes = new Uint8Array([1,2,3]), mime = 'audio/mpeg'
function decoder(channels: number[][]) {
  vi.stubGlobal('OfflineAudioContext',class {
    async decodeAudioData() {
      return {length:channels[0]!.length,numberOfChannels:channels.length,sampleRate:24000,duration:channels[0]!.length/24000,getChannelData:(channel:number)=>new Float32Array(channels[channel]!)}
    }
  })
}
it('raises quiet speech with bounded gain and preserves channel count, duration and sample order',async()=>{
  decoder([[0,0.02,-0.02,0.01],[0,-0.01,0.01,0.02]])
  const blob=await studySpeechPlaybackBlob(bytes,mime), view=new DataView(await blob.arrayBuffer())
  expect(blob.type).toBe('audio/wav'); expect(view.getUint16(22,true)).toBe(2)
  expect(view.getUint32(24,true)).toBe(24000); expect(view.getUint32(40,true)).toBe(16)
  expect(view.getInt16(48,true)/32767).toBeCloseTo(0.08,4)
  expect(view.getInt16(50,true)/32767).toBeCloseTo(-0.04,4)
  expect(view.getInt16(52,true)/32767).toBeCloseTo(-0.08,4)
  expect(bytes).toEqual(new Uint8Array([1,2,3]))
})
it('leaves headroom for a loud transient in otherwise quiet speech',async()=>{
  decoder([[...Array(100).fill(0.01),0.5]])
  const view=new DataView(await (await studySpeechPlaybackBlob(bytes,mime)).arrayBuffer())
  expect(view.getInt16(244,true)/32767).toBeCloseTo(0.89,4)
  expect(view.getInt16(44,true)/32767).toBeCloseTo(0.0178,4)
})
it.each([['already loud',[0.8,-0.8]],['silent',[0,0]],['invalid',[Number.NaN,0.01]]])('retains the original %s clip without re-encoding it',async(_name,samples)=>{
  decoder([samples as number[]])
  const blob=await studySpeechPlaybackBlob(bytes,mime)
  expect(blob.type).toBe(mime); expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes)
})
it('retains the original clip if the browser cannot decode it offline',async()=>{
  vi.stubGlobal('OfflineAudioContext',class {async decodeAudioData(){throw new Error('Unsupported codec')}})
  expect(new Uint8Array(await (await studySpeechPlaybackBlob(bytes,mime)).arrayBuffer())).toEqual(bytes)
  vi.stubGlobal('OfflineAudioContext',undefined)
  expect(new Uint8Array(await (await studySpeechPlaybackBlob(bytes,mime)).arrayBuffer())).toEqual(bytes)
})
