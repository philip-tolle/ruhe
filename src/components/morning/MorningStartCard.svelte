<script lang="ts">
  import Motiv from '../Motiv.svelte'
  import { todayEntry } from '../../lib/morning/logic'
  import { stats } from '../../lib/stats/store.svelte'
  import { openMorning } from '../../lib/ui/morning-ui.svelte'
  import { appNow } from '../../lib/ui/tageszeit.svelte'

  // Karte „Morgen-Start“ im Reiter „Energie“ (Spec M10 §2.2): kurz oder lang, zu jeder Stunde. Gibt es heute schon einen
  // Eintrag, sagt der Satz, dass ein neuer Durchgang die Angaben ersetzt; die Knöpfe bleiben. „Heute“ ist die Zeit der App
  // (`appNow`): Mit Mitternacht endet „heute schon gemacht“ auch bei offener App. Der Start läuft im Tipp selbst.
  const id = $props.id()

  const done = $derived(todayEntry(stats.data.mornings ?? [], appNow()) !== null)
</script>

<section class="card morning" aria-labelledby="{id}-title">
  <div class="head">
    <Motiv id="vorschlag-morgen" size={56} />
    <div class="text">
      <h2 id="{id}-title">Morgen-Start</h2>
      <p class="sentence">
        {done ? 'Heute schon gemacht. Ein neuer Durchgang ersetzt die Angaben.' : 'Kurz oder lang, jederzeit.'}
      </p>
    </div>
  </div>

  <div class="actions">
    <button type="button" class="button-line" onclick={() => openMorning('kurz')}>Kurz · 5 Min</button>
    <button type="button" class="button-line" onclick={() => openMorning('lang')}>Lang · 15 Min</button>
  </div>
</section>

<style>
  .morning {
    width: 100%;
  }

  /* Das Motiv links, daneben Titel und Satz; beide brechen notfalls um, das Motiv behält seine Fläche. */
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

  .sentence {
    color: var(--text-muted);
    font-size: 0.9375rem;
    line-height: 1.4;
  }

  /* Zwei Knöpfe nebeneinander, solange sie passen („Lang · 15 Min“ bricht nie in zwei Zeilen); bei großer Schrift
     rutscht der zweite darunter. */
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    width: 100%;
  }

  .actions .button-line {
    flex: 1 1 8rem;
    min-width: 0;
    padding: 0 12px;
    white-space: nowrap;
  }
</style>
