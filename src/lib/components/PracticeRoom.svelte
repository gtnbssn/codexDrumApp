<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import {
    Play,
    Asterisk,
    Square,
    Minus,
    Plus,
    Volume2,
    VolumeX,
    ChevronDown,
    ArrowUpRight,
    ArrowRight,
    Timer,
    Target,
    Sparkles,
    Headphones,
    Check,
    Music2,
  } from '@lucide/svelte';
  import type { Drill, Session } from '../types';
  import { drills, findDrill } from '../data/drills';
  import { Metronome } from '../audio/metronome';
  import { Microphone } from '../analysis/microphone';
  import { StrokeCamera } from '../analysis/camera';
  import { analyzeTiming, formatTime, localDay, weekDays } from '../utils/timing';
  import { practice, addSession } from '../stores/practice.svelte';
  import AnalysisPanel from './AnalysisPanel.svelte';
  import SessionSummary from './SessionSummary.svelte';

  let {
    drill,
    initialBpm,
    initialMinutes,
    onSelect,
    onRunning,
    navigate,
  }: {
    drill: Drill;
    initialBpm?: number;
    initialMinutes?: number;
    onSelect: (drill: Drill) => void;
    onRunning: (running: boolean) => void;
    navigate: (page: 'library' | 'progress' | 'planner') => void;
  } = $props();
  let bpm = $state(untrack(() => initialBpm ?? drill.bpm));
  let minutes = $state(untrack(() => initialMinutes ?? drill.minutes));
  let volume = $state(65);
  let muted = $state(false);
  let countIn = $state(true);
  let running = $state(false);
  let starting = $state(false);
  let elapsed = $state(0);
  let step = $state(-1);
  let bar = $state(0);
  let currentBpm = $state(untrack(() => bpm));
  let isCountIn = $state(false);
  let silent = $state(false);
  let error = $state('');
  let summary = $state<Session | null>(null);
  let micEnabled = $state(false);
  let cameraEnabled = $state(false);
  let sensorBusy = $state(false);
  let level = $state(0);
  let hitCount = $state(0);
  let strokes = $state({ left: 0, right: 0 });
  let motion = $state([0, 0]);
  let threshold = $state(0.035);
  let latency = $state(0);
  let video = $state<HTMLVideoElement>();
  let engine: Metronome | null = null;
  let microphone: Microphone | null = null;
  let camera: StrokeCamera | null = null;
  let timer: ReturnType<typeof setInterval>;
  let expected: number[] = [];
  let observed: number[] = [];
  let startTime = 0;
  let startedAt = '';
  let disposed = false;

  const today = new Date();
  const week = weekDays(today);
  let weeklyMinutes = $derived(
    practice.data.sessions
      .filter((s) => week.some((day) => localDay(day) === localDay(new Date(s.startedAt))))
      .reduce((sum, s) => sum + s.seconds / 60, 0),
  );
  let todaysPlan = $derived(practice.data.plan.filter((p) => p.day === today.getDay()));
  let todaySeconds = $derived(
    practice.data.sessions
      .filter((s) => localDay(new Date(s.startedAt)) === localDay(today))
      .reduce((sum, s) => sum + s.seconds, 0),
  );

  function audio() {
    engine ??= new Metronome();
    return engine;
  }
  $effect(() => {
    // Read rune values even before the imperative audio engine exists.
    const nextVolume = volume / 100;
    const nextMuted = muted;
    if (engine) {
      engine.volume = nextVolume;
      engine.muted = nextMuted;
    }
  });
  $effect(() => {
    const nextThreshold = threshold;
    microphone?.setThreshold(nextThreshold);
  });

  function mediaError(reason: unknown) {
    if (reason instanceof DOMException && reason.name === 'NotAllowedError')
      return 'Permission was not granted. Allow access in your browser settings, then try again. You can practice without sensors.';
    if (reason instanceof DOMException && reason.name === 'NotFoundError')
      return 'No input device was found. Connect a device, then try again.';
    return reason instanceof Error
      ? reason.message
      : 'Could not connect to the device. You can practice without sensors.';
  }

  async function toggleMic() {
    error = '';
    if (micEnabled) {
      microphone?.disconnect();
      microphone = null;
      micEnabled = false;
      level = 0;
      return;
    }
    sensorBusy = true;
    const candidate = new Microphone();
    try {
      const clock = audio();
      await clock.context.resume();
      await candidate.connect(
        clock.context,
        (time) => {
          if (running && time >= startTime && time <= startTime + minutes * 60) {
            observed.push(time - latency / 1000);
            hitCount = observed.length;
          }
        },
        (value) => (level = value),
      );
      if (disposed) {
        candidate.disconnect();
        return;
      }
      microphone = candidate;
      microphone.setThreshold(threshold);
      micEnabled = true;
    } catch (reason) {
      candidate.disconnect();
      error = mediaError(reason);
    } finally {
      sensorBusy = false;
    }
  }

  async function toggleCamera() {
    error = '';
    if (cameraEnabled) {
      camera?.disconnect();
      camera = null;
      cameraEnabled = false;
      return;
    }
    if (!video) return;
    sensorBusy = true;
    const candidate = new StrokeCamera();
    try {
      await candidate.connect(
        video,
        (side) => {
          if (running && !isCountIn) strokes[side]++;
        },
        (left, right) => (motion = [left, right]),
      );
      if (disposed) {
        candidate.disconnect();
        return;
      }
      camera = candidate;
      cameraEnabled = true;
    } catch (reason) {
      candidate.disconnect();
      error = mediaError(reason);
    } finally {
      sensorBusy = false;
    }
  }

  async function start() {
    error = '';
    starting = true;
    try {
      const clock = audio();
      await clock.context.resume();
      if (disposed) return;
      clock.volume = volume / 100;
      clock.muted = muted;
      expected = [];
      observed = [];
      hitCount = 0;
      strokes = { left: 0, right: 0 };
      elapsed = 0;
      step = -1;
      bar = 0;
      currentBpm = bpm;
      startedAt = new Date().toISOString();
      startTime = clock.context.currentTime + 0.12 + (countIn ? (4 * 60) / bpm : 0);
      running = true;
      onRunning(true);
      isCountIn = countIn;
      await clock.start(
        drill,
        bpm,
        (tick) => {
          if (tick.bar === 0 && tick.step === 0)
            startTime = tick.time + (countIn ? (4 * 60) / bpm : 0);
          if (tick.time >= startTime - 0.001 && tick.time < startTime + minutes * 60)
            expected.push(tick.time);
        },
        (tick) => {
          step = tick.step;
          bar = Math.max(0, tick.bar - (countIn ? 1 : 0));
          isCountIn = countIn && tick.bar === 0;
          currentBpm = tick.bpm;
          silent = tick.silent;
        },
        countIn ? 1 : 0,
      );
      timer = setInterval(() => {
        elapsed = Math.max(0, clock.context.currentTime - startTime);
        if (elapsed >= minutes * 60) finish(true);
      }, 80);
    } catch (reason) {
      engine?.stop();
      running = false;
      onRunning(false);
      error = mediaError(reason);
    } finally {
      starting = false;
    }
  }

  function finish(completed = false) {
    if (!running || !engine) return;
    const end = Math.min(engine.context.currentTime, startTime + minutes * 60);
    engine.stop();
    clearInterval(timer);
    const seconds = Math.max(0, end - startTime);
    if (seconds >= 1) {
      const session: Session = {
        id: crypto.randomUUID(),
        drillId: drill.id,
        drillName: drill.name,
        startedAt,
        seconds: Math.round(seconds),
        bpm,
        endBpm: currentBpm,
        completed,
        notes: '',
        timing: micEnabled
          ? analyzeTiming(
              expected.filter((time) => time <= end),
              observed.filter((time) => time >= startTime && time <= end),
            )
          : null,
        strokes: cameraEnabled ? { ...strokes } : null,
      };
      addSession(session);
      summary = session;
    }
    running = false;
    onRunning(false);
    step = -1;
    isCountIn = false;
    microphone?.disconnect();
    microphone = null;
    micEnabled = false;
    level = 0;
    camera?.disconnect();
    camera = null;
    cameraEnabled = false;
  }

  onDestroy(() => {
    disposed = true;
    clearInterval(timer);
    microphone?.disconnect();
    camera?.disconnect();
    void engine?.destroy();
  });
