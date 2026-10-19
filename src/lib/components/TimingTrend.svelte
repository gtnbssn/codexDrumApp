<script lang="ts">
  import type { Session } from '../types';
  let { sessions }: { sessions: Session[] } = $props();
  let filter = $state('all');
  let measured = $derived(sessions.filter((session) => session.timing !== null));
  let drillOptions = $derived([
    ...new Map(measured.map((s) => [s.drillId, s.drillName])).entries(),
  ]);
  let recent = $derived(
    measured
      .filter((session) => filter === 'all' || session.drillId === filter)
      .slice(0, 10)
      .reverse(),
  );
  const x = (index: number, count: number) => (count > 1 ? 40 + (index / (count - 1)) * 720 : 400);
  const y = (score: number) => 115 - score;
  let points = $derived(
    recent.map((s, i) => `${x(i, recent.length)},${y(s.timing!.score)}`).join(' '),
  );
</script>

{#if measured.length}
  <section class="card timing-trend-card">
    <div class="section-heading">
      <div>
        <h3>Getting closer to the beat</h3>
        <p class="section-description">
          Your last {recent.length} measured sessions, oldest to newest.
        </p>
      </div>
      <select aria-label="Filter timing trend by drill" bind:value={filter}>
        <option value="all">All drills</option>
        {#each drillOptions as [id, name]}<option value={id}>{name}</option>{/each}
      </select>
    </div>
    <svg
      viewBox="0 0 800 145"
      role="img"
      aria-label={`Timing trend: ${recent.map((session) => `${session.drillName}, ${session.timing!.score} percent`).join('; ')}`}
    >
      {#each [0, 50, 100] as score}<line
          x1="30"
          x2="780"
          y1={y(score)}
          y2={y(score)}
          stroke="#edf0ed"
        />
        <text x="0" y={y(score) + 3}>{score}%</text>{/each}
      <polyline {points} fill="none" stroke="#a5b7a0" stroke-width="2" />
      {#each recent as session, index}<circle
          cx={x(index, recent.length)}
          cy={y(session.timing!.score)}
          r="4"
          fill="#e3a18a"
          stroke="white"
          stroke-width="2"
        >
          <title>
            {session.drillName} · {session.bpm} BPM · {session.timing!.score}% · {new Date(
              session.startedAt,
            ).toLocaleDateString()}
          </title>
        </circle>
        <text x={x(index, recent.length)} y="138" text-anchor="middle">
          {new Date(session.startedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        </text>{/each}
    </svg>
    <p class="fine-print">
      For a useful comparison, keep the drill, tempo, and microphone settings similar. Scores are
      estimates, including missed and extra hits.
    </p>
  </section>
{/if}
