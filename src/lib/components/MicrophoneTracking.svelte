<script lang="ts">
  import { Mic, Headphones } from '@lucide/svelte';
  import { audioSettings, hasCalibration } from '../stores/audio-settings.svelte';

  let {
    enabled,
    busy,
    running,
    level,
    hits,
    toggle,
    calibrate,
    notice,
    error,
  }: {
    enabled: boolean;
    busy: boolean;
    running: boolean;
    level: number;
    hits: number;
    toggle: () => void;
    calibrate: () => void;
    notice: string;
    error: string;
  } = $props();
  let calibrated = $derived(hasCalibration());
</script>

<section class="tracking-card card" aria-label="Microphone tracking">
  <div class="tracking-heading">
    <div class="tracking-title">
      <Mic size={22} aria-hidden="true" />
      <div>
        <h2>Microphone tracking</h2>
        <p>Measure hit timing and consistency.</p>
      </div>
    </div>
    <button
      class="tracking-switch"
      role="switch"
      aria-label="Microphone tracking"
      aria-checked={enabled}
      aria-busy={busy}
      disabled={busy || running}
      onclick={toggle}
    >
      <span>{busy ? 'Connecting…' : enabled ? 'On' : 'Off'}</span>
      <span class="switch-track" aria-hidden="true"><span></span></span>
    </button>
  </div>
  <div class="tracking-calibration">
    <output aria-label="Audio calibration">
      {calibrated
        ? `Calibrated · ${audioSettings.latencyMs} ms`
        : 'Calibration required before tracking.'}
    </output>
    <button class="text-button coral" disabled={busy || running} onclick={calibrate}>
      {calibrated ? 'Recalibrate' : 'Calibrate latency'}
    </button>
  </div>
  {#if enabled}
    <div class="headphone-notice" role="status" aria-label="Headphone reminder">
      <Headphones size={21} aria-hidden="true" />
      <div>
        <strong>Use headphones</strong>
        <span>Speaker clicks can register as hits.</span>
      </div>
    </div>
    <div class="tracking-input">
      <div
        class="input-meter"
        aria-label={`Microphone level ${Math.round(Math.min(1, level * 10) * 100)} percent`}
      >
        <span style={`width:${Math.min(100, level * 1000)}%`}></span>
      </div>
      <span>{hits} hits this session</span>
    </div>
  {/if}
  {#if notice}<p class="tracking-message" role="status" aria-label="Tracking notice">
      {notice}
    </p>{/if}
  {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
  {#if audioSettings.warning}<p class="inline-error" role="alert">{audioSettings.warning}</p>{/if}
</section>
