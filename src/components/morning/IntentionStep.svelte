<script lang="ts">
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

  const levels = $derived(morningUi.checkin ?? freshCheckin(stats.data.energyCheckins ?? [], appNow())?.levels ?? null)
  const area = $derived(levels ? weakestArea(levels) : null)
  const own = $derived(ownWords(stats.data.mornings ?? []))

  const word = $derived(morningUi.draft.intention.trim())
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
      words={suggestions(area)}
      ownLabel="Deine Wörter"
      {own}
      fieldLabel="Eigenes Wort"
      placeholder="z. B. großzügig"
      max={INTENTION_MAX}
      capitalize="none"
      value={morningUi.draft.intention}
      onChange={(value) => (morningUi.draft.intention = value)}
    />
  </div>

  <div class="foot">
    <p class="summary" aria-live="polite">{word ? `Heute will ich ${word} sein.` : 'Wähle ein Wort oder tippe ein eigenes.'}</p>
    <button type="button" class="button" disabled={!arming.armed} onclick={nextStep}>Weiter</button>
  </div>
</div>
