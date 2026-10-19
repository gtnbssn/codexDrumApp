<script lang="ts">
  import type { TimingResult } from '../types';
  let { timing }: { timing: TimingResult } = $props();
  let points = $derived(timing.offsets.slice(-48));
</script>

<div class="timing-plot">
  <div class="section-heading">
    <h4>Where your hits landed</h4>
    <span>Last {points.length} matched hits</span>
  </div>
  <svg
    viewBox="0 0 360 78"
    role="img"
    aria-label={`Matched hit offsets: ${points.map((offset) => `${Math.round(offset)} milliseconds`).join(', ') || 'No matched hits'}`}
  >
    <rect x="156" y="5" width="48" height="52" rx="4" fill="#edf4ec" />
    <line x1="12" y1="31" x2="348" y2="31" stroke="#e5e9e6" />
    <line x1="180" y1="4" x2="180" y2="58" stroke="#b8c9b8" stroke-dasharray="3 3" />
    {#each points as offset, index}
      <circle
        cx={180 + (Math.max(-150, Math.min(150, offset)) / 150) * 168}
        cy={17 + (index % 5) * 7}
        r="3"
        fill={Math.abs(offset) <= 25 ? '#98ae96' : '#e8a68f'}
        opacity="0.8"
      >
        <title>{Math.round(offset)} ms {offset < 0 ? 'early' : 'late'}</title>
      </circle>
    {/each}
    <text x="12" y="74">−150 ms · EARLY</text>
    <text x="180" y="74" text-anchor="middle">ON THE BEAT</text>
    <text x="348" y="74" text-anchor="end">LATE · +150 ms</text>
  </svg>
</div>
