<script lang="ts">
  import type { EveningEntry, MorningEntry } from '../../lib/stats/schema'

  // Die Zeilen von „Dein Abend“ (Spec M11 §2.1): auf der Karte auf „Heute“ und im Abschluss des Ablaufs. Jede Zeile
  // erscheint nur, wenn sie etwas zu sagen hat; ohne jede Angabe steht „Logbuch erledigt.“. Der Big Domino kommt aus dem
  // Morgen-Eintrag desselben Logbuch-Tages, so zeigt die Zeile immer den aktuellen Stand des Hakens.
  let { entry, morning }: { entry: EveningEntry; morning: MorningEntry | null } = $props()

  const domino = $derived(morning?.domino ?? null)
  const empty = $derived(!entry.gave && !entry.cost && !domino && !entry.learned && !entry.better && !entry.weekFocus)
</script>

<div class="summary-lines">
  {#if entry.gave}
    <div class="row">
      <p class="label">Hat Energie gegeben</p>
      <ul class="marks" role="list">
        {#each entry.gave as tag (tag)}<li class="mark gave">{tag}</li>{/each}
      </ul>
    </div>
  {/if}
  {#if entry.cost}
    <div class="row">
      <p class="label">Hat Energie gekostet</p>
      <ul class="marks" role="list">
        {#each entry.cost as tag (tag)}<li class="mark cost">{tag}</li>{/each}
      </ul>
    </div>
  {/if}
  {#if domino}
    <p class="line">{morning?.dominoDone ? 'Big Domino geschafft:' : 'Big Domino offen:'} {domino}</p>
  {/if}
  {#if entry.learned}
    <p class="line">Gelernt: {entry.learned}</p>
  {/if}
  {#if entry.better}
    <p class="line">Morgen 1 % besser: {entry.better}</p>
  {/if}
  {#if entry.weekFocus}
    <p class="line">Wochenfokus: {entry.weekFocus}</p>
  {/if}
  {#if empty}
    <p class="line">Logbuch erledigt.</p>
  {/if}
</div>

<style>
  .summary-lines {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    min-width: 0;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label {
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .marks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Geber mint, Räuber koralle: Die Flächen unterscheiden sich in Farbe und Helligkeit, die Schrift bleibt die Textfarbe
     der Stimmung (Kontrast wie jeder Text). Die Bedeutung trägt die Überschrift darüber. Lange Wörter brechen um. */
  .mark {
    max-width: 100%;
    padding: 6px 12px;
    border: 1px solid transparent;
    border-radius: 16px;
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .mark.gave {
    border-color: rgb(159 224 207 / 0.55);
    background: rgb(159 224 207 / 0.16);
  }

  .mark.cost {
    border-color: rgb(244 169 154 / 0.4);
    background: rgb(244 169 154 / 0.1);
  }

  .line {
    font-size: 0.9375rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
</style>
