<script lang="ts">
  import { dominoLine, tagCountLine, type WeekReview } from '../../lib/evening/logic'

  // Die Blöcke der Wochenauswertung (Spec M11 §2.3, Schritt 7): Energie-Bilanz der Woche (Geber und Räuber, je die Top 3),
  // Big Dominos und „Gelernt“. Ohne Überschrift: Die Wochenseite im Ablauf und „Deine Woche“ geben ihr eigene. `level` ist
  // die Ebene der Überschriften der Blöcke, passend zum Ort.
  let { review, level = 3 }: { review: WeekReview; level?: 3 | 4 } = $props()

  const heading = $derived(`h${level}`)
  const line = $derived(dominoLine(review))
</script>

<div class="week-summary">
  <section class="block bilanz" aria-label="Energie-Bilanz der Woche">
    <div class="side">
      <svelte:element this={heading} class="side-title"><span class="dot gave" aria-hidden="true"></span>Geber</svelte:element>
      {#each review.gave as t (t.tag)}
        <p class="tag-line">{tagCountLine(t)}</p>
      {:else}
        <p class="empty">Noch keine Angaben.</p>
      {/each}
    </div>
    <div class="side">
      <svelte:element this={heading} class="side-title"><span class="dot cost" aria-hidden="true"></span>Räuber</svelte:element>
      {#each review.cost as t (t.tag)}
        <p class="tag-line">{tagCountLine(t)}</p>
      {:else}
        <p class="empty">Noch keine Angaben.</p>
      {/each}
    </div>
  </section>

  <section class="block" aria-label="Big Dominos">
    <svelte:element this={heading} class="side-title">Big Dominos</svelte:element>
    {#if line}
      <p class="strong">{line}</p>
      <div class="bars" aria-hidden="true">
        {#each review.dominos as d, i (i)}
          <span class="bar {d}"></span>
        {/each}
      </div>
    {:else}
      <p class="empty">Diese Woche ohne Big Domino.</p>
    {/if}
  </section>

  {#if review.learned.length > 0}
    <section class="block" aria-label="Gelernt">
      <svelte:element this={heading} class="side-title">Gelernt</svelte:element>
      <ul class="learned" role="list">
        {#each review.learned as sentence, i (i)}
          <li>{sentence}</li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .week-summary {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    min-width: 0;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border: 1px solid var(--surface-border);
    border-radius: 18px;
    background: var(--surface);
  }

  /* Geber und Räuber nebeneinander, solange sie passen; bei großer Schrift untereinander. */
  .bilanz {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 14px;
  }

  .side {
    display: flex;
    flex: 1 1 9rem;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .side-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot.gave {
    background: rgb(159 224 207);
  }

  .dot.cost {
    background: rgb(244 169 154);
  }

  .tag-line,
  .learned li,
  .strong,
  .empty {
    font-size: 0.9375rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .strong {
    font-weight: 700;
  }

  .empty {
    color: var(--text-muted);
  }

  .bars {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }

  /* Geschafft voll im Akzent, offen halb, ohne Big Domino nur angedeutet. */
  .bar {
    height: 8px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--text) 12%, transparent);
  }

  .bar.offen {
    background: color-mix(in srgb, var(--text) 35%, transparent);
  }

  .bar.geschafft {
    background: var(--accent);
  }

  .learned {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
