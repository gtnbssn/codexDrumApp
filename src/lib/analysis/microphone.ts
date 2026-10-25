import type { AudioRoute } from './latency';

/** Captures transients only. No raw audio is recorded, stored, or uploaded. */
export class Microphone {
  private closed = false;
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (this.closed) {
        stream.getTracks().forEach((track) => track.stop());
        throw new DOMException('Microphone connection cancelled.', 'AbortError');
      }
      this.stream = stream;
      await context.audioWorklet.addModule('/onset-processor.js');
      if (this.closed) throw new DOMException('Microphone connection cancelled.', 'AbortError');
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
  async getRoute(context: AudioContext): Promise<AudioRoute> {
    const track = this.stream?.getAudioTracks()[0];
    let outputLabel = '';
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      outputLabel =
        devices.find((device) => device.kind === 'audiooutput' && device.deviceId === 'default')
          ?.label ?? '';
    } catch {
      /* Some browsers do not expose output device metadata. */
    }
    return {
      inputId: track?.getSettings().deviceId ?? '',
      inputLabel: track?.label ?? '',
      outputLabel,
      sampleRate: context.sampleRate,
    };
  }
  disconnect() {
    this.closed = true;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.processor?.disconnect();
    this.source?.disconnect();
    this.silence?.disconnect();
    if (this.processor) this.processor.port.onmessage = null;
    this.processor?.port.close();
    this.processor = null;
    this.source = null;
    this.silence = null;
    this.stream = null;
  }
}
