// AudioWorklet runs on the audio thread rather than the animation/UI thread.
// This is an amplitude-transient detector, not drum transcription.
class OnsetProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.threshold = 0.035;
    this.previous = 0;
    this.lastHit = -1;
    this.block = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'threshold') this.threshold = data.value;
    };
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let sum = 0;
    for (const sample of channel) sum += sample * sample;
    const rms = Math.sqrt(sum / channel.length);
    const onset =
      rms > this.threshold && rms > this.previous * 1.6 && currentTime - this.lastHit > 0.075;
    if (onset) {
      this.lastHit = currentTime;
      this.port.postMessage({ type: 'hit', time: currentTime });
    }
    this.previous = Math.max(rms, this.previous * 0.93);
    if (++this.block % 16 === 0) this.port.postMessage({ type: 'level', level: rms });
    return true;
  }
}

registerProcessor('pocket-onset', OnsetProcessor);
