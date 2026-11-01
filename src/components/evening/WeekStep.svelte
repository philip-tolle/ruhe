<script lang="ts">
  import WordPicker from '../flow/WordPicker.svelte'
  import WeekSummary from './WeekSummary.svelte'
  import { ownFocus, weekRangeLine, weekReview } from '../../lib/evening/logic'
  import { FOCUS_MAX, FOCUS_SUGGESTIONS } from '../../lib/evening/words'
  import { sundayChoices } from '../../lib/principles/logic'
  import { stats } from '../../lib/stats/store.svelte'
  import { tapArming } from '../../lib/ui/arming.svelte'
  import { draftEntry, eveningUi, nextEveningStep } from '../../lib/ui/evening-ui.svelte'

  // „Wochenrückblick“ (Spec M11 §2.3, Schritt 7, nur sonntags): die Woche bis heute, mit den Angaben dieses Abends, die noch
  // nicht gespeichert sind (`draftEntry`), und darunter die Wahl des Fokus für die nächste Woche. Mit Prinzipien (Spec M12
  // §2.6) steht „Deine Prinzipien“ als erste Gruppe da; Vorschläge und eigene Wörter, die wie ein Leitsatz heißen, entfallen.
  // Es gilt genau eine Wahl: ein Wort leert das Prinzip, ein Prinzip das Wort.
  const arming = tapArming()

  const review = $derived(weekReview(stats.data.evenings ?? [], stats.data.mornings ?? [], eveningUi.day, draftEntry()))
  const choices = $derived(sundayChoices(FOCUS_SUGGESTIONS, ownFocus(stats.data.evenings ?? []), stats.data.collection ?? []))
  const principles = $derived((stats.data.collection ?? []).filter((item) => item.kind === 'prinzip').map(({ id, text }) => ({ id, text })))
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
      words={choices.suggestions}
      ownLabel="Deine Wörter"
      own={choices.own}
      fieldLabel="Eigenes Wort"
      placeholder="oder eigenes Wort"
      max={FOCUS_MAX}
      capitalize="sentences"
      value={eveningUi.draft.weekFocus}
      onChange={(value) => {
        eveningUi.draft.weekFocus = value
        eveningUi.draft.weekPrinciple = null
      }}
      refLabel="Deine Prinzipien"
      refs={principles}
      refValue={eveningUi.draft.weekPrinciple}
      onRef={(id) => {
        eveningUi.draft.weekPrinciple = id
        eveningUi.draft.weekFocus = ''
      }}
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
