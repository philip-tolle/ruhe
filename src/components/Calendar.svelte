<script lang="ts">
  // Monatskalender: Tage mit mindestens einer gezählten Sitzung sind markiert. Er öffnet im
  // laufenden Monat; die Knöpfe blättern monatsweise, auch über Jahresgrenzen.
  import type { Session } from '../lib/stats/schema'
  import { daysInMonth } from '../lib/stats/summary'
  import { calendarWeeks, dayLabel, monthTitle, shiftMonth, WEEKDAYS } from '../lib/ui/ich-view'

  let { sessions }: { sessions: Session[] } = $props()

  const today = new Date()

  let shown = $state({ year: today.getFullYear(), month0: today.getMonth() })

  const weeks = $derived(calendarWeeks(shown.year, shown.month0))
  const meditated = $derived(daysInMonth(sessions, shown.year, shown.month0))
  const todayInMonth = $derived(shown.year === today.getFullYear() && shown.month0 === today.getMonth() ? today.getDate() : null)

  function page(delta: number) {
    shown = shiftMonth(shown.year, shown.month0, delta)
  }
</script>

{#snippet chevron(direction: 'previous' | 'next')}
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d={direction === 'previous' ? 'm14.5 6-6 6 6 6' : 'm9.5 6 6 6-6 6'} />
  </svg>
{/snippet}

<div class="card calendar">
  <div class="head">
    <button type="button" class="nav" aria-label="Vorheriger Monat" onclick={() => page(-1)}>
      {@render chevron('previous')}
    </button>
    <h2 aria-live="polite">{monthTitle(shown.year, shown.month0)}</h2>
    <button type="button" class="nav" aria-label="Nächster Monat" onclick={() => page(1)}>
      {@render chevron('next')}
    </button>
  </div>

  <!-- Feste Höhe für sechs Wochen: Beim Blättern bleibt alles darunter an seinem Platz. -->
  <div class="grid">
    <table>
      <thead>
        <tr>
          {#each WEEKDAYS as [short, long] (short)}
            <th scope="col"><abbr title={long}>{short}</abbr></th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each weeks as week, w (w)}
          <tr>
            {#each week as day, d (d)}
              {#if day === null}
                <td></td>
              {:else}
                {@const done = meditated.has(day)}
                <td
                  class:marked={done}
                  class:today={day === todayInMonth}
                  aria-label={done ? dayLabel(day, shown.month0) : undefined}
                  aria-current={day === todayInMonth ? 'date' : undefined}
                >
                  <span class="day">{day}</span>
                </td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .calendar {
    --row: 44px;
    --head-row: 32px;

    align-items: stretch;
    gap: 12px;
    padding: 20px 12px 16px;
  }

  .head {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    align-items: center;
    gap: 8px;
  }

  h2 {
    text-align: center;
  }

  .nav {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border: 1px solid var(--surface-border);
    border-radius: 50%;
    background: var(--surface);
    color: var(--text);
  }

  .grid {
    min-height: calc(var(--head-row) + 6 * var(--row));
  }

  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }

  th {
    height: var(--head-row);
    padding: 0;
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-weight: 600;
  }

  abbr {
    text-decoration: none;
  }

  td {
    height: var(--row);
    padding: 0;
    text-align: center;
    vertical-align: middle;
  }

  .day {
    display: inline-grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 0.9375rem;
    font-variant-numeric: tabular-nums;
  }

  .today .day {
    box-shadow: inset 0 0 0 1.5px var(--text-muted);
  }

  /* Meditierte Tage leuchten in Gold; der heutige Tag behält zusätzlich seinen Ring. */
  .marked .day {
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
    box-shadow: 0 0 18px rgb(242 201 138 / 0.28);
  }

  .marked.today .day {
    box-shadow:
      inset 0 0 0 2px var(--on-accent),
      0 0 18px rgb(242 201 138 / 0.28);
  }
</style>
