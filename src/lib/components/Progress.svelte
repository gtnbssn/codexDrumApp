<script lang="ts">
  import { openDialog } from '../utils/dialog';
  import TimingTrend from './TimingTrend.svelte';
  import {
    ArrowRight,
    Download,
    Upload,
    Clock3,
    Target,
    Activity,
    Music2,
    ChevronLeft,
    ChevronRight,
    Trash2,
    ChevronDown,
    Pencil,
    Check,
    X,
    NotebookPen,
  } from '@lucide/svelte';
  import { validateData } from '../utils/backup';
  import {
    practice,
    exportData,
    importData,
    setGoal,
    updateNotes,
    removeSession,
  } from '../stores/practice.svelte';
  import { formatTime, localDay, weekDays } from '../utils/timing';
  let { goPractice }: { goPractice: () => void } = $props();
  let fileInput: HTMLInputElement;
  let message = $state('');
  let importError = $state(false);
  let pendingImport = $state<unknown>(null);
  let weekOffset = $state(0);
  let expanded = $state<string | null>(null);
  let deleting = $state<string | null>(null);
  let editingGoal = $state(false);
  let goalInput = $state(practice.data.weeklyGoal);
  let anchor = $derived.by(() => {
    const date = new Date();
    date.setDate(date.getDate() + weekOffset * 7);
    return date;
  });
  let days = $derived(weekDays(anchor));
  let daily = $derived(
    days.map((day) =>
      practice.data.sessions
        .filter((s) => localDay(new Date(s.startedAt)) === localDay(day))
        .reduce((sum, s) => sum + s.seconds / 60, 0),
    ),
  );
  let totalMinutes = $derived(practice.data.sessions.reduce((sum, s) => sum + s.seconds / 60, 0));
  let timed = $derived(practice.data.sessions.filter((s) => s.timing !== null));
  let averageTiming = $derived(
    timed.length
      ? Math.round(timed.reduce((sum, s) => sum + s.timing!.score, 0) / timed.length)
      : null,
  );
  let activeDays = $derived(
    new Set(practice.data.sessions.map((s) => localDay(new Date(s.startedAt)))).size,
  );
  let chartMax = $derived(Math.max(10, ...daily));

  async function readBackup(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error('Please choose a Pocket JSON backup smaller than 5 MB.');
      const data: unknown = JSON.parse(await file.text());
      if (!validateData(data))
        throw new Error('This file is not a valid Pocket backup. Existing data is unchanged.');
      pendingImport = data;
    } catch (error) {
      message = error instanceof Error ? error.message : 'Could not read this backup.';
      importError = true;
    }
    (event.target as HTMLInputElement).value = '';
  }

  function confirmImport() {
    try {
      importData(pendingImport);
      message = 'Backup restored. Your practice history and plan are here.';
      importError = false;
    } catch (error) {
      message = error instanceof Error ? error.message : 'Could not restore backup.';
      importError = true;
    }
    pendingImport = null;
  }
</script>

<div class="page-intro">
  <h1>My progress</h1>
  <div class="backup-buttons">
    <button class="secondary-button" onclick={exportData}><Download size={16} />Export</button>
    <button
      class="icon-button bordered"
      aria-label="Import backup"
      onclick={() => fileInput.click()}
    >
      <Upload size={17} />
    </button>
    <input
      class="hidden"
      type="file"
      accept="application/json,.json"
      bind:this={fileInput}
      onchange={readBackup}
    />
  </div>
