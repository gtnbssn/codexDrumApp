<script lang="ts">
  import { untrack } from 'svelte';
  import { openDialog } from '../utils/dialog';
  import { ArrowRight, X, NotebookPen } from '@lucide/svelte';
  import type { Session } from '../types';
  import { formatTime } from '../utils/timing';
  import { practice, updateNotes } from '../stores/practice.svelte';
  import TimingPlot from './TimingPlot.svelte';
  let {
    session,
    close,
    viewProgress,
  }: { session: Session; close: () => void; viewProgress: () => void } = $props();
  let notes = $state(untrack(() => session.notes));
  function finish(progress = false) {
    updateNotes(session.id, notes);
    close();
    if (progress) viewProgress();
  }
</script>

<div class="modal-backdrop">
  <dialog
    class="modal session-summary"
    aria-labelledby="summary-title"
    use:openDialog={() => finish()}
  >
    <button
      class="icon-button modal-close"
      aria-label="Close and save notes"
      onclick={() => finish()}
    >
      <X size={20} />
    </button>
    <h2 id="summary-title">Session results</h2>
    <p>
      {#if practice.warning}
        Your session is in memory. Browser saving needs attention; export a backup from My progress
        before closing.
      {:else}
        Your {session.completed ? 'completed session' : 'partial session'} is saved on this device.
      {/if}
    </p>
    <div class="summary-drill">
      {session.drillName}
      <span>
        {formatTime(session.seconds)}
        <i>·</i>
        {session.bpm}{session.bpm !== session.endBpm ? ` → ${session.endBpm}` : ''} BPM
      </span>
    </div>
    {#if session.timing}
      <div class="summary-metrics">
        <div>
          <strong>{session.timing.score}%</strong>
          <span>Timing estimate</span>
        </div>
        <div>
          <strong>
            {session.timing.matched ? Math.round(session.timing.meanErrorMs) : '—'}
            <small>ms</small>
          </strong>
          <span>Average error</span>
        </div>
        <div>
          <strong>{session.timing.matched}/{session.timing.expected}</strong>
          <span>Grid notes matched</span>
        </div>
      </div>
      <TimingPlot timing={session.timing} />
      <p class="fine-print">
        {session.timing.extra} extra hits. {session.timing.matched
          ? `Average ${Math.abs(Math.round(session.timing.meanOffsetMs))} ms ${session.timing.meanOffsetMs < 0 ? 'early' : 'late'}. Spread: ${Math.round(session.timing.consistencyMs)} ms.`
          : 'No hits matched. Check microphone input, threshold, and latency before your next session.'}
        Device latency can affect these estimates.
        {#if session.latencyMs !== undefined}Compensation: {session.latencyMs} ms.{/if}
      </p>
    {/if}
    {#if session.strokes}<p class="fine-print">
        Camera motion bursts: {session.strokes.left} left · {session.strokes.right} right. Motion counts
        are experimental.
      </p>{/if}
    <label class="notes-label" for="session-notes">
      <NotebookPen size={16} /> What did you notice?
    </label>
    <textarea
      id="session-notes"
      bind:value={notes}
      placeholder="Notes for your next session"
      rows="3"></textarea>
    <button class="primary-button full-width" onclick={() => finish(true)}>
      Save notes & view progress <ArrowRight size={17} />
    </button>
    <button class="text-button centered" onclick={() => finish()}>Back to the practice room</button>
  </dialog>
</div>
