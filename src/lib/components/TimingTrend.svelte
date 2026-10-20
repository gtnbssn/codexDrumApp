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
  // Draw in CSS pixels; changing viewport width never shrinks the label font.
  let width = $state(640);
  const x = (index: number, count: number) =>
    count > 1 ? 54 + (index / (count - 1)) * Math.max(1, width - 76) : width / 2;
  const y = (score: number) => 115 - score;
  let points = $derived(
    recent.map((s, i) => `${x(i, recent.length)},${y(s.timing!.score)}`).join(' '),
  );
  // Limit date labels on narrow screens. Every point still has its full tooltip.
  let labelInterval = $derived(Math.max(1, Math.ceil(recent.length / (width < 500 ? 3 : 6))));
</script>

{#if measured.length}
  <section class="card timing-trend-card">
    <div class="section-heading">
      <div>
        <h3>Timing trend</h3>
        <p class="section-description">
          Your last {recent.length} measured sessions, oldest to newest.
        </p>
      </div>
      <select aria-label="Filter timing trend by drill" bind:value={filter}>
        <option value="all">All drills</option>
        {#each drillOptions as [id, name]}<option value={id}>{name}</option>{/each}
      </select>
    </div>
    <div class="chart-viewport" bind:clientWidth={width}>
      <svg
        viewBox={`0 0 ${width} 160`}
        role="img"
        aria-label={`Timing trend: ${recent.map((session) => `${session.drillName}, ${session.timing!.score} percent`).join('; ')}`}
      >
        {#each [0, 50, 100] as score}
          <line x1="48" x2={width - 16} y1={y(score)} y2={y(score)} stroke="#dce2e6" />
          <text x="0" y={y(score) + 4}>{score}%</text>
        {/each}
        <polyline {points} fill="none" stroke="#356b50" stroke-width="2" />
        {#each recent as session, index}
          <circle
            cx={x(index, recent.length)}
            cy={y(session.timing!.score)}
            r="4"
            fill="#b7472b"
            stroke="white"
            stroke-width="2"
          >
            <title>
              {session.drillName} · {session.bpm} BPM · {session.timing!.score}% · {new Date(
                session.startedAt,
              ).toLocaleDateString()}
            </title>
          </circle>
          {#if index === 0 || index === recent.length - 1 || (index % labelInterval === 0 && index < recent.length - 2)}
            <text
              x={x(index, recent.length)}
              y="145"
              text-anchor={recent.length === 1
                ? 'middle'
                : index === 0
                  ? 'start'
                  : index === recent.length - 1
                    ? 'end'
                    : 'middle'}
            >
              {new Date(session.startedAt).toLocaleDateString('en', {
                month: 'short',
                day: 'numeric',
              })}
            </text>
          {/if}
        {/each}
      </svg>
    </div>
    <p class="fine-print">
      For a useful comparison, keep the drill, tempo, and microphone settings similar. Scores are
      estimates, including missed and extra hits.
    </p>
  </section>
{/if}
