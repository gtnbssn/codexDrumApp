<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from './lib/components/Sidebar.svelte';
  import PracticeRoom from './lib/components/PracticeRoom.svelte';
  import DrillLibrary from './lib/components/DrillLibrary.svelte';
  import Progress from './lib/components/Progress.svelte';
  import Planner from './lib/components/Planner.svelte';
  import { drills } from './lib/data/drills';
  import { practice } from './lib/stores/practice.svelte';
  import type { Drill, Page } from './lib/types';

  const titles = {
    practice: 'Practice room',
    library: 'Drill library',
    progress: 'My progress',
    planner: 'Practice plan',
  };
  const validPage = (value: string): Page =>
    Object.hasOwn(titles, value) ? (value as Page) : 'practice';
  let page = $state<Page>(validPage(location.hash.slice(1)));
  let selected = $state(drills[0]);
  let selectionKey = $state(0);
  let running = $state(false);
  function navigate(next: Page) {
    if (running) return;
    page = next;
    location.hash = next;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function selectDrill(drill: Drill) {
    if (!running) {
      selected = drill;
      selectionKey++;
      navigate('practice');
    }
  }

  onMount(() => {
    const hashChange = () => {
      if (!running) page = validPage(location.hash.slice(1));
      else history.replaceState(null, '', `#${page}`);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (running) {
        event.preventDefault();
      }
    };
    window.addEventListener('hashchange', hashChange);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('hashchange', hashChange);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  });
</script>

<svelte:head><title>{titles[page]} · Pocket</title></svelte:head>
<div class="app-shell">
  <Sidebar {page} {navigate} {running} />
  <div class="workspace">
    <main id="main-content">
      {#if practice.warning}<div class="notice notice-error" role="alert">
          {practice.warning}
        </div>{/if}{#if page === 'practice'}{#key selectionKey}<PracticeRoom
            drill={selected}
            onSelect={selectDrill}
            onRunning={(value) => (running = value)}
            {navigate}
          />{/key}{:else if page === 'library'}<DrillLibrary
          startDrill={selectDrill}
        />{:else if page === 'progress'}<Progress
          goPractice={() => navigate('practice')}
        />{:else}<Planner startDrill={selectDrill} />{/if}
    </main>
  </div>
</div>
