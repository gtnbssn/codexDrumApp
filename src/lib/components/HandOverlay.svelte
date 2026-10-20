<script lang="ts">
  import { HAND_CONNECTIONS, type TrackedHand } from '../analysis/hand-tracking';
  let { hands }: { hands: TrackedHand[] } = $props();
</script>

<svg class="hand-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
  {#each hands as hand (hand.side)}
    <g class={hand.side}>
      {#each HAND_CONNECTIONS as [start, end]}
        <line
          x1={hand.points[start].x}
          y1={hand.points[start].y}
          x2={hand.points[end].x}
          y2={hand.points[end].y}
          vector-effect="non-scaling-stroke"
        />
      {/each}
      {#each hand.points as point}
        <circle cx={point.x} cy={point.y} r="0.006" />
      {/each}
    </g>
  {/each}
</svg>
