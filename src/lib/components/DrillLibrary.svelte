<script lang="ts">
  import { openDialog } from '../utils/dialog';
  import {
    Search,
    ArrowUpRight,
    ArrowRight,
    Music2,
    Headphones,
    Sparkles,
    Zap,
    X,
    Clock3,
    Check,
  } from '@lucide/svelte';
  import { drills, categories } from '../data/drills';
  import type { Drill } from '../types';
  let { startDrill }: { startDrill: (drill: Drill) => void } = $props();
  let search = $state('');
  let category = $state<string>('All drills');
  let detail = $state<Drill | null>(null);
  let filtered = $derived(
    drills.filter(
      (d) =>
        (category === 'All drills' || d.category === category) &&
        `${d.name} ${d.focus} ${d.category}`.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  const icons = { Rudiments: Music2, Timing: Headphones, Coordination: Sparkles, Endurance: Zap };
</script>

<div class="page-intro">
  <div>
    <div class="eyebrow">
      <span class="small-line"></span>
      PURPOSE IN EVERY PATTERN
    </div>
    <!-- prettier-ignore -->
    <h1>A good place to grow<span class="coral">.</span></h1>
    <p>Less guessing what to play. More getting into it.</p>
  </div>
  <span class="page-count">{drills.length} thoughtfully built drills</span>
</div>
<div class="library-toolbar">
  <div class="filter-tabs">
    {#each categories as item}<button
        class:chosen={category === item}
        onclick={() => (category = item)}
      >
        {item}
      </button>{/each}
  </div>
  <label class="search-box">
    <Search size={17} />
    <input aria-label="Search drills" placeholder="Find your next drill…" bind:value={search} />
  </label>
</div>
<div class="library-grid">
  {#each filtered as drill, i}
    {@const Icon = icons[drill.category]}
    <article class="library-card card">
      <div
        class="library-art"
        class:art-peach={drill.category === 'Rudiments'}
        class:art-green={drill.category === 'Timing'}
        class:art-blue={drill.category === 'Coordination'}
        class:art-yellow={drill.category === 'Endurance'}
      >
        <span class="art-number">0{drills.indexOf(drill) + 1}</span>
        <div class="rudiment-art">
          {#each drill.sticking.slice(0, 8) as hand, index}<span
              class:art-accent={drill.accents.includes(index)}
              style={`--offset:${index % 2 === 0 ? '-8px' : '8px'}`}
            >
              {hand}
            </span>{/each}
        </div>
        <span class="art-category"><Icon size={13} />{drill.category}</span>
      </div>
      <div class="library-card-body">
        <div class="section-heading">
          <span class="eyebrow">{drill.focus.toUpperCase()}</span>
          <span class="tiny-label">{drill.level}</span>
        </div>
        <h2>{drill.name}</h2>
        <p>{drill.description}</p>
        <div class="library-card-meta">
          <span><Clock3 size={14} />{drill.minutes} min</span>
          <span>{drill.bpm} BPM start</span>
          <button class="text-button" onclick={() => (detail = drill)}>
            Explore drill <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </article>
  {/each}
</div>
{#if !filtered.length}<div class="empty-state">
    <Search size={30} />
    <h2>No drills on that beat.</h2>
    <p>Try another search or category.</p>
    <button
      class="secondary-button"
      onclick={() => {
        search = '';
        category = 'All drills';
      }}
    >
      Show all drills
    </button>
  </div>{/if}
<div class="library-note">
  <Sparkles size={21} />
  <div>
    <strong>Start slower than you think you need to.</strong>
    <p>Choose a tempo where every note feels comfortable. Consistency comes before speed.</p>
  </div>
</div>

{#if detail}
  <div class="modal-backdrop">
    <dialog class="modal" aria-labelledby="drill-title" use:openDialog={() => (detail = null)}>
      <button
        class="icon-button modal-close"
        aria-label="Close drill details"
        onclick={() => (detail = null)}
      >
        <X size={20} />
      </button>
      <span class="pill coral-pill">{detail.category}</span>
      <h2 id="drill-title">{detail.name}</h2>
      <p>{detail.description}</p>
      <div class="detail-sticking">
        {#each detail.sticking as hand, i}<span class:accent={detail.accents.includes(i)}>
            {hand}
          </span>{/each}
      </div>
      <h4>Your focus: {detail.focus.toLowerCase()}</h4>
      <ul class="instruction-list">
        {#each detail.instructions as instruction}<li>
            <Check size={16} />
            <span>{instruction}</span>
          </li>{/each}
      </ul>
      <p class="fine-print">
        Suggested start: {detail.bpm} BPM · {detail.minutes} minutes. You can adjust both in the practice
        room.
      </p>
      <button
        class="primary-button full-width"
        onclick={() => {
          if (detail) startDrill(detail);
          detail = null;
        }}
      >
        Take it to the practice room <ArrowRight size={17} />
      </button>
    </dialog>
  </div>
{/if}
