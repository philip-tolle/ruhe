<script lang="ts">
  import { AREAS, AREA_INFO, LEVELS, type EnergyArea, type EnergyLevel } from '../../lib/energy/areas'
  import { freshCheckin, weakestArea } from '../../lib/energy/insights'
  import { stats } from '../../lib/stats/store.svelte'
  import { openCheckIn } from '../../lib/ui/energy-ui.svelte'

  // „Dein Akku“ (Spec M9 §3.2, §3.7): mit frischem Check-in (höchstens 3 Std.) die vier Akkus in den Bereichsfarben,
  // gefüllt nach Stufe; sonst die Frage und „Check-in“. `compact` ist die schmale Karte auf „Heute“: Sie zeigt die
  // Akkus klein, nennt den niedrigsten Bereich und ist als Ganzes ein Knopf (`onOpen`, dort der Reiter „Energie“).
  // Ohne frischen Check-in gleicht sie der vollen Karte. „Jetzt“ ist wie auf „Heute“ und „Ich“ die Zeit beim Berechnen.
  let { compact = false, onOpen }: { compact?: boolean; onOpen?: () => void } = $props()

  const fresh = $derived(freshCheckin(stats.data.energyCheckins ?? [], new Date()))
</script>

<!-- Ein Akku: fünf Felder von unten, bis zur Stufe in der Bereichsfarbe. Schmuck; Name und Stufe stehen als Text daneben. -->
{#snippet battery(area: EnergyArea, level: EnergyLevel, mini: boolean)}
  <span class="battery" class:mini aria-hidden="true" style:--battery="var(--area-{area})">
    {#each LEVELS as n (n)}
      <span class="cell" class:on={n <= level}></span>
    {/each}
  </span>
{/snippet}

{#if fresh && compact}
  {@const levels = fresh.levels}
  <button type="button" class="card compact" onclick={() => onOpen?.()}>
    <span class="compact-head">
      <span class="title">Dein Akku</span>
      <span class="minis">
        {#each AREAS as area (area)}
          {@render battery(area, levels[area], true)}
        {/each}
      </span>
    </span>
    <span class="compact-row">
      <span class="line">{AREA_INFO[weakestArea(levels)].title} am niedrigsten · Jetzt-Reset</span>
      <svg class="chevron" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </span>
    <!-- Die Farben sagen nichts allein: Für Hilfstechnik stehen die Stufen mit Namen im Knopf. -->
    <span class="visually-hidden">
      {AREAS.map((area) => `${AREA_INFO[area].title} ${levels[area]} von 5`).join(', ')}
    </span>
  </button>
{:else}
  <div class="card akku">
    <h2>Dein Akku</h2>
    {#if fresh}
      {@const levels = fresh.levels}
      <ul class="cells">
        {#each AREAS as area (area)}
          <li>
            {@render battery(area, levels[area], false)}
            <span class="name">{AREA_INFO[area].title}</span>
            <span class="value">{levels[area]} von 5</span>
          </li>
        {/each}
      </ul>
      <button type="button" class="button-line" onclick={openCheckIn}>Neuer Check-in</button>
    {:else}
      <p class="ask">Wie voll ist dein Akku?</p>
      <button type="button" class="button-line" onclick={openCheckIn}>Check-in</button>
    {/if}
  </div>
{/if}

<style>
  .akku {
    width: 100%;
  }

  .ask {
    color: var(--text-muted);
  }

  .cells {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .cells li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .name {
    font-size: 0.875rem;
    font-weight: 700;
  }

  .value {
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  /* Der Akku: Rahmen und gefüllte Felder in der Bereichsfarbe; 30 × 64 px, fünf Felder à 9 px mit 2 px Abstand. */
  .battery {
    display: flex;
    flex-direction: column-reverse;
    gap: 2px;
    width: 30px;
    height: 64px;
    padding: 3px;
    border: 2px solid var(--battery);
    border-radius: 8px;
  }

  .cell {
    flex: 1 1 0;
    border-radius: 2px;
    background: rgb(238 240 250 / 0.08);
  }

  .cell.on {
    background: var(--battery);
  }

  .battery.mini {
    width: 16px;
    height: 36px;
    gap: 1px;
    padding: 2px;
    border-width: 1.5px;
    border-radius: 5px;
  }

  .mini .cell {
    border-radius: 1px;
  }

  /* Die schmale Karte ist ein Knopf: ganze Fläche tippbar, Schrift wie im Fließtext. */
  .compact {
    width: 100%;
    gap: 12px;
    padding: 18px 24px;
    color: inherit;
    font: inherit;
    text-align: left;
  }

  .title {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.1875rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  /* Oben der Titel und die kleinen Akkus, darunter die Zeile mit dem Pfeil: So bleibt der Satz auch auf 360 px kurz. */
  .compact-head,
  .compact-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
  }

  .minis {
    display: flex;
    flex: none;
    gap: 6px;
  }

  .line {
    flex: 1 1 auto;
    min-width: 0;
    font-weight: 600;
    line-height: 1.35;
  }

  .chevron {
    flex: none;
    stroke: var(--text-muted);
  }
</style>
