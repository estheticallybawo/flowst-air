/** Raise quiet reply audio locally; cached provider audio and timings stay intact. */
export async function studySpeechPlaybackBlob(data: Uint8Array, mimeType: string): Promise<Blob> {
  const original = new Blob([data.slice().buffer], {type:mimeType})
  if (typeof OfflineAudioContext === 'undefined') return original
  try {
    // Decoding offline does not start audio output or request a microphone.
    const decoder = new OfflineAudioContext(1, 1, 24000)
    const audio = await decoder.decodeAudioData(data.slice().buffer)
    if (!audio.length || audio.duration > 600 || audio.numberOfChannels > 2) return original
    let peak = 0, squares = 0
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      for (const sample of audio.getChannelData(channel)) {
        if (!Number.isFinite(sample)) return original
        peak = Math.max(peak,Math.abs(sample)); squares += sample * sample
      }
    }
    if (!peak) return original
    const rms = Math.sqrt(squares / (audio.length * audio.numberOfChannels))
    // At most 12 dB of gain, with peak headroom. Never turn loud clips down.
    const gain = Math.min(4,0.125 / rms,0.89 / peak)
    if (gain <= 1.05) return original
    const channels = audio.numberOfChannels, blockAlign = channels * 2
    const wave = new ArrayBuffer(44 + audio.length * blockAlign), view = new DataView(wave)
    const write = (offset: number, text: string) => {
      for (let index = 0; index < text.length; index++) view.setUint8(offset+index,text.charCodeAt(index))
    }
    write(0,'RIFF'); view.setUint32(4,wave.byteLength-8,true); write(8,'WAVEfmt ')
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true)
    view.setUint32(24,audio.sampleRate,true); view.setUint32(28,audio.sampleRate*blockAlign,true)
    view.setUint16(32,blockAlign,true); view.setUint16(34,16,true)
    write(36,'data'); view.setUint32(40,wave.byteLength-44,true)
    for (let channel = 0; channel < channels; channel++) {
      const samples = audio.getChannelData(channel)
      for (let frame = 0; frame < audio.length; frame++) {
        view.setInt16(44 + frame*blockAlign + channel*2,Math.round(samples[frame]! * gain * 32767),true)
      }
    }
    return new Blob([wave], {type:'audio/wav'})
  } catch {
    // Unsupported codecs or offline decoding must not prevent normal playback.
    return original
  }
}
