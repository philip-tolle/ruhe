<script lang="ts">
  import WordPicker from '../flow/WordPicker.svelte'
  import WeekSummary from './WeekSummary.svelte'
  import { ownFocus, weekRangeLine, weekReview } from '../../lib/evening/logic'
  import { FOCUS_MAX, FOCUS_SUGGESTIONS } from '../../lib/evening/words'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { draftEntry, eveningUi, nextEveningStep } from '../../lib/ui/evening-ui.svelte'

  // „Wochenrückblick“ (Spec M11 §2.3, Schritt 7, nur sonntags): die Woche bis heute, mit den Angaben dieses Abends, die noch
  // nicht gespeichert sind (`draftEntry`), und darunter die Wahl des Fokus für die nächste Woche.
  const arming = tapArming()

  const review = $derived(weekReview(stats.data.evenings ?? [], stats.data.mornings ?? [], eveningUi.day, draftEntry()))
  const own = $derived(ownFocus(stats.data.evenings ?? []))
</script>

<div class="step">
  <div class="content">
    <header class="head">
      <p class="kicker">Wochenrückblick</p>
      <h2 class="title" tabindex="-1" data-step-title>Deine Woche</h2>
      <p class="lead">{weekRangeLine(review)}</p>
    </header>

    <WeekSummary {review} />

    <h3 class="sub">Dein Fokus für nächste Woche</h3>
    <WordPicker
      label="Vorschläge"
      words={FOCUS_SUGGESTIONS}
      ownLabel="Deine Wörter"
      {own}
      fieldLabel="Eigenes Wort"
      placeholder="oder eigenes Wort"
      max={FOCUS_MAX}
      capitalize="sentences"
      value={eveningUi.draft.weekFocus}
      onChange={(value) => (eveningUi.draft.weekFocus = value)}
    />
  </div>

  <div class="foot">
    <button type="button" class="button" disabled={!arming.armed} onclick={nextEveningStep}>Weiter</button>
  </div>
</div>

<style>
  .sub {
    font-size: 1.25rem;
    line-height: 1.25;
  }
</style>
