<script lang="ts">
  import { Mic, Video, ArrowUpRight, ShieldCheck, Info } from '@lucide/svelte';
  import HandOverlay from './HandOverlay.svelte';
  import type { HandFrame } from '../analysis/hand-tracking';
  import { audioSettings, setLatency, setThreshold } from '../stores/audio-settings.svelte';
  let {
    micEnabled,
    cameraEnabled,
    busy,
    running,
    level,
    hits,
    strokes,
    handFrame,
    cameraConnecting,
    calibrate,
    calibrationNotice,
    video = $bindable<HTMLVideoElement | undefined>(),
    toggleMic,
    toggleCamera,
    error,
  }: {
    micEnabled: boolean;
    cameraEnabled: boolean;
    busy: boolean;
    running: boolean;
    level: number;
    hits: number;
    strokes: { left: number; right: number };
    handFrame: HandFrame;
    cameraConnecting: boolean;
    calibrate: () => void;
    calibrationNotice: string;
    video?: HTMLVideoElement;
    toggleMic: () => void;
    toggleCamera: () => void;
    error: string;
  } = $props();
  let tab = $state<'mic' | 'camera'>('mic');
  let aspectRatio = $state(4 / 3);
  let threshold = $derived(audioSettings.threshold);
  let latency = $derived(audioSettings.latencyMs);
</script>

<section class="analysis-card card">
  <div class="section-heading">
    <h2>Performance analysis</h2>
    <span class="pill subtle">Optional</span>
  </div>
  <div class="analysis-tabs" role="tablist" aria-label="Performance analysis">
    <button
      role="tab"
      aria-selected={tab === 'mic'}
      class:chosen={tab === 'mic'}
      onclick={() => (tab = 'mic')}
    >
      <Mic size={16} />Timing analysis {#if micEnabled}<span class="green-dot"></span>{/if}
    </button>
    <button
      role="tab"
      aria-selected={tab === 'camera'}
      class:chosen={tab === 'camera'}
      onclick={() => (tab = 'camera')}
    >
      <Video size={17} />Camera tracking
      <span class="tiny-label">Experimental</span>
    </button>
  </div>
  {#if tab === 'mic'}
    <div class="analysis-content">
      <div>
        <h4>{micEnabled ? 'Listening for your hits' : 'Microphone timing'}</h4>
        <p>
          {micEnabled
            ? `${hits} hits detected this session. Play a few strokes to check the input meter.`
            : 'Connect your microphone for timing accuracy, early / late feedback, and consistency estimates.'}
        </p>
        <button class="text-button coral" disabled={busy || running} onclick={toggleMic}>
          {busy ? 'Connecting…' : micEnabled ? 'Disconnect microphone' : 'Enable microphone'}
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
    <section class="latency-settings" aria-labelledby="latency-heading">
      <div class="section-heading">
        <h4 id="latency-heading">Audio latency</h4>
        <button class="secondary-button" disabled={busy || running} onclick={calibrate}>
          Calibrate latency
        </button>
      </div>
      <p class="fine-print">
        Point a headphone cup at your microphone for a short click test. You don’t need to start a
        practice session.
      </p>
      <label class="latency-value">
        Compensation (ms)
        <input
          aria-label="Latency compensation in milliseconds"
          type="number"
          min="-200"
          max="1000"
          step="1"
          value={latency}
          oninput={(event) => setLatency(event.currentTarget.valueAsNumber)}
          disabled={running}
        />
      </label>
      <p class="fine-print">
        {#if audioSettings.calibration}
          Measured {audioSettings.calibration.latencyMs} ms · repeatability ±{audioSettings
            .calibration.jitterMs} ms. Measured {new Date(
            audioSettings.calibration.measuredAt,
          ).toLocaleDateString()}.
          {#if audioSettings.calibration.threshold !== threshold}Detection threshold changed;
            recalibrate for this setting.{/if}
        {:else}Manual compensation. Positive values shift detected hits earlier.{/if}
        Recalibrate when your audio setup changes.
      </p>
      {#if calibrationNotice}<p class="inline-error" role="status">{calibrationNotice}</p>{/if}
      {#if audioSettings.warning}<p class="inline-error" role="alert">
          {audioSettings.warning}
        </p>{/if}
    </section>
    {#if micEnabled}
      <div
        class="input-meter"
        aria-label={`Microphone level ${Math.round(Math.min(1, level * 10) * 100)} percent`}
      >
        <span style={`width:${Math.min(100, level * 1000)}%`}></span>
      </div>
      <div class="sensor-settings">
        <label>
          Detection threshold <span>{threshold.toFixed(3)}</span>
          <input
            type="range"
            min="0.005"
            max="0.15"
            step="0.005"
            value={threshold}
            oninput={(event) => setThreshold(Number(event.currentTarget.value))}
            disabled={running}
          />
        </label>
      </div>
      <p class="fine-print">
        Lower the threshold for a quiet pad. Calibration uses the same detector. Timing accuracy is
        an estimate.
      </p>
    {/if}
    <div class="analysis-footnote">
      <Info size={14} />
      <span>Use headphones. Speaker clicks can be detected as drum hits.</span>
    </div>
  {/if}
  <div class:hidden={tab !== 'camera'}>
    <div class="analysis-content">
      <div>
        <h4>MediaPipe hand tracking</h4>
        <p>Track hand landmarks and estimate left and right strokes during practice.</p>
        <button
          class="text-button coral"
          disabled={(busy && !cameraConnecting) || running}
          onclick={toggleCamera}
        >
          {cameraConnecting
            ? 'Cancel camera connection'
            : cameraEnabled
              ? 'Disconnect camera'
              : 'Enable camera'}
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
    {#if cameraConnecting}<p class="fine-print" role="status">
        Loading hand tracking, then requesting camera access…
      </p>{/if}
    <div
      class="camera-preview"
      class:hidden={!cameraEnabled}
      style:aspect-ratio={aspectRatio}
      data-processed-frames={handFrame.processedFrames}
    >
      <video
        bind:this={video}
        autoplay
        muted
        playsinline
        aria-label="Mirrored camera preview"
        onloadedmetadata={(event) => {
          aspectRatio = event.currentTarget.videoWidth / event.currentTarget.videoHeight;
        }}
      ></video>
      <HandOverlay hands={handFrame.hands} />
    </div>
    {#if cameraEnabled}
      <p class="fine-print" role="status">
        {#if handFrame.hands.length}
          Tracking {handFrame.hands
            .map((hand) => `${hand.side} (${Math.round(hand.confidence * 100)}%)`)
            .join(' · ')}
        {:else if handFrame.processedFrames}
          No hands detected. Keep your hands visible and well lit.
        {:else}Looking for hands…{/if}
      </p>
      <div class="hand-counts" aria-label="Estimated hand strokes">
        <span>
          Left hand <strong>{strokes.left}</strong>
        </span>
        <span>
          Right hand <strong>{strokes.right}</strong>
        </span>
      </div>
      <p class="fine-print">Counts start with the practice session, after the count-in.</p>
    {/if}
    <div class="analysis-footnote">
      <Info size={14} />
      <span>
        Keep the camera still with a front view of both hands. Each estimate needs a visible lift,
        downstroke and rebound. Fast or small movements and hands hidden by sticks may be missed.
        This does not detect drum contact or rate technique.
      </span>
    </div>
  </div>
  {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
  <div class="privacy-note">
    <ShieldCheck size={13} />On-device processing. Audio and video are never saved or uploaded.
  </div>
</section>
