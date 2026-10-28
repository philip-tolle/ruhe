<script lang="ts">
  import LevelDots from '../energy/LevelDots.svelte'
  import { AREAS, AREA_INFO, LEVEL_WORD, type EnergyArea, type EnergyLevel } from '../../lib/energy/areas'
  import { saveCheckin } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { energyUi } from '../../lib/ui/energy-ui.svelte'
  import { morningUi, nextStep } from '../../lib/ui/morning-ui.svelte'

  // Schritt 1, „Check-in“ (Spec M10 §2.3): dieselben vier Reihen wie im Check-in-Blatt (M9 §3.3). „Weiter“ gilt erst mit
  // allen vier Bereichen, speichert einen normalen Energie-Check-in und gibt ihn dem Ablauf mit: Er liefert den Bereich
  // der Intention und den Vorher-Wert der Übung. Der Schritt ist der erste: Ein Doppeltipp auf „Kurz“ oder „Lang“ träfe
  // mit dem zweiten Tipp sonst einen Punkt, der sich gerade an dieselbe Stelle legt (siehe `tapArming`).
  const arming = tapArming()

  let picked = $state<Partial<Record<EnergyArea, EnergyLevel>>>({})

  // Stufen sind 1 bis 5, also genügt die Wahrheitsprüfung, um jede Zeile als gesetzt zu erkennen.
  const levels = $derived.by(() => {
    const { koerper, gefuehl, geist, sinn } = picked
    return koerper && gefuehl && geist && sinn ? { koerper, gefuehl, geist, sinn } : null
  })

  function proceed() {
    if (!levels) return
    saveCheckin(levels)
    // Ein neuer Check-in ist eine neue Grundlage des Jetzt-Resets: Die Vorschläge fangen von vorn an.
    energyUi.resetSkip = 0
    morningUi.checkin = { ...levels }
    nextStep()
  }
</script>

<div class="step">
  <div class="content">
    <header class="head">
      <p class="kicker">Check-in</p>
      <h2 class="title" tabindex="-1" data-step-title>Wie voll ist dein Akku?</h2>
      <p class="lead">Ein Tipp je Bereich, 1 = leer, 5 = voll.</p>
    </header>

    <div class="rows">
      {#each AREAS as area (area)}
        {@const info = AREA_INFO[area]}
        {@const value = picked[area] ?? null}
        <div class="row">
          <p class="row-head">
            <span class="name" style:color="var(--area-{area}-text)">{info.title}</span>
            <!-- Das Wort ist für Hilfstechnik schon der gewählte Punkt; sichtbar steht es zur Bestätigung. -->
            <span class="word" aria-hidden="true">{value ? LEVEL_WORD[value] : '–'}</span>
          </p>
          <p class="question">{info.question}</p>
          <LevelDots {area} {value} disabled={!arming.armed} onPick={(level) => (picked[area] = level)} />
        </div>
      {/each}
    </div>
  </div>

  <div class="foot">
    <button type="button" class="button" class:inactive={!levels} disabled={!levels || !arming.armed} onclick={proceed}>Weiter</button>
  </div>
</div>

<style>
  /* Dämpft nur, was fehlt (nicht alle vier gesetzt), nicht die kurze Sperre nach dem Einblenden. */
  .inactive {
    opacity: 0.45;
    box-shadow: none;
  }

  .rows {
    display: flex;
    flex-direction: column;
  }

  /* Jede Zeile über einer feinen Goldlinie, wie im Check-in-Blatt. */
  .row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 0 4px;
    border-top: 1px solid var(--gold-line);
  }

  .row-head {
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
</style>