</script>

<svelte:window
  onkeydown={(event) => {
    if (
      event.key === 'Enter' &&
      event.target === document.body &&
      !summary &&
      !sensorBusy &&
      !starting
    ) {
      event.preventDefault();
      if (running) finish();
      else void start();
    }
  }}
/>

<div class="page-intro">
  <div>
    <div class="eyebrow">
      <span class="small-line"></span>
      A LITTLE BETTER, EVERY BEAT
    </div>
    <!-- prettier-ignore -->
    <h1>Find your pocket<span class="coral">.</span></h1>
    <p>Show up. Settle in. Make a little progress.</p>
  </div>
  <div class="today-tag">
    <span class="green-dot"></span>
    Your daily rhythm starts here
  </div>
</div>

<div class="practice-layout">
  <div class="practice-main">
    <div class="section-title">
      <h2>Let’s get into it</h2>
      <button class="text-button" disabled={running} onclick={() => navigate('library')}>
        Explore all drills <ArrowUpRight size={16} />
      </button>
    </div>
    <div class="quick-drills">
      {#each [drills[0], drills[2], drills[3]] as item, i}<button
          class:selected={drill.id === item.id}
          disabled={running}
          onclick={() => onSelect(item)}
        >
          <span class="drill-mini-icon">
            {#if i === 0}<Music2 size={18} />{:else if i === 1}<Sparkles
                size={18}
              />{:else}<Headphones size={18} />{/if}
          </span>
          <span>
            <strong>{item.name}</strong>
            <small>{item.category}</small>
          </span>
          {#if drill.id === item.id}<span class="selection-tick"><Check size={11} /></span>{/if}
        </button>{/each}
    </div>

    <section class="metronome-card card" aria-label="Practice controls">
      <div class="metronome-heading">
        <div>
          <span class="pill coral-pill">{drill.category.toUpperCase()}</span>
          <h2>{drill.name}</h2>
          <p>{drill.focus}</p>
        </div>
        <span class="time-signature">
          4
          <span>/</span>
          4
          <small>TIME SIGNATURE</small>
        </span>
      </div>
      <div class="tempo-workspace">
        <button
          class="tempo-adjust"
          aria-label="Decrease tempo by 5"
          disabled={running || bpm <= 30}
          onclick={() => (bpm = Math.max(30, bpm - 5))}
        >
          <Minus size={20} />
        </button>
        <div
          class="tempo-dial"
          class:playing={running}
          style={`--progress:${Math.min(100, (elapsed / (minutes * 60)) * 100)}%`}
        >
          <div class="dial-content">
            <span class="dial-top">
              {isCountIn
                ? 'COUNTING YOU IN'
                : running
                  ? silent
                    ? 'TRUST YOUR TIMING'
                    : 'IN THE POCKET'
                  : 'SET YOUR TEMPO'}
            </span>
            <div class="bpm-number">{running ? currentBpm : bpm}</div>
            <span class="bpm-label">BEATS PER MINUTE</span>
            <div class="dial-dots">
              {#each [0, 1, 2, 3] as beat}<span
                  class:lit={running && Math.floor(step / drill.subdivision) === beat}
                ></span>{/each}
            </div>
          </div>
        </div>
        <button
          class="tempo-adjust"
          aria-label="Increase tempo by 5"
          disabled={running || bpm >= 240}
          onclick={() => (bpm = Math.min(240, bpm + 5))}
        >
          <Plus size={20} />
        </button>
      </div>
      <div class="tempo-range">
        <span>30</span>
        <input
          aria-label="Tempo"
          type="range"
          min="30"
          max="240"
          step="1"
          bind:value={bpm}
          disabled={running}
          style={`--range-progress:${((bpm - 30) / 210) * 100}%`}
        />
        <span>240</span>
      </div>
      <div class="beat-grid-label">
        <span>
          YOUR STICKING <span class="faint">
            · {drill.subdivision === 2 ? '8TH' : '16TH'} NOTES
          </span>
        </span>
        <span>
          <i class="accent-dot"></i>
          Accent
          <i class="regular-dot"></i>
          Regular
        </span>
      </div>
      <div class="beat-grid" style={`--steps:${drill.sticking.length}`}>
        {#each drill.sticking as hand, index}<div
            class:accent={drill.accents.includes(index)}
            class:current={running && step === index}
          >
            <span class="beat-count">
              {index % drill.subdivision === 0
                ? index / drill.subdivision + 1
                : drill.subdivision === 2
                  ? '&'
                  : ['', 'e', '&', 'a'][index % 4]}
            </span>
            <span class="sticking-note">{hand}</span>
            <i></i>
          </div>{/each}
      </div>
      <div class="transport-settings">
        <label>
          <Timer size={15} />
          <select aria-label="Session duration" bind:value={minutes} disabled={running}>
            {#each Array.from({ length: 60 }, (_, index) => index + 1) as duration}<option
                value={duration}
              >
                {duration} min session
              </option>{/each}
          </select>
          <ChevronDown size={13} />
        </label>
        <label class="count-in">
          <input type="checkbox" bind:checked={countIn} disabled={running} />
          <span>1-bar count-in</span>
        </label>
        <div class="volume-control">
          <button
            aria-label={muted ? 'Unmute click' : 'Mute click'}
            class="icon-button"
            onclick={() => (muted = !muted)}
          >
            {#if muted}<VolumeX size={17} />{:else}<Volume2 size={17} />{/if}
          </button>
          <input aria-label="Click volume" type="range" min="0" max="100" bind:value={volume} />
        </div>
      </div>
      <div class="transport">
        <div class="session-time">
          <span>{running ? (isCountIn ? 'GET READY' : `BAR ${bar + 1}`) : 'SESSION TIME'}</span>
          <strong>
            {formatTime(elapsed)}
            <small>/ {formatTime(minutes * 60)}</small>
          </strong>
        </div>
        <button
          class="primary-button start-button"
          disabled={starting || sensorBusy}
          onclick={() => (running ? finish() : start())}
        >
          {#if running}<Square size={15} fill="currentColor" />End session{:else}<Play
              size={17}
              fill="currentColor"
            />{starting ? 'Starting…' : 'Start practice'}{/if}
        </button>
        <div class="transport-tip">
          {#if running}<span class="live-dot"></span>
            {isCountIn ? 'One bar, then you’re in' : 'Every beat is a new beginning'}{:else}<span
              class="key-hint"
            >
              ↵
            </span>
            A moment just for you{/if}
        </div>
      </div>
      {#if error && !micEnabled && !cameraEnabled}<p class="inline-error" role="alert">
          {error}
        </p>{/if}
    </section>
    <AnalysisPanel
      {micEnabled}
      {cameraEnabled}
      busy={sensorBusy}
      {running}
      {level}
      hits={hitCount}
      {strokes}
      {motion}
      bind:threshold
      bind:latency
      bind:video
      {toggleMic}
      {toggleCamera}
      {error}
    />
  </div>

  <aside class="practice-aside">
    <section class="focus-card">
      <div class="focus-art" aria-hidden="true">
        <div></div>
        <div></div>
        <div></div>
        <span><Asterisk size={55} strokeWidth={1.2} /></span>
      </div>
      <span class="eyebrow">TODAY’S REMINDER</span>
      <h2>
        Slow is smooth.
        <br />
        Smooth is fast.
      </h2>
      <p>
        Start where you can play cleanly.
        <br />
        The speed will follow.
      </p>
      <span class="focus-footer">
        <span></span>
        ONE GOOD REP AT A TIME
      </span>
    </section>
    <section class="weekly-card card">
      <div class="section-heading">
        <h3>This week’s rhythm</h3>
        <Target size={17} />
      </div>
      <p>
        <strong>{Math.floor(weeklyMinutes)}</strong>
        / {practice.data.weeklyGoal}
        <span>min practiced</span>
      </p>
      <div class="goal-bar">
        <span
          style={`width:${Math.min(100, (weeklyMinutes / practice.data.weeklyGoal) * 100)}%`}
        ></span>
      </div>
      <div class="week-dots">
        {#each week as day}<div class:today={localDay(day) === localDay(today)}>
            <span>{day.toLocaleDateString('en', { weekday: 'narrow' })}</span>
            <i
              class:done={practice.data.sessions.some(
                (s) => localDay(new Date(s.startedAt)) === localDay(day),
              )}
            >
              {#if practice.data.sessions.some((s) => localDay(new Date(s.startedAt)) === localDay(day))}<Check
                  size={12}
                />{:else}<span></span>{/if}
            </i>
          </div>{/each}
      </div>
      <button class="text-button" disabled={running} onclick={() => navigate('progress')}>
        Your progress, a beat at a time <ArrowRight size={14} />
      </button>
    </section>
    <section class="plan-card card">
      <div class="section-heading">
        <h3>On the practice pad</h3>
        <span class="tiny-label">TODAY</span>
      </div>
      {#if todaysPlan.length}{#each todaysPlan.slice(0, 3) as item}<button
            class="planned-item"
            disabled={running}
            onclick={() =>
              onSelect({ ...findDrill(item.drillId), bpm: item.bpm, minutes: item.minutes })}
          >
            <span class="plan-item-icon"><Music2 size={15} /></span>
            <span>
              <strong>{findDrill(item.drillId).name}</strong>
              <small>{item.minutes} min · {item.bpm} BPM</small>
            </span>
            <Play size={13} />
          </button>{/each}{:else}<div class="suggested-plan">
          <span class="plan-item-icon"><Music2 size={17} /></span>
          <div>
            <strong>A little structure helps.</strong>
            <p>
              Build a routine you’ll look
              <br />
              forward to coming back to.
            </p>
          </div>
        </div>{/if}
      <button class="text-button" disabled={running} onclick={() => navigate('planner')}>
        {todaysPlan.length ? 'Edit your practice plan' : 'Make a practice plan'}
        <ArrowUpRight size={14} />
      </button>
    </section>
    <div class="today-total">
      <span class="small-line"></span>
      <span>
        {todaySeconds >= 60
          ? `${Math.floor(todaySeconds / 60)} minutes invested in yourself today.`
          : 'Your next good habit starts with one session.'}
      </span>
    </div>
  </aside>
</div>
<div class="page-footer">
  <span>LESS SCROLLING. MORE ROLLING.</span>
  <span>
    Made for the love of the groove <span class="coral"><Asterisk size={13} /></span>
  </span>
</div>
{#if summary}<SessionSummary
    session={summary}
    close={() => (summary = null)}
    viewProgress={() => navigate('progress')}
  />{/if}
