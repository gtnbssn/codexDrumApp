<script lang="ts">
  import { openDialog } from '../utils/dialog';
  import { Plus, ArrowRight, Trash2, X, Play, Music2 } from '@lucide/svelte';
  import { practice, addPlan, removePlan } from '../stores/practice.svelte';
  import { drills, findDrill } from '../data/drills';
  import type { Drill } from '../types';
  let { startDrill }: { startDrill: (drill: Drill) => void } = $props();
  const days = [
    { id: 1, name: 'Monday' },
    { id: 2, name: 'Tuesday' },
    { id: 3, name: 'Wednesday' },
    { id: 4, name: 'Thursday' },
    { id: 5, name: 'Friday' },
    { id: 6, name: 'Saturday' },
    { id: 0, name: 'Sunday' },
  ];
  let adding = $state(false);
  let selectedDay = $state(new Date().getDay());
  let drillId = $state(drills[0].id);
  let bpm = $state(80);
  let minutes = $state(5);
  let planTotal = $derived(practice.data.plan.reduce((sum, p) => sum + p.minutes, 0));

  function open(day: number) {
    selectedDay = day;
    adding = true;
  }
  function save(event: SubmitEvent) {
    event.preventDefault();
    addPlan({ id: crypto.randomUUID(), day: selectedDay, drillId, minutes, bpm });
    adding = false;
  }
  function starterPlan() {
    [1, 3, 5].forEach((day) => {
      [
        { drillId: 'single-strokes', minutes: 5, bpm: 80 },
        { drillId: 'double-strokes', minutes: 3, bpm: 70 },
        { drillId: 'gap-click', minutes: 2, bpm: 80 },
      ].forEach((item) => addPlan({ ...item, id: crypto.randomUUID(), day }));
    });
  }
</script>

<div class="page-intro">
  <h1>Practice plan</h1>
  <button class="primary-button" onclick={() => open(new Date().getDay())}>
    <Plus size={17} />Add a drill
  </button>
</div>
<p class="planner-description">Recurring weekly routine · {planTotal} minutes planned per week.</p>
{#if !practice.data.plan.length}<div class="starter-banner">
    <div>
      <strong>Starter routine</strong>
      <p>10 minutes of drills on Monday, Wednesday, and Friday.</p>
    </div>
    <button class="secondary-button" onclick={starterPlan}>
      Use the starter plan <ArrowRight size={16} />
    </button>
  </div>{/if}
<div class="planner-week">
  {#each days as day}{@const items = practice.data.plan.filter((p) => p.day === day.id)}
    <section class="planner-day card" class:is-today={new Date().getDay() === day.id}>
      <div class="day-heading">
        <h3>
          {day.name}{#if new Date().getDay() === day.id}<span class="tiny-label coral">
              TODAY
            </span>{/if}
        </h3>
        <span>{items.reduce((sum, p) => sum + p.minutes, 0)} min</span>
      </div>
      {#if items.length}<div class="day-drills">
          {#each items as item}{@const drill = findDrill(item.drillId)}
            <div class="day-drill">
              <span class="plan-item-icon"><Music2 size={17} /></span>
              <div>
                <strong>{drill.name}</strong>
                <span>{drill.category} · {item.minutes} min · {item.bpm} BPM</span>
              </div>
              <button
                class="icon-button play-planned"
                aria-label={`Practice ${drill.name} on ${day.name}`}
                onclick={() => startDrill({ ...drill, bpm: item.bpm, minutes: item.minutes })}
              >
                <Play size={16} />
              </button>
              <button
                class="icon-button"
                aria-label={`Remove ${drill.name} from ${day.name}`}
                onclick={() => removePlan(item.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>{/each}
        </div>{:else}<p class="rest-day">No drills scheduled.</p>{/if}
      <button class="add-day-button" onclick={() => open(day.id)}>
        <Plus size={14} />Add a drill
      </button>
    </section>{/each}
</div>
{#if adding}<div class="modal-backdrop">
    <dialog class="modal" aria-labelledby="add-drill-title" use:openDialog={() => (adding = false)}>
      <button
        class="icon-button modal-close"
        aria-label="Close add drill"
        onclick={() => (adding = false)}
      >
        <X size={20} />
      </button>
      <h2 id="add-drill-title">Add a drill</h2>
      <p>Add a drill to your recurring weekly plan.</p>
      <form class="plan-form" onsubmit={save}>
        <label>
          Day
          <select bind:value={selectedDay}>
            {#each days as day}<option value={day.id}>{day.name}</option>{/each}
          </select>
        </label>
        <label>
          Drill
          <select
            bind:value={drillId}
            onchange={() => {
              const drill = findDrill(drillId);
              bpm = drill.bpm;
              minutes = drill.minutes;
            }}
          >
            {#each drills as drill}<option value={drill.id}>{drill.name}</option>{/each}
          </select>
        </label>
        <div class="form-row">
          <label>
            Duration (minutes)
            <input type="number" min="1" max="30" required bind:value={minutes} />
          </label>
          <label>
            Starting tempo (BPM)
            <input type="number" min="30" max="240" required bind:value={bpm} />
          </label>
        </div>
        <button class="primary-button full-width">Add to my week <Plus size={16} /></button>
      </form>
    </dialog>
  </div>{/if}
