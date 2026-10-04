/* Browser-only PCM capture; no audio or credentials are retained. */
class AminaCapture extends AudioWorkletProcessor {
 constructor() { super(); this.phase = 0; this.sum = 0; this.count = 0; this.frame = new Int16Array(1600); this.offset = 0; }
 process(inputs) { const channel = inputs[0]?.[0]; if (!channel) return true; let energy = 0;
  for (const sample of channel) { energy += sample * sample; this.sum += sample; this.count++; this.phase += 16000;
   if (this.phase >= sampleRate) { this.phase -= sampleRate; const value = Math.max(-1, Math.min(1, this.sum / this.count)); this.frame[this.offset++] = value < 0 ? value * 32768 : value * 32767; this.sum = 0; this.count = 0;
    if (this.offset === this.frame.length) { this.port.postMessage({ audio: this.frame.buffer, level: Math.sqrt(energy / channel.length) }, [this.frame.buffer]); this.frame = new Int16Array(1600); this.offset = 0; }
   }
  } return true;
 }
}
registerProcessor('airs-capture', AminaCapture);
