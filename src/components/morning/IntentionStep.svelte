<script lang="ts">
  import { untrack } from 'svelte'
  import WordPicker from './WordPicker.svelte'
  import { AREA_INFO } from '../../lib/energy/areas'
  import { freshCheckin, weakestArea } from '../../lib/energy/insights'
  import { ownWords, suggestions } from '../../lib/morning/logic'
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
  const own = $derived(ownWords(stats.data.mornings ?? []))

  const word = $derived(morningUi.draft.intention.trim())

  // Die Zeile über „Weiter“ steht immer da; ansagen soll sie nur, wenn ein Wort gewählt wurde (Tipp auf einen Vorschlag),
  // nicht bei jedem Tastendruck im Feld. Darum sagt eine eigene, unsichtbare Live-Zeile an: Sie bekommt den Satz bei der Wahl
  // und leert sich, sobald im Feld getippt wird.
  const sentence = (chosen: string) => (chosen ? `Heute will ich ${chosen} sein.` : 'Wähle ein Wort oder tippe ein eigenes.')
  let announced = $state('')
</script>

<div class="step">
  <div class="content">
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
