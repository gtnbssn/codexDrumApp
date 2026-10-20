<script lang="ts">
  import { Mic, Video, ArrowUpRight, ShieldCheck, Info } from '@lucide/svelte';
  let {
    micEnabled,
    cameraEnabled,
    busy,
    running,
    level,
    hits,
    strokes,
    motion,
    threshold = $bindable(0.035),
    latency = $bindable(0),
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
    motion: number[];
    threshold?: number;
    latency?: number;
    video?: HTMLVideoElement;
    toggleMic: () => void;
    toggleCamera: () => void;
    error: string;
  } = $props();
  let tab = $state<'mic' | 'camera'>('mic');
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
            bind:value={threshold}
            disabled={running}
          />
        </label>
        <label>
          Latency compensation <span>{latency} ms</span>
          <input
            type="range"
            min="-200"
            max="200"
            step="5"
            bind:value={latency}
            disabled={running}
          />
        </label>
      </div>
      <p class="fine-print">
        Lower the threshold for a quiet pad. Positive compensation subtracts input delay from hits.
        Calibrate to your device; accuracy is an estimate.
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
        <h4>Camera motion tracking</h4>
        <p>Count motion bursts in left and right hand zones.</p>
        <button class="text-button coral" disabled={busy || running} onclick={toggleCamera}>
          {busy ? 'Connecting…' : cameraEnabled ? 'Disconnect camera' : 'Enable camera'}
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
    <div class="camera-preview" class:hidden={!cameraEnabled}>
      <video
        bind:this={video}
        autoplay
        muted
        playsinline
        aria-label="Mirrored camera preview"
      ></video>
      <div class="camera-zones">
        <span>
          L <b>{strokes.left}</b>
          <i style={`opacity:${Math.min(1, motion[0])}`}></i>
        </span>
        <span>
          R <b>{strokes.right}</b>
          <i style={`opacity:${Math.min(1, motion[1])}`}></i>
        </span>
      </div>
    </div>
    <div class="analysis-footnote">
      <Info size={14} />
      <span>
        Keep one hand in each zone and the camera still. Counts are motion bursts, not verified
        strokes or technique ratings.
      </span>
    </div>
  </div>
  {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
  <div class="privacy-note">
    <ShieldCheck size={13} />On-device processing. Audio and video are never saved or uploaded.
  </div>
</section>
