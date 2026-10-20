<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { X } from '@lucide/svelte';
  import { openDialog } from '../utils/dialog';
  import { measureLatency } from '../analysis/calibrate';
  import { PROBE_OFFSETS } from '../analysis/latency';
  import type { SavedCalibration } from '../analysis/latency';
  import type { CalibrationProgress } from '../analysis/calibrate';
  import { audioSettings } from '../stores/audio-settings.svelte';

  let {
    getContext,
    apply,
    close,
  }: {
    getContext: () => AudioContext;
    apply: (measurement: SavedCalibration) => void;
    close: () => void;
  } = $props();
  let running = $state(false);
  let volume = $state(65);
  let threshold = $state(untrack(() => audioSettings.threshold));
  let result = $state<SavedCalibration | null>(null);
  let error = $state('');
  let progress = $state<CalibrationProgress>({
    phase: 'connecting',
    played: 0,
    detected: 0,
    level: 0,
  });
  let controller: AbortController | null = null;
  let disposed = false;

  async function start() {
    result = null;
    error = '';
    running = true;
    progress = { phase: 'connecting', played: 0, detected: 0, level: 0 };
    const attempt = new AbortController();
    controller = attempt;
    try {
      const measurement = await measureLatency(getContext(), {
        volume: volume / 100,
        threshold,
        signal: attempt.signal,
        onProgress: (value) => {
          if (!disposed && !attempt.signal.aborted) progress = value;
        },
      });
      if (!disposed && !attempt.signal.aborted) result = measurement;
    } catch (reason) {
      if (disposed || attempt.signal.aborted) return;
      error =
        reason instanceof DOMException && reason.name === 'NotAllowedError'
          ? 'Microphone permission was not granted. Allow it in your browser settings, then retry.'
          : reason instanceof DOMException && reason.name === 'NotFoundError'
            ? 'No microphone was found. Connect one, then retry.'
            : reason instanceof Error
              ? reason.message
              : 'The calibration could not start. Please retry.';
    } finally {
      if (!disposed) running = false;
      if (controller === attempt) controller = null;
    }
  }

  function cancel() {
    controller?.abort();
    close();
  }
  onDestroy(() => {
    disposed = true;
    controller?.abort();
  });
</script>

<div class="modal-backdrop">
  <dialog class="modal latency-modal" aria-labelledby="calibration-title" use:openDialog={cancel}>
    <button class="icon-button modal-close" aria-label="Close calibration" onclick={cancel}>
      <X size={20} />
    </button>
    <h2 id="calibration-title">Calibrate audio latency</h2>
    <p>
      Measure the delay between a scheduled click and the microphone hearing it. No practice session
      or recording is saved.
    </p>
    {#if running}
      <div class="calibration-progress" role="status" aria-live="polite">
        <strong>
          {progress.phase === 'connecting'
            ? 'Connecting microphone…'
            : progress.phase === 'quiet'
              ? 'Checking for a quiet room…'
              : `${progress.played}/${PROBE_OFFSETS.length} clicks played · ${progress.detected} detected`}
        </strong>
        <progress
          aria-label="Calibration progress"
          max={PROBE_OFFSETS.length}
          value={progress.played}
        ></progress>
      </div>
      <div class="input-meter" aria-label="Calibration microphone level">
        <span style={`width:${Math.min(100, progress.level * 1000)}%`}></span>
      </div>
    {:else if result?.reliable}
      <div class="calibration-result" role="status">
        <strong>
          {result.latencyMs}
          <small>ms</small>
        </strong>
        <span>
          {result.consistent}/{result.total} consistent clicks · repeatability ±{result.jitterMs} ms
        </span>
      </div>
      <p class="fine-print">
        This is an acoustic round-trip estimate, including output, input, and sound travel. It
        aligns scoring to the click you hear. It does not measure your playing or reaction time.
      </p>
    {:else if result}
      <p class="inline-error" role="alert">
        {result.reason} Your existing compensation has not changed.
      </p>
    {/if}
    {#if error}<p class="inline-error" role="alert">
        {error} Your existing compensation has not changed.
      </p>{/if}
    {#if !running && !result?.reliable}
      <ol class="calibration-instructions">
        <li>
          Use the microphone and headphones you practice with. Place one headphone cup close to the
          microphone.
        </li>
        <li>Keep the room quiet. Don’t play the pad, tap along, or talk during the test.</li>
        <li>Start the test. It plays eight spaced clicks in about eleven seconds.</li>
      </ol>
      <div class="sensor-settings calibration-controls">
        <label>
          Test volume <span>{volume}%</span>
          <input
            aria-label="Calibration test volume"
            type="range"
            min="5"
            max="100"
            step="1"
            bind:value={volume}
            disabled={running}
          />
        </label>
        <label>
          Detection threshold <span>{threshold.toFixed(3)}</span>
          <input
            aria-label="Calibration detection threshold"
            type="range"
            min="0.005"
            max="0.15"
            step="0.005"
            bind:value={threshold}
            disabled={running}
          />
        </label>
      </div>
    {/if}
    <p class="fine-print calibration-device-note">
      Recalibrate after switching headphones, microphone, audio interface, or Bluetooth mode. Keep
      the headphone-to-microphone distance short; room echoes and wireless jitter can affect the
      result.
    </p>
    <div class="modal-actions">
      <button class="secondary-button" onclick={cancel}>{running ? 'Cancel test' : 'Close'}</button>
      {#if !running}
        <button class={result?.reliable ? 'secondary-button' : 'primary-button'} onclick={start}>
          {result || error ? 'Retry calibration' : 'Start calibration'}
        </button>
        {#if result?.reliable}<button
            class="primary-button"
            onclick={() => {
              if (result) apply(result);
            }}
          >
            Use {result.latencyMs} ms
          </button>{/if}
      {/if}
    </div>
  </dialog>
</div>
