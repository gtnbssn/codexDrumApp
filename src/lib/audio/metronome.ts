import type { Drill } from '../types';
import { tempoAtBar } from '../data/drills';
import { ClickSound } from './click-sound';

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
  private sound: ClickSound;
  private nextTime = 0;
  private position = 0;
  private running = false;

  constructor() {
    this.context = new AudioContext({ latencyHint: 'interactive' });
    this.sound = new ClickSound(this.context);
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
          this.sound.play(this.nextTime, this.volume, step === 0, step % drill.subdivision === 0);
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

  stop() {
    this.running = false;
    clearTimeout(this.timer);
    this.uiTimers.forEach(clearTimeout);
    this.uiTimers.clear();
    this.sound.stop();
  }

  async destroy() {
    this.stop();
    await this.context.close();
  }
}
