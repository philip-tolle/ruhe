<script lang="ts">
  import Sheet from '../Sheet.svelte'
  import LevelDots from './LevelDots.svelte'
  import { AREAS, AREA_INFO, LEVEL_WORD, type EnergyArea, type EnergyLevel } from '../../lib/energy/areas'
  import { saveCheckin } from '../../lib/stats/store.svelte'
  import { closeCheckIn } from '../../lib/ui/energy-ui.svelte'

  // Energie-Check-in als Blatt von unten (Spec M9 §3.3). Jede Zeile beginnt leer: Das Blatt wird nur bei
  // offenem Blatt eingehängt (App.svelte), also fängt jedes Öffnen von vorn an. „Speichern“ gilt erst mit
  // allen vier Bereichen; „Später“, die Zurück-Geste und Tippen daneben schließen ohne Speichern (Sheet).
  let picked = $state<Partial<Record<EnergyArea, EnergyLevel>>>({})

  // Stufen sind 1 bis 5, also genügt die Wahrheitsprüfung, um jede Zeile als gesetzt zu erkennen.
  const levels = $derived.by(() => {
    const { koerper, gefuehl, geist, sinn } = picked
    return koerper && gefuehl && geist && sinn ? { koerper, gefuehl, geist, sinn } : null
  })

  function save() {
    if (!levels) return
    saveCheckin(levels)
    closeCheckIn()
  }
</script>

<Sheet title="Wie voll ist dein Akku?" onClose={closeCheckIn}>
  <p class="sub">Ein Tipp je Bereich, 1 = leer, 5 = voll.</p>

  <div class="rows">
    {#each AREAS as area (area)}
      {@const info = AREA_INFO[area]}
      {@const value = picked[area] ?? null}
      <div class="row">
        <p class="head">
          <span class="name" style:color="var(--area-{area}-text)">{info.title}</span>
          <!-- Das Wort ist für Hilfstechnik schon der gewählte Punkt; sichtbar steht es zur Bestätigung. -->
          <span class="word" aria-hidden="true">{value ? LEVEL_WORD[value] : '–'}</span>
        </p>
        <p class="question">{info.question}</p>
        <LevelDots {area} {value} onPick={(level) => (picked[area] = level)} />
      </div>
    {/each}
  </div>

  <div class="actions">
    <button type="button" class="button save" disabled={!levels} onclick={save}>Speichern</button>
    <button type="button" class="later" onclick={closeCheckIn}>Später</button>
  </div>
</Sheet>

<style>
  .sub {
    margin-top: -12px;
    color: var(--text-muted);
    font-size: 0.9375rem;
  }

  /* Jede Zeile über einer feinen Goldlinie, wie die Zeilen der Ruhe-Karte. */
  .rows {
    display: flex;
    flex-direction: column;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 0 4px;
    border-top: 1px solid var(--gold-line);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0 12px;
  }

  .name {
    font-size: 1.0625rem;
    font-weight: 700;
  }

  .word {
    font-size: 0.875rem;
    font-weight: 700;
  }

  .question {
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1.35;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .save {
    width: 100%;
  }

  .save:disabled {
    opacity: 0.45;
    box-shadow: none;
    cursor: default;
  }

  .later {
    min-height: 48px;
    border: 0;
    background: none;
    color: var(--text-muted);
    font-weight: 700;
  }
</style>
