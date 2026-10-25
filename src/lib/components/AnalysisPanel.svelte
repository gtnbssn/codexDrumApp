<script lang="ts">
  import { ArrowUpRight, ShieldCheck, Info } from '@lucide/svelte';
  import { audioSettings, setLatency, setThreshold } from '../stores/audio-settings.svelte';
  let {
    micEnabled,
    busy,
    running,
    level,
    hits,
    calibrate,
    calibrationNotice,
    toggleMic,
    error,
  }: {
    micEnabled: boolean;
    busy: boolean;
    running: boolean;
    level: number;
    hits: number;
    calibrate: () => void;
    calibrationNotice: string;
    toggleMic: () => void;
    error: string;
  } = $props();
  let threshold = $derived(audioSettings.threshold);
  let latency = $derived(audioSettings.latencyMs);
</script>

<section class="analysis-card card">
  <div class="section-heading">
    <h2>Performance analysis</h2>
    <span class="pill subtle">Optional</span>
  </div>
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
      Lower the threshold for a quiet pad. Calibration uses the same detector. Timing accuracy is an
      estimate.
    </p>
  {/if}
  <div class="analysis-footnote">
    <Info size={14} />
    <span>Use headphones. Speaker clicks can be detected as drum hits.</span>
  </div>
  {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
  <div class="privacy-note">
    <ShieldCheck size={13} />On-device processing. Audio is never saved or uploaded.
  </div>
</section>
