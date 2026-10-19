/** Captures transients only. No raw audio is recorded, stored, or uploaded. */
export class Microphone {
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: AudioWorkletNode | null = null;
  private silence: GainNode | null = null;

  async connect(
    context: AudioContext,
    onHit: (time: number) => void,
    onLevel: (level: number) => void,
  ) {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('Microphone access needs HTTPS or localhost and a supported browser.');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      await context.audioWorklet.addModule('/onset-processor.js');
      this.source = context.createMediaStreamSource(this.stream);
      this.processor = new AudioWorkletNode(context, 'pocket-onset');
      this.silence = context.createGain();
      this.silence.gain.value = 0;
      this.source.connect(this.processor).connect(this.silence).connect(context.destination);
      this.processor.port.onmessage = ({ data }) => {
        if (data.type === 'hit') onHit(data.time);
        if (data.type === 'level') onLevel(data.level);
      };
    } catch (error) {
      this.disconnect();
      throw error;
    }
  }

  setThreshold(value: number) {
    this.processor?.port.postMessage({ type: 'threshold', value });
  }
  disconnect() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.processor?.disconnect();
    this.source?.disconnect();
    this.silence?.disconnect();
    if (this.processor) this.processor.port.onmessage = null;
    this.stream = null;
  }
}
