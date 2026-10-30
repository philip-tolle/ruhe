<script lang="ts">
  import { AREAS, AREA_INFO } from '../../lib/energy/areas'
  import {
    cellLabel,
    cellLevel,
    effectLabel,
    focusLine,
    hasPatternData,
    patternSentences,
    PATTERN_HINT,
    weekGrid,
    whatWorks,
    WHAT_WORKS_HINT,
  } from '../../lib/energy/insights'
  import { logbookDay, morningReminder, weekReview } from '../../lib/evening/logic'
  import { morningCount, morningCountLine } from '../../lib/morning/logic'
  import WeekSummary from '../evening/WeekSummary.svelte'
  import { stats } from '../../lib/stats/store.svelte'
  import { appNow } from '../../lib/ui/tageszeit.svelte'

  // „Deine Woche“ (Spec M9 §3.2 Punkt 6, §6.3–§6.6): das Raster der letzten 7 Tage mit den vier Bereichen, darunter die
  // Muster-Sätze (oder der Hinweis, wann sie kommen), die Fokus-Zeile, die Zeile zum Morgen-Start (Spec M10 §2.2), den
  // Wochenrückblick des Abend-Logbuchs (Spec M11 §2.2) und „Was bei dir wirkt“. „Jetzt“ ist die Zeit der App (`appNow`):
  // neu bei jeder Änderung der Daten, mit jeder vollen Minute und bei der Rückkehr in die App.
  const id = $props.id()

  const view = $derived.by(() => {
    const now = appNow()
    const checkins = stats.data.energyCheckins ?? []
    const patterns = hasPatternData(checkins, now)
    return {
      days: weekGrid(checkins, now),
      patterns,
      sentences: patterns ? patternSentences(checkins, now) : [],
      focus: focusLine(stats.data.focusSprints ?? [], now),
      morning: morningCount(stats.data.mornings ?? [], now),
      review: weekReview(stats.data.evenings ?? [], stats.data.mornings ?? [], logbookDay(now)),
      focusWord: morningReminder(stats.data.evenings ?? [], now).weekFocus,
      works: whatWorks(stats.data.hackRuns ?? []),
    }
  })
</script>

<section class="card week" aria-labelledby="{id}-title">
  <h2 id="{id}-title">Deine Woche</h2>

  <!-- Achtspaltig: der Name des Bereichs und sieben Tage. Jedes Feld ist ein Bild mit Namen („Geist, Dienstag: 2,5 von 5“);
       Tag und Bereich in den Köpfen sind darum nur für Sehende da. Die Felder sind keine Tippflächen. -->
  <div class="grid">
    <span aria-hidden="true"></span>
    {#each view.days as day (day.key)}
      <span class="day" aria-hidden="true">{day.short}</span>
    {/each}

    {#each AREAS as area (area)}
      <span class="area" aria-hidden="true" style:--area-text="var(--area-{area}-text)">{AREA_INFO[area].title}</span>
      {#each view.days as day (day.key)}
        {@const mean = day.cells[area]}
        <span
          class="cell"
          class:empty={mean === null}
          role="img"
          aria-label={cellLabel(area, day.long, mean)}
          style:--area="var(--area-{area})"
          style:opacity={mean === null ? undefined : cellLevel(mean) / 5}
        ></span>
      {/each}
    {/each}
  </div>

  {#if view.patterns}
    <div class="sentences">
      {#each view.sentences as sentence (sentence)}
        <p>{sentence}</p>
      {/each}
    </div>
  {:else}
    <p class="hint">{PATTERN_HINT}</p>
  {/if}

  {#if view.focus}
    <p class="focus">{view.focus}</p>
  {/if}

  <!-- Spec M10 §2.2: unter der Fokus-Zeile, erst ab einem Tag mit Morgen-Start. -->
  {#if view.morning >= 1}
    <p class="morning-line">{morningCountLine(view.morning)}</p>
  {/if}

  <!-- Spec M11 §2.2: der Wochenrückblick des Abend-Logbuchs, sobald es in den sieben Tagen ein Logbuch gibt. -->
  {#if view.review.days >= 1}
    <div class="review">
      <h3>Wochenrückblick</h3>
      <WeekSummary review={view.review} level={4} />
      {#if view.focusWord}
        <p class="focus-word">Wochenfokus: {view.focusWord}</p>
      {/if}
    </div>
  {/if}

  <div class="works">
    <h3>Was bei dir wirkt</h3>
    {#if view.works.length > 0}
      <ol role="list">
        {#each view.works as { hack, mean }, i (hack.id)}
          <li style:--area-text="var(--area-{hack.area}-text)">
            {i + 1} · {hack.title} · <span class="where">{AREA_INFO[hack.area].title}</span> · {effectLabel(mean)}
          </li>
        {/each}
      </ol>
    {:else}
      <p class="hint">{WHAT_WORKS_HINT}</p>
    {/if}
  </div>
</section>

<style>
  .week {
    width: 100%;
  }

  /* Name des Bereichs und sieben gleich breite Tage. `minmax(0, 1fr)`: Die Felder schrumpfen mit dem Bildschirm (und mit
     großer Schrift), statt die Karte zu weiten; ein Feld ist ein Bild, keine Tippfläche. */
  .grid {
    display: grid;
    grid-template-columns: max-content repeat(7, minmax(0, 1fr));
    gap: 4px;
    align-items: center;
    width: 100%;
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .day {
    text-align: center;
  }

  /* Der Name steht in der Textfarbe des Bereichs (auf 4,5:1 abgestimmt), die Felder malen mit der Formfarbe. */
  .area {
    padding-right: 6px;
    color: var(--area-text);
    font-weight: 700;
  }

  .cell {
    box-sizing: border-box;
    min-width: 0;
    height: 1.75rem;
    border-radius: 6px;
    background: var(--area);
  }

  /* Ohne Check-in an dem Tag: gestrichelter Rahmen, kein Füllton. */
  .cell.empty {
    border: 1px dashed rgb(238 240 250 / 0.4);
    background: none;
  }

  .sentences {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  p {
    line-height: 1.45;
  }

  .hint {
    color: var(--text-muted);
    font-size: 0.9375rem;
  }

  /* Fokus-Zeile und Zeile zum Morgen-Start sehen gleich aus. */
  .focus,
  .morning-line {
    font-weight: 700;
  }

  .review,
  .works {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .focus-word {
    font-size: 0.9375rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  h3 {
    color: var(--text-muted);
    font-family: var(--font-body), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 0.875rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  ol {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .where {
    color: var(--area-text);
    font-weight: 700;
  }
</style>
