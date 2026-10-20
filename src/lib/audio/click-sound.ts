/** Shared by practice and calibration so both use the same click envelope. */
export class ClickSound {
  private voices = new Set<OscillatorNode>();

  constructor(private context: AudioContext) {}

  play(time: number, volume: number, downbeat = false, quarter = true) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = downbeat ? 1400 : quarter ? 1000 : 740;
    gain.gain.setValueAtTime(Math.max(0.0001, volume * (quarter ? 0.35 : 0.16)), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    oscillator.connect(gain).connect(this.context.destination);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(time);
    oscillator.stop(time + 0.04);
  }

  stop() {
    this.voices.forEach((voice) => {
      try {
        voice.stop();
      } catch {
        /* Already stopped. */
      }
    });
    this.voices.clear();
  }
}