</div>
{#if message}<div class:notice-error={importError} class="notice" role="status">
    {message}
    <button class="icon-button" aria-label="Dismiss message" onclick={() => (message = '')}>
      <X size={16} />
    </button>
  </div>{/if}
<div class="stat-grid">
  <div class="stat-card card">
    <span><Clock3 size={17} />Practice time</span>
    <strong>
      {Math.floor(totalMinutes)}
      <small>min</small>
    </strong>
    <p>Across {practice.data.sessions.length} saved sessions</p>
  </div>
  <div class="stat-card card">
    <span><Music2 size={17} />Practice days</span>
    <strong>
      {activeDays}
      <small>days</small>
    </strong>
    <p>Days with a saved session</p>
  </div>
  <div class="stat-card card">
    <span><Activity size={17} />Timing estimate</span>
    <strong>{averageTiming === null ? '—' : `${averageTiming}%`}</strong>
    <p>
      {timed.length
        ? `Average of ${timed.length} microphone sessions`
        : 'Enable your microphone to start measuring'}
    </p>
  </div>
</div>
<div class="progress-panels">
  <section class="card activity-card">
    <div class="section-heading">
      <div>
        <h3>Practice minutes</h3>
        <p class="section-description">
          {days[0].toLocaleDateString('en', { month: 'short', day: 'numeric' })} – {days[6].toLocaleDateString(
            'en',
            { month: 'short', day: 'numeric', year: 'numeric' },
          )}
        </p>
      </div>
      <div class="chart-controls">
        <button class="icon-button" aria-label="Previous week" onclick={() => weekOffset--}>
          <ChevronLeft size={17} />
        </button>
        <button class="text-button" onclick={() => (weekOffset = 0)}>
          {weekOffset === 0 ? 'This week' : 'Back to today'}
        </button>
        <button
          class="icon-button"
          aria-label="Next week"
          disabled={weekOffset >= 0}
          onclick={() => weekOffset++}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
    <div
      class="activity-chart"
      role="img"
      aria-label={days
        .map(
          (day, i) =>
            `${day.toLocaleDateString('en', { weekday: 'long' })}: ${daily[i].toFixed(1)} minutes`,
        )
        .join(', ')}
    >
      <div class="chart-grid">
        <span>{Math.ceil(chartMax)} min</span>
        <span>{Math.ceil(chartMax / 2)}</span>
        <span>0</span>
      </div>
      {#each days as day, i}<div class="chart-column">
          <span>{daily[i] ? `${Math.round(daily[i] * 10) / 10}m` : ''}</span>
          <div class="bar-track">
            <div
              class:current-day={localDay(day) === localDay(new Date())}
              style={`height:${Math.max(daily[i] ? 3 : 0, (daily[i] / chartMax) * 100)}%`}
            ></div>
          </div>
          <small class:coral={localDay(day) === localDay(new Date())}>
            {day.toLocaleDateString('en', { weekday: 'short' })}
          </small>
        </div>{/each}
    </div>
  </section>
  <section class="card goal-card">
    <div class="section-heading">
      <h3>Weekly goal</h3>
      <Target size={18} />
    </div>
    <div
      class="goal-circle"
      style={`--progress:${Math.min(100, (daily.reduce((a, b) => a + b, 0) / practice.data.weeklyGoal) * 100)}%`}
    >
      <div>
        <strong>{Math.floor(daily.reduce((a, b) => a + b, 0))}</strong>
        <span>of {practice.data.weeklyGoal} min</span>
      </div>
    </div>
    {#if editingGoal}<form
        class="goal-form"
        onsubmit={(e) => {
          e.preventDefault();
          setGoal(goalInput);
          editingGoal = false;
        }}
      >
        <input
          aria-label="Weekly goal in minutes"
          type="number"
          min="10"
          max="1000"
          required
          bind:value={goalInput}
        />
        <span>min / week</span>
        <button class="icon-button" aria-label="Save goal"><Check size={18} /></button>
      </form>{:else}<button
        class="text-button"
        onclick={() => {
          goalInput = practice.data.weeklyGoal;
          editingGoal = true;
        }}
      >
        <Pencil size={13} />Edit weekly goal
      </button>{/if}
  </section>
</div>
<TimingTrend sessions={practice.data.sessions} />
<section class="history-section">
  <div class="section-title">
    <h2>Sessions</h2>
    <span class="muted">{practice.data.sessions.length} sessions</span>
  </div>
  {#if practice.data.sessions.length}<div class="history-table card">
      <div class="history-row table-heading">
        <span>DRILL / DATE</span>
        <span>DURATION</span>
        <span>TEMPO</span>
        <span>TIMING</span>
        <span></span>
      </div>
      {#each practice.data.sessions as session}<div class="history-row">
          <button
            class="session-name"
            onclick={() => (expanded = expanded === session.id ? null : session.id)}
          >
            <span class="history-icon"><Music2 size={18} /></span>
            <span>
              <strong>{session.drillName}</strong>
              <small>
                {new Date(session.startedAt).toLocaleDateString('en', {
                  month: 'short',
                  day: 'numeric',
                })} · {new Date(session.startedAt).toLocaleTimeString('en', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}{session.completed ? '' : ' · Partial'}
              </small>
            </span>
          </button>
          <span>{formatTime(session.seconds)}</span>
          <span>
            {session.bpm}{session.endBpm !== session.bpm ? ` → ${session.endBpm}` : ''}
            <small>BPM</small>
          </span>
          <span>{session.timing ? `${session.timing.score}%` : '—'}</span>
          <button
            class="icon-button"
            aria-label={`Expand ${session.drillName} session`}
            onclick={() => (expanded = expanded === session.id ? null : session.id)}
          >
            <ChevronDown size={17} />
          </button>
        </div>
        {#if expanded === session.id}<div class="session-expanded">
            {#if session.timing}<div class="session-detail-metrics">
                <span>{session.timing.matched} / {session.timing.expected} notes matched</span>
                <span>
                  {session.timing.matched ? Math.round(session.timing.meanErrorMs) : '—'} ms average error
                </span>
                <span>{session.timing.extra} extra hits</span>
                {#if session.latencyMs !== undefined}<span>
                    {session.latencyMs} ms compensation
                  </span>{/if}
                <span>
                  {session.timing.matched ? Math.round(session.timing.consistencyMs) : '—'} ms spread
                </span>
              </div>{/if}{#if session.strokes}<p class="fine-print">
                Experimental motion counts: L {session.strokes.left} / R {session.strokes.right}
              </p>{/if}
            <label for={`notes-${session.id}`} class="notes-label">
              <NotebookPen size={15} />Session notes (saved when you leave this field)
            </label>
            <textarea
              id={`notes-${session.id}`}
              rows="2"
              value={session.notes}
              placeholder="What did you notice?"
              onchange={(e) => updateNotes(session.id, e.currentTarget.value)}></textarea>
            <button class="text-button danger" onclick={() => (deleting = session.id)}>
              <Trash2 size={14} />Delete session
            </button>
          </div>{/if}{/each}
    </div>{:else}<div class="empty-state card">
      <h2>No sessions yet</h2>
      <p>End a practice session to save its duration, notes, and timing results here.</p>
      <button class="primary-button" onclick={goPractice}>
        Start practice <ArrowRight size={17} />
      </button>
    </div>{/if}
</section>
<p class="storage-caption">
  Stored in this browser, on this device. Export regularly to keep a backup. Timing scores are
  device-dependent estimates.
</p>

{#if deleting || pendingImport}<div class="modal-backdrop">
    <dialog
      class="modal small-modal"
      aria-labelledby="confirm-title"
      use:openDialog={() => {
        deleting = null;
        pendingImport = null;
      }}
    >
      <h2 id="confirm-title">{deleting ? 'Delete this session?' : 'Restore this backup?'}</h2>
      <p>
        {deleting
          ? 'This removes the session and its notes from this device. This cannot be undone.'
          : 'This replaces your current sessions, weekly goal, and practice plan. Export a backup first if you want to keep them.'}
      </p>
      <div class="modal-actions">
        <button
          class="secondary-button"
          onclick={() => {
            deleting = null;
            pendingImport = null;
          }}
        >
          Cancel
        </button>
        <button
          class="primary-button"
          onclick={() => {
            if (deleting) {
              removeSession(deleting);
              deleting = null;
            } else confirmImport();
          }}
        >
          {deleting ? 'Delete session' : 'Replace with backup'}
        </button>
      </div>
    </dialog>
  </div>{/if}
