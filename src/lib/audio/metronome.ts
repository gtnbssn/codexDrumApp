import type { Drill } from '../types';
import { tempoAtBar } from '../data/drills';

export interface Tick {
  time: number;
  step: number;
  bar: number;
  bpm: number;
  silent: boolean;
}

/** Audio is scheduled ahead on the audio clock. UI timers never determine sound timing. */
export class Metronome {
  context: AudioContext;
  volume = 0.5;
  muted = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private uiTimers = new Set<ReturnType<typeof setTimeout>>();
  private voices = new Set<OscillatorNode>();
  private nextTime = 0;
  private position = 0;
  private running = false;

  constructor() {
    this.context = new AudioContext({ latencyHint: 'interactive' });
  }

  async start(
    drill: Drill,
    bpm: number,
    onScheduled: (tick: Tick) => void,
    onTick: (tick: Tick) => void,
    countInBars = 0,
  ) {
    await this.context.resume();
    this.running = true;
    this.position = 0;
    this.nextTime = this.context.currentTime + 0.12;
    const schedule = () => {
      if (!this.running) return;
      while (this.nextTime < this.context.currentTime + 0.12) {
        const step = this.position % drill.sticking.length;
        const bar = Math.floor(this.position / drill.sticking.length);
        const practiceBar = Math.max(0, bar - countInBars);
        const currentBpm = tempoAtBar(drill, bpm, practiceBar);
        const silent = Boolean(drill.gapBars && bar >= countInBars && practiceBar % 4 === 3);
        const tick = { time: this.nextTime, step, bar, bpm: currentBpm, silent };
        onScheduled(tick);
        if (!silent && !this.muted)
          this.click(this.nextTime, step === 0, step % drill.subdivision === 0);
        const timer = setTimeout(
          () => {
            this.uiTimers.delete(timer);
            if (this.running) onTick(tick);
          },
          Math.max(0, (this.nextTime - this.context.currentTime) * 1000),
        );
        this.uiTimers.add(timer);
        this.nextTime += 60 / currentBpm / drill.subdivision;
        this.position++;
      }
      this.timer = setTimeout(schedule, 25);
    };
    schedule();
  }

  private click(time: number, downbeat: boolean, quarter: boolean) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = downbeat ? 1400 : quarter ? 1000 : 740;
    gain.gain.setValueAtTime(Math.max(0.0001, this.volume * (quarter ? 0.35 : 0.16)), time);
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
    this.running = false;
    clearTimeout(this.timer);
    this.uiTimers.forEach(clearTimeout);
    this.uiTimers.clear();
    this.voices.forEach((voice) => {
      try {
        voice.stop();
      } catch {
        /* Already stopped. */
      }
    });
    this.voices.clear();
  }

  async destroy() {
    this.stop();
    await this.context.close();
  }
}
