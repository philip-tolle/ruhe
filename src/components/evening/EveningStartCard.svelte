<script lang="ts">
  import Motiv from '../Motiv.svelte'
  import { eveningEntry, logbookDay } from '../../lib/evening/logic'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { eveningUi, openEvening } from '../../lib/ui/evening-ui.svelte'
  import { appNow } from '../../lib/ui/tageszeit.svelte'

  // Karte „Abend-Logbuch“ im Reiter „Energie“ (Spec M11 §2.2): zu jeder Stunde startbar. Gibt es für den Logbuch-Tag schon
  // einen Eintrag, sagt der Satz, dass ein neuer Durchgang die Angaben ersetzt. „Jetzt“ ist die Zeit der App (`appNow`).
  const id = $props.id()

  // „Starten“ nimmt Tipps erst kurz nach dem Erscheinen an (siehe `tapArming`): Mit „Fertig“ im Abschluss oder „Beenden“ in
  // der Rückfrage schließt der Ablauf, und der zweite Tipp eines Doppeltipps öffnete ihn sonst gleich wieder. Die Sperre
  // beginnt neu, wenn der Ablauf öffnet oder schließt.
  const arming = tapArming(() => eveningUi.open)

  const done = $derived(eveningEntry(stats.data.evenings ?? [], logbookDay(appNow())) !== null)
</script>

<section class="card evening" aria-labelledby="{id}-title">
  <div class="head">
    <Motiv id="vorschlag-abend" size={56} />
    <div class="text">
      <p class="kicker">Abend-Logbuch</p>
      <h2 id="{id}-title">Tag abschließen</h2>
      <p class="sentence">{done ? 'Heute schon gemacht. Ein neuer Durchgang ersetzt die Angaben.' : 'Jederzeit Bilanz ziehen.'}</p>
    </div>
  </div>

  <button type="button" class="button-line start" disabled={!arming.armed} onclick={openEvening}>Starten</button>
</section>

<style>
  .evening {
    width: 100%;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .kicker {
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .sentence {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
  }

  .start {
    width: 100%;
  }
</style>
