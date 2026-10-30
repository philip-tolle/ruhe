<script lang="ts">
  import Motiv from '../Motiv.svelte'
  import EveningSummary from './EveningSummary.svelte'
  import { eveningCard, eveningCount, eveningCountLine, eveningEntry, logbookDay, morningEntry } from '../../lib/evening/logic'
  import { stats } from '../../lib/stats/store.svelte'
  import { isSunday } from '../../lib/stats/summary'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { eveningUi, openEvening } from '../../lib/ui/evening-ui.svelte'
  import { appNow } from '../../lib/ui/tageszeit.svelte'

  // Die Abend-Karte auf „Heute“ (Spec M11 §2.1): „Tag abschließen“ von 18:00 bis 3:59, solange es für den Logbuch-Tag kein
  // Logbuch gibt, und „Dein Abend“ ab dem Logbuch bis 3:59 (außer im Morgen-Fenster). Welche, entscheidet `eveningCard`.
  // „Jetzt“ ist die Zeit der App (`appNow`): Sie rechnet mit jeder vollen Minute und bei der Rückkehr in die App neu, die
  // Karte wechselt also um 18:00, 0:00 und 4:00 auch bei einer App, die im Speicher blieb.
  const id = $props.id()

  const view = $derived.by(() => {
    const now = appNow()
    const evenings = stats.data.evenings ?? []
    const day = logbookDay(now)
    return {
      kind: eveningCard(evenings, now),
      day,
      entry: eveningEntry(evenings, day),
      morning: morningEntry(stats.data.mornings ?? [], day),
      count: eveningCount(evenings, now),
    }
  })

  // Nur die Art der Karte, als eigener Wert: `view` ist mit jeder vollen Minute ein neues Objekt.
  const kind = $derived(view.kind)

  // „Starten“ nimmt Tipps erst kurz nach dem Erscheinen an (siehe `tapArming`): Mit „Beenden“ in der Rückfrage schließt das
  // Logbuch, und ein schneller zweiter Tipp öffnete es sonst gleich wieder. Die Sperre beginnt neu, wenn die Karte wechselt
  // und wenn das Logbuch öffnet oder schließt.
  const arming = tapArming(() => `${kind}|${eveningUi.open}`)
</script>

{#if view.kind === 'tag-abschliessen'}
  <section class="card evening" aria-labelledby="{id}-title">
    <div class="head">
      <div class="text">
        <h2 class="kicker" id="{id}-title">Tag abschließen</h2>
        <p class="title">Wie war dein Tag?</p>
        <p class="sentence">Bilanz ziehen, Gelerntes festhalten, morgen 1 % besser.</p>
      </div>
      <Motiv id="vorschlag-abend" size={80} />
    </div>
    <button type="button" class="button start" disabled={!arming.armed} onclick={openEvening}>
      {isSunday(view.day) ? 'Mit Wochenrückblick · 5 Min' : 'Starten · 3 Min'}
    </button>
  </section>
{:else if view.kind === 'dein-abend' && view.entry}
  <section class="card evening" aria-labelledby="{id}-title">
    <div class="head">
      <div class="text">
        <h2 class="kicker" id="{id}-title">Dein Abend</h2>
        <p class="title">Tag abgeschlossen</p>
      </div>
      <Motiv id="vorschlag-abend" size={64} />
    </div>
    <EveningSummary entry={view.entry} morning={view.morning} />
    <p class="count">{eveningCountLine(view.count)}</p>
  </section>
{/if}

<style>
  /* Hervorgehoben wie die Morgen-Karte: Goldrand und ein Hauch Akzent. */
  .evening {
    width: 100%;
    gap: 14px;
    border-color: var(--gold-line-strong);
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--accent) 4%, transparent));
  }

  .kicker {
    color: var(--accent);
    font-family: var(--font-body), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .title {
    font-family: var(--font-display), Georgia, 'Times New Roman', serif;
    font-size: 1.375rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .sentence,
  .count {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .count {
    font-size: 0.8125rem;
  }

  .start {
    width: 100%;
    min-height: 52px;
    padding: 0 12px;
  }
</style>
