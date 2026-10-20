<script lang="ts">
  import type { TimingResult } from '../types';
  let { timing }: { timing: TimingResult } = $props();
  let points = $derived(timing.offsets.slice(-48));
  // Use the available pixel width so chart labels stay readable on small screens.
  let width = $state(360);
  let center = $derived(width / 2);
  let radius = $derived(Math.max(1, center - 16));
</script>

<div class="timing-plot">
  <div class="section-heading">
    <h4>Where your hits landed</h4>
    <span>Last {points.length} matched hits</span>
  </div>
  <div class="chart-viewport" bind:clientWidth={width}>
    <svg
      viewBox={`0 0 ${width} 96`}
      role="img"
      aria-label={`Matched hit offsets: ${points.map((offset) => `${Math.round(offset)} milliseconds`).join(', ') || 'No matched hits'}`}
    >
      <rect x={center - radius / 6} y="5" width={radius / 3} height="52" rx="4" fill="#edf4ec" />
      <line x1="12" y1="31" x2={width - 12} y2="31" stroke="#d0d9d2" />
      <line x1={center} y1="4" x2={center} y2="58" stroke="#6b8970" stroke-dasharray="3 3" />
      {#each points as offset, index}
        <circle
          cx={center + (Math.max(-150, Math.min(150, offset)) / 150) * radius}
          cy={17 + (index % 5) * 7}
          r="3"
          fill={Math.abs(offset) <= 25 ? '#356b50' : '#b7472b'}
        >
          <title>{Math.round(offset)} ms {offset < 0 ? 'early' : 'late'}</title>
        </circle>
      {/each}
      <text x="12" y="90">−150 ms · early</text>
      <text x={center} y="90" text-anchor="middle">On beat</text>
      <text x={width - 12} y="90" text-anchor="end">late · +150 ms</text>
    </svg>
  </div>
</div>
