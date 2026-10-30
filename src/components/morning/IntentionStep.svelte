<script lang="ts">
  import { untrack } from 'svelte'
  import WordPicker from '../flow/WordPicker.svelte'
  import { AREA_INFO } from '../../lib/energy/areas'
  import { morningReminder } from '../../lib/evening/logic'
  import { freshCheckin, weakestArea } from '../../lib/energy/insights'
  import { intentionSentence, ownWords, suggestions } from '../../lib/morning/logic'
  import { INTENTION_MAX } from '../../lib/morning/words'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { morningUi, nextStep } from '../../lib/ui/morning-ui.svelte'
  import { appNow } from '../../lib/ui/tageszeit.svelte'

  // „Intention“ (Spec M10 §2.3): „Wie willst du heute sein?“ mit sechs Vorschlägen zum Bereich, der am niedrigsten ist.
  // Den Bereich liefert der Check-in aus dem Ablauf; ohne ihn ein frischer Check-in (M9 §6.1); ohne beide gelten die
  // Standardwörter und die Zeile über den Akku entfällt. „Weiter“ liegt an der Stelle des „Weiter“ des Schritts davor
  // (siehe `tapArming`).
  const arming = tapArming()

  // Der Bereich wird beim Einblenden einmal festgehalten (`untrack`): Der Check-in „frisch“ rechnet mit der Uhr, und die
  // Daten können sich ändern (ein Check-in aus dem Blatt, der Schritt hängt Stunden im Speicher). Die Vorschläge und die
  // Zeile über den Akku wechseln nicht unter den Fingern, solange man auf dem Schritt ist.
  const area = untrack(() => {
    const levels = morningUi.checkin ?? freshCheckin(stats.data.energyCheckins ?? [], appNow())?.levels ?? null
    return levels ? weakestArea(levels) : null
  })
  const words = suggestions(area)

  // Der Kasten aus dem Abend-Logbuch (Spec M11 §2.4): der 1-%-Satz von gestern und der Wochenfokus, ebenfalls beim
  // Einblenden festgehalten. Ohne beides entfällt er.
  const reminder = untrack(() => morningReminder(stats.data.evenings ?? [], appNow()))
  const own = $derived(ownWords(stats.data.mornings ?? []))

  const word = $derived(morningUi.draft.intention.trim())

  // Die Zeile über „Weiter“ steht immer da; ansagen soll sie nur, wenn ein Wort gewählt wurde (Tipp auf einen Vorschlag),
  // nicht bei jedem Tastendruck im Feld. Darum sagt eine eigene, unsichtbare Live-Zeile an: Sie bekommt den Satz bei der Wahl
  // und leert sich, sobald im Feld getippt wird.
  const sentence = (chosen: string) => (chosen ? intentionSentence(chosen) : 'Wähle ein Wort oder tippe ein eigenes.')
  let announced = $state('')
</script>

<div class="step">
  <div class="content">
    {#if reminder.better || reminder.weekFocus}
      <section class="reminder" aria-label="Von gestern Abend">
        {#if reminder.better}
          <div class="reminder-row">
            <p class="reminder-label">Gestern vorgenommen</p>
            <p class="reminder-text">{reminder.better}</p>
          </div>
        {/if}
        {#if reminder.weekFocus}
          <div class="reminder-row">
            <p class="reminder-label">Wochenfokus</p>
            <p class="reminder-text accent">{reminder.weekFocus}</p>
          </div>
        {/if}
      </section>
    {/if}

    <header class="head">
      <p class="kicker">Intention</p>
      <h2 class="title" tabindex="-1" data-step-title>Wie willst du heute sein?</h2>
      {#if area}
        <p class="lead">Dein {AREA_INFO[area].title}-Akku ist gerade am niedrigsten.</p>
      {/if}
    </header>

    <WordPicker
      label="Vorschläge"
      {words}
      ownLabel="Deine Wörter"
      {own}
      fieldLabel="Eigenes Wort"
      placeholder="z. B. großzügig"
      max={INTENTION_MAX}
      capitalize="none"
      value={morningUi.draft.intention}
      onChange={(value, via) => {
        morningUi.draft.intention = value
        announced = via === 'chip' ? sentence(value.trim()) : ''
      }}
    />
  </div>

  <div class="foot">
    <p class="summary">{sentence(word)}</p>
    <p class="visually-hidden" aria-live="polite">{announced}</p>
    <button type="button" class="button" disabled={!arming.armed} onclick={nextStep}>Weiter</button>
  </div>
</div>

<style>
  /* Der Kasten aus dem Abend-Logbuch: reiner Text auf eigener Fläche mit Goldrand. */
  .reminder {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    border: 1px solid var(--gold-line-strong);
    border-radius: 18px;
    background: var(--surface);
  }

  .reminder-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .reminder-label {
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .reminder-text {
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .reminder-text.accent {
    color: var(--accent);
  }
</style>
