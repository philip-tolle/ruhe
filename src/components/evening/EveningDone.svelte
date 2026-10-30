<script lang="ts">
  import Motiv from '../Motiv.svelte'
  import EveningSummary from './EveningSummary.svelte'
  import { morningEntry } from '../../lib/evening/logic'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { closeEvening, eveningUi } from '../../lib/ui/evening-ui.svelte'

  // Der Abschluss des Abend-Logbuchs (Spec M11 §2.3): Motiv, „Gute Nacht.“, die Zusammenfassung des gespeicherten
  // Eintrags (wie „Dein Abend“, ohne Zählzeile) und „Fertig“. „Fertig“ liegt an der Stelle des letzten „Weiter“: Er nimmt
  // Tipps erst kurz nach dem Erscheinen an, sonst schlösse ein Doppeltipp den Abschluss sofort (siehe `tapArming`).
  const arming = tapArming()

  const morning = $derived(morningEntry(stats.data.mornings ?? [], eveningUi.day))
</script>

<div class="step">
  <div class="content">
    <header class="hero">
      <Motiv id="vorschlag-abend" size={96} />
      <p class="kicker">Tag abgeschlossen</p>
      <h2 class="title" tabindex="-1" data-step-title>Gute Nacht.</h2>
      <p class="lead">Lass den Tag hier liegen. Morgen geht es weiter.</p>
    </header>

    {#if eveningUi.entry}
      <section class="summary-card" aria-label="Dein Abend">
        <EveningSummary entry={eveningUi.entry} {morning} />
      </section>
    {/if}
  </div>

  <div class="foot">
    <button type="button" class="button" disabled={!arming.armed} onclick={closeEvening}>Fertig</button>
  </div>
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }

  .summary-card {
    padding: 18px;
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
    border-radius: 22px;
    background: var(--surface);
  }
</style>
