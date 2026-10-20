<script lang="ts">
  import { openDialog } from '../utils/dialog';
  import {
    AudioLines,
    SlidersHorizontal,
    LayoutGrid,
    ChartNoAxesCombined,
    CalendarDays,
    ArrowUpRight,
    CircleHelp,
    X,
  } from '@lucide/svelte';
  import type { Page } from '../types';
  let {
    page,
    navigate,
    running,
  }: { page: Page; navigate: (page: Page) => void; running: boolean } = $props();
  let help = $state(false);
  const links = [
    { id: 'practice' as const, title: 'Practice room', icon: SlidersHorizontal },
    { id: 'library' as const, title: 'Drill library', icon: LayoutGrid },
    { id: 'progress' as const, title: 'My progress', icon: ChartNoAxesCombined },
    { id: 'planner' as const, title: 'Practice plan', icon: CalendarDays },
  ];
</script>

<aside class="sidebar">
  <a
    class="brand"
    href="#practice"
    onclick={(event) => {
      event.preventDefault();
      navigate('practice');
    }}
    aria-label="Pocket home"
  >
    <span class="brand-symbol"><AudioLines size={24} strokeWidth={2.8} /></span>
    <!-- prettier-ignore -->
    <span class="brand-word">pocket<span class="brand-dot">.</span></span>
  </a>
  <nav aria-label="Main navigation">
    {#each links as item}
      <button
        class:active={page === item.id}
        disabled={running && page !== item.id}
        aria-label={item.title}
        onclick={() => navigate(item.id)}
        aria-current={page === item.id ? 'page' : undefined}
      >
        <item.icon size={19} strokeWidth={1.7} />
        <span>{item.title}</span>
        {#if page === item.id}<span class="nav-active-dot"></span>{/if}
      </button>
    {/each}
  </nav>
  <div class="sidebar-bottom">
    <button class="help-link" onclick={() => (help = true)}>
      <CircleHelp size={17} /> Help <ArrowUpRight size={15} />
    </button>
  </div>
</aside>

{#if help}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) help = false;
    }}
  >
    <dialog class="modal" aria-labelledby="help-title" use:openDialog={() => (help = false)}>
      <button
        class="icon-button modal-close"
        aria-label="Close help"
        onclick={() => (help = false)}
      >
        <X size={20} />
      </button>
      <h2 id="help-title">Practice help</h2>
      <p>
        Pick a drill, set a comfortable tempo, and press play. One bar counts you in. End your
        session to save it, even if you don’t finish the timer.
      </p>
      <p>
        Microphone feedback detects sound transients. Use headphones so the click doesn’t count as a
        hit. Device latency and room noise affect the estimates.
      </p>
      <p>
        The experimental camera tool counts motion bursts in two hand zones. It does not evaluate
        technique or detect contact with a drum.
      </p>
      <p>
        Your history lives in this browser. Export a backup from My progress before clearing browser
        data or changing devices. No account, uploads, or cloud sync.
      </p>
      <button class="primary-button" onclick={() => (help = false)}>
        Close help <ArrowUpRight size={17} />
      </button>
    </dialog>
  </div>
{/if}
